import type { Role, TenantRole } from './types';

export type PropertyTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 404; code: 'TENANT_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND' };

export function canCreatePropertyInTenant(input: {
  activeTenantId?: string | null;
  userRole: Role;
  tenantRole?: TenantRole | null;
}): PropertyTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (input.userRole !== 'admin' && input.userRole !== 'owner') {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }
  if (input.tenantRole !== 'owner') return { allowed: false, status: 403, code: 'FORBIDDEN' };
  return { allowed: true };
}

export function canUseTenantProperty(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
}): PropertyTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}
