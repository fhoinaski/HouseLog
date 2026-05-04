import { describe, expect, it } from 'vitest';
import {
  canAssignRoomToInventory,
  inventoryPhotoEndpoint,
  withInventoryPhotoEndpoint,
} from './inventory-tenant';

describe('inventory tenant isolation', () => {
  // ── canAssignRoomToInventory ─────────────────────────────────────────────────

  const base = { roomPropertyId: 'prop-a', requestedPropertyId: 'prop-a' };

  it('blocks room assignment when no active tenant', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: null, roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('blocks room assignment when activeTenantId is undefined', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: undefined, roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('tenant A cannot assign a room from tenant B to its inventory item', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' });
  });

  it('room with null tenant_id is blocked from being assigned (legacy data)', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: 'tenant-a', roomTenantId: null })
    ).toEqual({ allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' });
  });

  it('room with undefined tenant_id is blocked (legacy data)', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: 'tenant-a', roomTenantId: undefined })
    ).toEqual({ allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' });
  });

  it('room from different property (same tenant) is blocked', () => {
    expect(
      canAssignRoomToInventory({
        activeTenantId: 'tenant-a',
        roomTenantId: 'tenant-a',
        roomPropertyId: 'prop-b',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' });
  });

  it('room from different tenant AND different property is blocked', () => {
    expect(
      canAssignRoomToInventory({
        activeTenantId: 'tenant-a',
        roomTenantId: 'tenant-b',
        roomPropertyId: 'prop-b',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' });
  });

  it('allows room assignment when tenant and property both match', () => {
    expect(
      canAssignRoomToInventory({ ...base, activeTenantId: 'tenant-a', roomTenantId: 'tenant-a' })
    ).toEqual({ allowed: true });
  });

  // ── inventoryPhotoEndpoint ───────────────────────────────────────────────────

  it('generates the correct authenticated photo endpoint path', () => {
    expect(inventoryPhotoEndpoint('prop-123', 'item-456')).toBe(
      '/api/v1/properties/prop-123/inventory/item-456/photo'
    );
  });

  // ── withInventoryPhotoEndpoint ───────────────────────────────────────────────

  it('replaces a non-null photo_url with the authenticated endpoint', () => {
    const item = { id: 'item-1', photo_url: 'inventory/prop-a/abc.jpg' };
    expect(withInventoryPhotoEndpoint(item, 'prop-a').photo_url).toBe(
      '/api/v1/properties/prop-a/inventory/item-1/photo'
    );
  });

  it('does NOT return the raw R2 key as photo_url', () => {
    const item = { id: 'item-1', photo_url: 'inventory/prop-a/abc.jpg' };
    const result = withInventoryPhotoEndpoint(item, 'prop-a');
    expect(result.photo_url).not.toContain('inventory/prop-a/abc.jpg');
  });

  it('does NOT return a public R2 URL as photo_url', () => {
    const item = { id: 'item-1', photo_url: 'https://pub.r2.dev/inventory/prop-a/abc.jpg' };
    const result = withInventoryPhotoEndpoint(item, 'prop-a');
    expect(result.photo_url).not.toContain('r2.dev');
    expect(result.photo_url).toBe('/api/v1/properties/prop-a/inventory/item-1/photo');
  });

  it('keeps photo_url as null when there is no photo', () => {
    const item = { id: 'item-1', photo_url: null };
    expect(withInventoryPhotoEndpoint(item, 'prop-a').photo_url).toBeNull();
  });
});
