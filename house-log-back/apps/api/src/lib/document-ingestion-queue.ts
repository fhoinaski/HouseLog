import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { PropertyDocumentExtractionSchema } from '@houselog/contracts';
import {
  documentExtractionReviews,
  documentExtractions,
  documentIngestionJobs,
} from '../db/schema';
import type { AppDb } from '../db/client';
import type { DocumentIngestionQueueMessage } from './types';

const DocumentIngestionQueueMessageSchema = z
  .object({
    tenantId: z.string().min(1),
    propertyId: z.string().min(1),
    documentId: z.string().min(1),
    jobId: z.string().min(1),
  })
  .strict();

export const FAKE_DOCUMENT_INGESTION_MODEL_NAME = 'fake-document-ingestion-v1';
export const FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION = 'v1';
export const FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE = 0.72;
export const DOCUMENT_INGESTION_REVIEW_CONFIDENCE_THRESHOLD = 0.8;

type FakeDocumentIngestionFinalStatus = 'completed' | 'needs_review';

export type FakeDocumentIngestionProcessingPlan = {
  extractionId: string;
  reviewId: string | null;
  finalJobStatus: FakeDocumentIngestionFinalStatus;
  confidenceScore: number;
  rawText: string;
  rawJson: Record<string, unknown>;
  normalizedJson: Record<string, unknown>;
  reviewNotes: string | null;
};

export type FakeDocumentIngestionProcessResult =
  | {
      processed: true;
      jobId: string;
      extractionId: string;
      reviewId: string | null;
      status: FakeDocumentIngestionFinalStatus;
    }
  | {
      processed: false;
      jobId: string;
      reason: 'job_not_found' | 'job_not_processable';
      status?: string;
    };

export function parseDocumentIngestionQueueMessage(
  body: unknown
): DocumentIngestionQueueMessage | null {
  const parsed = DocumentIngestionQueueMessageSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export function isDocumentIngestionQueueMessage(
  body: unknown
): body is DocumentIngestionQueueMessage {
  return parseDocumentIngestionQueueMessage(body) !== null;
}

export function buildFakeDocumentIngestionProcessingPlan(input: {
  extractionId: string;
  reviewId: string;
}): FakeDocumentIngestionProcessingPlan {
  const normalizedExtraction = PropertyDocumentExtractionSchema.parse({
    documentType: 'other',
    summary: 'Extracao simulada para validar o pipeline de ingestao inteligente.',
    language: 'pt-BR',
    confidenceScore: FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
    technicalSystems: [],
    warranties: [],
    inventoryItems: [],
    maintenanceRecommendations: [
      {
        systemType: 'general',
        title: 'Revisar documento tecnico importado',
        description:
          'Recomendacao simulada criada sem leitura real do arquivo, apenas para validar o fluxo de ingestao.',
        recommendedIntervalMonths: 12,
        priority: 'medium',
        standardReference: 'HouseLog P2-AI-10 simulated consumer',
        confidenceScore: FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
        evidence: [
          {
            text: 'Conteudo simulado pelo consumer fake da fila de ingestao.',
            confidenceScore: FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
            fieldPath: 'maintenanceRecommendations[0]',
          },
        ],
      },
    ],
    detectedDates: [],
    warnings: ['Extracao simulada: nenhum arquivo foi lido e nenhuma IA real foi chamada.'],
    evidence: [
      {
        text: 'Registro fake gerado para teste ponta a ponta do pipeline.',
        confidenceScore: FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
      },
    ],
    schemaVersion: FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
  });

  const requiresReview =
    normalizedExtraction.confidenceScore < DOCUMENT_INGESTION_REVIEW_CONFIDENCE_THRESHOLD;

  return {
    extractionId: input.extractionId,
    reviewId: requiresReview ? input.reviewId : null,
    finalJobStatus: requiresReview ? 'needs_review' : 'completed',
    confidenceScore: normalizedExtraction.confidenceScore,
    rawText: 'Conteudo simulado pelo consumer fake da fila de ingestao de documentos.',
    rawJson: {
      simulated: true,
      modelName: FAKE_DOCUMENT_INGESTION_MODEL_NAME,
      schemaVersion: FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
    },
    normalizedJson: normalizedExtraction,
    reviewNotes: requiresReview
      ? 'Revisao humana necessaria pela confianca simulada abaixo do limiar.'
      : null,
  };
}

export async function processFakeDocumentIngestionQueueMessage(
  db: AppDb,
  message: DocumentIngestionQueueMessage,
  options: {
    now?: string;
    idFactory?: () => string;
  } = {}
): Promise<FakeDocumentIngestionProcessResult> {
  const parsedMessage = DocumentIngestionQueueMessageSchema.parse(message);
  const now = options.now ?? new Date().toISOString();
  const idFactory = options.idFactory ?? nanoid;

  const [job] = await db
    .select({
      id: documentIngestionJobs.id,
      tenantId: documentIngestionJobs.tenantId,
      propertyId: documentIngestionJobs.propertyId,
      documentId: documentIngestionJobs.documentId,
      status: documentIngestionJobs.status,
      attempts: documentIngestionJobs.attempts,
      startedAt: documentIngestionJobs.startedAt,
    })
    .from(documentIngestionJobs)
    .where(
      and(
        eq(documentIngestionJobs.id, parsedMessage.jobId),
        eq(documentIngestionJobs.tenantId, parsedMessage.tenantId),
        eq(documentIngestionJobs.propertyId, parsedMessage.propertyId),
        eq(documentIngestionJobs.documentId, parsedMessage.documentId)
      )
    )
    .limit(1);

  if (!job) {
    return { processed: false, jobId: parsedMessage.jobId, reason: 'job_not_found' };
  }

  if (job.status !== 'queued' && job.status !== 'processing') {
    return {
      processed: false,
      jobId: parsedMessage.jobId,
      reason: 'job_not_processable',
      status: job.status,
    };
  }

  await db
    .update(documentIngestionJobs)
    .set({
      status: 'processing',
      attempts: (job.attempts ?? 0) + 1,
      lastError: null,
      startedAt: job.startedAt ?? now,
      updatedAt: now,
    })
    .where(eq(documentIngestionJobs.id, job.id));

  const plan = buildFakeDocumentIngestionProcessingPlan({
    extractionId: idFactory(),
    reviewId: idFactory(),
  });

  await db.insert(documentExtractions).values({
    id: plan.extractionId,
    tenantId: job.tenantId,
    propertyId: job.propertyId,
    documentId: job.documentId,
    jobId: job.id,
    rawText: plan.rawText,
    rawJson: plan.rawJson,
    normalizedJson: plan.normalizedJson,
    confidenceScore: plan.confidenceScore,
    schemaVersion: FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
    modelName: FAKE_DOCUMENT_INGESTION_MODEL_NAME,
    createdAt: now,
  });

  if (plan.reviewId) {
    await db.insert(documentExtractionReviews).values({
      id: plan.reviewId,
      tenantId: job.tenantId,
      propertyId: job.propertyId,
      documentId: job.documentId,
      extractionId: plan.extractionId,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      notes: plan.reviewNotes,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(documentIngestionJobs)
    .set({
      status: plan.finalJobStatus,
      finishedAt: now,
      updatedAt: now,
    })
    .where(eq(documentIngestionJobs.id, job.id));

  return {
    processed: true,
    jobId: job.id,
    extractionId: plan.extractionId,
    reviewId: plan.reviewId,
    status: plan.finalJobStatus,
  };
}
