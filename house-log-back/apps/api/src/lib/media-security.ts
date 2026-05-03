export type MediaAccessDecision =
  | { allowed: true; classification: 'public' }
  | { allowed: false; status: 401 | 404 | 409; code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'LINK_EXPIRED' };

const PRIVATE_MEDIA_CATEGORIES = new Set(['documents', 'photos', 'videos', 'invoices', 'inventory']);
const PUBLIC_MEDIA_CATEGORIES = new Set(['avatars']);

export function classifyR2Key(key: string): 'public' | 'private' | 'unknown' {
  const parts = key.split('/').filter(Boolean);
  const category = parts[1];
  if (!category) return 'unknown';
  if (PRIVATE_MEDIA_CATEGORIES.has(category)) return 'private';
  if (PUBLIC_MEDIA_CATEGORIES.has(category)) return 'public';
  return 'unknown';
}

export function canServeDirectMediaKey(key: string): MediaAccessDecision {
  if (!key || key.includes('..')) return { allowed: false, status: 404, code: 'NOT_FOUND' };
  const classification = classifyR2Key(key);
  if (classification !== 'public') return { allowed: false, status: 404, code: 'NOT_FOUND' };
  return { allowed: true, classification };
}

export function canUsePublicMediaToken(input: {
  tokenStatus?: 'active' | 'used' | 'expired' | string | null;
  expiresAt?: string | null;
  scopeAllowsMedia?: boolean;
}): MediaAccessDecision {
  if (!input.scopeAllowsMedia) return { allowed: false, status: 404, code: 'NOT_FOUND' };
  if (!input.expiresAt || new Date(input.expiresAt) < new Date() || input.tokenStatus === 'expired') {
    return { allowed: false, status: 409, code: 'LINK_EXPIRED' };
  }
  if (input.tokenStatus !== 'active') return { allowed: false, status: 404, code: 'NOT_FOUND' };
  return { allowed: true, classification: 'public' };
}

export function canUseTenantDocument(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  documentTenantId?: string | null;
  documentPropertyId?: string | null;
  propertyId: string;
  serviceOrderTenantId?: string | null;
  serviceOrderPropertyId?: string | null;
  hasServiceOrder?: boolean;
}): MediaAccessDecision {
  if (!input.activeTenantId) return { allowed: false, status: 401, code: 'UNAUTHORIZED' };
  if (
    input.propertyTenantId !== input.activeTenantId ||
    input.documentTenantId !== input.activeTenantId ||
    input.documentPropertyId !== input.propertyId
  ) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (
    input.hasServiceOrder &&
    (input.serviceOrderTenantId !== input.activeTenantId || input.serviceOrderPropertyId !== input.propertyId)
  ) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true, classification: 'public' };
}

// Returns true only when the R2 key belongs to an explicitly public category.
// Private categories must use an authenticated endpoint or a short-lived
// signed URL — never a direct public R2 URL.
export function canUsePublicUrl(key: string): boolean {
  return classifyR2Key(key) === 'public';
}
