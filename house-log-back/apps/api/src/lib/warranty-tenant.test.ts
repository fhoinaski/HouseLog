import { describe, expect, it } from 'vitest';
import { canLinkWarrantyReference, canUseTenantWarranty } from './warranty-tenant';

describe('warranty tenant isolation', () => {
  it('blocks warranty access without an active tenant', () => {
    expect(
      canUseTenantWarranty({
        activeTenantId: null,
        propertyTenantId: 'tenant-a',
        warrantyTenantId: 'tenant-a',
        warrantyPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('hides property from another tenant', () => {
    expect(
      canUseTenantWarranty({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        warrantyTenantId: 'tenant-b',
        warrantyPropertyId: 'property-b',
        requestedPropertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides warranty from another tenant by id', () => {
    expect(
      canUseTenantWarranty({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        warrantyTenantId: 'tenant-b',
        warrantyPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides warranty from another property in the same tenant', () => {
    expect(
      canUseTenantWarranty({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        warrantyTenantId: 'tenant-a',
        warrantyPropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows warranty access when tenant and property match', () => {
    expect(
      canUseTenantWarranty({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        warrantyTenantId: 'tenant-a',
        warrantyPropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks a linked reference from another tenant', () => {
    expect(
      canLinkWarrantyReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-b',
        referencePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('blocks a linked reference from another property', () => {
    expect(
      canLinkWarrantyReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-a',
        referencePropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' });
  });

  it('allows a linked reference in the same tenant and property', () => {
    expect(
      canLinkWarrantyReference({
        activeTenantId: 'tenant-a',
        referenceTenantId: 'tenant-a',
        referencePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });
});
