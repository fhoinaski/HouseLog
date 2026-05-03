import { describe, expect, it } from 'vitest';
import {
  canServeDirectMediaKey,
  canUsePublicMediaToken,
  canUseTenantDocument,
  canUsePublicUrl,
  classifyR2Key,
} from './media-security';
import { buildR2Key, validatePrivateUpload } from './r2';

describe('media security policy', () => {
  it('classifies document and service evidence keys as private', () => {
    expect(classifyR2Key('property-a/documents/1.pdf')).toBe('private');
    expect(classifyR2Key('property-a/photos/1.jpg')).toBe('private');
    expect(classifyR2Key('property-a/videos/1.mp4')).toBe('private');
    expect(classifyR2Key('property-a/invoices/1.pdf')).toBe('private');
  });

  it('does not serve private media by raw R2 key', () => {
    expect(canServeDirectMediaKey('property-a/documents/1.pdf')).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('allows only explicitly public direct media keys', () => {
    expect(canServeDirectMediaKey('user-a/avatars/avatar.webp')).toEqual({
      allowed: true,
      classification: 'public',
    });
  });

  it('blocks dangerous upload extensions even when mime type looks valid', () => {
    expect(validatePrivateUpload('application/pdf', 10, 'contract.exe')).toEqual({
      ok: false,
      error: 'Extensao de arquivo nao permitida',
    });
  });

  it('blocks mismatched mime and extension', () => {
    expect(validatePrivateUpload('application/pdf', 10, 'contract.jpg')).toEqual({
      ok: false,
      error: 'Extensao nao corresponde ao tipo do arquivo',
    });
  });

  it('blocks expired public media tokens', () => {
    expect(
      canUsePublicMediaToken({
        tokenStatus: 'active',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        scopeAllowsMedia: true,
      })
    ).toEqual({ allowed: false, status: 409, code: 'LINK_EXPIRED' });
  });

  it('allows active scoped public media tokens', () => {
    expect(
      canUsePublicMediaToken({
        tokenStatus: 'active',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        scopeAllowsMedia: true,
      })
    ).toEqual({ allowed: true, classification: 'public' });
  });

  it('blocks tenant A from accessing tenant B document', () => {
    expect(
      canUseTenantDocument({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        documentTenantId: 'tenant-b',
        documentPropertyId: 'property-b',
        propertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('blocks document linked to service order from another tenant/property', () => {
    expect(
      canUseTenantDocument({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        documentTenantId: 'tenant-a',
        documentPropertyId: 'property-a',
        propertyId: 'property-a',
        hasServiceOrder: true,
        serviceOrderTenantId: 'tenant-a',
        serviceOrderPropertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows document in active tenant and property', () => {
    expect(
      canUseTenantDocument({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        documentTenantId: 'tenant-a',
        documentPropertyId: 'property-a',
        propertyId: 'property-a',
      })
    ).toEqual({ allowed: true, classification: 'public' });
  });
});

describe('canUsePublicUrl', () => {
  it('allows public URL only for avatar keys', () => {
    expect(canUsePublicUrl('user-a/avatars/avatar.webp')).toBe(true);
  });

  it('blocks public URL for inventory keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'inventory', filename: 'item.jpg' });
    expect(canUsePublicUrl(key)).toBe(false);
  });

  it('blocks public URL for photo keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'photos', filename: 'cover.jpg' });
    expect(canUsePublicUrl(key)).toBe(false);
  });

  it('blocks public URL for document keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'documents', filename: 'contract.pdf' });
    expect(canUsePublicUrl(key)).toBe(false);
  });

  it('blocks public URL for invoice keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'invoices', filename: 'invoice.pdf' });
    expect(canUsePublicUrl(key)).toBe(false);
  });

  it('blocks public URL for video keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'videos', filename: 'tour.mp4' });
    expect(canUsePublicUrl(key)).toBe(false);
  });
});

describe('inventory media security', () => {
  it('classifies inventory keys built with buildR2Key as private', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'inventory', filename: 'item.jpg' });
    expect(classifyR2Key(key)).toBe('private');
  });

  it('does not serve inventory keys via direct media endpoint', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'inventory', filename: 'item.jpg' });
    expect(canServeDirectMediaKey(key)).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot access inventory item from tenant B via canUseTenantDocument', () => {
    // Demonstrates the cross-tenant access pattern used in media serving
    expect(
      canUseTenantDocument({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        documentTenantId: 'tenant-b',
        documentPropertyId: 'prop-b',
        propertyId: 'prop-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

describe('service-request media security', () => {
  it('classifies service-request photo keys as private', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'photos', filename: 'req-1-photo.jpg' });
    expect(classifyR2Key(key)).toBe('private');
  });

  it('classifies service-request video keys as private', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'videos', filename: 'req-1-video.mp4' });
    expect(classifyR2Key(key)).toBe('private');
  });

  it('classifies service-request audio keys (stored as documents) as private', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'documents', filename: 'req-1-audio.pdf' });
    expect(classifyR2Key(key)).toBe('private');
  });

  it('does not serve service-request media via direct /media/ endpoint', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'photos', filename: 'req-1-photo.jpg' });
    expect(canServeDirectMediaKey(key)).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('does not allow public URL for service-request media keys', () => {
    const key = buildR2Key({ propertyId: 'prop-a', category: 'photos', filename: 'req-1-photo.jpg' });
    expect(canUsePublicUrl(key)).toBe(false);
  });
});
