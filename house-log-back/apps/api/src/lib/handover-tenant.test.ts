import { describe, expect, it } from 'vitest';
import {
  canLinkHandoverSummaryDocument,
  canLinkHandoverChecklistReference,
  canUseHandoverTenantUser,
  canUseTenantHandoverChecklistItem,
  canUseTenantHandoverPackage,
  isAllowedHandoverEvidenceReference,
} from './handover-tenant';

describe('handover package tenant isolation', () => {
  it('blocks package access without active tenant', () => {
    expect(
      canUseTenantHandoverPackage({
        activeTenantId: null,
        propertyTenantId: 'tenant-a',
        packageTenantId: 'tenant-a',
        packagePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('hides tenant B property from tenant A', () => {
    expect(
      canUseTenantHandoverPackage({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        packageTenantId: 'tenant-b',
        packagePropertyId: 'property-b',
        requestedPropertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides tenant B package by id from tenant A', () => {
    expect(
      canUseTenantHandoverPackage({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        packageTenantId: 'tenant-b',
        packagePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows package access when tenant and property match', () => {
    expect(
      canUseTenantHandoverPackage({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        packageTenantId: 'tenant-a',
        packagePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks summary document from another tenant', () => {
    expect(
      canLinkHandoverSummaryDocument({
        activeTenantId: 'tenant-a',
        documentTenantId: 'tenant-b',
        documentPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('blocks summary document from another property', () => {
    expect(
      canLinkHandoverSummaryDocument({
        activeTenantId: 'tenant-a',
        documentTenantId: 'tenant-a',
        documentPropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('allows summary document in the same tenant/property', () => {
    expect(
      canLinkHandoverSummaryDocument({
        activeTenantId: 'tenant-a',
        documentTenantId: 'tenant-a',
        documentPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks reviewedBy/approvedBy outside the tenant', () => {
    expect(canUseHandoverTenantUser({ activeTenantId: 'tenant-a', userTenantId: 'tenant-b' })).toEqual({
      allowed: false,
      status: 403,
      code: 'USER_NOT_IN_TENANT',
    });
  });

  it('allows reviewedBy/approvedBy inside the tenant', () => {
    expect(canUseHandoverTenantUser({ activeTenantId: 'tenant-a', userTenantId: 'tenant-a' })).toEqual({
      allowed: true,
    });
  });

  it('hides checklist item from another tenant by id', () => {
    expect(
      canUseTenantHandoverChecklistItem({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        packageTenantId: 'tenant-a',
        packagePropertyId: 'property-a',
        itemTenantId: 'tenant-b',
        itemPropertyId: 'property-a',
        itemPackageId: 'package-a',
        requestedPropertyId: 'property-a',
        requestedPackageId: 'package-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows checklist item when tenant, property and package match', () => {
    expect(
      canUseTenantHandoverChecklistItem({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        packageTenantId: 'tenant-a',
        packagePropertyId: 'property-a',
        itemTenantId: 'tenant-a',
        itemPropertyId: 'property-a',
        itemPackageId: 'package-a',
        requestedPropertyId: 'property-a',
        requestedPackageId: 'package-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks checklist reference from another property', () => {
    expect(
      canLinkHandoverChecklistReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-a',
        referencePropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('blocks raw private R2 evidence keys', () => {
    expect(isAllowedHandoverEvidenceReference({ value: 'property-a/photos/123.jpg' })).toBe(false);
  });

  it('blocks public R2 URLs for private media categories', () => {
    expect(
      isAllowedHandoverEvidenceReference({
        value: 'https://pub.example.com/property-a/documents/manual.pdf',
        publicR2BaseUrl: 'https://pub.example.com',
      })
    ).toBe(false);
  });

  it('allows authenticated evidence endpoints', () => {
    expect(isAllowedHandoverEvidenceReference({ value: '/api/v1/properties/property-a/documents/doc-a/download' })).toBe(true);
  });

  it('allows non-R2 external evidence URLs', () => {
    expect(isAllowedHandoverEvidenceReference({ value: 'https://cdn.example.com/evidence/photo.jpg' })).toBe(true);
  });
});
