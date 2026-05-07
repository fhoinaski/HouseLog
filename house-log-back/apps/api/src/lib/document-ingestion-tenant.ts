export type IngestionJobDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404 | 409; code: string };

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
