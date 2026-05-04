import { request } from '@/lib/api/_core';
import type { MaintenanceFrequency } from '@houselog/contracts';

export type { MaintenanceFrequency };

export type MaintenanceSchedule = {
  id: string;
  property_id: string;
  system_type: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  last_done: string | null;
  next_due: string | null;
  responsible: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
  created_at: string;
};

export const maintenanceApi = {
  list: (propertyId: string) =>
    request<{ schedules: MaintenanceSchedule[] }>(`/properties/${propertyId}/maintenance`),

  create: (propertyId: string, data: Partial<MaintenanceSchedule>) =>
    request<{ schedule: MaintenanceSchedule }>(`/properties/${propertyId}/maintenance`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<MaintenanceSchedule>) =>
    request<{ schedule: MaintenanceSchedule }>(`/properties/${propertyId}/maintenance/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  markDone: (propertyId: string, id: string, auto_create_os?: boolean) =>
    request<{ last_done: string; next_due: string }>(`/properties/${propertyId}/maintenance/${id}/mark-done`, {
      method: 'POST', body: JSON.stringify({ auto_create_os: auto_create_os ? 1 : 0 }),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/maintenance/${id}`, { method: 'DELETE' }),
};
