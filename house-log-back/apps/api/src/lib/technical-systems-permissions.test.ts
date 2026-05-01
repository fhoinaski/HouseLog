import { describe, expect, it } from 'vitest';
import { resolveTechnicalSystemPermissions } from './technical-systems-permissions';

const baseProperty = {
  tenantId: 'tenant-a',
  ownerId: 'owner-a',
  managerId: 'manager-a',
};

describe('resolveTechnicalSystemPermissions', () => {
  it('allows owner to view and manage technical systems', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'owner-a',
        role: 'owner',
        property: baseProperty,
      })
    ).toEqual({ hasTenant: true, canView: true, canManage: true });
  });

  it('allows property manager to view and manage technical systems', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'manager-a',
        role: 'owner',
        property: baseProperty,
      }).canManage
    ).toBe(true);
  });

  it('allows collaborator manager to view and manage technical systems', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'collab-manager',
        role: 'owner',
        property: baseProperty,
        collaboratorRole: 'manager',
      })
    ).toEqual({ hasTenant: true, canView: true, canManage: true });
  });

  it('allows provider collaborator to view but not manage technical systems', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'provider-a',
        role: 'provider',
        property: baseProperty,
        collaboratorRole: 'provider',
      })
    ).toEqual({ hasTenant: true, canView: true, canManage: false });
  });

  it('does not allow admin bypass without explicit property relationship', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'admin-a',
        role: 'admin',
        property: baseProperty,
      })
    ).toEqual({ hasTenant: true, canView: false, canManage: false });
  });

  it('blocks records when property has no tenant context', () => {
    expect(
      resolveTechnicalSystemPermissions({
        userId: 'owner-a',
        role: 'owner',
        property: { ...baseProperty, tenantId: null },
      })
    ).toEqual({ hasTenant: false, canView: false, canManage: false });
  });
});
