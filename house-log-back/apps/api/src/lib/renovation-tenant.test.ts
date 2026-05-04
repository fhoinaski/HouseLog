import { describe, expect, it } from 'vitest';
import {
  canLinkRenovationReference,
  canUseRenovationContractor,
  canUseTenantRenovation,
  isPublicRenovationPhotoReference,
} from './renovation-tenant';

describe('renovation tenant isolation', () => {
  it('blocks renovation access without active tenant', () => {
    expect(
      canUseTenantRenovation({
        activeTenantId: null,
        propertyTenantId: 'tenant-a',
        renovationTenantId: 'tenant-a',
        renovationPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('hides tenant B property from tenant A', () => {
    expect(
      canUseTenantRenovation({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        renovationTenantId: 'tenant-b',
        renovationPropertyId: 'property-b',
        requestedPropertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides tenant B renovation by id from tenant A', () => {
    expect(
      canUseTenantRenovation({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        renovationTenantId: 'tenant-b',
        renovationPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows renovation access when tenant and property match', () => {
    expect(
      canUseTenantRenovation({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        renovationTenantId: 'tenant-a',
        renovationPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks reference from another tenant', () => {
    expect(
      canLinkRenovationReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-b',
        referencePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('blocks reference from another property', () => {
    expect(
      canLinkRenovationReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-a',
        referencePropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('allows contractor with active tenant membership', () => {
    expect(
      canUseRenovationContractor({
        activeTenantId: 'tenant-a',
        contractorTenantId: 'tenant-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('allows provider collaborator in the same tenant/property', () => {
    expect(
      canUseRenovationContractor({
        activeTenantId: 'tenant-a',
        contractorTenantId: null,
        contractorCollaboratorTenantId: 'tenant-a',
        contractorCollaboratorPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks contractor outside tenant and property relationship', () => {
    expect(
      canUseRenovationContractor({
        activeTenantId: 'tenant-a',
        contractorTenantId: 'tenant-b',
        contractorCollaboratorTenantId: 'tenant-a',
        contractorCollaboratorPropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 403, code: 'CONTRACTOR_FORBIDDEN' });
  });

  it('does not allow raw private R2 property keys as photo references', () => {
    expect(isPublicRenovationPhotoReference({ propertyId: 'property-a', value: 'property-a/photos/123.jpg' })).toBe(false);
  });

  it('does not allow a public R2 URL for a private media category', () => {
    expect(
      isPublicRenovationPhotoReference({
        propertyId: 'property-a',
        value: 'https://pub.example.com/property-a/photos/123.jpg',
        publicR2BaseUrl: 'https://pub.example.com',
      })
    ).toBe(false);
  });

  it('does not allow an r2.dev URL for a private media category', () => {
    expect(
      isPublicRenovationPhotoReference({
        propertyId: 'property-a',
        value: 'https://abc.r2.dev/property-a/documents/manual.pdf',
      })
    ).toBe(false);
  });

  it('allows authenticated API photo paths', () => {
    expect(
      isPublicRenovationPhotoReference({
        propertyId: 'property-a',
        value: '/api/v1/properties/property-a/services/service-a/media/property-a%2Fphotos%2F123.jpg',
      })
    ).toBe(true);
  });

  it('allows non-R2 external URLs', () => {
    expect(
      isPublicRenovationPhotoReference({
        propertyId: 'property-a',
        value: 'https://cdn.example.com/renovations/photo.jpg',
      })
    ).toBe(true);
  });

  it('blocks arbitrary relative paths that are not authenticated API endpoints', () => {
    expect(isPublicRenovationPhotoReference({ propertyId: 'property-a', value: '/uploads/photo.jpg' })).toBe(false);
  });
});
