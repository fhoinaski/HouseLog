import { describe, expect, it, vi } from 'vitest';
import { PropertyDocumentExtractionSchema } from '@houselog/contracts';
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
  mapExtractionToDetail,
  mapExtractionToSummary,
  mapAppliedTechnicalSystemToResponse,
  mapAppliedWarrantyToResponse,
  mapDocumentExtractionCandidateToContract,
  mapReviewToContract,
  listDocumentIngestionJobsForDocument,
  sanitizeDocumentIngestionQueueError,
  type DocumentExtractionCandidateRow,
  type DocumentExtractionReviewRow,
  type ExtractionDetailInput,
  type DocumentIngestionJobListRow,
  type ExtractionSummaryInput,
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

  it('nao cria review (test 15)', () => {
    const detail = mapExtractionToDetail(extractionDetailRow);
    expect(detail).not.toHaveProperty('review');
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
    })).toEqual({ allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' });
  });

  it('bloqueia candidate de tipo maintenance_recommendation (test 25)', () => {
    expect(canApplyDocumentExtractionCandidate({
      ...approvedWarrantyCandidate,
      candidateType: 'maintenance_recommendation',
      targetEntityType: 'maintenance_schedule',
    })).toEqual({ allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' });
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
});
