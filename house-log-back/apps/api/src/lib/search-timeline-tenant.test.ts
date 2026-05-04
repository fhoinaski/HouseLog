import { describe, expect, it } from 'vitest';
import {
  canUseTenantSearchProperty,
  canUseTenantTimelineEvent,
  isSearchResultPayloadSafe,
} from './search-timeline-tenant';

describe('search and timeline tenant isolation', () => {
  it('blocks search without an active tenant', () => {
    expect(canUseTenantSearchProperty({ activeTenantId: null, propertyTenantId: 'tenant-a' })).toEqual({
      allowed: false,
      status: 400,
      code: 'TENANT_REQUIRED',
    });
  });

  it('hides a search property from another tenant', () => {
    expect(canUseTenantSearchProperty({ activeTenantId: 'tenant-a', propertyTenantId: 'tenant-b' })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('hides legacy null-tenant properties from search', () => {
    expect(canUseTenantSearchProperty({ activeTenantId: 'tenant-a', propertyTenantId: null })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('allows search inside the active tenant property', () => {
    expect(canUseTenantSearchProperty({ activeTenantId: 'tenant-a', propertyTenantId: 'tenant-a' })).toEqual({
      allowed: true,
    });
  });

  it('hides timeline events from another tenant', () => {
    expect(
      canUseTenantTimelineEvent({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        eventTenantId: 'tenant-b',
        eventPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides legacy null-tenant timeline events', () => {
    expect(
      canUseTenantTimelineEvent({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        eventTenantId: null,
        eventPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides timeline events from another property', () => {
    expect(
      canUseTenantTimelineEvent({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        eventTenantId: 'tenant-a',
        eventPropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows timeline events scoped to tenant and property', () => {
    expect(
      canUseTenantTimelineEvent({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        eventTenantId: 'tenant-a',
        eventPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks search payloads exposing private media keys', () => {
    expect(
      isSearchResultPayloadSafe({
        type: 'document',
        id: 'doc-a',
        title: 'Manual',
        property_id: 'property-a',
        fileUrl: 'documents/property-a/manual.pdf',
      })
    ).toBe(false);
  });

  it('blocks search payloads exposing credential secrets or ciphertext', () => {
    expect(
      isSearchResultPayloadSafe({
        type: 'credential',
        id: 'credential-a',
        title: 'Wi-Fi',
        property_id: 'property-a',
        ciphertext: 'encrypted',
      })
    ).toBe(false);
  });

  it('allows minimal search result payloads', () => {
    expect(
      isSearchResultPayloadSafe({
        type: 'document',
        id: 'doc-a',
        title: 'Manual',
        subtitle: 'manual',
        property_id: 'property-a',
        href: '/properties/property-a/documents',
      })
    ).toBe(true);
  });
});
