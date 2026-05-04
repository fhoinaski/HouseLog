export type SearchTimelineTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

export function canUseTenantSearchProperty(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
}): SearchTimelineTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canUseTenantTimelineEvent(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  eventTenantId?: string | null;
  eventPropertyId?: string | null;
  requestedPropertyId: string;
}): SearchTimelineTenantDecision {
  const propertyDecision = canUseTenantSearchProperty({
    activeTenantId: input.activeTenantId,
    propertyTenantId: input.propertyTenantId,
  });
  if (!propertyDecision.allowed) return propertyDecision;

  if (
    !input.eventTenantId ||
    input.eventTenantId !== input.activeTenantId ||
    input.eventPropertyId !== input.requestedPropertyId
  ) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  return { allowed: true };
}

const FORBIDDEN_SEARCH_RESULT_FIELDS = new Set([
  'file_url',
  'fileUrl',
  'media_key',
  'mediaKey',
  'r2_key',
  'r2Key',
  'secret',
  'ciphertext',
  'encryptedSecret',
  'encrypted_secret',
  'password',
]);

export function isSearchResultPayloadSafe(result: Record<string, unknown>): boolean {
  return Object.keys(result).every((field) => !FORBIDDEN_SEARCH_RESULT_FIELDS.has(field));
}
