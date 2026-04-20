import { qs, request } from './_core';
import type { CursorPage, Property, PropertyDashboard, PropertyProvider } from './_core';

export const propertiesApi = {
  list: (params?: { limit?: number; cursor?: string; search?: string }) =>
    request<CursorPage<Property>>(`/properties${qs(params)}`),

  get: (id: string) => request<{ property: Property }>(`/properties/${id}`),

  create: (data: Partial<Property>) =>
    request<{ property: Property }>('/properties', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Property>) =>
    request<{ property: Property }>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => request<{ success: boolean }>(`/properties/${id}`, { method: 'DELETE' }),

  dashboard: (id: string) => request<PropertyDashboard>(`/properties/${id}/dashboard`),

  applyTemplate: (id: string, type: 'house' | 'apt' | 'commercial' | 'warehouse') =>
    request<{ created: { rooms: number; maintenance: number } }>(`/properties/${id}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  providers: (id: string) => request<{ providers: PropertyProvider[] }>(`/properties/${id}/providers`),
};
