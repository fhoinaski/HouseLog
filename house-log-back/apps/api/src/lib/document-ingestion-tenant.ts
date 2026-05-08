import type {
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionJobStatus,
  DocumentIngestionProvider,
} from '@houselog/contracts';
import {
  DocumentExtractionSummarySchema,
  DocumentIngestionJobSchema,
} from '@houselog/contracts';

export type IngestionJobDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404 | 409; code: string };

export type DocumentIngestionJobListRow = {
  id: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  status: DocumentIngestionJobStatus;
  provider: DocumentIngestionProvider;
  modelName: string | null;
  attempts: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentIngestionJobListItem = DocumentIngestionJob;

export type DocumentIngestionJobListPage = {
  data: DocumentIngestionJobListItem[];
  next_cursor: string | null;
  has_more: boolean;
};

// Validates that a document belongs to the active tenant and requested property
// and is not soft-deleted. Returns NOT_FOUND for cross-tenant/cross-property access
// and for missing or deleted documents so as not to leak existence information.
export function canAccessDocumentForIngestion(input: {
  activeTenantId?: string | null;
  documentTenantId?: string | null;
  documentPropertyId?: string | null;
  requestedPropertyId: string;
  documentDeletedAt?: string | null;
}): IngestionJobDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.documentTenantId || input.documentTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.documentPropertyId || input.documentPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.documentDeletedAt) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

// Guards against creating a duplicate ingestion job when an active job already
// exists for the same document. Active statuses are: queued, processing, needs_review.
// A null/undefined existingActiveJobId means no active job — creation is allowed.
export function canCreateIngestionJob(input: {
  existingActiveJobId?: string | null;
}): IngestionJobDecision {
  if (input.existingActiveJobId) {
    return { allowed: false, status: 409, code: 'ACTIVE_JOB_EXISTS' };
  }
  return { allowed: true };
}

// Validates that an ingestion job belongs to the active tenant, requested property
// and requested document. Returns NOT_FOUND for cross-tenant/cross-property/cross-document
// access so as not to leak existence information.
export function canAccessIngestionJobDetail(input: {
  activeTenantId?: string | null;
  jobTenantId?: string | null;
  jobPropertyId?: string | null;
  jobDocumentId?: string | null;
  requestedPropertyId: string;
  requestedDocumentId: string;
}): IngestionJobDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.jobTenantId || input.jobTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.jobPropertyId || input.jobPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.jobDocumentId || input.jobDocumentId !== input.requestedDocumentId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

// Input shape for mapping a DB extraction row to a summary DTO.
// Includes the raw fields needed to compute boolean presence flags.
export type ExtractionSummaryInput = {
  id: string;
  documentId: string;
  jobId: string;
  rawText: string | null | undefined;
  rawJson: Record<string, unknown> | null | undefined;
  normalizedJson: Record<string, unknown> | null | undefined;
  confidenceScore: number | null | undefined;
  schemaVersion: string;
  modelName: string | null | undefined;
  createdAt: string;
};

// Output shape compatible with DocumentExtractionSummarySchema.
// Never exposes tenantId, rawText, rawJson or normalizedJson.
export type DocumentExtractionSummaryItem = DocumentExtractionSummary;

export type DocumentIngestionJobDetail = {
  job: DocumentIngestionJob;
  extractions: DocumentExtractionSummary[];
};

export function mapExtractionToSummary(row: ExtractionSummaryInput): DocumentExtractionSummaryItem {
  return DocumentExtractionSummarySchema.parse({
    id: row.id,
    documentId: row.documentId,
    jobId: row.jobId,
    confidenceScore: row.confidenceScore ?? null,
    schemaVersion: row.schemaVersion,
    modelName: row.modelName ?? null,
    createdAt: row.createdAt,
    hasRawText: !!row.rawText,
    hasRawJson: row.rawJson !== null && row.rawJson !== undefined,
    hasNormalizedJson: row.normalizedJson !== null && row.normalizedJson !== undefined,
  });
}

export function mapJobToContract(row: DocumentIngestionJobListRow): DocumentIngestionJob {
  return DocumentIngestionJobSchema.parse({
    id: row.id,
    propertyId: row.propertyId,
    documentId: row.documentId,
    status: row.status,
    provider: row.provider,
    modelName: row.modelName,
    attempts: row.attempts,
    lastError: row.lastError,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function getDocumentIngestionJobDetail(input: {
  job: DocumentIngestionJobListRow;
  extractions: ExtractionSummaryInput[];
  tenantId: string;
  propertyId: string;
  documentId: string;
}): DocumentIngestionJobDetail | null {
  const decision = canAccessIngestionJobDetail({
    activeTenantId: input.tenantId,
    jobTenantId: input.job.tenantId,
    jobPropertyId: input.job.propertyId,
    jobDocumentId: input.job.documentId,
    requestedPropertyId: input.propertyId,
    requestedDocumentId: input.documentId,
  });

  if (!decision.allowed) return null;

  return {
    job: mapJobToContract(input.job),
    extractions: input.extractions.map(mapExtractionToSummary),
  };
}

export function listDocumentIngestionJobsForDocument(input: {
  jobs: DocumentIngestionJobListRow[];
  tenantId: string;
  propertyId: string;
  documentId: string;
  status?: DocumentIngestionJobStatus;
  cursor?: string;
  limit: number;
}): DocumentIngestionJobListPage {
  const filtered = input.jobs
    .filter((job) => job.tenantId === input.tenantId)
    .filter((job) => job.propertyId === input.propertyId)
    .filter((job) => job.documentId === input.documentId)
    .filter((job) => !input.status || job.status === input.status)
    .filter((job) => !input.cursor || job.createdAt < input.cursor)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const page = filtered.slice(0, input.limit + 1);
  const hasMore = page.length > input.limit;
  const items = hasMore ? page.slice(0, input.limit) : page;
  const last = items.at(-1);

  return {
    data: items.map(mapJobToContract),
    next_cursor: hasMore && last ? last.createdAt : null,
    has_more: hasMore,
  };
}
