export type RoomAssignDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 422; code: 'TENANT_REQUIRED' | 'ROOM_NOT_IN_PROPERTY' };

// Validates that a room (fetched from DB) can be assigned to an inventory item
// being created or updated for the given tenant/property.
// Pass the fields from the fetched room record — if the room doesn't exist in the
// DB query the caller should return 422 before reaching this function.
export function canAssignRoomToInventory(input: {
  activeTenantId?: string | null;
  roomTenantId?: string | null;
  roomPropertyId: string;
  requestedPropertyId: string;
}): RoomAssignDecision {
  if (!input.activeTenantId) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (!input.roomTenantId || input.roomTenantId !== input.activeTenantId) {
    return { allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' };
  }
  if (input.roomPropertyId !== input.requestedPropertyId) {
    return { allowed: false, status: 422, code: 'ROOM_NOT_IN_PROPERTY' };
  }
  return { allowed: true };
}

// Authenticated endpoint path for an inventory item's photo.
// Callers must NOT return raw R2 keys or public R2 URLs for private inventory media.
export function inventoryPhotoEndpoint(propertyId: string, itemId: string): string {
  return `/api/v1/properties/${propertyId}/inventory/${itemId}/photo`;
}

// Replaces the raw photo_url (R2 key or public URL) with the authenticated endpoint.
// Returns null photo_url unchanged so the client knows there's no photo yet.
export function withInventoryPhotoEndpoint<T extends { id: string; photo_url?: string | null }>(
  item: T,
  propertyId: string
): T {
  return {
    ...item,
    photo_url: item.photo_url != null ? inventoryPhotoEndpoint(propertyId, item.id) : null,
  };
}
