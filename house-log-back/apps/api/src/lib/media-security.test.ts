import { describe, expect, it } from 'vitest';
import { canServeDirectMediaKey, canUsePublicMediaToken, canUseTenantDocument, classifyR2Key } from './media-security';
import { validatePrivateUpload } from './r2';

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
