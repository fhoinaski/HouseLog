import { describe, expect, it } from 'vitest';
import { canCreatePropertyInTenant, canUseTenantProperty } from './property-tenant';

describe('property tenant guard', () => {
  it('blocks property creation without an active tenant', () => {
    expect(canCreatePropertyInTenant({ activeTenantId: null, userRole: 'owner', tenantRole: 'owner' })).toEqual({
      allowed: false,
      status: 400,
      code: 'TENANT_REQUIRED',
    });
  });

  it('blocks property creation when user is not tenant owner', () => {
    expect(canCreatePropertyInTenant({ activeTenantId: 'tenant-a', userRole: 'owner', tenantRole: 'manager' })).toEqual({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('allows tenant owner to create a property in the active tenant', () => {
    expect(canCreatePropertyInTenant({ activeTenantId: 'tenant-a', userRole: 'owner', tenantRole: 'owner' })).toEqual({
      allowed: true,
    });
  });

  it('blocks tenant A from accessing a property from tenant B', () => {
    expect(canUseTenantProperty({ activeTenantId: 'tenant-a', propertyTenantId: 'tenant-b' })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('allows access when property belongs to the active tenant', () => {
    expect(canUseTenantProperty({ activeTenantId: 'tenant-a', propertyTenantId: 'tenant-a' })).toEqual({
      allowed: true,
    });
  });
});
