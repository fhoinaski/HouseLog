import { describe, expect, it } from 'vitest';
import { canAccessRoomForTenant } from './room-tenant';

describe('room tenant isolation', () => {
  const base = { roomPropertyId: 'prop-a', requestedPropertyId: 'prop-a' };

  it('blocks access without an active tenant', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: null, roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('blocks access when activeTenantId is undefined', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: undefined, roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('tenant A cannot list rooms from tenant B', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot read a room by ID from tenant B', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot update a room from tenant B', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot delete a room from tenant B', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('legacy room with null tenant_id is not exposed', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('legacy room with undefined tenant_id is not exposed', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: undefined })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows access when tenant and property both match', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: true });
  });

  it('blocks access when room belongs to a different property (same tenant)', () => {
    expect(
      canAccessRoomForTenant({
        activeTenantId: 'tenant-a',
        roomTenantId: 'tenant-a',
        roomPropertyId: 'prop-b',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('cross-tenant access to a different property is still NOT_FOUND', () => {
    expect(
      canAccessRoomForTenant({
        activeTenantId: 'tenant-a',
        roomTenantId: 'tenant-b',
        roomPropertyId: 'prop-b',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('create (INSERT) requires an active tenant — no tenant means TENANT_REQUIRED', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: null, roomTenantId: null })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('empty string tenant_id is treated as missing (NOT_FOUND)', () => {
    expect(
      canAccessRoomForTenant({ ...base, activeTenantId: 'tenant-a', roomTenantId: '' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});
