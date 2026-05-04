export type RenovationTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

export type RenovationReferenceDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 422; code: 'TENANT_REQUIRED' | 'REFERENCE_NOT_IN_PROPERTY' };

export type RenovationContractorDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403; code: 'TENANT_REQUIRED' | 'CONTRACTOR_FORBIDDEN' };

export function canUseTenantRenovation(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  renovationTenantId?: string | null;
  renovationPropertyId?: string | null;
  requestedPropertyId: string;
}): RenovationTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.renovationTenantId || input.renovationTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.renovationPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canLinkRenovationReference(input: {
  activeTenantId?: string | null;
  referenceTenantId?: string | null;
  referencePropertyId?: string | null;
  requestedPropertyId: string;
}): RenovationReferenceDecision {
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

export function canUseRenovationContractor(input: {
  activeTenantId?: string | null;
  contractorTenantId?: string | null;
  contractorCollaboratorTenantId?: string | null;
  contractorCollaboratorPropertyId?: string | null;
  requestedPropertyId: string;
}): RenovationContractorDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (input.contractorTenantId === input.activeTenantId) {
    return { allowed: true };
  }
  if (
    input.contractorCollaboratorTenantId === input.activeTenantId &&
    input.contractorCollaboratorPropertyId === input.requestedPropertyId
  ) {
    return { allowed: true };
  }
  return { allowed: false, status: 403, code: 'CONTRACTOR_FORBIDDEN' };
}

export function isPublicRenovationPhotoReference(input: {
  propertyId: string;
  value: string;
  publicR2BaseUrl?: string | null;
}): boolean {
  const trimmed = input.value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/api/v1/')) return true;

  if (/^https?:\/\//i.test(trimmed)) {
    const publicBaseUrl = input.publicR2BaseUrl?.trim().replace(/\/$/, '');
    if (publicBaseUrl && trimmed.startsWith(`${publicBaseUrl}/`)) {
      const key = decodeURIComponent(trimmed.slice(publicBaseUrl.length + 1));
      return canUsePublicUrl(key);
    }

    try {
      const url = new URL(trimmed);
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const isKnownR2Url = url.hostname.includes('r2.dev') || classifyR2Key(key) !== 'unknown';
      if (isKnownR2Url) return canUsePublicUrl(key);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
import { canUsePublicUrl, classifyR2Key } from './media-security';
