import type {
  DocumentExtractionCandidate,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateTargetEntityType,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionReview,
  DocumentExtractionReviewStatus,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionSummary,
  DocumentIngestionJobStatus,
  DocumentIngestionProvider,
  ExtractedInventoryItem,
  ExtractedMaintenanceRecommendation,
  ExtractedTechnicalSystem,
  ExtractedWarranty,
  MaintenanceFrequency,
  PropertyDocumentExtraction,
  PropertyDocumentIngestionSummary,
  TechnicalSystemStatus,
  WarrantyStatus,
} from '@houselog/contracts';
import {
  DocumentExtractionCandidateSchema,
  DocumentExtractionDetailSchema,
  DocumentExtractionReviewSchema,
  DocumentExtractionSummarySchema,
  DocumentIngestionJobSchema,
  DocumentIngestionSummarySchema,
  ExtractedInventoryItemSchema,
  ExtractedMaintenanceRecommendationSchema,
  ExtractedTechnicalSystemSchema,
  ExtractedWarrantySchema,
  PropertyDocumentIngestionSummarySchema,
  PropertyDocumentExtractionSchema,
} from '@houselog/contracts';
import type { DocumentIngestionQueueMessage } from './types';

export type IngestionJobDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404 | 409; code: 'TENANT_REQUIRED' | 'NOT_FOUND' | 'ACTIVE_JOB_EXISTS' };

export type TenantScopedEntityDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

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

export type DocumentIngestionSummaryJobRow = {
  status: DocumentIngestionJobStatus;
  createdAt: string;
};

export type DocumentIngestionSummaryExtractionRow = {
  id: string;
};

export type DocumentIngestionSummaryReviewRow = {
  status: DocumentExtractionReviewStatus;
};

export type DocumentIngestionSummaryCandidateRow = {
  status: DocumentExtractionCandidateStatus;
};

export type PropertyDocumentIngestionSummaryDocumentRow = {
  id: string;
  tenantId: string | null;
  propertyId: string;
  deletedAt?: string | null;
};

export type PropertyDocumentIngestionSummaryJobRow = {
  tenantId: string;
  propertyId: string;
  documentId: string;
  status: DocumentIngestionJobStatus;
  createdAt: string;
};

export type PropertyDocumentIngestionSummaryExtractionRow = {
  tenantId: string;
  propertyId: string;
  documentId: string;
  id: string;
};

export type PropertyDocumentIngestionSummaryReviewRow = {
  tenantId: string;
  propertyId: string;
  documentId: string;
  status: DocumentExtractionReviewStatus;
};

export type PropertyDocumentIngestionSummaryCandidateRow = {
  tenantId: string;
  propertyId: string;
  documentId: string;
  status: DocumentExtractionCandidateStatus;
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

export type ExtractionDetailInput = ExtractionSummaryInput & {
  tenantId: string;
  propertyId: string;
};

export type DocumentExtractionReviewRow = {
  id: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  extractionId: string;
  status: DocumentExtractionReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentExtractionReviewJobPatch =
  | {
      status: 'completed';
      lastError: null;
      finishedAt: string;
      updatedAt: string;
    }
  | {
      status: 'failed';
      lastError: string;
      finishedAt: string;
      updatedAt: string;
    }
  | {
      status: 'needs_review';
      lastError: null;
      updatedAt: string;
    };

export type DocumentExtractionReviewAuditData = {
  tenant_id: string;
  property_id: string;
  document_id: string;
  job_id: string;
  extraction_id: string;
  review_id: string;
  status: DocumentExtractionReviewStatus;
};

export type DocumentExtractionCandidateRow = {
  id: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  candidateType: DocumentExtractionCandidateType;
  status: DocumentExtractionCandidateStatus;
  targetEntityType: DocumentExtractionCandidateTargetEntityType;
  targetEntityId: string | null;
  sourcePath: string;
  payloadJson: Record<string, unknown>;
  confidenceScore: number | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  appliedBy: string | null;
};

export type DocumentExtractionCandidateListPage = {
  data: DocumentExtractionCandidate[];
  next_cursor: string | null;
  has_more: boolean;
};

export type NewDocumentExtractionCandidate = {
  id: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  candidateType: DocumentExtractionCandidateType;
  status: 'pending';
  targetEntityType: DocumentExtractionCandidateTargetEntityType;
  targetEntityId: null;
  sourcePath: string;
  payloadJson: Record<string, unknown>;
  confidenceScore: number | null;
  reviewNotes: null;
  createdAt: string;
  updatedAt: string;
  appliedAt: null;
  appliedBy: null;
};

export type CandidateGenerationDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 400 | 404 | 409 | 422;
      code:
        | 'TENANT_REQUIRED'
        | 'NOT_FOUND'
        | 'NORMALIZED_JSON_REQUIRED'
        | 'INVALID_NORMALIZED_JSON'
        | 'EXTRACTION_REVIEW_NOT_APPROVED'
        | 'CANDIDATES_ALREADY_EXIST';
    };

export type CandidateReviewDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 400 | 404 | 409;
      code:
        | 'TENANT_REQUIRED'
        | 'NOT_FOUND'
        | 'CANDIDATE_ALREADY_APPLIED'
        | 'CANDIDATE_SUPERSEDED';
    };

export type DocumentExtractionCandidateReviewPatch = {
  status: 'approved' | 'rejected';
  reviewNotes: string | null;
  updatedAt: string;
};

export type DocumentExtractionCandidateReviewAuditData = {
  tenant_id: string;
  property_id: string;
  document_id: string;
  job_id: string;
  extraction_id: string;
  candidate_id: string;
  status: 'approved' | 'rejected';
};

export type CandidateApplyDecision =
  | { allowed: true; targetEntityType: 'technical_system' | 'warranty' | 'inventory_item' | 'maintenance_schedule' }
  | {
      allowed: false;
      status: 400 | 404 | 409 | 422;
      code:
        | 'TENANT_REQUIRED'
        | 'NOT_FOUND'
        | 'CANDIDATE_NOT_APPROVED'
        | 'CANDIDATE_ALREADY_APPLIED'
        | 'UNSUPPORTED_CANDIDATE_TYPE'
        | 'INVALID_CANDIDATE_TARGET'
        | 'INVALID_TECHNICAL_SYSTEM_PAYLOAD'
        | 'INVALID_WARRANTY_PAYLOAD'
        | 'INVALID_INVENTORY_ITEM_PAYLOAD'
        | 'WARRANTY_END_DATE_REQUIRED'
        | 'INVALID_MAINTENANCE_RECOMMENDATION_PAYLOAD';
    };

export type TechnicalSystemFromCandidateInsert = {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  type: ExtractedTechnicalSystem['type'];
  description: string | null;
  locationSummary: string | null;
  installationDate: string | null;
  status: 'active';
  createdAt: string;
  updatedAt: string;
};

export type WarrantyFromCandidateInsert = {
  id: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  title: string;
  description: string | null;
  providerName: string | null;
  warrantyType: ExtractedWarranty['warrantyType'];
  startDate: string | null;
  endDate: string;
  status: 'active';
  coverage: string | null;
  exclusions: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItemFromCandidateInsert = {
  id: string;
  tenantId: string;
  propertyId: string;
  category: ExtractedInventoryItem['category'];
  name: string;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  createdAt: string;
};

export type MaintenanceScheduleFromCandidateInsert = {
  id: string;
  tenantId: string;
  propertyId: string;
  systemType: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  lastDone: null;
  nextDue: string | null;
  responsible: string;
  autoCreateOs: 0;
  notes: string | null;
  createdAt: string;
};

export type AppliedTechnicalSystem = {
  id: string;
  propertyId: string;
  name: string;
  type: ExtractedTechnicalSystem['type'];
  description: string | null;
  locationSummary: string | null;
  installationDate: string | null;
  status: TechnicalSystemStatus;
  createdAt: string;
  updatedAt: string | null;
};

export type AppliedWarranty = {
  id: string;
  propertyId: string;
  documentId: string | null;
  title: string;
  description: string | null;
  providerName: string | null;
  warrantyType: ExtractedWarranty['warrantyType'];
  startDate: string | null;
  endDate: string;
  status: WarrantyStatus;
  coverage: string | null;
  exclusions: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

export type AppliedInventoryItem = {
  id: string;
  propertyId: string;
  category: ExtractedInventoryItem['category'];
  name: string;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  quantity: number | null;
  unit: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  createdAt: string;
};

export type AppliedMaintenanceSchedule = {
  id: string;
  propertyId: string;
  systemType: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  lastDone: string | null;
  nextDue: string | null;
  responsible: string | null;
  autoCreateOs: number | null;
  notes: string | null;
  createdAt: string;
};

export type DocumentExtractionCandidateApplyPatch = {
  status: 'applied';
  targetEntityId: string;
  appliedAt: string;
  appliedBy: string;
  updatedAt: string;
};

export type DocumentExtractionCandidateAppliedAuditData = {
  tenant_id: string;
  property_id: string;
  document_id: string;
  job_id: string;
  extraction_id: string;
  candidate_id: string;
  target_entity_type: 'technical_system' | 'warranty' | 'inventory_item' | 'maintenance_schedule';
  target_entity_id: string;
};

// Output shape compatible with DocumentExtractionSummarySchema.
// Never exposes tenantId, rawText, rawJson or normalizedJson.
export type DocumentExtractionSummaryItem = DocumentExtractionSummary;

export type DocumentIngestionJobDetail = {
  job: DocumentIngestionJob;
  extractions: DocumentExtractionSummary[];
};

const blockedRawJsonKeys = new Set([
  'r2Key',
  'r2_key',
  'fileUrl',
  'file_url',
  'privateUrl',
  'private_url',
  'storageKey',
  'storage_key',
]);

export function buildDocumentIngestionQueueMessage(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
}): DocumentIngestionQueueMessage {
  return {
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    documentId: input.documentId,
    jobId: input.jobId,
  };
}

export function sanitizeDocumentIngestionQueueError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const trimmed = rawMessage.trim();
  if (!trimmed) return 'Falha ao enfileirar job de ingestao de documento';

  return trimmed
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted-token]')
    .slice(0, 240);
}

export function buildDocumentIngestionQueueFailurePatch(error: unknown, updatedAt: string): {
  status: 'failed';
  lastError: string;
  updatedAt: string;
} {
  return {
    status: 'failed',
    lastError: sanitizeDocumentIngestionQueueError(error),
    updatedAt,
  };
}

export async function enqueueDocumentIngestionJob(
  queue: Queue<DocumentIngestionQueueMessage>,
  input: {
    tenantId: string;
    propertyId: string;
    documentId: string;
    jobId: string;
  }
): Promise<DocumentIngestionQueueMessage> {
  const message = buildDocumentIngestionQueueMessage(input);
  await queue.send(message);
  return message;
}

export function canAccessExtractionDetail(input: {
  activeTenantId?: string | null;
  extractionTenantId?: string | null;
  extractionPropertyId?: string | null;
  extractionDocumentId?: string | null;
  extractionJobId?: string | null;
  requestedPropertyId: string;
  requestedDocumentId: string;
  requestedJobId: string;
}): TenantScopedEntityDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.extractionTenantId || input.extractionTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.extractionPropertyId || input.extractionPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.extractionDocumentId || input.extractionDocumentId !== input.requestedDocumentId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.extractionJobId || input.extractionJobId !== input.requestedJobId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

function sanitizeRawJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeRawJsonValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (!blockedRawJsonKeys.has(key)) {
        sanitized[key] = sanitizeRawJsonValue(nestedValue);
      }
    }
    return sanitized;
  }

  return value;
}

export function sanitizeExtractionRawJson(rawJson: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (rawJson === null || rawJson === undefined) return null;
  return sanitizeRawJsonValue(rawJson) as Record<string, unknown>;
}

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

export function mapExtractionToDetail(
  row: ExtractionDetailInput,
  review?: DocumentExtractionReviewRow | null
): DocumentExtractionDetail {
  const rawJson = sanitizeExtractionRawJson(row.rawJson);
  const normalizedJson: PropertyDocumentExtraction | null = row.normalizedJson
    ? PropertyDocumentExtractionSchema.parse(row.normalizedJson)
    : null;

  return DocumentExtractionDetailSchema.parse({
    id: row.id,
    documentId: row.documentId,
    jobId: row.jobId,
    confidenceScore: row.confidenceScore ?? null,
    schemaVersion: row.schemaVersion,
    modelName: row.modelName ?? null,
    createdAt: row.createdAt,
    hasRawText: !!row.rawText,
    hasRawJson: rawJson !== null,
    hasNormalizedJson: normalizedJson !== null,
    rawText: row.rawText ?? null,
    rawJson,
    normalizedJson,
    review: review ? mapReviewToContract(review) : null,
  });
}

export function mapReviewToContract(row: DocumentExtractionReviewRow): DocumentExtractionReview {
  return DocumentExtractionReviewSchema.parse({
    id: row.id,
    documentId: row.documentId,
    extractionId: row.extractionId,
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function buildDocumentExtractionReviewJobPatch(input: {
  status: 'approved' | 'rejected' | 'partially_applied';
  now: string;
}): DocumentExtractionReviewJobPatch {
  if (input.status === 'approved') {
    return {
      status: 'completed',
      lastError: null,
      finishedAt: input.now,
      updatedAt: input.now,
    };
  }

  if (input.status === 'rejected') {
    return {
      status: 'failed',
      lastError: 'Extraction rejected by reviewer',
      finishedAt: input.now,
      updatedAt: input.now,
    };
  }

  return {
    status: 'needs_review',
    lastError: null,
    updatedAt: input.now,
  };
}

export function buildDocumentExtractionReviewAuditData(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  reviewId: string;
  status: DocumentExtractionReviewStatus;
}): DocumentExtractionReviewAuditData {
  return {
    tenant_id: input.tenantId,
    property_id: input.propertyId,
    document_id: input.documentId,
    job_id: input.jobId,
    extraction_id: input.extractionId,
    review_id: input.reviewId,
    status: input.status,
  };
}

export function mapDocumentExtractionCandidateToContract(
  row: DocumentExtractionCandidateRow
): DocumentExtractionCandidate {
  return DocumentExtractionCandidateSchema.parse({
    id: row.id,
    documentId: row.documentId,
    jobId: row.jobId,
    extractionId: row.extractionId,
    candidateType: row.candidateType,
    status: row.status,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    sourcePath: row.sourcePath,
    payloadJson: row.payloadJson,
    confidenceScore: row.confidenceScore,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    appliedAt: row.appliedAt,
    appliedBy: row.appliedBy,
  });
}

export function canReviewDocumentExtractionCandidate(input: {
  activeTenantId?: string | null;
  candidateTenantId?: string | null;
  candidatePropertyId?: string | null;
  candidateDocumentId?: string | null;
  candidateJobId?: string | null;
  candidateExtractionId?: string | null;
  requestedPropertyId: string;
  requestedDocumentId: string;
  requestedJobId: string;
  requestedExtractionId: string;
  candidateStatus?: DocumentExtractionCandidateStatus | null;
}): CandidateReviewDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.candidateTenantId || input.candidateTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidatePropertyId || input.candidatePropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateDocumentId || input.candidateDocumentId !== input.requestedDocumentId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateJobId || input.candidateJobId !== input.requestedJobId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateExtractionId || input.candidateExtractionId !== input.requestedExtractionId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.candidateStatus === 'applied') {
    return { allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' };
  }
  if (input.candidateStatus === 'superseded') {
    return { allowed: false, status: 409, code: 'CANDIDATE_SUPERSEDED' };
  }
  return { allowed: true };
}

export function buildDocumentExtractionCandidateReviewPatch(input: {
  status: 'approved' | 'rejected';
  reviewNotes?: string;
  now: string;
}): DocumentExtractionCandidateReviewPatch {
  return {
    status: input.status,
    reviewNotes: input.reviewNotes ?? null,
    updatedAt: input.now,
  };
}

export function buildDocumentExtractionCandidateReviewAuditData(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  candidateId: string;
  status: 'approved' | 'rejected';
}): DocumentExtractionCandidateReviewAuditData {
  return {
    tenant_id: input.tenantId,
    property_id: input.propertyId,
    document_id: input.documentId,
    job_id: input.jobId,
    extraction_id: input.extractionId,
    candidate_id: input.candidateId,
    status: input.status,
  };
}

export function canAccessDocumentExtractionCandidate(input: {
  activeTenantId?: string | null;
  candidateTenantId?: string | null;
  candidatePropertyId?: string | null;
  candidateDocumentId?: string | null;
  candidateJobId?: string | null;
  candidateExtractionId?: string | null;
  requestedPropertyId: string;
  requestedDocumentId: string;
  requestedJobId: string;
  requestedExtractionId: string;
}): TenantScopedEntityDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.candidateTenantId || input.candidateTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidatePropertyId || input.candidatePropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateDocumentId || input.candidateDocumentId !== input.requestedDocumentId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateJobId || input.candidateJobId !== input.requestedJobId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.candidateExtractionId || input.candidateExtractionId !== input.requestedExtractionId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canApplyTechnicalSystemCandidate(
  candidate: Pick<
    DocumentExtractionCandidateRow,
    'candidateType' | 'status' | 'targetEntityType' | 'targetEntityId' | 'appliedAt' | 'appliedBy' | 'payloadJson'
  >
): CandidateApplyDecision {
  if (candidate.candidateType !== 'technical_system') {
    return { allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' };
  }
  const decision = canApplyDocumentExtractionCandidate(candidate);
  if (!decision.allowed) return decision;
  if (decision.targetEntityType !== 'technical_system') {
    return { allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' };
  }
  return decision;
}

export function canApplyDocumentExtractionCandidate(
  candidate: Pick<
    DocumentExtractionCandidateRow,
    'candidateType' | 'status' | 'targetEntityType' | 'targetEntityId' | 'appliedAt' | 'appliedBy' | 'payloadJson'
  >
): CandidateApplyDecision {
  if (candidate.status === 'applied' || candidate.targetEntityId || candidate.appliedAt || candidate.appliedBy) {
    return { allowed: false, status: 409, code: 'CANDIDATE_ALREADY_APPLIED' };
  }
  if (candidate.status !== 'approved') {
    return { allowed: false, status: 409, code: 'CANDIDATE_NOT_APPROVED' };
  }

  if (candidate.candidateType === 'technical_system') {
    if (candidate.targetEntityType !== 'technical_system') {
      return { allowed: false, status: 422, code: 'INVALID_CANDIDATE_TARGET' };
    }
    if (!ExtractedTechnicalSystemSchema.safeParse(candidate.payloadJson).success) {
      return { allowed: false, status: 422, code: 'INVALID_TECHNICAL_SYSTEM_PAYLOAD' };
    }
    return { allowed: true, targetEntityType: 'technical_system' };
  }

  if (candidate.candidateType === 'warranty') {
    if (candidate.targetEntityType !== 'warranty') {
      return { allowed: false, status: 422, code: 'INVALID_CANDIDATE_TARGET' };
    }
    const parsed = ExtractedWarrantySchema.safeParse(candidate.payloadJson);
    if (!parsed.success) {
      return { allowed: false, status: 422, code: 'INVALID_WARRANTY_PAYLOAD' };
    }
    if (!parsed.data.endDate) {
      return { allowed: false, status: 422, code: 'WARRANTY_END_DATE_REQUIRED' };
    }
    return { allowed: true, targetEntityType: 'warranty' };
  }

  if (candidate.candidateType === 'inventory_item') {
    if (candidate.targetEntityType !== 'inventory_item') {
      return { allowed: false, status: 422, code: 'INVALID_CANDIDATE_TARGET' };
    }
    if (!ExtractedInventoryItemSchema.safeParse(candidate.payloadJson).success) {
      return { allowed: false, status: 422, code: 'INVALID_INVENTORY_ITEM_PAYLOAD' };
    }
    return { allowed: true, targetEntityType: 'inventory_item' };
  }

  if (candidate.candidateType === 'maintenance_recommendation') {
    if (candidate.targetEntityType !== 'maintenance_schedule') {
      return { allowed: false, status: 422, code: 'INVALID_CANDIDATE_TARGET' };
    }
    if (!ExtractedMaintenanceRecommendationSchema.safeParse(candidate.payloadJson).success) {
      return { allowed: false, status: 422, code: 'INVALID_MAINTENANCE_RECOMMENDATION_PAYLOAD' };
    }
    return { allowed: true, targetEntityType: 'maintenance_schedule' };
  }

  return { allowed: false, status: 422, code: 'UNSUPPORTED_CANDIDATE_TYPE' };
}

export function buildTechnicalSystemFromCandidatePayload(input: {
  technicalSystemId: string;
  tenantId: string;
  propertyId: string;
  payloadJson: Record<string, unknown>;
  now: string;
}): TechnicalSystemFromCandidateInsert {
  const payload = ExtractedTechnicalSystemSchema.parse(input.payloadJson);
  return {
    id: input.technicalSystemId,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    name: payload.name,
    type: payload.type,
    description: payload.description ?? null,
    locationSummary: payload.locationSummary ?? null,
    installationDate: payload.installationDate ?? null,
    status: 'active',
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function optionalExtractedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildWarrantyFromCandidatePayload(input: {
  warrantyId: string;
  tenantId: string;
  propertyId: string;
  documentId: string;
  createdBy: string;
  payloadJson: Record<string, unknown>;
  now: string;
}): WarrantyFromCandidateInsert {
  const payload = ExtractedWarrantySchema.parse(input.payloadJson);
  if (!payload.endDate) {
    throw new Error('WARRANTY_END_DATE_REQUIRED');
  }

  return {
    id: input.warrantyId,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    documentId: input.documentId,
    title: payload.title.trim(),
    description: null,
    providerName: optionalExtractedText(payload.providerName),
    warrantyType: payload.warrantyType,
    startDate: optionalExtractedText(payload.startDate),
    endDate: payload.endDate,
    status: 'active',
    coverage: optionalExtractedText(payload.coverage),
    exclusions: optionalExtractedText(payload.exclusions),
    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function buildInventoryItemFromCandidatePayload(input: {
  inventoryItemId: string;
  tenantId: string;
  propertyId: string;
  payloadJson: Record<string, unknown>;
  now: string;
}): InventoryItemFromCandidateInsert {
  const payload = ExtractedInventoryItemSchema.parse(input.payloadJson);
  return {
    id: input.inventoryItemId,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    category: payload.category,
    name: payload.name.trim(),
    brand: optionalExtractedText(payload.brand),
    model: optionalExtractedText(payload.model),
    supplier: optionalExtractedText(payload.supplier),
    quantity: payload.quantity ?? 0,
    unit: optionalExtractedText(payload.unit) ?? 'un',
    purchaseDate: optionalExtractedText(payload.purchaseDate),
    warrantyUntil: optionalExtractedText(payload.warrantyUntil),
    createdAt: input.now,
  };
}

export function mapRecommendedIntervalMonthsToFrequency(
  months: number | null | undefined
): { frequency: MaintenanceFrequency; unsupportedIntervalMonths: number | null } {
  if (months === 1) return { frequency: 'monthly', unsupportedIntervalMonths: null };
  if (months === 3) return { frequency: 'quarterly', unsupportedIntervalMonths: null };
  if (months === 6) return { frequency: 'semiannual', unsupportedIntervalMonths: null };
  if (months === 12 || months === null || months === undefined) {
    return { frequency: 'annual', unsupportedIntervalMonths: null };
  }
  return { frequency: 'annual', unsupportedIntervalMonths: months };
}

export function buildMaintenanceScheduleNotes(input: {
  standardReference?: string;
  unsupportedIntervalMonths: number | null;
}): string {
  const notes = ['Origem: IA/documento.'];
  const standardReference = optionalExtractedText(input.standardReference);
  if (standardReference) notes.push(`Referencia tecnica: ${standardReference}.`);
  if (input.unsupportedIntervalMonths !== null) {
    notes.push(`Intervalo recomendado original: ${input.unsupportedIntervalMonths} meses.`);
  }
  return notes.join(' ');
}

export function buildMaintenanceScheduleFromCandidatePayload(input: {
  maintenanceScheduleId: string;
  tenantId: string;
  propertyId: string;
  payloadJson: Record<string, unknown>;
  now: string;
}): MaintenanceScheduleFromCandidateInsert {
  const payload: ExtractedMaintenanceRecommendation = ExtractedMaintenanceRecommendationSchema.parse(input.payloadJson);
  const interval = mapRecommendedIntervalMonthsToFrequency(payload.recommendedIntervalMonths);

  return {
    id: input.maintenanceScheduleId,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    systemType: payload.systemType,
    title: payload.title,
    description: payload.description ?? null,
    frequency: interval.frequency,
    lastDone: null,
    nextDue: payload.firstDueDate ?? null,
    responsible: 'A definir',
    autoCreateOs: 0,
    notes: buildMaintenanceScheduleNotes({
      standardReference: payload.standardReference,
      unsupportedIntervalMonths: interval.unsupportedIntervalMonths,
    }),
    createdAt: input.now,
  };
}

export function buildDocumentExtractionCandidateApplyPatch(input: {
  targetEntityId: string;
  appliedBy: string;
  now: string;
}): DocumentExtractionCandidateApplyPatch {
  return {
    status: 'applied',
    targetEntityId: input.targetEntityId,
    appliedAt: input.now,
    appliedBy: input.appliedBy,
    updatedAt: input.now,
  };
}

export function buildDocumentExtractionCandidateAppliedAuditData(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  candidateId: string;
  targetEntityType: 'technical_system' | 'warranty' | 'inventory_item' | 'maintenance_schedule';
  targetEntityId: string;
}): DocumentExtractionCandidateAppliedAuditData {
  return {
    tenant_id: input.tenantId,
    property_id: input.propertyId,
    document_id: input.documentId,
    job_id: input.jobId,
    extraction_id: input.extractionId,
    candidate_id: input.candidateId,
    target_entity_type: input.targetEntityType,
    target_entity_id: input.targetEntityId,
  };
}

export function mapAppliedTechnicalSystemToResponse(row: {
  id: string;
  propertyId: string;
  name: string;
  type: ExtractedTechnicalSystem['type'];
  description: string | null;
  locationSummary: string | null;
  installationDate: string | null;
  status: TechnicalSystemStatus;
  createdAt: string;
  updatedAt: string | null;
}): AppliedTechnicalSystem {
  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    type: row.type,
    description: row.description,
    locationSummary: row.locationSummary,
    installationDate: row.installationDate,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapAppliedWarrantyToResponse(row: {
  id: string;
  propertyId: string;
  documentId: string | null;
  title: string;
  description: string | null;
  providerName: string | null;
  warrantyType: ExtractedWarranty['warrantyType'];
  startDate: string | null;
  endDate: string;
  status: WarrantyStatus;
  coverage: string | null;
  exclusions: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}): AppliedWarranty {
  return {
    id: row.id,
    propertyId: row.propertyId,
    documentId: row.documentId,
    title: row.title,
    description: row.description,
    providerName: row.providerName,
    warrantyType: row.warrantyType,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    coverage: row.coverage,
    exclusions: row.exclusions,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapAppliedInventoryItemToResponse(row: {
  id: string;
  propertyId: string;
  category: ExtractedInventoryItem['category'];
  name: string;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  quantity: number | null;
  unit: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  createdAt: string;
}): AppliedInventoryItem {
  return {
    id: row.id,
    propertyId: row.propertyId,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    supplier: row.supplier,
    quantity: row.quantity,
    unit: row.unit,
    purchaseDate: row.purchaseDate,
    warrantyUntil: row.warrantyUntil,
    createdAt: row.createdAt,
  };
}

export function mapAppliedMaintenanceScheduleToResponse(row: {
  id: string;
  propertyId: string;
  systemType: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  lastDone: string | null;
  nextDue: string | null;
  responsible: string | null;
  autoCreateOs: number | null;
  notes: string | null;
  createdAt: string;
}): AppliedMaintenanceSchedule {
  return {
    id: row.id,
    propertyId: row.propertyId,
    systemType: row.systemType,
    title: row.title,
    description: row.description,
    frequency: row.frequency,
    lastDone: row.lastDone,
    nextDue: row.nextDue,
    responsible: row.responsible,
    autoCreateOs: row.autoCreateOs,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function canGenerateDocumentExtractionCandidates(input: {
  activeTenantId?: string | null;
  extractionTenantId?: string | null;
  extractionPropertyId?: string | null;
  extractionDocumentId?: string | null;
  extractionJobId?: string | null;
  requestedPropertyId: string;
  requestedDocumentId: string;
  requestedJobId: string;
  normalizedJson?: Record<string, unknown> | null;
  reviewStatus?: DocumentExtractionReviewStatus | null;
  existingCandidateCount: number;
}): CandidateGenerationDecision {
  const accessDecision = canAccessExtractionDetail({
    activeTenantId: input.activeTenantId,
    extractionTenantId: input.extractionTenantId,
    extractionPropertyId: input.extractionPropertyId,
    extractionDocumentId: input.extractionDocumentId,
    extractionJobId: input.extractionJobId,
    requestedPropertyId: input.requestedPropertyId,
    requestedDocumentId: input.requestedDocumentId,
    requestedJobId: input.requestedJobId,
  });

  if (!accessDecision.allowed) return accessDecision;
  if (!input.normalizedJson) {
    return { allowed: false, status: 409, code: 'NORMALIZED_JSON_REQUIRED' };
  }
  if (!PropertyDocumentExtractionSchema.safeParse(input.normalizedJson).success) {
    return { allowed: false, status: 422, code: 'INVALID_NORMALIZED_JSON' };
  }
  if (input.reviewStatus !== 'approved' && input.reviewStatus !== 'partially_applied') {
    return { allowed: false, status: 409, code: 'EXTRACTION_REVIEW_NOT_APPROVED' };
  }
  if (input.existingCandidateCount > 0) {
    return { allowed: false, status: 409, code: 'CANDIDATES_ALREADY_EXIST' };
  }
  return { allowed: true };
}

export function buildDocumentExtractionCandidates(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  normalizedJson: Record<string, unknown>;
  extractionConfidenceScore?: number | null;
  now: string;
  idFactory: () => string;
}): NewDocumentExtractionCandidate[] {
  const extraction = PropertyDocumentExtractionSchema.parse(input.normalizedJson);
  const fallbackConfidence = input.extractionConfidenceScore ?? extraction.confidenceScore ?? null;
  const base = {
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    documentId: input.documentId,
    jobId: input.jobId,
    extractionId: input.extractionId,
    status: 'pending' as const,
    targetEntityId: null,
    reviewNotes: null,
    createdAt: input.now,
    updatedAt: input.now,
    appliedAt: null,
    appliedBy: null,
  };
  const candidates: NewDocumentExtractionCandidate[] = [];

  extraction.technicalSystems.forEach((item, index) => {
    candidates.push({
      ...base,
      id: input.idFactory(),
      candidateType: 'technical_system',
      targetEntityType: 'technical_system',
      sourcePath: `technicalSystems[${index}]`,
      payloadJson: { ...item },
      confidenceScore: item.confidenceScore ?? fallbackConfidence,
    });
  });
  extraction.warranties.forEach((item, index) => {
    candidates.push({
      ...base,
      id: input.idFactory(),
      candidateType: 'warranty',
      targetEntityType: 'warranty',
      sourcePath: `warranties[${index}]`,
      payloadJson: { ...item },
      confidenceScore: item.confidenceScore ?? fallbackConfidence,
    });
  });
  extraction.inventoryItems.forEach((item, index) => {
    candidates.push({
      ...base,
      id: input.idFactory(),
      candidateType: 'inventory_item',
      targetEntityType: 'inventory_item',
      sourcePath: `inventoryItems[${index}]`,
      payloadJson: { ...item },
      confidenceScore: item.confidenceScore ?? fallbackConfidence,
    });
  });
  extraction.maintenanceRecommendations.forEach((item, index) => {
    candidates.push({
      ...base,
      id: input.idFactory(),
      candidateType: 'maintenance_recommendation',
      targetEntityType: 'maintenance_schedule',
      sourcePath: `maintenanceRecommendations[${index}]`,
      payloadJson: { ...item },
      confidenceScore: item.confidenceScore ?? fallbackConfidence,
    });
  });

  return candidates;
}

export function buildDocumentExtractionCandidatesAuditData(input: {
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  candidates: Array<{ candidateType: DocumentExtractionCandidateType }>;
}): Record<string, unknown> {
  const countsByType = input.candidates.reduce<Record<DocumentExtractionCandidateType, number>>(
    (counts, candidate) => {
      counts[candidate.candidateType] += 1;
      return counts;
    },
    {
      technical_system: 0,
      warranty: 0,
      inventory_item: 0,
      maintenance_recommendation: 0,
    }
  );

  return {
    property_id: input.propertyId,
    document_id: input.documentId,
    job_id: input.jobId,
    extraction_id: input.extractionId,
    total_count: input.candidates.length,
    counts_by_type: countsByType,
  };
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

export function getDocumentExtractionDetail(input: {
  extraction: ExtractionDetailInput;
  review?: DocumentExtractionReviewRow | null;
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
}): DocumentExtractionDetail | null {
  const decision = canAccessExtractionDetail({
    activeTenantId: input.tenantId,
    extractionTenantId: input.extraction.tenantId,
    extractionPropertyId: input.extraction.propertyId,
    extractionDocumentId: input.extraction.documentId,
    extractionJobId: input.extraction.jobId,
    requestedPropertyId: input.propertyId,
    requestedDocumentId: input.documentId,
    requestedJobId: input.jobId,
  });

  if (!decision.allowed) return null;

  return mapExtractionToDetail(input.extraction, input.review);
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

export function listDocumentExtractionCandidatesForExtraction(input: {
  candidates: DocumentExtractionCandidateRow[];
  tenantId: string;
  propertyId: string;
  documentId: string;
  jobId: string;
  extractionId: string;
  status?: DocumentExtractionCandidateStatus;
  candidateType?: DocumentExtractionCandidateType;
  cursor?: string;
  limit: number;
}): DocumentExtractionCandidateListPage {
  const filtered = input.candidates
    .filter((candidate) => candidate.tenantId === input.tenantId)
    .filter((candidate) => candidate.propertyId === input.propertyId)
    .filter((candidate) => candidate.documentId === input.documentId)
    .filter((candidate) => candidate.jobId === input.jobId)
    .filter((candidate) => candidate.extractionId === input.extractionId)
    .filter((candidate) => !input.status || candidate.status === input.status)
    .filter((candidate) => !input.candidateType || candidate.candidateType === input.candidateType)
    .filter((candidate) => !input.cursor || candidate.createdAt < input.cursor)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const page = filtered.slice(0, input.limit + 1);
  const hasMore = page.length > input.limit;
  const items = hasMore ? page.slice(0, input.limit) : page;
  const last = items.at(-1);

  return {
    data: items.map(mapDocumentExtractionCandidateToContract),
    next_cursor: hasMore && last ? last.createdAt : null,
    has_more: hasMore,
  };
}

export function buildDocumentIngestionSummary(input: {
  jobs: DocumentIngestionSummaryJobRow[];
  extractions: DocumentIngestionSummaryExtractionRow[];
  reviews: DocumentIngestionSummaryReviewRow[];
  candidates: DocumentIngestionSummaryCandidateRow[];
}): DocumentIngestionSummary {
  const latestJob = input.jobs.reduce<DocumentIngestionSummaryJobRow | null>((latest, job) => {
    if (!latest) return job;
    return job.createdAt > latest.createdAt ? job : latest;
  }, null);

  const summary = {
    totalJobs: input.jobs.length,
    latestJobStatus: latestJob?.status ?? null,
    totalExtractions: input.extractions.length,
    totalReviews: input.reviews.length,
    pendingReviews: input.reviews.filter((review) => review.status === 'pending').length,
    totalCandidates: input.candidates.length,
    pendingCandidates: input.candidates.filter((candidate) => candidate.status === 'pending').length,
    approvedCandidates: input.candidates.filter((candidate) => candidate.status === 'approved').length,
    rejectedCandidates: input.candidates.filter((candidate) => candidate.status === 'rejected').length,
    appliedCandidates: input.candidates.filter((candidate) => candidate.status === 'applied').length,
    failedJobs: input.jobs.filter((job) => job.status === 'failed').length,
    lastIngestionAt: latestJob?.createdAt ?? null,
  };

  return DocumentIngestionSummarySchema.parse(summary);
}

export function buildPropertyDocumentIngestionSummary(input: {
  tenantId: string;
  propertyId: string;
  documents: PropertyDocumentIngestionSummaryDocumentRow[];
  jobs: PropertyDocumentIngestionSummaryJobRow[];
  extractions: PropertyDocumentIngestionSummaryExtractionRow[];
  reviews: PropertyDocumentIngestionSummaryReviewRow[];
  candidates: PropertyDocumentIngestionSummaryCandidateRow[];
}): PropertyDocumentIngestionSummary {
  const documents = input.documents.filter((document) =>
    document.tenantId === input.tenantId &&
    document.propertyId === input.propertyId &&
    !document.deletedAt
  );
  const documentIds = new Set(documents.map((document) => document.id));
  const jobs = input.jobs.filter((job) =>
    job.tenantId === input.tenantId &&
    job.propertyId === input.propertyId &&
    documentIds.has(job.documentId)
  );
  const extractions = input.extractions.filter((extraction) =>
    extraction.tenantId === input.tenantId &&
    extraction.propertyId === input.propertyId &&
    documentIds.has(extraction.documentId)
  );
  const reviews = input.reviews.filter((review) =>
    review.tenantId === input.tenantId &&
    review.propertyId === input.propertyId &&
    documentIds.has(review.documentId)
  );
  const candidates = input.candidates.filter((candidate) =>
    candidate.tenantId === input.tenantId &&
    candidate.propertyId === input.propertyId &&
    documentIds.has(candidate.documentId)
  );
  const latestJob = jobs.reduce<PropertyDocumentIngestionSummaryJobRow | null>((latest, job) => {
    if (!latest) return job;
    return job.createdAt > latest.createdAt ? job : latest;
  }, null);

  return PropertyDocumentIngestionSummarySchema.parse({
    totalDocuments: documents.length,
    documentsWithIngestion: new Set(jobs.map((job) => job.documentId)).size,
    totalJobs: jobs.length,
    processingJobs: jobs.filter((job) => job.status === 'queued' || job.status === 'processing').length,
    failedJobs: jobs.filter((job) => job.status === 'failed').length,
    needsReviewJobs: jobs.filter((job) => job.status === 'needs_review').length,
    totalExtractions: extractions.length,
    pendingExtractionReviews: reviews.filter((review) => review.status === 'pending').length,
    totalCandidates: candidates.length,
    pendingCandidates: candidates.filter((candidate) => candidate.status === 'pending').length,
    approvedCandidates: candidates.filter((candidate) => candidate.status === 'approved').length,
    rejectedCandidates: candidates.filter((candidate) => candidate.status === 'rejected').length,
    appliedCandidates: candidates.filter((candidate) => candidate.status === 'applied').length,
    lastIngestionAt: latestJob?.createdAt ?? null,
    latestStatus: latestJob?.status ?? null,
  });
}
