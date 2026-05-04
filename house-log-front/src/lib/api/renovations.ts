import { qs, request } from '@/lib/api/_core';
import type {
  Renovation,
  RenovationCategory,
  RenovationCreateInput,
  RenovationStatus,
  RenovationUpdateInput,
} from '@houselog/contracts';

export type { Renovation, RenovationCreateInput, RenovationUpdateInput };

export type RenovationFilters = {
  status?: RenovationStatus;
  category?: RenovationCategory;
  room_id?: string;
  service_order_id?: string;
  document_id?: string;
  started_from?: string;
  started_to?: string;
  completed_from?: string;
  completed_to?: string;
};

export const renovationsApi = {
  list: (propertyId: string, filters?: RenovationFilters) =>
    request<{ renovations: Renovation[] }>(`/properties/${propertyId}/renovations${qs(filters)}`),

  get: (propertyId: string, renovationId: string) =>
    request<{ renovation: Renovation }>(`/properties/${propertyId}/renovations/${renovationId}`),

  create: (propertyId: string, data: RenovationCreateInput) =>
    request<{ renovation: Renovation }>(`/properties/${propertyId}/renovations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, renovationId: string, data: RenovationUpdateInput) =>
    request<{ renovation: Renovation }>(`/properties/${propertyId}/renovations/${renovationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (propertyId: string, renovationId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/renovations/${renovationId}`, {
      method: 'DELETE',
    }),
};
