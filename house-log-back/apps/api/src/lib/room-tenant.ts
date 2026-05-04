export type RoomTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

// Validates that a room record belongs to the active tenant and requested property.
// Returns NOT_FOUND for cross-tenant access AND for legacy null-tenant records
// so as not to leak existence information.
export function canAccessRoomForTenant(input: {
  activeTenantId?: string | null;
  roomTenantId?: string | null;
  roomPropertyId: string;
  requestedPropertyId: string;
}): RoomTenantDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.roomTenantId || input.roomTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  if (input.roomPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}
