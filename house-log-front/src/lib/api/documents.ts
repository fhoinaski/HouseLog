import { BASE, getToken, qs, request } from './_core';
import type { CursorPage, Document } from './_core';

export const documentsApi = {
  list: (propertyId: string, params?: { type?: string; cursor?: string }) =>
    request<CursorPage<Document>>(`/properties/${propertyId}/documents${qs(params)}`),

  upload: (propertyId: string, file: File, meta: Partial<Document> & { type: string; title: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('meta', JSON.stringify(meta));
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then((r) => r.json() as Promise<{ document: Document }>);
  },

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/documents/${id}`, { method: 'DELETE' }),

  ocr: (propertyId: string, id: string) =>
    request<{ ocr_data: Record<string, unknown> }>(`/properties/${propertyId}/documents/${id}/ocr`, {
      method: 'POST',
    }),
};
