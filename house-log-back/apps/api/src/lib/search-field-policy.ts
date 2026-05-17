export type SearchFieldEntity = 'service' | 'document' | 'inventory' | 'maintenance';

export type SearchFieldPolicyEntry = {
  allowedFields: readonly string[];
  forbiddenFields: readonly string[];
  note: string;
  requiresTenantScope: true;
};

export const SEARCH_FIELD_POLICY = {
  service: {
    allowedFields: ['title', 'system_type'],
    forbiddenFields: ['description', 'order_description', 'before_photos', 'after_photos', 'video_url', 'audio_url'],
    note: 'Free-form service descriptions and evidence fields are operational text and must not be searched.',
    requiresTenantScope: true,
  },
  document: {
    allowedFields: ['title'],
    forbiddenFields: ['ocr_data', 'file_url', 'r2_key', 'vendor_cnpj', 'amount'],
    note: 'Document OCR and extracted fiscal fields require a document-specific sensitivity policy before search.',
    requiresTenantScope: true,
  },
  inventory: {
    allowedFields: ['name', 'brand', 'category'],
    forbiddenFields: ['serial_number', 'notes', 'photo_url', 'warranty_until'],
    note: 'Inventory search stays limited to identifying catalog fields.',
    requiresTenantScope: true,
  },
  maintenance: {
    allowedFields: ['title', 'system_type'],
    forbiddenFields: ['description', 'last_done', 'next_due', 'notes'],
    note: 'Maintenance free-form descriptions and schedule details are not indexed.',
    requiresTenantScope: true,
  },
} as const satisfies Record<SearchFieldEntity, SearchFieldPolicyEntry>;

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

export function canSearchField(entity: SearchFieldEntity, field: string): boolean {
  const policy = SEARCH_FIELD_POLICY[entity];
  return policy.requiresTenantScope && (policy.allowedFields as readonly string[]).includes(field);
}

export function assertSearchFieldAllowed(entity: SearchFieldEntity, field: string): void {
  if (!canSearchField(entity, field)) {
    throw new Error(`Search field not allowed: ${entity}.${field}`);
  }
}

export function isSearchResultPayloadSafe(result: Record<string, unknown>): boolean {
  return Object.keys(result).every((field) => !FORBIDDEN_SEARCH_RESULT_FIELDS.has(field));
}
