export type WarrantyTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

export type WarrantyReferenceDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 422; code: 'TENANT_REQUIRED' | 'REFERENCE_NOT_IN_PROPERTY' };

export function canUseTenantWarranty(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  warrantyTenantId?: string | null;
  warrantyPropertyId?: string | null;
  requestedPropertyId: string;
}): WarrantyTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.warrantyTenantId || input.warrantyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.warrantyPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canLinkWarrantyReference(input: {
  activeTenantId?: string | null;
  referenceTenantId?: string | null;
  referencePropertyId?: string | null;
  requestedPropertyId: string;
}): WarrantyReferenceDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.referenceTenantId || input.referenceTenantId !== input.activeTenantId) {
    return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  }
  if (input.referencePropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  }
  return { allowed: true };
}
