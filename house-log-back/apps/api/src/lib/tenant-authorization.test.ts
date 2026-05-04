import { describe, expect, it } from 'vitest';
import { canUseTenantPropertyAccess } from './tenant-authorization';

const base = {
  activeTenantId: 'tenant-a',
  tenantRole: 'owner' as const,
  userId: 'user-a',
  userRole: 'owner' as const,
  propertyTenantId: 'tenant-a',
  propertyOwnerId: 'owner-a',
  propertyManagerId: null,
};

describe('tenant-aware property authorization', () => {
  it('allows tenant owner to access a property in the active tenant', () => {
    expect(canUseTenantPropertyAccess(base)).toEqual({ allowed: true, reason: 'tenant_owner' });
  });

  it('allows tenant manager to access a property in the active tenant', () => {
    expect(canUseTenantPropertyAccess({ ...base, tenantRole: 'manager' })).toEqual({
      allowed: true,
      reason: 'tenant_manager',
    });
  });

  it('blocks access when no tenant is active', () => {
    expect(canUseTenantPropertyAccess({ ...base, activeTenantId: null })).toEqual({
      allowed: false,
      status: 400,
      code: 'TENANT_REQUIRED',
    });
  });

  it('hides properties from another tenant', () => {
    expect(canUseTenantPropertyAccess({ ...base, propertyTenantId: 'tenant-b' })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('blocks legacy null-tenant properties', () => {
    expect(canUseTenantPropertyAccess({ ...base, propertyTenantId: null })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('blocks provider from property access by id alone', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'provider',
        userRole: 'provider',
        userId: 'provider-a',
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('allows provider only for explicitly assigned service scope', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'provider',
        userRole: 'provider',
        userId: 'provider-a',
        assignedProviderId: 'provider-a',
        accessLevel: 'assigned_service',
      })
    ).toEqual({ allowed: true, reason: 'provider_assigned_service' });
  });

  it('does not allow admin bypass without active tenant role and tenant match', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        activeTenantId: null,
        tenantRole: null,
        userRole: 'admin',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('allows admin only through explicit tenant membership', () => {
    expect(canUseTenantPropertyAccess({ ...base, userRole: 'admin', tenantRole: 'manager' })).toEqual({
      allowed: true,
      reason: 'tenant_manager',
    });
  });

  it('does not allow tenant manager to reveal secrets without direct property relation', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'manager',
        propertyOwnerId: 'other-owner',
        propertyManagerId: 'other-manager',
        accessLevel: 'secret',
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('allows direct property manager to reveal secrets inside the active tenant', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'manager',
        propertyOwnerId: 'other-owner',
        propertyManagerId: 'user-a',
        accessLevel: 'secret',
      })
    ).toEqual({ allowed: true, reason: 'direct_property_secret' });
  });

  it('keeps propertyCollaborators compatibility inside the same tenant', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'provider',
        propertyOwnerId: 'other-owner',
        collaborator: { tenantId: 'tenant-a', role: 'viewer' },
      })
    ).toEqual({ allowed: true, reason: 'property_collaborator_view' });
  });

  it('does not let legacy propertyCollaborators open cross-tenant access', () => {
    expect(
      canUseTenantPropertyAccess({
        ...base,
        tenantRole: 'provider',
        propertyOwnerId: 'other-owner',
        collaborator: { tenantId: null, role: 'viewer' },
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });
});
