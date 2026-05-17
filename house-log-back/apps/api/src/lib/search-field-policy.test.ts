import { describe, expect, it } from 'vitest';
import {
  SEARCH_FIELD_POLICY,
  assertSearchFieldAllowed,
  canSearchField,
  isSearchResultPayloadSafe,
} from './search-field-policy';

describe('SEARCH_FIELD_POLICY', () => {
  it('keeps allowed fields searchable for current entities', () => {
    expect(canSearchField('service', 'title')).toBe(true);
    expect(canSearchField('service', 'system_type')).toBe(true);
    expect(canSearchField('document', 'title')).toBe(true);
    expect(canSearchField('inventory', 'name')).toBe(true);
    expect(canSearchField('inventory', 'brand')).toBe(true);
    expect(canSearchField('inventory', 'category')).toBe(true);
    expect(canSearchField('maintenance', 'title')).toBe(true);
    expect(canSearchField('maintenance', 'system_type')).toBe(true);
  });

  it('keeps OCR and extracted document fields out of search', () => {
    expect(canSearchField('document', 'ocr_data')).toBe(false);
    expect(canSearchField('document', 'vendor_cnpj')).toBe(false);
    expect(SEARCH_FIELD_POLICY.document.forbiddenFields).toContain('ocr_data');
  });

  it('keeps free-form service descriptions out of search', () => {
    expect(canSearchField('service', 'description')).toBe(false);
    expect(SEARCH_FIELD_POLICY.service.forbiddenFields).toContain('description');
  });

  it('does not define credential search entities or secret fields', () => {
    expect(Object.keys(SEARCH_FIELD_POLICY)).not.toContain('credential');
    expect(Object.values(SEARCH_FIELD_POLICY).flatMap((entry) => [...entry.allowedFields])).not.toContain('secret');
    expect(isSearchResultPayloadSafe({ type: 'credential', id: 'cred-1', title: 'Wi-Fi', secret: 'plain' })).toBe(false);
  });

  it('requires tenant scope for every searchable entity', () => {
    for (const entry of Object.values(SEARCH_FIELD_POLICY)) {
      expect(entry.requiresTenantScope).toBe(true);
    }
  });

  it('throws when a route tries to use a forbidden field', () => {
    expect(() => assertSearchFieldAllowed('document', 'ocr_data')).toThrow(
      'Search field not allowed: document.ocr_data'
    );
  });
});
