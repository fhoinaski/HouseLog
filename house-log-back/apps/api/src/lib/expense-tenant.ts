export type FinanceTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

// Validates that a financial record (expense, pix_charge, nfe_import) belongs to the
// active tenant. Returns NOT_FOUND for cross-tenant access AND for legacy null-tenant
// records, so as not to leak existence information.
export function canAccessFinanceForTenant(input: {
  activeTenantId?: string | null;
  recordTenantId?: string | null;
}): FinanceTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.recordTenantId || input.recordTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

// Validates that a pix charge belongs to the active tenant and property.
// Property boundary is validated separately by assertPropertyAccess.
export function canAccessPixChargeForTenant(input: {
  activeTenantId?: string | null;
  chargeTenantId?: string | null;
  chargePropertyId: string;
  requestedPropertyId: string;
}): FinanceTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.chargeTenantId || input.chargeTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.chargePropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}
