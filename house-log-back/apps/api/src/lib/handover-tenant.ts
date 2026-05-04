import { canUsePublicUrl, classifyR2Key } from './media-security';

export type HandoverPackageTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

export type HandoverPackageReferenceDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 422; code: 'TENANT_REQUIRED' | 'REFERENCE_NOT_IN_PROPERTY' };

export type HandoverPackageUserDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403; code: 'TENANT_REQUIRED' | 'USER_NOT_IN_TENANT' };

export function canUseTenantHandoverPackage(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  packageTenantId?: string | null;
  packagePropertyId?: string | null;
  requestedPropertyId: string;
}): HandoverPackageTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (!input.packageTenantId || input.packageTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.packagePropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canLinkHandoverSummaryDocument(input: {
  activeTenantId?: string | null;
  documentTenantId?: string | null;
  documentPropertyId?: string | null;
  requestedPropertyId: string;
}): HandoverPackageReferenceDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.documentTenantId || input.documentTenantId !== input.activeTenantId) {
    return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  }
  if (input.documentPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  }
  return { allowed: true };
}

export function canUseHandoverTenantUser(input: {
  activeTenantId?: string | null;
  userTenantId?: string | null;
}): HandoverPackageUserDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (input.userTenantId !== input.activeTenantId) {
    return { allowed: false, status: 403, code: 'USER_NOT_IN_TENANT' };
  }
  return { allowed: true };
}

export function canUseTenantHandoverChecklistItem(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  packageTenantId?: string | null;
  packagePropertyId?: string | null;
  itemTenantId?: string | null;
  itemPropertyId?: string | null;
  itemPackageId?: string | null;
  requestedPropertyId: string;
  requestedPackageId: string;
}): HandoverPackageTenantDecision {
  const packageDecision = canUseTenantHandoverPackage({
    activeTenantId: input.activeTenantId,
    propertyTenantId: input.propertyTenantId,
    packageTenantId: input.packageTenantId,
    packagePropertyId: input.packagePropertyId,
    requestedPropertyId: input.requestedPropertyId,
  });
  if (!packageDecision.allowed) return packageDecision;

  if (!input.itemTenantId || input.itemTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.itemPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.itemPackageId !== input.requestedPackageId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canLinkHandoverChecklistReference(input: {
  activeTenantId?: string | null;
  referenceTenantId?: string | null;
  referencePropertyId?: string | null;
  requestedPropertyId: string;
}): HandoverPackageReferenceDecision {
  return canLinkHandoverSummaryDocument({
    activeTenantId: input.activeTenantId,
    documentTenantId: input.referenceTenantId,
    documentPropertyId: input.referencePropertyId,
    requestedPropertyId: input.requestedPropertyId,
  });
}

export function isAllowedHandoverEvidenceReference(input: {
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
