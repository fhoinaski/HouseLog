import { describe, expect, it, vi } from 'vitest';
import { ListDocumentExtractionCandidatesQuerySchema, PropertyDocumentExtractionSchema } from '@houselog/contracts';
import {
  buildDocumentExtractionCandidates,
  buildDocumentExtractionCandidatesAuditData,
  buildDocumentExtractionCandidateAppliedAuditData,
  buildDocumentExtractionCandidateApplyPatch,
  buildDocumentExtractionCandidateReviewAuditData,
  buildDocumentExtractionCandidateReviewPatch,
  buildDocumentExtractionReviewAuditData,
  buildDocumentExtractionReviewJobPatch,
  buildDocumentIngestionQueueFailurePatch,
  buildDocumentIngestionQueueMessage,
  buildDocumentIngestionSummary,
  buildPropertyDocumentIngestionSummary,
  buildInventoryItemFromCandidatePayload,
  buildMaintenanceScheduleFromCandidatePayload,
  buildTechnicalSystemFromCandidatePayload,
  buildWarrantyFromCandidatePayload,
  canAccessDocumentExtractionCandidate,
  canAccessExtractionDetail,
  canApplyDocumentExtractionCandidate,
  canApplyTechnicalSystemCandidate,
  canGenerateDocumentExtractionCandidates,
  canReviewDocumentExtractionCandidate,
  canAccessDocumentForIngestion,
  canCreateIngestionJob,
  canAccessIngestionJobDetail,
  enqueueDocumentIngestionJob,
  getDocumentExtractionDetail,
  getDocumentIngestionJobDetail,
  mapRecommendedIntervalMonthsToFrequency,
  mapExtractionToDetail,
  mapExtractionToSummary,
  mapAppliedInventoryItemToResponse,
  mapAppliedMaintenanceScheduleToResponse,
  mapAppliedTechnicalSystemToResponse,
  mapAppliedWarrantyToResponse,
  mapDocumentExtractionCandidateToContract,
  mapReviewToContract,
  listDocumentExtractionCandidatesForExtraction,
  listDocumentIngestionJobsForDocument,
  sanitizeDocumentIngestionQueueError,
  type DocumentExtractionCandidateRow,
  type DocumentExtractionReviewRow,
  type ExtractionDetailInput,
  type DocumentIngestionJobListRow,
  type DocumentIngestionSummaryCandidateRow,
  type DocumentIngestionSummaryExtractionRow,
  type DocumentIngestionSummaryJobRow,
  type DocumentIngestionSummaryReviewRow,
  type ExtractionSummaryInput,
  type PropertyDocumentIngestionSummaryCandidateRow,
  type PropertyDocumentIngestionSummaryDocumentRow,
  type PropertyDocumentIngestionSummaryExtractionRow,
  type PropertyDocumentIngestionSummaryJobRow,
  type PropertyDocumentIngestionSummaryReviewRow,
} from './document-ingestion-tenant';
import type { DocumentIngestionQueueMessage } from './types';

// ── canAccessDocumentForIngestion ─────────────────────────────────────────────

const validDocAccess = {
  activeTenantId: 'tenant-a',
  documentTenantId: 'tenant-a',
  documentPropertyId: 'prop-a',
  requestedPropertyId: 'prop-a',
  documentDeletedAt: null,
};

describe('canAccessDocumentForIngestion', () => {
  it('permite criar job para documento valido no mesmo tenant e property', () => {
    expect(canAccessDocumentForIngestion(validDocAccess)).toEqual({ allowed: true });
  });

  it('retorna 404 para documento inexistente (documentTenantId null)', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento de outro tenant', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento de outro property', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentPropertyId: 'prop-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento soft-deleted', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentDeletedAt: '2025-01-01T00:00:00Z' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 400 quando nao ha tenant ativo', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, activeTenantId: null })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('nao expoe documento de tenant legado com tenant_id null', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('bloqueia acesso mesmo com documentPropertyId correto se tenant divergir', () => {
    expect(
      canAccessDocumentForIngestion({
        activeTenantId: 'tenant-a',
        documentTenantId: 'tenant-b',
        documentPropertyId: 'prop-a',
        requestedPropertyId: 'prop-a',
        documentDeletedAt: null,
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

// ── canCreateIngestionJob ─────────────────────────────────────────────────────

describe('canCreateIngestionJob', () => {
  it('permite criar job quando nao ha job ativo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: null })).toEqual({ allowed: true });
  });

  it('permite criar job quando anterior esta completed, failed ou cancelled (existingActiveJobId null)', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: undefined })).toEqual({ allowed: true });
  });

  it('impede job duplicado quando ja existe job com status ativo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: 'job_active_123' })).toEqual({
      allowed: false,
      status: 409,
      code: 'ACTIVE_JOB_EXISTS',
    });
  });

  it('impede job duplicado para qualquer id de job ativo nao nulo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: 'job_queued_xyz' })).toEqual({
      allowed: false,
      status: 409,
      code: 'ACTIVE_JOB_EXISTS',
    });
  });
});

// ── listDocumentIngestionJobsForDocument ──────────────────────────────────────

const queuePayloadInput = {
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-a',
};

describe('document ingestion Queue producer', () => {
  it('monta mensagem minima com somente tenantId, propertyId, documentId e jobId', () => {
    const message = buildDocumentIngestionQueueMessage(queuePayloadInput);

    expect(message).toEqual({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
    });
    expect(Object.keys(message).sort()).toEqual(['documentId', 'jobId', 'propertyId', 'tenantId']);
  });

  it('nao inclui fileUrl, R2 key nem conteudo extraido na mensagem', () => {
    const message = buildDocumentIngestionQueueMessage(queuePayloadInput);

    expect(message).not.toHaveProperty('fileUrl');
    expect(message).not.toHaveProperty('r2Key');
    expect(message).not.toHaveProperty('rawText');
    expect(message).not.toHaveProperty('rawJson');
    expect(message).not.toHaveProperty('normalizedJson');
  });

  it('chama DOCUMENT_INGESTION_QUEUE.send com a mensagem minima', async () => {
    const send = vi.fn<Queue<DocumentIngestionQueueMessage>['send']>().mockResolvedValue({} as QueueSendResponse);
    const queue = { send } as unknown as Queue<DocumentIngestionQueueMessage>;

    const message = await enqueueDocumentIngestionJob(queue, queuePayloadInput);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
    });
    expect(message).toEqual(send.mock.calls[0]?.[0]);
  });

  it('sanitiza erro de Queue sem expor URL nem token longo', () => {
    const sanitized = sanitizeDocumentIngestionQueueError(
      new Error('Queue failed https://storage.example/private.pdf token abcdefghijklmnopqrstuvwxyzABCDEF123456')
    );

    expect(sanitized).toContain('Queue failed');
    expect(sanitized).not.toContain('https://storage.example/private.pdf');
    expect(sanitized).not.toContain('abcdefghijklmnopqrstuvwxyzABCDEF123456');
    expect(sanitized.length).toBeLessThanOrEqual(240);
  });

  it('monta patch failed com lastError sanitizado e updatedAt quando a Queue falha', () => {
    const patch = buildDocumentIngestionQueueFailurePatch(
      new Error('Queue failed https://storage.example/private.pdf abcdefghijklmnopqrstuvwxyzABCDEF123456'),
      '2026-05-08T00:00:00.000Z'
    );

    expect(patch.status).toBe('failed');
    expect(patch.updatedAt).toBe('2026-05-08T00:00:00.000Z');
    expect(patch.lastError).toContain('Queue failed');
    expect(patch.lastError).not.toContain('https://storage.example/private.pdf');
    expect(patch.lastError).not.toContain('abcdefghijklmnopqrstuvwxyzABCDEF123456');
  });
});

describe('buildDocumentIngestionSummary', () => {
  const jobs: DocumentIngestionSummaryJobRow[] = [
    { status: 'queued', createdAt: '2026-05-07T10:00:00.000Z' },
    { status: 'failed', createdAt: '2026-05-07T11:00:00.000Z' },
    { status: 'completed', createdAt: '2026-05-08T10:00:00.000Z' },
  ];
  const extractions: DocumentIngestionSummaryExtractionRow[] = [
    { id: 'ext-001' },
    { id: 'ext-002' },
  ];
  const reviews: DocumentIngestionSummaryReviewRow[] = [
    { status: 'pending' },
    { status: 'approved' },
    { status: 'rejected' },
  ];
  const candidates: DocumentIngestionSummaryCandidateRow[] = [
    { status: 'pending' },
    { status: 'approved' },
    { status: 'approved' },
    { status: 'rejected' },
    { status: 'applied' },
    { status: 'superseded' },
  ];

  it('retorna resumo vazio para documento sem ingestao', () => {
    expect(buildDocumentIngestionSummary({
      jobs: [],
      extractions: [],
      reviews: [],
      candidates: [],
    })).toEqual({
      totalJobs: 0,
      latestJobStatus: null,
      totalExtractions: 0,
      totalReviews: 0,
      pendingReviews: 0,
      totalCandidates: 0,
      pendingCandidates: 0,
      approvedCandidates: 0,
      rejectedCandidates: 0,
      appliedCandidates: 0,
      failedJobs: 0,
      lastIngestionAt: null,
    });
  });

  it('conta jobs e identifica latestJobStatus', () => {
    const summary = buildDocumentIngestionSummary({ jobs, extractions: [], reviews: [], candidates: [] });

    expect(summary.totalJobs).toBe(3);
    expect(summary.latestJobStatus).toBe('completed');
  });

  it('conta extractions e reviews pendentes', () => {
    const summary = buildDocumentIngestionSummary({ jobs: [], extractions, reviews, candidates: [] });

    expect(summary.totalExtractions).toBe(2);
    expect(summary.totalReviews).toBe(3);
    expect(summary.pendingReviews).toBe(1);
  });

  it('conta candidates por status', () => {
    const summary = buildDocumentIngestionSummary({ jobs: [], extractions: [], reviews: [], candidates });

    expect(summary.totalCandidates).toBe(6);
    expect(summary.pendingCandidates).toBe(1);
    expect(summary.approvedCandidates).toBe(2);
    expect(summary.rejectedCandidates).toBe(1);
    expect(summary.appliedCandidates).toBe(1);
  });

  it('conta failedJobs e retorna lastIngestionAt', () => {
    const summary = buildDocumentIngestionSummary({ jobs, extractions: [], reviews: [], candidates: [] });

    expect(summary.failedJobs).toBe(1);
    expect(summary.lastIngestionAt).toBe('2026-05-08T10:00:00.000Z');
  });

  it('nao mistura dados de outro documento, property ou tenant quando recebe somente linhas filtradas', () => {
    const filteredJobs = jobs.filter((job) => job.status !== 'queued');
    const summary = buildDocumentIngestionSummary({
      jobs: filteredJobs,
      extractions: extractions.slice(0, 1),
      reviews: reviews.slice(0, 2),
      candidates: candidates.slice(0, 3),
    });

    expect(summary.totalJobs).toBe(2);
    expect(summary.totalExtractions).toBe(1);
    expect(summary.totalReviews).toBe(2);
    expect(summary.totalCandidates).toBe(3);
  });

  it('nao expoe tenantId nem payload bruto', () => {
    const summary = buildDocumentIngestionSummary({ jobs, extractions, reviews, candidates });

    expect(summary).not.toHaveProperty('tenantId');
    expect(summary).not.toHaveProperty('rawText');
    expect(summary).not.toHaveProperty('rawJson');
    expect(summary).not.toHaveProperty('normalizedJson');
    expect(summary).not.toHaveProperty('payloadJson');
  });
});

describe('buildPropertyDocumentIngestionSummary', () => {
  const documents: PropertyDocumentIngestionSummaryDocumentRow[] = [
    { id: 'doc-a', tenantId: 'tenant-a', propertyId: 'prop-a', deletedAt: null },
    { id: 'doc-b', tenantId: 'tenant-a', propertyId: 'prop-a', deletedAt: null },
    { id: 'doc-c', tenantId: 'tenant-a', propertyId: 'prop-a', deletedAt: null },
    { id: 'doc-other-property', tenantId: 'tenant-a', propertyId: 'prop-b', deletedAt: null },
    { id: 'doc-other-tenant', tenantId: 'tenant-b', propertyId: 'prop-a', deletedAt: null },
    { id: 'doc-deleted', tenantId: 'tenant-a', propertyId: 'prop-a', deletedAt: '2026-05-08T00:00:00.000Z' },
  ];
  const jobs: PropertyDocumentIngestionSummaryJobRow[] = [
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a', status: 'queued', createdAt: '2026-05-07T08:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a', status: 'processing', createdAt: '2026-05-07T09:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-b', status: 'needs_review', createdAt: '2026-05-07T10:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-b', status: 'failed', createdAt: '2026-05-07T11:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-c', status: 'completed', createdAt: '2026-05-08T12:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-b', documentId: 'doc-other-property', status: 'failed', createdAt: '2026-05-09T12:00:00.000Z' },
    { tenantId: 'tenant-b', propertyId: 'prop-a', documentId: 'doc-other-tenant', status: 'failed', createdAt: '2026-05-10T12:00:00.000Z' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-deleted', status: 'failed', createdAt: '2026-05-11T12:00:00.000Z' },
  ];
  const extractions: PropertyDocumentIngestionSummaryExtractionRow[] = [
    { id: 'ext-a', tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a' },
    { id: 'ext-b', tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-b' },
    { id: 'ext-other-property', tenantId: 'tenant-a', propertyId: 'prop-b', documentId: 'doc-other-property' },
    { id: 'ext-other-tenant', tenantId: 'tenant-b', propertyId: 'prop-a', documentId: 'doc-other-tenant' },
  ];
  const reviews: PropertyDocumentIngestionSummaryReviewRow[] = [
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a', status: 'pending' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-b', status: 'approved' },
    { tenantId: 'tenant-a', propertyId: 'prop-b', documentId: 'doc-other-property', status: 'pending' },
    { tenantId: 'tenant-b', propertyId: 'prop-a', documentId: 'doc-other-tenant', status: 'pending' },
  ];
  const candidates: PropertyDocumentIngestionSummaryCandidateRow[] = [
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a', status: 'pending' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-a', status: 'approved' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-b', status: 'rejected' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-c', status: 'applied' },
    { tenantId: 'tenant-a', propertyId: 'prop-a', documentId: 'doc-c', status: 'superseded' },
    { tenantId: 'tenant-a', propertyId: 'prop-b', documentId: 'doc-other-property', status: 'pending' },
    { tenantId: 'tenant-b', propertyId: 'prop-a', documentId: 'doc-other-tenant', status: 'approved' },
  ];

  it('retorna resumo vazio para imovel sem documentos', () => {
    expect(buildPropertyDocumentIngestionSummary({
      tenantId: 'tenant-a',
      propertyId: 'prop-empty',
      documents,
      jobs,
      extractions,
      reviews,
      candidates,
    })).toEqual({
      totalDocuments: 0,
      documentsWithIngestion: 0,
      totalJobs: 0,
      processingJobs: 0,
      failedJobs: 0,
      needsReviewJobs: 0,
      totalExtractions: 0,
      pendingExtractionReviews: 0,
      totalCandidates: 0,
      pendingCandidates: 0,
      approvedCandidates: 0,
      rejectedCandidates: 0,
      appliedCandidates: 0,
      lastIngestionAt: null,
      latestStatus: null,
    });
  });

  it('conta documentos com ingestao', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.totalDocuments).toBe(3);
    expect(summary.documentsWithIngestion).toBe(3);
  });

  it('conta jobs por status', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.totalJobs).toBe(5);
    expect(summary.processingJobs).toBe(2);
    expect(summary.needsReviewJobs).toBe(1);
    expect(summary.failedJobs).toBe(1);
  });

  it('conta reviews pendentes', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.totalExtractions).toBe(2);
    expect(summary.pendingExtractionReviews).toBe(1);
  });

  it('conta candidates por status', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.totalCandidates).toBe(5);
    expect(summary.pendingCandidates).toBe(1);
    expect(summary.approvedCandidates).toBe(1);
    expect(summary.rejectedCandidates).toBe(1);
    expect(summary.appliedCandidates).toBe(1);
  });

  it('calcula lastIngestionAt e latestStatus', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.lastIngestionAt).toBe('2026-05-08T12:00:00.000Z');
    expect(summary.latestStatus).toBe('completed');
  });

  it('nao mistura outro property', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.failedJobs).toBe(1);
    expect(summary.lastIngestionAt).not.toBe('2026-05-09T12:00:00.000Z');
  });

  it('nao mistura outro tenant', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary.approvedCandidates).toBe(1);
    expect(summary.lastIngestionAt).not.toBe('2026-05-10T12:00:00.000Z');
  });

  it('response nao expoe tenantId nem raw payload', () => {
    const summary = buildPropertyDocumentIngestionSummary({ tenantId: 'tenant-a', propertyId: 'prop-a', documents, jobs, extractions, reviews, candidates });

    expect(summary).not.toHaveProperty('tenantId');
    expect(summary).not.toHaveProperty('rawText');
    expect(summary).not.toHaveProperty('rawJson');
    expect(summary).not.toHaveProperty('normalizedJson');
    expect(summary).not.toHaveProperty('payloadJson');
  });
});

const jobRows = [
  {
    id: 'job-new',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    documentId: 'doc-a',
    status: 'queued',
    provider: 'openai',
    modelName: 'gpt-4.1-mini',
    attempts: 0,
    lastError: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-07T12:00:00.000Z',
    updatedAt: '2026-05-07T12:00:00.000Z',
  },
  {
    id: 'job-old',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    documentId: 'doc-a',
    status: 'completed',
    provider: 'manual',
    modelName: null,
    attempts: 1,
    lastError: null,
    startedAt: '2026-05-06T11:00:00.000Z',
    finishedAt: '2026-05-06T11:05:00.000Z',
    createdAt: '2026-05-06T11:00:00.000Z',
    updatedAt: '2026-05-06T11:05:00.000Z',
  },
  {
    id: 'job-other-document',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    documentId: 'doc-b',
    status: 'queued',
    provider: 'none',
    modelName: null,
    attempts: 0,
    lastError: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-07T13:00:00.000Z',
    updatedAt: '2026-05-07T13:00:00.000Z',
  },
  {
    id: 'job-other-property',
    tenantId: 'tenant-a',
    propertyId: 'prop-b',
    documentId: 'doc-a',
    status: 'queued',
    provider: 'none',
    modelName: null,
    attempts: 0,
    lastError: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-07T14:00:00.000Z',
    updatedAt: '2026-05-07T14:00:00.000Z',
  },
  {
    id: 'job-other-tenant',
    tenantId: 'tenant-b',
    propertyId: 'prop-a',
    documentId: 'doc-a',
    status: 'queued',
    provider: 'none',
    modelName: null,
    attempts: 0,
    lastError: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-07T15:00:00.000Z',
    updatedAt: '2026-05-07T15:00:00.000Z',
  },
] satisfies DocumentIngestionJobListRow[];

describe('listDocumentIngestionJobsForDocument', () => {
  it('lista jobs de documento valido ordenados por createdAt desc', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 20,
    });

    expect(page.data.map((job) => job.id)).toEqual(['job-new', 'job-old']);
  });

  it('retorna lista vazia quando nao ha jobs', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 20,
    });

    expect(page).toEqual({ data: [], next_cursor: null, has_more: false });
  });

  it('filtra por status', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      status: 'completed',
      limit: 20,
    });

    expect(page.data.map((job) => job.id)).toEqual(['job-old']);
  });

  it('respeita limit default 20 quando recebido do contract', () => {
    const baseJob: DocumentIngestionJobListRow = { ...jobRows[0]! };
    const manyJobs = Array.from({ length: 25 }, (_, index) => ({
      ...baseJob,
      id: `job-${index}`,
      createdAt: `2026-05-${String(26 - index).padStart(2, '0')}T12:00:00.000Z`,
      updatedAt: `2026-05-${String(26 - index).padStart(2, '0')}T12:00:00.000Z`,
    })) satisfies DocumentIngestionJobListRow[];

    const page = listDocumentIngestionJobsForDocument({
      jobs: manyJobs,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 20,
    });

    expect(page.data).toHaveLength(20);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('2026-05-07T12:00:00.000Z');
  });

  it('respeita limit customizado', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 1,
    });

    expect(page.data.map((job) => job.id)).toEqual(['job-new']);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('2026-05-07T12:00:00.000Z');
  });

  it('aplica cursor por createdAt', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      cursor: '2026-05-07T12:00:00.000Z',
      limit: 20,
    });

    expect(page.data.map((job) => job.id)).toEqual(['job-old']);
  });

  it('nao expoe tenantId na resposta', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 20,
    });

    expect(page.data[0]).not.toHaveProperty('tenantId');
  });

  it('nao mistura jobs de outro documento, property ou tenant', () => {
    const page = listDocumentIngestionJobsForDocument({
      jobs: jobRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      limit: 20,
    });

    expect(page.data.map((job) => job.id)).not.toContain('job-other-document');
    expect(page.data.map((job) => job.id)).not.toContain('job-other-property');
    expect(page.data.map((job) => job.id)).not.toContain('job-other-tenant');
  });
});

// ── canAccessIngestionJobDetail ───────────────────────────────────────────────

const candidateListBaseRow: DocumentExtractionCandidateRow = {
  id: 'candidate-new',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-a',
  extractionId: 'ext-a',
  candidateType: 'warranty',
  status: 'approved',
  targetEntityType: 'warranty',
  targetEntityId: null,
  sourcePath: 'warranties[0]',
  payloadJson: {
    title: 'Garantia do equipamento',
    warrantyType: 'equipment',
    endDate: '2027-05-08',
    confidenceScore: 0.92,
    evidence: [],
  },
  confidenceScore: 0.92,
  reviewNotes: null,
  createdAt: '2026-05-08T12:00:00.000Z',
  updatedAt: '2026-05-08T12:00:00.000Z',
  appliedAt: null,
  appliedBy: null,
};

const candidateRows = [
  candidateListBaseRow,
  {
    ...candidateListBaseRow,
    id: 'candidate-old',
    candidateType: 'technical_system',
    status: 'pending',
    targetEntityType: 'technical_system',
    sourcePath: 'technicalSystems[0]',
    payloadJson: {
      type: 'electrical',
      name: 'Quadro eletrico',
      confidenceScore: 0.86,
      evidence: [],
    },
    confidenceScore: 0.86,
    createdAt: '2026-05-07T12:00:00.000Z',
    updatedAt: '2026-05-07T12:00:00.000Z',
  },
  { ...candidateListBaseRow, id: 'candidate-other-extraction', extractionId: 'ext-b' },
  { ...candidateListBaseRow, id: 'candidate-other-job', jobId: 'job-b' },
  { ...candidateListBaseRow, id: 'candidate-other-document', documentId: 'doc-b' },
  { ...candidateListBaseRow, id: 'candidate-other-property', propertyId: 'prop-b' },
  { ...candidateListBaseRow, id: 'candidate-other-tenant', tenantId: 'tenant-b' },
] satisfies DocumentExtractionCandidateRow[];

describe('listDocumentExtractionCandidatesForExtraction', () => {
  it('lista candidates validos ordenados por createdAt desc', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: 20,
    });

    expect(page.data.map((candidate) => candidate.id)).toEqual(['candidate-new', 'candidate-old']);
  });

  it('retorna lista vazia quando nao ha candidates', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: 20,
    });

    expect(page).toEqual({ data: [], next_cursor: null, has_more: false });
  });

  it('filtra por status', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      status: 'approved',
      limit: 20,
    });

    expect(page.data.map((candidate) => candidate.id)).toEqual(['candidate-new']);
  });

  it('filtra por candidateType', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      candidateType: 'technical_system',
      limit: 20,
    });

    expect(page.data.map((candidate) => candidate.id)).toEqual(['candidate-old']);
  });

  it('respeita limit default 20 quando recebido do contract', () => {
    const query = ListDocumentExtractionCandidatesQuerySchema.parse({});
    const manyCandidates = Array.from({ length: 25 }, (_, index) => ({
      ...candidateListBaseRow,
      id: `candidate-${index}`,
      createdAt: `2026-05-${String(26 - index).padStart(2, '0')}T12:00:00.000Z`,
      updatedAt: `2026-05-${String(26 - index).padStart(2, '0')}T12:00:00.000Z`,
    })) satisfies DocumentExtractionCandidateRow[];

    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: manyCandidates,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: query.limit,
    });

    expect(page.data).toHaveLength(20);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('2026-05-07T12:00:00.000Z');
  });

  it('respeita limit customizado', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: 1,
    });

    expect(page.data.map((candidate) => candidate.id)).toEqual(['candidate-new']);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('2026-05-08T12:00:00.000Z');
  });

  it('rejeita limit acima de 100 no contract', () => {
    const query = ListDocumentExtractionCandidatesQuerySchema.safeParse({ limit: '101' });

    expect(query.success).toBe(false);
  });

  it('aplica cursor por createdAt', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      cursor: '2026-05-08T12:00:00.000Z',
      limit: 20,
    });

    expect(page.data.map((candidate) => candidate.id)).toEqual(['candidate-old']);
  });

  it('nao expoe tenantId na resposta', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: 20,
    });

    expect(page.data[0]).not.toHaveProperty('tenantId');
  });

  it('nao mistura candidates de outra extraction, job, document, property ou tenant', () => {
    const page = listDocumentExtractionCandidatesForExtraction({
      candidates: candidateRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      limit: 20,
    });
    const ids = page.data.map((candidate) => candidate.id);

    expect(ids).not.toContain('candidate-other-extraction');
    expect(ids).not.toContain('candidate-other-job');
    expect(ids).not.toContain('candidate-other-document');
    expect(ids).not.toContain('candidate-other-property');
    expect(ids).not.toContain('candidate-other-tenant');
  });

  it('mantem 404 para documento soft-deleted antes de listar candidates', () => {
    expect(canAccessDocumentForIngestion({
      activeTenantId: 'tenant-a',
      documentTenantId: 'tenant-a',
      documentPropertyId: 'prop-a',
      requestedPropertyId: 'prop-a',
      documentDeletedAt: '2026-05-08T10:00:00.000Z',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

const validJobAccess = {
  activeTenantId: 'tenant-a',
  jobTenantId: 'tenant-a',
  jobPropertyId: 'prop-a',
  jobDocumentId: 'doc-a',
  requestedPropertyId: 'prop-a',
  requestedDocumentId: 'doc-a',
};

describe('canAccessIngestionJobDetail', () => {
  it('permite acesso a job valido no mesmo tenant, property e document', () => {
    expect(canAccessIngestionJobDetail(validJobAccess)).toEqual({ allowed: true });
  });

  it('retorna 404 para job inexistente (jobTenantId null)', () => {
    expect(canAccessIngestionJobDetail({ ...validJobAccess, jobTenantId: null }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para job de outro tenant', () => {
    expect(canAccessIngestionJobDetail({ ...validJobAccess, jobTenantId: 'tenant-b' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para job de outro property', () => {
    expect(canAccessIngestionJobDetail({ ...validJobAccess, jobPropertyId: 'prop-b' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para job de outro document', () => {
    expect(canAccessIngestionJobDetail({ ...validJobAccess, jobDocumentId: 'doc-b' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 400 quando nao ha tenant ativo', () => {
    expect(canAccessIngestionJobDetail({ ...validJobAccess, activeTenantId: null }))
      .toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('nao expoe tenantId — a decisao nao carrega o tenant do job na resposta', () => {
    const decision = canAccessIngestionJobDetail(validJobAccess);
    expect(decision).not.toHaveProperty('tenantId');
  });
});

// ── getDocumentIngestionJobDetail ─────────────────────────────────────────────

const detailJobRow: DocumentIngestionJobListRow = {
  id: 'job-001',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  status: 'completed',
  provider: 'openai',
  modelName: 'gpt-4.1-mini',
  attempts: 1,
  lastError: null,
  startedAt: '2026-05-07T12:00:00.000Z',
  finishedAt: '2026-05-07T12:01:00.000Z',
  createdAt: '2026-05-07T12:00:00.000Z',
  updatedAt: '2026-05-07T12:01:00.000Z',
};

const detailExtractionRows: ExtractionSummaryInput[] = [
  {
    id: 'ext-001',
    documentId: 'doc-a',
    jobId: 'job-001',
    rawText: 'Texto sensivel extraido',
    rawJson: { pages: 2 },
    normalizedJson: { documentType: 'invoice', schemaVersion: 'v1' },
    confidenceScore: 0.88,
    schemaVersion: 'v1',
    modelName: 'gpt-4.1-mini',
    createdAt: '2026-05-07T12:02:00.000Z',
  },
];

describe('getDocumentIngestionJobDetail', () => {
  it('retorna job valido (test 1)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: detailJobRow,
      extractions: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail?.job).toMatchObject({
      id: 'job-001',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      status: 'completed',
    });
  });

  it('retorna lista de extraction summaries (test 2)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: detailJobRow,
      extractions: detailExtractionRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail?.extractions).toHaveLength(1);
    expect(detail?.extractions[0]).toMatchObject({
      id: 'ext-001',
      documentId: 'doc-a',
      jobId: 'job-001',
      hasRawText: true,
      hasRawJson: true,
      hasNormalizedJson: true,
    });
  });

  it('retorna lista vazia quando o job nao tem extractions (test 3)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: detailJobRow,
      extractions: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail?.extractions).toEqual([]);
  });

  it('nao retorna rawText, rawJson ou normalizedJson no detalhe (tests 4, 5, 6)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: detailJobRow,
      extractions: detailExtractionRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail?.extractions[0]).not.toHaveProperty('rawText');
    expect(detail?.extractions[0]).not.toHaveProperty('rawJson');
    expect(detail?.extractions[0]).not.toHaveProperty('normalizedJson');
  });

  it('retorna null para job de outro document (test 8)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: { ...detailJobRow, documentId: 'doc-b' },
      extractions: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail).toBeNull();
  });

  it('retorna null para job de outro property (test 9)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: { ...detailJobRow, propertyId: 'prop-b' },
      extractions: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail).toBeNull();
  });

  it('retorna null para job de outro tenant (test 10)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: { ...detailJobRow, tenantId: 'tenant-b' },
      extractions: [],
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail).toBeNull();
  });

  it('nao expoe tenantId no job nem nas extractions (tests 12, 13)', () => {
    const detail = getDocumentIngestionJobDetail({
      job: detailJobRow,
      extractions: detailExtractionRows,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
    });

    expect(detail?.job).not.toHaveProperty('tenantId');
    expect(detail?.extractions[0]).not.toHaveProperty('tenantId');
  });
});

// ── mapExtractionToSummary ────────────────────────────────────────────────────

const validNormalizedExtraction = {
  documentType: 'manual',
  summary: 'Manual tecnico do pressurizador.',
  language: 'pt-BR',
  confidenceScore: 0.86,
  technicalSystems: [
    {
      type: 'plumbing',
      name: 'Pressurizador',
      confidenceScore: 0.82,
    },
  ],
  warranties: [],
  inventoryItems: [],
  maintenanceRecommendations: [],
  detectedDates: [],
  warnings: [],
  evidence: [
    {
      text: 'Pressurizador requer revisao anual.',
      confidenceScore: 0.8,
      fieldPath: 'technicalSystems.0.name',
    },
  ],
  schemaVersion: 'v1',
};

const extractionDetailRow: ExtractionDetailInput = {
  id: 'ext-detail-001',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-001',
  rawText: 'Texto bruto extraido para revisao humana.',
  rawJson: {
    pages: 3,
    language: 'pt-BR',
    r2Key: 'prop-a/documents/private.pdf',
    nested: {
      fileUrl: 'https://private.example/prop-a/documents/private.pdf',
      value: 'mantido',
    },
  },
  normalizedJson: validNormalizedExtraction,
  confidenceScore: 0.86,
  schemaVersion: 'v1',
  modelName: 'fake-consumer-v1',
  createdAt: '2026-05-07T12:02:00.000Z',
};

describe('canAccessExtractionDetail', () => {
  it('permite extraction valida no mesmo tenant, property, document e job', () => {
    expect(canAccessExtractionDetail({
      activeTenantId: 'tenant-a',
      extractionTenantId: 'tenant-a',
      extractionPropertyId: 'prop-a',
      extractionDocumentId: 'doc-a',
      extractionJobId: 'job-001',
      requestedPropertyId: 'prop-a',
      requestedDocumentId: 'doc-a',
      requestedJobId: 'job-001',
    })).toEqual({ allowed: true });
  });

  it('retorna 404 para extraction inexistente (test 6)', () => {
    expect(canAccessExtractionDetail({
      activeTenantId: 'tenant-a',
      extractionTenantId: null,
      extractionPropertyId: null,
      extractionDocumentId: null,
      extractionJobId: null,
      requestedPropertyId: 'prop-a',
      requestedDocumentId: 'doc-a',
      requestedJobId: 'job-001',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

describe('getDocumentExtractionDetail', () => {
  it('retorna extraction valida (test 1)', () => {
    const detail = getDocumentExtractionDetail({
      extraction: extractionDetailRow,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail).toMatchObject({
      id: 'ext-detail-001',
      documentId: 'doc-a',
      jobId: 'job-001',
      confidenceScore: 0.86,
      schemaVersion: 'v1',
      modelName: 'fake-consumer-v1',
    });
  });

  it('retorna rawText (test 2)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail.rawText).toBe('Texto bruto extraido para revisao humana.');
    expect(detail.hasRawText).toBe(true);
  });

  it('retorna rawJson sanitizado (test 3)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail.rawJson).toMatchObject({
      pages: 3,
      language: 'pt-BR',
      nested: { value: 'mantido' },
    });
    expect(detail.hasRawJson).toBe(true);
  });

  it('retorna normalizedJson (test 4)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail.normalizedJson).toMatchObject({
      documentType: 'manual',
      summary: 'Manual tecnico do pressurizador.',
      schemaVersion: 'v1',
    });
    expect(detail.hasNormalizedJson).toBe(true);
  });

  it('normalizedJson retornado passa em PropertyDocumentExtractionSchema (test 5)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(PropertyDocumentExtractionSchema.safeParse(detail.normalizedJson).success).toBe(true);
  });

  it('retorna null para extraction de outro job (test 7)', () => {
    expect(getDocumentExtractionDetail({
      extraction: { ...extractionDetailRow, jobId: 'job-other' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    })).toBeNull();
  });

  it('retorna null para extraction de outro documento (test 8)', () => {
    expect(getDocumentExtractionDetail({
      extraction: { ...extractionDetailRow, documentId: 'doc-b' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    })).toBeNull();
  });

  it('retorna null para extraction de outro property (test 9)', () => {
    expect(getDocumentExtractionDetail({
      extraction: { ...extractionDetailRow, propertyId: 'prop-b' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    })).toBeNull();
  });

  it('retorna null para extraction de outro tenant (test 10)', () => {
    expect(getDocumentExtractionDetail({
      extraction: { ...extractionDetailRow, tenantId: 'tenant-b' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    })).toBeNull();
  });

  it('retorna 404 logico para documento soft-deleted (test 11)', () => {
    expect(canAccessDocumentForIngestion({
      activeTenantId: 'tenant-a',
      documentTenantId: 'tenant-a',
      documentPropertyId: 'prop-a',
      requestedPropertyId: 'prop-a',
      documentDeletedAt: '2026-05-07T12:00:00.000Z',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('nao expoe tenantId (test 12)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail).not.toHaveProperty('tenantId');
  });

  it('nao expoe R2 key ou URL privada (test 13)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    const serialized = JSON.stringify(detail);

    expect(detail).not.toHaveProperty('r2Key');
    expect(detail.rawJson).not.toHaveProperty('r2Key');
    expect(detail.rawJson).not.toHaveProperty('fileUrl');
    expect(serialized).not.toContain('prop-a/documents/private.pdf');
    expect(serialized).not.toContain('private.example');
  });

  it('nao altera status do job (test 14)', () => {
    const jobBefore = { ...detailJobRow };
    mapExtractionToDetail(extractionDetailRow);
    expect(detailJobRow).toEqual(jobBefore);
  });

  it('retorna review nulo quando nao informado (test 15)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail.review).toBeNull();
    expect(detail).not.toHaveProperty('reviewStatus');
    expect(detail).not.toHaveProperty('reviewedBy');
  });

  it('nao aplica dados em tabelas de dominio (test 16)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail).not.toHaveProperty('technicalSystems');
    expect(detail).not.toHaveProperty('warranties');
    expect(detail).not.toHaveProperty('inventoryItems');
    expect(detail).not.toHaveProperty('maintenanceSchedules');
  });
});

const baseExtractionRow: ExtractionSummaryInput = {
  id: 'ext-001',
  documentId: 'doc-a',
  jobId: 'job-001',
  rawText: null,
  rawJson: null,
  normalizedJson: null,
  confidenceScore: 0.91,
  schemaVersion: 'v1',
  modelName: 'claude-3-5-haiku',
  createdAt: '2026-05-07T12:00:00.000Z',
};

describe('mapExtractionToSummary', () => {
  it('retorna summary valido sem campos raw', () => {
    const summary = mapExtractionToSummary(baseExtractionRow);
    expect(summary.id).toBe('ext-001');
    expect(summary.documentId).toBe('doc-a');
    expect(summary.jobId).toBe('job-001');
    expect(summary.confidenceScore).toBe(0.91);
    expect(summary.schemaVersion).toBe('v1');
    expect(summary.modelName).toBe('claude-3-5-haiku');
    expect(summary.createdAt).toBe('2026-05-07T12:00:00.000Z');
  });

  it('nao retorna rawText no summary (test 4)', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawText: 'Conteudo extraido' });
    expect(summary).not.toHaveProperty('rawText');
  });

  it('nao retorna rawJson no summary (test 5)', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawJson: { pages: 4 } });
    expect(summary).not.toHaveProperty('rawJson');
  });

  it('nao retorna normalizedJson no summary (test 6)', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, normalizedJson: { documentType: 'manual' } });
    expect(summary).not.toHaveProperty('normalizedJson');
  });

  it('nao expoe tenantId na extraction (test 13)', () => {
    const summary = mapExtractionToSummary(baseExtractionRow);
    expect(summary).not.toHaveProperty('tenantId');
  });

  it('hasRawText e true quando rawText tem conteudo', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawText: 'Texto extraido do PDF.' });
    expect(summary.hasRawText).toBe(true);
  });

  it('hasRawText e false quando rawText e null', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawText: null });
    expect(summary.hasRawText).toBe(false);
  });

  it('hasRawText e false quando rawText e string vazia', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawText: '' });
    expect(summary.hasRawText).toBe(false);
  });

  it('hasRawJson e true quando rawJson e objeto', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawJson: { lang: 'pt' } });
    expect(summary.hasRawJson).toBe(true);
  });

  it('hasRawJson e false quando rawJson e null', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, rawJson: null });
    expect(summary.hasRawJson).toBe(false);
  });

  it('hasNormalizedJson e true quando normalizedJson e objeto', () => {
    const summary = mapExtractionToSummary({
      ...baseExtractionRow,
      normalizedJson: { documentType: 'invoice', schemaVersion: 'v1' },
    });
    expect(summary.hasNormalizedJson).toBe(true);
  });

  it('hasNormalizedJson e false quando normalizedJson e null', () => {
    const summary = mapExtractionToSummary({ ...baseExtractionRow, normalizedJson: null });
    expect(summary.hasNormalizedJson).toBe(false);
  });

  it('lista vazia de extractions resulta em array vazio sem erros (test 3)', () => {
    const summaries = ([] as ExtractionSummaryInput[]).map(mapExtractionToSummary);
    expect(summaries).toEqual([]);
  });
});

const candidateNormalizedJson = PropertyDocumentExtractionSchema.parse({
  documentType: 'manual',
  confidenceScore: 0.81,
  schemaVersion: 'v1',
  technicalSystems: [
    {
      type: 'electrical',
      name: 'Quadro geral',
      confidenceScore: 0.91,
    },
  ],
  warranties: [
    {
      title: 'Garantia do inversor',
      warrantyType: 'equipment',
      confidenceScore: 0.82,
    },
  ],
  inventoryItems: [
    {
      category: 'electrical',
      name: 'Disjuntor reserva',
      confidenceScore: 0.73,
    },
  ],
  maintenanceRecommendations: [
    {
      systemType: 'electrical',
      title: 'Revisar quadro geral',
      recommendedIntervalMonths: 12,
      priority: 'medium',
      confidenceScore: 0.69,
    },
  ],
});

const validCandidateDecisionInput = {
  activeTenantId: 'tenant-a',
  extractionTenantId: 'tenant-a',
  extractionPropertyId: 'prop-a',
  extractionDocumentId: 'doc-a',
  extractionJobId: 'job-a',
  requestedPropertyId: 'prop-a',
  requestedDocumentId: 'doc-a',
  requestedJobId: 'job-a',
  normalizedJson: candidateNormalizedJson,
  reviewStatus: 'approved' as const,
  existingCandidateCount: 0,
};

describe('document extraction candidates generation', () => {
  function buildCandidates() {
    let nextId = 1;
    return buildDocumentExtractionCandidates({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      normalizedJson: candidateNormalizedJson,
      extractionConfidenceScore: 0.8,
      now: '2026-05-08T12:00:00.000Z',
      idFactory: () => `cand-${nextId++}`,
    });
  }

  it('gera candidates para technicalSystems', () => {
    const candidates = buildCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({
      candidateType: 'technical_system',
      targetEntityType: 'technical_system',
      sourcePath: 'technicalSystems[0]',
      status: 'pending',
      targetEntityId: null,
    }));
  });

  it('gera candidates para warranties', () => {
    const candidates = buildCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({
      candidateType: 'warranty',
      targetEntityType: 'warranty',
      sourcePath: 'warranties[0]',
    }));
  });

  it('gera candidates para inventoryItems', () => {
    const candidates = buildCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({
      candidateType: 'inventory_item',
      targetEntityType: 'inventory_item',
      sourcePath: 'inventoryItems[0]',
    }));
  });

  it('gera candidates para maintenanceRecommendations apontando para maintenance_schedule', () => {
    const candidates = buildCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({
      candidateType: 'maintenance_recommendation',
      targetEntityType: 'maintenance_schedule',
      sourcePath: 'maintenanceRecommendations[0]',
    }));
  });

  it('bloqueia geracao sem normalizedJson', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      normalizedJson: null,
    })).toEqual({ allowed: false, status: 409, code: 'NORMALIZED_JSON_REQUIRED' });
  });

  it('bloqueia geracao se normalizedJson invalido', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      normalizedJson: { documentType: 'manual', confidenceScore: 2, schemaVersion: 'v1' },
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_NORMALIZED_JSON' });
  });

  it('bloqueia geracao se review esta pending', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      reviewStatus: 'pending',
    })).toEqual({ allowed: false, status: 409, code: 'EXTRACTION_REVIEW_NOT_APPROVED' });
  });

  it('bloqueia geracao se review esta rejected', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      reviewStatus: 'rejected',
    })).toEqual({ allowed: false, status: 409, code: 'EXTRACTION_REVIEW_NOT_APPROVED' });
  });

  it('permite geracao se review esta approved', () => {
    expect(canGenerateDocumentExtractionCandidates(validCandidateDecisionInput)).toEqual({ allowed: true });
  });

  it('permite geracao se review esta partially_applied', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      reviewStatus: 'partially_applied',
    })).toEqual({ allowed: true });
  });

  it('evita duplicacao para mesma extraction', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      existingCandidateCount: 1,
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATES_ALREADY_EXIST' });
  });

  it('retorna 404 para extraction de outro job', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      extractionJobId: 'job-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para extraction de outro documento', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      extractionDocumentId: 'doc-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para outro property', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      extractionPropertyId: 'prop-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para outro tenant', () => {
    expect(canGenerateDocumentExtractionCandidates({
      ...validCandidateDecisionInput,
      extractionTenantId: 'tenant-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('nao expoe tenantId no DTO de candidate', () => {
    const dto = mapDocumentExtractionCandidateToContract(buildCandidates()[0]!);
    expect(dto).not.toHaveProperty('tenantId');
  });

  it('nao cria registros em technicalSystems, warranties, inventoryItems ou maintenanceSchedules', () => {
    const candidates = buildCandidates();
    expect(candidates.every((candidate) => candidate.targetEntityId === null)).toBe(true);
    expect(candidates.every((candidate) => candidate.appliedAt === null)).toBe(true);
    expect(candidates.every((candidate) => candidate.appliedBy === null)).toBe(true);
  });

  it('audit log nao contem rawText, rawJson ou normalizedJson completo', () => {
    const auditData = buildDocumentExtractionCandidatesAuditData({
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      candidates: buildCandidates(),
    });
    const serialized = JSON.stringify(auditData);
    expect(serialized).not.toContain('rawText');
    expect(serialized).not.toContain('rawJson');
    expect(serialized).not.toContain('normalizedJson');
    expect(serialized).not.toContain('Quadro geral');
    expect(auditData).toMatchObject({
      total_count: 4,
      counts_by_type: {
        technical_system: 1,
        warranty: 1,
        inventory_item: 1,
        maintenance_recommendation: 1,
      },
    });
  });

  const reviewCandidateRow = {
    id: 'cand-review-a',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    documentId: 'doc-a',
    jobId: 'job-a',
    extractionId: 'ext-a',
    candidateType: 'technical_system',
    status: 'pending',
    targetEntityType: 'technical_system',
    targetEntityId: null,
    sourcePath: 'technicalSystems[0]',
    payloadJson: { name: 'Quadro geral', type: 'electrical', confidenceScore: 0.9 },
    confidenceScore: 0.9,
    reviewNotes: null,
    createdAt: '2026-05-08T12:00:00.000Z',
    updatedAt: '2026-05-08T12:00:00.000Z',
    appliedAt: null,
    appliedBy: null,
  } satisfies DocumentExtractionCandidateRow;

  const validCandidateReviewDecisionInput = {
    activeTenantId: 'tenant-a',
    candidateTenantId: 'tenant-a',
    candidatePropertyId: 'prop-a',
    candidateDocumentId: 'doc-a',
    candidateJobId: 'job-a',
    candidateExtractionId: 'ext-a',
    requestedPropertyId: 'prop-a',
    requestedDocumentId: 'doc-a',
    requestedJobId: 'job-a',
    requestedExtractionId: 'ext-a',
    candidateStatus: 'pending' as const,
  };

  it('aprova candidate valido sem expor tenantId', () => {
    const patch = buildDocumentExtractionCandidateReviewPatch({
      status: 'approved',
      now: '2026-05-08T13:00:00.000Z',
    });
    const dto = mapDocumentExtractionCandidateToContract({
      ...reviewCandidateRow,
      ...patch,
    });

    expect(canReviewDocumentExtractionCandidate(validCandidateReviewDecisionInput)).toEqual({ allowed: true });
    expect(dto.status).toBe('approved');
    expect(dto).not.toHaveProperty('tenantId');
  });

  it('rejeita candidate valido e atualiza reviewNotes', () => {
    const patch = buildDocumentExtractionCandidateReviewPatch({
      status: 'rejected',
      reviewNotes: 'Nao corresponde ao imovel.',
      now: '2026-05-08T13:00:00.000Z',
    });
    const dto = mapDocumentExtractionCandidateToContract({
      ...reviewCandidateRow,
      ...patch,
    });

    expect(dto.status).toBe('rejected');
    expect(dto.reviewNotes).toBe('Nao corresponde ao imovel.');
    expect(dto.updatedAt).toBe('2026-05-08T13:00:00.000Z');
  });

  it('retorna 404 para candidate inexistente ou fora do escopo completo', () => {
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateTenantId: null,
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateExtractionId: 'ext-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateJobId: 'job-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateDocumentId: 'doc-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidatePropertyId: 'prop-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateTenantId: 'tenant-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 logico para documento soft-deleted antes de revisar candidate', () => {
    expect(canAccessDocumentForIngestion({
      activeTenantId: 'tenant-a',
      documentTenantId: 'tenant-a',
      documentPropertyId: 'prop-a',
      requestedPropertyId: 'prop-a',
      documentDeletedAt: '2026-05-08T12:00:00.000Z',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('bloqueia candidate applied e superseded', () => {
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateStatus: 'applied',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' });
    expect(canReviewDocumentExtractionCandidate({
      ...validCandidateReviewDecisionInput,
      candidateStatus: 'superseded',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_SUPERSEDED' });
  });

  it('nao altera payloadJson, targetEntityId, appliedAt ou appliedBy', () => {
    const patch = buildDocumentExtractionCandidateReviewPatch({
      status: 'approved',
      reviewNotes: 'Aprovado para aplicacao futura.',
      now: '2026-05-08T13:00:00.000Z',
    });
    const reviewed = {
      ...reviewCandidateRow,
      ...patch,
    };

    expect(reviewed.payloadJson).toEqual(reviewCandidateRow.payloadJson);
    expect(reviewed.targetEntityId).toBeNull();
    expect(reviewed.appliedAt).toBeNull();
    expect(reviewed.appliedBy).toBeNull();
  });

  it('nao cria registros em tabelas finais do dominio ao revisar candidate', () => {
    const reviewed = {
      ...reviewCandidateRow,
      ...buildDocumentExtractionCandidateReviewPatch({
        status: 'approved',
        now: '2026-05-08T13:00:00.000Z',
      }),
    };

    expect(reviewed).not.toHaveProperty('technicalSystems');
    expect(reviewed).not.toHaveProperty('warranties');
    expect(reviewed).not.toHaveProperty('inventoryItems');
    expect(reviewed).not.toHaveProperty('maintenanceSchedules');
    expect(reviewed.targetEntityId).toBeNull();
  });

  it('audit log de review de candidate contem somente identificadores e status seguros', () => {
    const auditData = buildDocumentExtractionCandidateReviewAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-a',
      extractionId: 'ext-a',
      candidateId: 'cand-review-a',
      status: 'approved',
    });
    const serialized = JSON.stringify(auditData);

    expect(auditData).toEqual({
      tenant_id: 'tenant-a',
      property_id: 'prop-a',
      document_id: 'doc-a',
      job_id: 'job-a',
      extraction_id: 'ext-a',
      candidate_id: 'cand-review-a',
      status: 'approved',
    });
    expect(serialized).not.toContain('payloadJson');
    expect(serialized).not.toContain('rawText');
    expect(serialized).not.toContain('rawJson');
    expect(serialized).not.toContain('normalizedJson');
  });
});

// ── document extraction detail / review ───────────────────────────────────────

const normalizedExtraction = PropertyDocumentExtractionSchema.parse({
  documentType: 'manual',
  summary: 'Manual tecnico importado.',
  confidenceScore: 0.91,
  schemaVersion: 'v1',
});

const detailExtractionRow: ExtractionDetailInput = {
  id: 'ext-001',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-001',
  rawText: 'Texto bruto extraido',
  rawJson: {
    pages: 4,
    r2Key: 'private/key.pdf',
    nested: {
      fileUrl: 'https://private.example/file.pdf',
      value: 'mantido',
    },
  },
  normalizedJson: normalizedExtraction,
  confidenceScore: 0.91,
  schemaVersion: 'v1',
  modelName: 'fake-document-ingestion-v1',
  createdAt: '2026-05-07T12:02:00.000Z',
};

describe('canAccessExtractionDetail', () => {
  const validExtractionAccess = {
    activeTenantId: 'tenant-a',
    extractionTenantId: 'tenant-a',
    extractionPropertyId: 'prop-a',
    extractionDocumentId: 'doc-a',
    extractionJobId: 'job-001',
    requestedPropertyId: 'prop-a',
    requestedDocumentId: 'doc-a',
    requestedJobId: 'job-001',
  };

  it('permite extraction valida no mesmo tenant, property, document e job', () => {
    expect(canAccessExtractionDetail(validExtractionAccess)).toEqual({ allowed: true });
  });

  it('retorna 404 para extraction inexistente', () => {
    expect(canAccessExtractionDetail({ ...validExtractionAccess, extractionTenantId: null }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para extraction de outro job', () => {
    expect(canAccessExtractionDetail({ ...validExtractionAccess, extractionJobId: 'job-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para extraction de outro documento', () => {
    expect(canAccessExtractionDetail({ ...validExtractionAccess, extractionDocumentId: 'doc-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para extraction de outro property', () => {
    expect(canAccessExtractionDetail({ ...validExtractionAccess, extractionPropertyId: 'prop-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para extraction de outro tenant', () => {
    expect(canAccessExtractionDetail({ ...validExtractionAccess, extractionTenantId: 'tenant-b' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

describe('getDocumentExtractionDetail', () => {
  it('retorna detalhe completo sem expor tenantId', () => {
    const detail = getDocumentExtractionDetail({
      extraction: detailExtractionRow,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail).toMatchObject({
      id: 'ext-001',
      documentId: 'doc-a',
      jobId: 'job-001',
      rawText: 'Texto bruto extraido',
      normalizedJson: normalizedExtraction,
    });
    expect(detail).not.toHaveProperty('tenantId');
  });

  it('sanitiza rawJson sem expor R2 key ou URL privada', () => {
    const detail = mapExtractionToDetail(detailExtractionRow);

    expect(detail.rawJson).toEqual({
      pages: 4,
      nested: {
        value: 'mantido',
      },
    });
  });
});

const reviewRow: DocumentExtractionReviewRow = {
  id: 'review-001',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  extractionId: 'ext-001',
  status: 'approved',
  reviewedBy: 'user-reviewer',
  reviewedAt: '2026-05-08T10:00:00.000Z',
  notes: 'Validado pelo responsavel tecnico.',
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:00:00.000Z',
};

describe('getDocumentExtractionDetail com review persistido', () => {
  it('retorna review aprovado no detalhe sem expor tenantId', () => {
    const detail = getDocumentExtractionDetail({
      extraction: detailExtractionRow,
      review: reviewRow,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail?.review).toMatchObject({
      id: 'review-001',
      documentId: 'doc-a',
      extractionId: 'ext-001',
      status: 'approved',
      reviewedBy: 'user-reviewer',
    });
    expect(detail?.review).not.toHaveProperty('tenantId');
    expect(detail?.review).not.toHaveProperty('propertyId');
  });

  it('retorna review partially_applied no detalhe', () => {
    const detail = getDocumentExtractionDetail({
      extraction: detailExtractionRow,
      review: { ...reviewRow, status: 'partially_applied' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail?.review?.status).toBe('partially_applied');
  });

  it('retorna review rejected no detalhe', () => {
    const detail = getDocumentExtractionDetail({
      extraction: detailExtractionRow,
      review: { ...reviewRow, status: 'rejected' },
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail?.review?.status).toBe('rejected');
  });

  it('retorna review null no detalhe quando nao existe review persistido', () => {
    const detail = getDocumentExtractionDetail({
      extraction: detailExtractionRow,
      review: null,
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
    });

    expect(detail?.review).toBeNull();
  });
});

describe('mapReviewToContract', () => {
  it('retorna review aprovado compativel com contract', () => {
    expect(mapReviewToContract(reviewRow)).toMatchObject({
      id: 'review-001',
      documentId: 'doc-a',
      extractionId: 'ext-001',
      status: 'approved',
      reviewedBy: 'user-reviewer',
      reviewedAt: '2026-05-08T10:00:00.000Z',
      notes: 'Validado pelo responsavel tecnico.',
    });
  });

  it('retorna review rejeitado compativel com contract', () => {
    expect(mapReviewToContract({ ...reviewRow, status: 'rejected' }).status).toBe('rejected');
  });

  it('retorna review parcialmente aplicado compativel com contract', () => {
    expect(mapReviewToContract({ ...reviewRow, status: 'partially_applied' }).status).toBe('partially_applied');
  });

  it('nao expoe tenantId nem propertyId na resposta', () => {
    const review = mapReviewToContract(reviewRow);

    expect(review).not.toHaveProperty('tenantId');
    expect(review).not.toHaveProperty('propertyId');
  });

  it('preenche reviewedBy com usuario autenticado vindo do backend', () => {
    const review = mapReviewToContract({ ...reviewRow, reviewedBy: 'auth-user-123' });

    expect(review.reviewedBy).toBe('auth-user-123');
  });

  it('preenche reviewedAt com timestamp gerado no backend', () => {
    const review = mapReviewToContract({ ...reviewRow, reviewedAt: '2026-05-08T11:00:00.000Z' });

    expect(review.reviewedAt).toBe('2026-05-08T11:00:00.000Z');
  });
});

describe('buildDocumentExtractionReviewJobPatch', () => {
  const now = '2026-05-08T10:00:00.000Z';

  it('approved atualiza job para completed', () => {
    expect(buildDocumentExtractionReviewJobPatch({ status: 'approved', now })).toEqual({
      status: 'completed',
      lastError: null,
      finishedAt: now,
      updatedAt: now,
    });
  });

  it('rejected atualiza job para failed com lastError sanitizado e fixo', () => {
    expect(buildDocumentExtractionReviewJobPatch({ status: 'rejected', now })).toEqual({
      status: 'failed',
      lastError: 'Extraction rejected by reviewer',
      finishedAt: now,
      updatedAt: now,
    });
  });

  it('partially_applied mantem job em needs_review sem aplicar dominio', () => {
    expect(buildDocumentExtractionReviewJobPatch({ status: 'partially_applied', now })).toEqual({
      status: 'needs_review',
      lastError: null,
      updatedAt: now,
    });
  });
});

describe('buildDocumentExtractionReviewAuditData', () => {
  it('inclui somente identificadores seguros e status no audit log', () => {
    const auditData = buildDocumentExtractionReviewAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      reviewId: 'review-001',
      status: 'approved',
    });

    expect(auditData).toEqual({
      tenant_id: 'tenant-a',
      property_id: 'prop-a',
      document_id: 'doc-a',
      job_id: 'job-001',
      extraction_id: 'ext-001',
      review_id: 'review-001',
      status: 'approved',
    });
  });

  it('nao registra rawText, rawJson ou normalizedJson no audit log', () => {
    const auditData = buildDocumentExtractionReviewAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      reviewId: 'review-001',
      status: 'rejected',
    });

    expect(auditData).not.toHaveProperty('rawText');
    expect(auditData).not.toHaveProperty('rawJson');
    expect(auditData).not.toHaveProperty('normalizedJson');
  });

  it('nao cria payload para tabelas de dominio fora do escopo', () => {
    const auditData = buildDocumentExtractionReviewAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      reviewId: 'review-001',
      status: 'partially_applied',
    });

    expect(auditData).not.toHaveProperty('technicalSystems');
    expect(auditData).not.toHaveProperty('warranties');
    expect(auditData).not.toHaveProperty('inventoryItems');
    expect(auditData).not.toHaveProperty('maintenanceSchedules');
  });
});

// ── document extraction candidate apply ───────────────────────────────────

const approvedTechnicalSystemCandidate: DocumentExtractionCandidateRow = {
  id: 'candidate-001',
  tenantId: 'tenant-a',
  propertyId: 'prop-a',
  documentId: 'doc-a',
  jobId: 'job-001',
  extractionId: 'ext-001',
  candidateType: 'technical_system',
  status: 'approved',
  targetEntityType: 'technical_system',
  targetEntityId: null,
  sourcePath: 'technicalSystems[0]',
  payloadJson: {
    type: 'plumbing',
    name: 'Pressurizador',
    description: 'Sistema de pressurizacao da rede hidraulica.',
    locationSummary: 'Casa de maquinas',
    installationDate: '2024-03-15',
    brand: 'Marca preservada no candidate',
    model: 'Modelo preservado no candidate',
    serialNumber: 'SN-123',
    warrantyUntil: '2027-03-15',
    confidenceScore: 0.93,
    evidence: [],
  },
  confidenceScore: 0.93,
  reviewNotes: 'Aprovado para aplicacao.',
  createdAt: '2026-05-08T09:00:00.000Z',
  updatedAt: '2026-05-08T09:10:00.000Z',
  appliedAt: null,
  appliedBy: null,
};

const validCandidateAccess = {
  activeTenantId: 'tenant-a',
  candidateTenantId: 'tenant-a',
  candidatePropertyId: 'prop-a',
  candidateDocumentId: 'doc-a',
  candidateJobId: 'job-001',
  candidateExtractionId: 'ext-001',
  requestedPropertyId: 'prop-a',
  requestedDocumentId: 'doc-a',
  requestedJobId: 'job-001',
  requestedExtractionId: 'ext-001',
};

describe('canApplyTechnicalSystemCandidate', () => {
  it('aplica candidate technical_system aprovado (test 1)', () => {
    expect(canApplyTechnicalSystemCandidate(approvedTechnicalSystemCandidate)).toEqual({
      allowed: true,
      targetEntityType: 'technical_system',
    });
  });

  it('bloqueia candidate pending (test 15)', () => {
    expect(canApplyTechnicalSystemCandidate({ ...approvedTechnicalSystemCandidate, status: 'pending' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate rejected (test 16)', () => {
    expect(canApplyTechnicalSystemCandidate({ ...approvedTechnicalSystemCandidate, status: 'rejected' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate superseded (test 17)', () => {
    expect(canApplyTechnicalSystemCandidate({ ...approvedTechnicalSystemCandidate, status: 'superseded' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate ja applied (test 18)', () => {
    expect(canApplyTechnicalSystemCandidate({
      ...approvedTechnicalSystemCandidate,
      status: 'applied',
      targetEntityId: 'tech-001',
      appliedAt: '2026-05-08T10:00:00.000Z',
      appliedBy: 'user-001',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' });
  });

  it('bloqueia candidate de tipo warranty (test 19)', () => {
    expect(canApplyTechnicalSystemCandidate({
      ...approvedTechnicalSystemCandidate,
      candidateType: 'warranty',
      targetEntityType: 'warranty',
    })).toEqual({ allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' });
  });

  it('bloqueia candidate de tipo inventory_item (test 20)', () => {
    expect(canApplyTechnicalSystemCandidate({
      ...approvedTechnicalSystemCandidate,
      candidateType: 'inventory_item',
      targetEntityType: 'inventory_item',
    })).toEqual({ allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' });
  });

  it('bloqueia candidate de tipo maintenance_recommendation (test 21)', () => {
    expect(canApplyTechnicalSystemCandidate({
      ...approvedTechnicalSystemCandidate,
      candidateType: 'maintenance_recommendation',
      targetEntityType: 'maintenance_schedule',
    })).toEqual({ allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' });
  });

  it('retorna 422 para payloadJson invalido (test 28)', () => {
    expect(canApplyTechnicalSystemCandidate({
      ...approvedTechnicalSystemCandidate,
      payloadJson: { type: 'plumbing' },
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_TECHNICAL_SYSTEM_PAYLOAD' });
  });
});

const approvedWarrantyCandidate: DocumentExtractionCandidateRow = {
  ...approvedTechnicalSystemCandidate,
  id: 'candidate-warranty-001',
  candidateType: 'warranty',
  targetEntityType: 'warranty',
  sourcePath: 'warranties[0]',
  payloadJson: {
    title: 'Garantia do pressurizador',
    warrantyType: 'equipment',
    providerName: 'Assistencia Tecnica Premium',
    startDate: '2024-03-15',
    endDate: '2027-03-15',
    coverage: 'Cobertura de defeitos de fabricacao e instalacao.',
    exclusions: 'Mau uso e alteracoes nao autorizadas.',
    confidenceScore: 0.91,
    evidence: [],
  },
  confidenceScore: 0.91,
};

const approvedInventoryItemCandidate: DocumentExtractionCandidateRow = {
  ...approvedTechnicalSystemCandidate,
  id: 'candidate-inventory-001',
  candidateType: 'inventory_item',
  targetEntityType: 'inventory_item',
  sourcePath: 'inventoryItems[0]',
  payloadJson: {
    category: 'electrical',
    name: 'Disjuntor reserva',
    brand: 'Schneider',
    model: 'C60',
    supplier: 'Fornecedor Eletrico',
    quantity: 2,
    unit: 'un',
    purchaseDate: '2025-01-10',
    warrantyUntil: '2027-01-10',
    confidenceScore: 0.88,
    evidence: [],
  },
  confidenceScore: 0.88,
};

describe('canApplyDocumentExtractionCandidate para warranty', () => {
  it('aplica candidate warranty aprovado (test 1)', () => {
    expect(canApplyDocumentExtractionCandidate(approvedWarrantyCandidate)).toEqual({
      allowed: true,
      targetEntityType: 'warranty',
    });
  });

  it('bloqueia candidate pending (test 20)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedWarrantyCandidate, status: 'pending' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate rejected (test 21)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedWarrantyCandidate, status: 'rejected' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate superseded (test 22)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedWarrantyCandidate, status: 'superseded' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate ja applied (test 23)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedWarrantyCandidate,
      status: 'applied',
      targetEntityId: 'warranty-001',
      appliedAt: '2026-05-08T10:00:00.000Z',
      appliedBy: 'user-001',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' });
  });

  it('bloqueia candidate de tipo inventory_item (test 24)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedWarrantyCandidate,
      candidateType: 'inventory_item',
      targetEntityType: 'inventory_item',
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_INVENTORY_ITEM_PAYLOAD' });
  });

  it('retorna 422 para payloadJson invalido (test 33)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedWarrantyCandidate,
      payloadJson: { warrantyType: 'equipment' },
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_WARRANTY_PAYLOAD' });
  });

  it('bloqueia warranty sem endDate porque warranties.endDate e obrigatorio (test 19)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedWarrantyCandidate,
      payloadJson: {
        title: 'Garantia sem fim',
        warrantyType: 'equipment',
        confidenceScore: 0.91,
        evidence: [],
      },
    })).toEqual({ allowed: false, status: 422, code: 'WARRANTY_END_DATE_REQUIRED' });
  });
});

describe('canApplyDocumentExtractionCandidate para inventory_item', () => {
  it('aplica candidate inventory_item aprovado (test 1)', () => {
    expect(canApplyDocumentExtractionCandidate(approvedInventoryItemCandidate)).toEqual({
      allowed: true,
      targetEntityType: 'inventory_item',
    });
  });

  it('bloqueia candidate pending (test 18)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedInventoryItemCandidate, status: 'pending' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate rejected (test 19)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedInventoryItemCandidate, status: 'rejected' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate superseded (test 20)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedInventoryItemCandidate, status: 'superseded' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
  });

  it('bloqueia candidate ja applied (test 21)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedInventoryItemCandidate,
      status: 'applied',
      targetEntityId: 'inventory-001',
      appliedAt: '2026-05-08T10:00:00.000Z',
      appliedBy: 'user-001',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' });
  });

  it('retorna 422 quando candidate maintenance_recommendation carrega payload de inventory_item (test 22)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedInventoryItemCandidate,
      candidateType: 'maintenance_recommendation',
      targetEntityType: 'maintenance_schedule',
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_MAINTENANCE_RECOMMENDATION_PAYLOAD' });
  });

  it('retorna 422 para payloadJson invalido (test 27)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedInventoryItemCandidate,
      payloadJson: { category: 'electrical' },
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_INVENTORY_ITEM_PAYLOAD' });
  });
});

const approvedMaintenanceCandidate: DocumentExtractionCandidateRow = {
  ...approvedTechnicalSystemCandidate,
  id: 'candidate-maintenance-001',
  candidateType: 'maintenance_recommendation',
  targetEntityType: 'maintenance_schedule',
  sourcePath: 'maintenanceRecommendations[0]',
  payloadJson: {
    systemType: 'plumbing',
    title: 'Revisao preventiva do pressurizador',
    description: 'Verificar pressao, vazamentos e estado geral do sistema.',
    recommendedIntervalMonths: 6,
    firstDueDate: '2026-07-15',
    priority: 'medium',
    standardReference: 'Manual tecnico pagina 12',
    confidenceScore: 0.89,
    evidence: [],
  },
  confidenceScore: 0.89,
};

describe('canApplyDocumentExtractionCandidate para maintenance_recommendation', () => {
  it('mantem decisao existente para candidate maintenance_recommendation aprovado', () => {
    expect(canApplyDocumentExtractionCandidate(approvedMaintenanceCandidate))
      .toEqual({ allowed: true, targetEntityType: 'maintenance_schedule' });
  });

  it('bloqueia candidate pendente/rejeitado/superseded/aplicado (test 15)', () => {
    expect(canApplyDocumentExtractionCandidate({ ...approvedMaintenanceCandidate, status: 'pending' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
    expect(canApplyDocumentExtractionCandidate({ ...approvedMaintenanceCandidate, status: 'rejected' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
    expect(canApplyDocumentExtractionCandidate({ ...approvedMaintenanceCandidate, status: 'superseded' }))
      .toEqual({ allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' });
    expect(canApplyDocumentExtractionCandidate({
      ...approvedMaintenanceCandidate,
      status: 'applied',
      targetEntityId: 'schedule-001',
      appliedAt: '2026-05-08T10:00:00.000Z',
      appliedBy: 'user-001',
    })).toEqual({ allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' });
  });

  it('preserva aplicacao dos tipos anteriores (test 16)', () => {
    expect(canApplyTechnicalSystemCandidate(approvedTechnicalSystemCandidate)).toEqual({
      allowed: true,
      targetEntityType: 'technical_system',
    });
    expect(canApplyDocumentExtractionCandidate(approvedWarrantyCandidate)).toEqual({
      allowed: true,
      targetEntityType: 'warranty',
    });
  });

  it('retorna 404 para outro tenant/property/document/job/extraction (test 17)', () => {
    expect(canAccessDocumentExtractionCandidate({ ...validCandidateAccess, candidateTenantId: 'tenant-b' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canAccessDocumentExtractionCandidate({ ...validCandidateAccess, candidatePropertyId: 'prop-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canAccessDocumentExtractionCandidate({ ...validCandidateAccess, candidateDocumentId: 'doc-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canAccessDocumentExtractionCandidate({ ...validCandidateAccess, candidateJobId: 'job-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
    expect(canAccessDocumentExtractionCandidate({ ...validCandidateAccess, candidateExtractionId: 'ext-other' }))
      .toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 422 para payload invalido (test 18)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedMaintenanceCandidate,
      payloadJson: { systemType: 'plumbing', title: 'Sem campos obrigatorios' },
    })).toEqual({ allowed: false, status: 422, code: 'INVALID_MAINTENANCE_RECOMMENDATION_PAYLOAD' });
  });
});

describe('buildTechnicalSystemFromCandidatePayload', () => {
  const now = '2026-05-08T10:00:00.000Z';
  const technicalSystem = buildTechnicalSystemFromCandidatePayload({
    technicalSystemId: 'tech-001',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    payloadJson: approvedTechnicalSystemCandidate.payloadJson,
    now,
  });

  it('cria registro em technical_systems (test 2)', () => {
    expect(technicalSystem.id).toBe('tech-001');
  });

  it('preenche tenantId pelo backend (test 3)', () => {
    expect(technicalSystem.tenantId).toBe('tenant-a');
  });

  it('preenche propertyId corretamente (test 4)', () => {
    expect(technicalSystem.propertyId).toBe('prop-a');
  });

  it('mapeia name (test 5)', () => {
    expect(technicalSystem.name).toBe('Pressurizador');
  });

  it('mapeia type (test 6)', () => {
    expect(technicalSystem.type).toBe('plumbing');
  });

  it('mapeia description (test 7)', () => {
    expect(technicalSystem.description).toBe('Sistema de pressurizacao da rede hidraulica.');
  });

  it('mapeia locationSummary (test 8)', () => {
    expect(technicalSystem.locationSummary).toBe('Casa de maquinas');
  });

  it('mapeia installationDate (test 9)', () => {
    expect(technicalSystem.installationDate).toBe('2024-03-15');
  });

  it('technical system criado fica active (test 10)', () => {
    expect(technicalSystem.status).toBe('active');
  });

  it('nao cria warranty (test 31)', () => {
    expect(technicalSystem).not.toHaveProperty('warrantyType');
    expect(technicalSystem).not.toHaveProperty('endDate');
  });

  it('nao cria inventory item (test 32)', () => {
    expect(technicalSystem).not.toHaveProperty('serialNumber');
    expect(technicalSystem).not.toHaveProperty('quantity');
  });

  it('nao cria maintenance schedule (test 33)', () => {
    expect(technicalSystem).not.toHaveProperty('frequency');
    expect(technicalSystem).not.toHaveProperty('nextDueDate');
  });
});

describe('buildWarrantyFromCandidatePayload', () => {
  const now = '2026-05-08T10:00:00.000Z';
  const warranty = buildWarrantyFromCandidatePayload({
    warrantyId: 'warranty-001',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    documentId: 'doc-a',
    createdBy: 'user-001',
    payloadJson: approvedWarrantyCandidate.payloadJson,
    now,
  });

  it('cria registro em warranties (test 2)', () => {
    expect(warranty.id).toBe('warranty-001');
  });

  it('preenche tenantId na warranty pelo backend (test 3)', () => {
    expect(warranty.tenantId).toBe('tenant-a');
  });

  it('preenche propertyId corretamente (test 4)', () => {
    expect(warranty.propertyId).toBe('prop-a');
  });

  it('preenche documentId (test 5)', () => {
    expect(warranty.documentId).toBe('doc-a');
  });

  it('preenche createdBy (test 6)', () => {
    expect(warranty.createdBy).toBe('user-001');
  });

  it('mapeia title (test 7)', () => {
    expect(warranty.title).toBe('Garantia do pressurizador');
  });

  it('mapeia warrantyType (test 8)', () => {
    expect(warranty.warrantyType).toBe('equipment');
  });

  it('mapeia providerName (test 9)', () => {
    expect(warranty.providerName).toBe('Assistencia Tecnica Premium');
  });

  it('mapeia startDate (test 10)', () => {
    expect(warranty.startDate).toBe('2024-03-15');
  });

  it('mapeia endDate (test 11)', () => {
    expect(warranty.endDate).toBe('2027-03-15');
  });

  it('mapeia coverage (test 12)', () => {
    expect(warranty.coverage).toBe('Cobertura de defeitos de fabricacao e instalacao.');
  });

  it('mapeia exclusions (test 13)', () => {
    expect(warranty.exclusions).toBe('Mau uso e alteracoes nao autorizadas.');
  });

  it('warranty criada fica com status active (test 14)', () => {
    expect(warranty.status).toBe('active');
  });

  it('nao cria technical system ao aplicar warranty (test 36)', () => {
    expect(warranty).not.toHaveProperty('locationSummary');
    expect(warranty).not.toHaveProperty('installationDate');
  });

  it('nao cria inventory item (test 37)', () => {
    expect(warranty).not.toHaveProperty('quantity');
    expect(warranty).not.toHaveProperty('unit');
  });

  it('nao cria maintenance schedule (test 38)', () => {
    expect(warranty).not.toHaveProperty('recommendedIntervalMonths');
    expect(warranty).not.toHaveProperty('firstDueDate');
  });
});

describe('buildInventoryItemFromCandidatePayload', () => {
  const now = '2026-05-08T10:00:00.000Z';
  const inventoryItem = buildInventoryItemFromCandidatePayload({
    inventoryItemId: 'inventory-001',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    payloadJson: approvedInventoryItemCandidate.payloadJson,
    now,
  });

  it('cria registro em inventory_items (test 2)', () => {
    expect(inventoryItem.id).toBe('inventory-001');
  });

  it('preenche tenantId pelo backend (test 3)', () => {
    expect(inventoryItem.tenantId).toBe('tenant-a');
  });

  it('preenche propertyId (test 4)', () => {
    expect(inventoryItem.propertyId).toBe('prop-a');
  });

  it('mapeia category (test 5)', () => {
    expect(inventoryItem.category).toBe('electrical');
  });

  it('mapeia name (test 6)', () => {
    expect(inventoryItem.name).toBe('Disjuntor reserva');
  });

  it('mapeia brand (test 7)', () => {
    expect(inventoryItem.brand).toBe('Schneider');
  });

  it('mapeia model (test 8)', () => {
    expect(inventoryItem.model).toBe('C60');
  });

  it('mapeia supplier (test 9)', () => {
    expect(inventoryItem.supplier).toBe('Fornecedor Eletrico');
  });

  it('mapeia quantity (test 10)', () => {
    expect(inventoryItem.quantity).toBe(2);
  });

  it('mapeia unit (test 11)', () => {
    expect(inventoryItem.unit).toBe('un');
  });

  it('mapeia purchaseDate (test 12)', () => {
    expect(inventoryItem.purchaseDate).toBe('2025-01-10');
  });

  it('mapeia warrantyUntil (test 13)', () => {
    expect(inventoryItem.warrantyUntil).toBe('2027-01-10');
  });

  it('nao cria warranty (test 30)', () => {
    expect(inventoryItem).not.toHaveProperty('warrantyType');
    expect(inventoryItem).not.toHaveProperty('endDate');
  });

  it('nao cria technical system (test 31)', () => {
    expect(inventoryItem).not.toHaveProperty('locationSummary');
    expect(inventoryItem).not.toHaveProperty('installationDate');
  });

  it('nao cria maintenance schedule (test 32)', () => {
    expect(inventoryItem).not.toHaveProperty('frequency');
    expect(inventoryItem).not.toHaveProperty('nextDue');
  });
});

describe('buildMaintenanceScheduleFromCandidatePayload', () => {
  const now = '2026-05-08T10:00:00.000Z';
  const maintenanceSchedule = buildMaintenanceScheduleFromCandidatePayload({
    maintenanceScheduleId: 'schedule-001',
    tenantId: 'tenant-a',
    propertyId: 'prop-a',
    payloadJson: approvedMaintenanceCandidate.payloadJson,
    now,
  });

  it('cria registro em maintenance_schedules (test 2)', () => {
    expect(maintenanceSchedule.id).toBe('schedule-001');
  });

  it('mapeia systemType (test 3)', () => {
    expect(maintenanceSchedule.systemType).toBe('plumbing');
  });

  it('mapeia title (test 4)', () => {
    expect(maintenanceSchedule.title).toBe('Revisao preventiva do pressurizador');
  });

  it('mapeia description (test 5)', () => {
    expect(maintenanceSchedule.description).toBe('Verificar pressao, vazamentos e estado geral do sistema.');
  });

  it('converte 1 para monthly (test 6)', () => {
    expect(mapRecommendedIntervalMonthsToFrequency(1)).toEqual({
      frequency: 'monthly',
      unsupportedIntervalMonths: null,
    });
  });

  it('converte 3 para quarterly (test 7)', () => {
    expect(mapRecommendedIntervalMonthsToFrequency(3)).toEqual({
      frequency: 'quarterly',
      unsupportedIntervalMonths: null,
    });
  });

  it('converte 6 para semiannual (test 8)', () => {
    expect(maintenanceSchedule.frequency).toBe('semiannual');
  });

  it('converte 12 para annual (test 9)', () => {
    expect(mapRecommendedIntervalMonthsToFrequency(12)).toEqual({
      frequency: 'annual',
      unsupportedIntervalMonths: null,
    });
  });

  it('fallback para annual em intervalo nao suportado e preserva observacao (test 10)', () => {
    const fallback = buildMaintenanceScheduleFromCandidatePayload({
      maintenanceScheduleId: 'schedule-unsupported',
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      payloadJson: {
        ...approvedMaintenanceCandidate.payloadJson,
        recommendedIntervalMonths: 5,
      },
      now,
    });

    expect(fallback.frequency).toBe('annual');
    expect(fallback.notes).toContain('Intervalo recomendado original: 5 meses.');
  });

  it('mapeia firstDueDate para nextDue (test 11)', () => {
    expect(maintenanceSchedule.nextDue).toBe('2026-07-15');
  });

  it('inclui standardReference em notes (test 12)', () => {
    expect(maintenanceSchedule.notes).toContain('Referencia tecnica: Manual tecnico pagina 12.');
    expect(maintenanceSchedule.notes).toContain('Origem: IA/documento.');
  });

  it('preenche responsible como A definir e autoCreateOs como 0', () => {
    expect(maintenanceSchedule.responsible).toBe('A definir');
    expect(maintenanceSchedule.autoCreateOs).toBe(0);
  });

  it('nao cria technical system/warranty/inventory item (test 20)', () => {
    expect(maintenanceSchedule).not.toHaveProperty('locationSummary');
    expect(maintenanceSchedule).not.toHaveProperty('warrantyType');
    expect(maintenanceSchedule).not.toHaveProperty('quantity');
  });
});

describe('buildDocumentExtractionCandidateApplyPatch', () => {
  const now = '2026-05-08T10:00:00.000Z';
  const patch = buildDocumentExtractionCandidateApplyPatch({
    targetEntityId: 'tech-001',
    appliedBy: 'user-001',
    now,
  });

  it('candidate vira applied (test 11)', () => {
    expect(patch.status).toBe('applied');
  });

  it('candidate recebe targetEntityId (test 12)', () => {
    expect(patch.targetEntityId).toBe('tech-001');
  });

  it('candidate recebe appliedAt (test 13)', () => {
    expect(patch.appliedAt).toBe(now);
  });

  it('candidate recebe appliedBy (test 14)', () => {
    expect(patch.appliedBy).toBe('user-001');
  });

  it('nao altera status do job (test 14 adicional)', () => {
    expect(patch).not.toHaveProperty('jobStatus');
    expect(patch).not.toHaveProperty('statusJob');
  });
});

describe('canAccessDocumentExtractionCandidate', () => {
  it('retorna 404 para candidate de outra extraction (test 22)', () => {
    expect(canAccessDocumentExtractionCandidate({
      ...validCandidateAccess,
      candidateExtractionId: 'ext-other',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para candidate de outro job (test 23)', () => {
    expect(canAccessDocumentExtractionCandidate({
      ...validCandidateAccess,
      candidateJobId: 'job-other',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para candidate de outro documento (test 24)', () => {
    expect(canAccessDocumentExtractionCandidate({
      ...validCandidateAccess,
      candidateDocumentId: 'doc-other',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para candidate de outro property (test 25)', () => {
    expect(canAccessDocumentExtractionCandidate({
      ...validCandidateAccess,
      candidatePropertyId: 'prop-other',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para candidate de outro tenant (test 26)', () => {
    expect(canAccessDocumentExtractionCandidate({
      ...validCandidateAccess,
      candidateTenantId: 'tenant-b',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento soft-deleted (test 27)', () => {
    expect(canAccessDocumentForIngestion({
      activeTenantId: 'tenant-a',
      documentTenantId: 'tenant-a',
      documentPropertyId: 'prop-a',
      requestedPropertyId: 'prop-a',
      documentDeletedAt: '2026-05-08T10:00:00.000Z',
    })).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

describe('candidate apply response and audit safety', () => {
  it('nao expoe tenantId na response (test 29)', () => {
    const response = mapAppliedTechnicalSystemToResponse({
      id: 'tech-001',
      propertyId: 'prop-a',
      name: 'Pressurizador',
      type: 'plumbing',
      description: null,
      locationSummary: null,
      installationDate: null,
      status: 'active',
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-08T10:00:00.000Z',
    });

    expect(response).not.toHaveProperty('tenantId');
  });

  it('nao expoe tenantId na response de warranty (test 34)', () => {
    const response = mapAppliedWarrantyToResponse({
      id: 'warranty-001',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      title: 'Garantia do pressurizador',
      description: null,
      providerName: 'Assistencia Tecnica Premium',
      warrantyType: 'equipment',
      startDate: '2024-03-15',
      endDate: '2027-03-15',
      status: 'active',
      coverage: 'Cobertura',
      exclusions: 'Exclusoes',
      createdBy: 'user-001',
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-08T10:00:00.000Z',
    });

    expect(response).not.toHaveProperty('tenantId');
  });

  it('nao expoe tenantId na response de inventory item (test 28)', () => {
    const response = mapAppliedInventoryItemToResponse({
      id: 'inventory-001',
      propertyId: 'prop-a',
      category: 'electrical',
      name: 'Disjuntor reserva',
      brand: 'Schneider',
      model: 'C60',
      supplier: 'Fornecedor Eletrico',
      quantity: 2,
      unit: 'un',
      purchaseDate: '2025-01-10',
      warrantyUntil: '2027-01-10',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expect(response).not.toHaveProperty('tenantId');
  });

  it('nao expoe tenantId na response de maintenance schedule (test 19)', () => {
    const response = mapAppliedMaintenanceScheduleToResponse({
      id: 'schedule-001',
      propertyId: 'prop-a',
      systemType: 'plumbing',
      title: 'Revisao preventiva do pressurizador',
      description: 'Verificar pressao.',
      frequency: 'semiannual',
      lastDone: null,
      nextDue: '2026-07-15',
      responsible: 'A definir',
      autoCreateOs: 0,
      notes: 'Origem: IA/documento.',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expect(response).not.toHaveProperty('tenantId');
  });

  it('audit log nao contem payloadJson, rawText, rawJson ou normalizedJson (test 30)', () => {
    const auditData = buildDocumentExtractionCandidateAppliedAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      candidateId: 'candidate-001',
      targetEntityType: 'technical_system',
      targetEntityId: 'tech-001',
    });

    expect(auditData).toEqual({
      tenant_id: 'tenant-a',
      property_id: 'prop-a',
      document_id: 'doc-a',
      job_id: 'job-001',
      extraction_id: 'ext-001',
      candidate_id: 'candidate-001',
      target_entity_type: 'technical_system',
      target_entity_id: 'tech-001',
    });
    expect(auditData).not.toHaveProperty('payloadJson');
    expect(auditData).not.toHaveProperty('rawText');
    expect(auditData).not.toHaveProperty('rawJson');
    expect(auditData).not.toHaveProperty('normalizedJson');
  });

  it('audit log de warranty nao contem payloadJson, rawText, rawJson ou normalizedJson (test 35)', () => {
    const auditData = buildDocumentExtractionCandidateAppliedAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      candidateId: 'candidate-warranty-001',
      targetEntityType: 'warranty',
      targetEntityId: 'warranty-001',
    });

    expect(auditData).toMatchObject({
      target_entity_type: 'warranty',
      target_entity_id: 'warranty-001',
    });
    expect(auditData).not.toHaveProperty('payloadJson');
    expect(auditData).not.toHaveProperty('rawText');
    expect(auditData).not.toHaveProperty('rawJson');
    expect(auditData).not.toHaveProperty('normalizedJson');
  });

  it('audit log de inventory item nao contem payloadJson, rawText, rawJson ou normalizedJson (test 29)', () => {
    const auditData = buildDocumentExtractionCandidateAppliedAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      candidateId: 'candidate-inventory-001',
      targetEntityType: 'inventory_item',
      targetEntityId: 'inventory-001',
    });

    expect(auditData).toMatchObject({
      target_entity_type: 'inventory_item',
      target_entity_id: 'inventory-001',
    });
    expect(auditData).not.toHaveProperty('payloadJson');
    expect(auditData).not.toHaveProperty('rawText');
    expect(auditData).not.toHaveProperty('rawJson');
    expect(auditData).not.toHaveProperty('normalizedJson');
  });

  it('audit log de maintenance nao contem payload bruto (test 21)', () => {
    const auditData = buildDocumentExtractionCandidateAppliedAuditData({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      documentId: 'doc-a',
      jobId: 'job-001',
      extractionId: 'ext-001',
      candidateId: 'candidate-maintenance-001',
      targetEntityType: 'maintenance_schedule',
      targetEntityId: 'schedule-001',
    });

    expect(auditData).toMatchObject({
      target_entity_type: 'maintenance_schedule',
      target_entity_id: 'schedule-001',
    });
    expect(auditData).not.toHaveProperty('payloadJson');
    expect(auditData).not.toHaveProperty('rawText');
    expect(auditData).not.toHaveProperty('rawJson');
    expect(auditData).not.toHaveProperty('normalizedJson');
  });
});
