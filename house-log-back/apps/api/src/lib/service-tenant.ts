export type ServiceTenantDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 400 | 403 | 404;
      code: 'TENANT_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND';
    };

export function canUseTenantServiceOrder(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  serviceTenantId?: string | null;
}): ServiceTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };

  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  // Legacy service_orders with tenant_id NULL are not exposed through protected
  // tenant-aware routes. They must be backfilled before normal SaaS access.
  if (!input.serviceTenantId || input.serviceTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  return { allowed: true };
}

export function canAssignProviderToTenantService(input: {
  activeTenantId?: string | null;
  propertyId: string;
  providerCollaboratorTenantId?: string | null;
  providerCollaboratorPropertyId?: string | null;
}): ServiceTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };

  if (
    input.providerCollaboratorTenantId !== input.activeTenantId ||
    input.providerCollaboratorPropertyId !== input.propertyId
  ) {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  return { allowed: true };
}

export function canUsePublicServiceLink(input: {
  linkTenantId?: string | null;
  serviceTenantId?: string | null;
  propertyTenantId?: string | null;
  linkStatus?: 'active' | 'used' | 'expired' | string | null;
  expiresAt?: string | null;
  serviceDeletedAt?: string | null;
}): ServiceTenantDecision | { allowed: false; status: 409; code: 'LINK_EXPIRED' | 'LINK_USED' } {
  if (
    !input.linkTenantId ||
    input.linkTenantId !== input.serviceTenantId ||
    input.linkTenantId !== input.propertyTenantId ||
    input.serviceDeletedAt
  ) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  if (!input.expiresAt || new Date(input.expiresAt) < new Date()) {
    return { allowed: false, status: 409, code: 'LINK_EXPIRED' };
  }

  if (input.linkStatus === 'expired') return { allowed: false, status: 409, code: 'LINK_EXPIRED' };
  if (input.linkStatus === 'used') return { allowed: false, status: 409, code: 'LINK_USED' };
  if (input.linkStatus !== 'active') return { allowed: false, status: 404, code: 'NOT_FOUND' };

  return { allowed: true };
}

export function canProviderAccessTenantServiceCycle(input: {
  activeTenantId?: string | null;
  serviceTenantId?: string | null;
  userId: string;
  assignedProviderId?: string | null;
  hasActiveProviderBid?: boolean;
}): ServiceTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (!input.serviceTenantId || input.serviceTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.assignedProviderId === input.userId || input.hasActiveProviderBid) {
    return { allowed: true };
  }
  return { allowed: false, status: 403, code: 'FORBIDDEN' };
}
