import { describe, expect, it } from 'vitest';
import { PropertyDocumentExtractionSchema } from '@houselog/contracts';
import {
  DOCUMENT_INGESTION_REVIEW_CONFIDENCE_THRESHOLD,
  FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
  FAKE_DOCUMENT_INGESTION_MODEL_NAME,
  FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
  buildFakeDocumentIngestionProcessingPlan,
  isDocumentIngestionQueueMessage,
  parseDocumentIngestionQueueMessage,
} from './document-ingestion-queue';

const validQueueMessage = {
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-a',
};

describe('document ingestion Queue consumer message', () => {
  it('aceita somente a mensagem minima da fila de ingestao', () => {
    expect(parseDocumentIngestionQueueMessage(validQueueMessage)).toEqual(validQueueMessage);
    expect(isDocumentIngestionQueueMessage(validQueueMessage)).toBe(true);
  });

  it('rejeita mensagens comuns de outras filas com campo type', () => {
    expect(
      isDocumentIngestionQueueMessage({
        type: 'GENERATE_THUMBNAIL',
        r2Key: 'private/key.pdf',
        itemId: 'item-a',
        itemType: 'document',
      })
    ).toBe(false);
  });

  it('rejeita mensagem de ingestao com campo extra', () => {
    expect(
      parseDocumentIngestionQueueMessage({
        ...validQueueMessage,
        fileUrl: 'https://storage.example/private.pdf',
      })
    ).toBeNull();
  });

  it('rejeita mensagem incompleta', () => {
    expect(
      parseDocumentIngestionQueueMessage({
        tenantId: 'tenant-a',
        propertyId: 'prop-a',
        documentId: 'doc-a',
      })
    ).toBeNull();
  });
});

describe('fake document ingestion processing plan', () => {
  it('gera normalizedJson valido pelo contract de extracao tecnica', () => {
    const plan = buildFakeDocumentIngestionProcessingPlan({
      extractionId: 'ext-a',
      reviewId: 'review-a',
    });

    expect(() => PropertyDocumentExtractionSchema.parse(plan.normalizedJson)).not.toThrow();
    expect(plan.normalizedJson).toMatchObject({
      documentType: 'other',
      schemaVersion: FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
      confidenceScore: FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE,
    });
  });

  it('cria review pendente quando a confianca simulada fica abaixo do limiar', () => {
    const plan = buildFakeDocumentIngestionProcessingPlan({
      extractionId: 'ext-a',
      reviewId: 'review-a',
    });

    expect(FAKE_DOCUMENT_INGESTION_CONFIDENCE_SCORE).toBeLessThan(
      DOCUMENT_INGESTION_REVIEW_CONFIDENCE_THRESHOLD
    );
    expect(plan.finalJobStatus).toBe('needs_review');
    expect(plan.reviewId).toBe('review-a');
    expect(plan.reviewNotes).toContain('Revisao humana necessaria');
  });

  it('marca rawJson como simulado e nao inclui conteudo privado de arquivo', () => {
    const plan = buildFakeDocumentIngestionProcessingPlan({
      extractionId: 'ext-a',
      reviewId: 'review-a',
    });

    expect(plan.rawJson).toEqual({
      simulated: true,
      modelName: FAKE_DOCUMENT_INGESTION_MODEL_NAME,
      schemaVersion: FAKE_DOCUMENT_INGESTION_SCHEMA_VERSION,
    });
    expect(plan.rawJson).not.toHaveProperty('fileUrl');
    expect(plan.rawJson).not.toHaveProperty('r2Key');
  });

  it('nao inclui tenantId, propertyId, documentId ou jobId no normalizedJson', () => {
    const plan = buildFakeDocumentIngestionProcessingPlan({
      extractionId: 'ext-a',
      reviewId: 'review-a',
    });

    expect(plan.normalizedJson).not.toHaveProperty('tenantId');
    expect(plan.normalizedJson).not.toHaveProperty('propertyId');
    expect(plan.normalizedJson).not.toHaveProperty('documentId');
    expect(plan.normalizedJson).not.toHaveProperty('jobId');
  });
});
