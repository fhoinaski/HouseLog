import { BASE, getToken, normalizeApiMediaUrls, qs, request } from '@/lib/api/_core';
import type { CursorPage, ServiceBid, ServiceOrder } from '@/lib/api/_core';

export type AuditLinkData = {
  token: string;
  order_title: string;
  order_description: string | null;
  system_type: string;
  before_photos: string[];
  property_name: string;
  address: string;
  scope: { canUploadPhotos: boolean; canUploadVideo: boolean; requiredFields: string[] };
  expires_at: string;
};

export type ServiceMessage = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  internal: number;
  attachments: string[];
  created_at: string;
};

export const servicesApi = {
  list: (propertyId: string, params?: { status?: string; priority?: string; cursor?: string }) =>
    request<CursorPage<ServiceOrder>>(
      `/properties/${propertyId}/services${qs(params)}`
    ),

  get: (propertyId: string, id: string) =>
    request<{ order: ServiceOrder }>(`/properties/${propertyId}/services/${id}`),

  create: (propertyId: string, data: Partial<ServiceOrder>) =>
    request<{ order: ServiceOrder }>(`/properties/${propertyId}/services`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<ServiceOrder>) =>
    request<{ order: ServiceOrder }>(`/properties/${propertyId}/services/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  updateStatus: (propertyId: string, id: string, status: string) =>
    request<{ order: ServiceOrder }>(`/properties/${propertyId}/services/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/services/${id}`, { method: 'DELETE' }),

  uploadPhoto: (propertyId: string, id: string, file: File, type: 'before' | 'after') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/services/${id}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => normalizeApiMediaUrls(await r.json() as { url: string; type: string }));
  },

  uploadVideo: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/services/${id}/video`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => normalizeApiMediaUrls(await r.json() as { video_url: string }));
  },

  uploadAudio: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/services/${id}/audio`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => normalizeApiMediaUrls(await r.json() as { audio_url: string }));
  },

  createAuditLink: (
    propertyId: string,
    id: string,
    data: { scope: { canUploadPhotos: boolean; canUploadVideo: boolean }; expires_in_hours: number }
  ) =>
    request<{ url: string; token: string; expires_at: string }>(
      `/properties/${propertyId}/services/${id}/audit-link`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  patchChecklist: (propertyId: string, id: string, checklist: { item: string; done: boolean }[]) =>
    request<{ checklist: { item: string; done: boolean }[] }>(
      `/properties/${propertyId}/services/${id}/checklist`,
      { method: 'PATCH', body: JSON.stringify({ checklist }) }
    ),
};

export const auditApi = {
  getByToken: (token: string) =>
    request<AuditLinkData>(`/audit/public/${token}`),

  submit: (token: string, photos: File[], notes: string) => {
    const fd = new FormData();
    photos.forEach((f) => fd.append('photos', f));
    fd.append('notes', notes);
    return fetch(`${BASE}/audit/public/${token}/submit`, {
      method: 'POST',
      body: fd,
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: 'Erro ao enviar' }));
        throw new Error((body as { error: string }).error ?? 'Erro ao enviar');
      }
      return r.json() as Promise<{ success: boolean }>;
    });
  },
};

export const bidsApi = {
  list: (propertyId: string, serviceId: string) =>
    request<{ bids: ServiceBid[] }>(`/properties/${propertyId}/services/${serviceId}/bids`),

  create: (propertyId: string, serviceId: string, data: { amount: number; notes?: string }) =>
    request<{ bid: ServiceBid }>(`/properties/${propertyId}/services/${serviceId}/bids`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateStatus: (propertyId: string, serviceId: string, bidId: string, status: 'accepted' | 'rejected') =>
    request<{ success: boolean; status: string }>(
      `/properties/${propertyId}/services/${serviceId}/bids/${bidId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),
};

export const messagesApi = {
  list: (serviceOrderId: string) =>
    request<{ data: ServiceMessage[] }>(`/services/${serviceOrderId}/messages`),

  create: (serviceOrderId: string, data: { body: string; internal?: boolean; attachments?: string[] }) =>
    request<{ id: string; created_at: string }>(`/services/${serviceOrderId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  remove: (serviceOrderId: string, id: string) =>
    request<{ id: string }>(`/services/${serviceOrderId}/messages/${id}`, { method: 'DELETE' }),
};
