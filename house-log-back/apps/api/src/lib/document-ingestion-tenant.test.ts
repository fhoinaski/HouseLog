import { describe, expect, it } from 'vitest';
import {
  canAccessDocumentForIngestion,
  canCreateIngestionJob,
  canAccessIngestionJobDetail,
  getDocumentIngestionJobDetail,
  mapExtractionToSummary,
  listDocumentIngestionJobsForDocument,
  type DocumentIngestionJobListRow,
  type ExtractionSummaryInput,
} from './document-ingestion-tenant';

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
