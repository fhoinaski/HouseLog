import { qs, request } from '@/lib/api/_core';
import type {
  Warranty,
  WarrantyCreateInput,
  WarrantyStatus,
  WarrantyType,
  WarrantyUpdateInput,
} from '@houselog/contracts';

export type { Warranty, WarrantyCreateInput, WarrantyUpdateInput };

export type WarrantyFilters = {
  status?: WarrantyStatus;
  warranty_type?: WarrantyType;
  room_id?: string;
  service_order_id?: string;
  document_id?: string;
  inventory_item_id?: string;
};

export const warrantiesApi = {
  list: (propertyId: string, filters?: WarrantyFilters) =>
    request<{ warranties: Warranty[] }>(`/properties/${propertyId}/warranties${qs(filters)}`),

  get: (propertyId: string, warrantyId: string) =>
    request<{ warranty: Warranty }>(`/properties/${propertyId}/warranties/${warrantyId}`),

  create: (propertyId: string, data: WarrantyCreateInput) =>
    request<{ warranty: Warranty }>(`/properties/${propertyId}/warranties`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, warrantyId: string, data: WarrantyUpdateInput) =>
    request<{ warranty: Warranty }>(`/properties/${propertyId}/warranties/${warrantyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (propertyId: string, warrantyId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/warranties/${warrantyId}`, {
      method: 'DELETE',
    }),
};
