import { request } from '@/lib/api/_core';
import type { RoomType } from '@houselog/contracts';

export type { RoomType };

export type Room = {
  id: string;
  property_id: string;
  name: string;
  type: RoomType;
  floor: number;
  area_m2: number | null;
  notes: string | null;
  created_at: string;
};

export const roomsApi = {
  list: (propertyId: string) =>
    request<{ rooms: Room[] }>(`/properties/${propertyId}/rooms`),

  create: (propertyId: string, data: Partial<Room>) =>
    request<{ room: Room }>(`/properties/${propertyId}/rooms`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<Room>) =>
    request<{ room: Room }>(`/properties/${propertyId}/rooms/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/rooms/${id}`, { method: 'DELETE' }),
};
