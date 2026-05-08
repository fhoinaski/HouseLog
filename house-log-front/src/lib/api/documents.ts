import { BASE, getToken, normalizeApiMediaUrls, qs, request } from './_core';
import type { CursorPage, Document, DocumentType } from './_core';

export type { DocumentType };

// Meta fields accepted by the upload endpoint.
// Excludes server-generated fields (id, property_id, file_url, ocr_data, created_by, created_at).
// type is string here because form values are untyped strings at the call site.
export type DocumentUploadMeta = {
  type: string;
  title: string;
  service_id?: string;
  vendor_cnpj?: string;
  amount?: number;
  issue_date?: string;
  expiry_date?: string;
};

export const documentsApi = {
  list: (propertyId: string, params?: { type?: string; cursor?: string }) =>
    request<CursorPage<Document>>(`/properties/${propertyId}/documents${qs(params)}`),

  get: (propertyId: string, id: string) =>
    request<{ document: Document }>(`/properties/${propertyId}/documents/${id}`),

  upload: (propertyId: string, file: File, meta: DocumentUploadMeta) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('meta', JSON.stringify(meta));
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: 'Erro ao enviar documento', code: 'UPLOAD_FAILED' }));
        const error = new Error((body as { error?: string }).error ?? 'Erro ao enviar documento') as Error & {
          code: string;
          status: number;
          details?: unknown;
        };
        error.code = (body as { code?: string }).code ?? 'UPLOAD_FAILED';
        error.status = r.status;
        error.details = (body as { details?: unknown }).details;
        throw error;
      }

      return normalizeApiMediaUrls(await r.json() as { document: Document });
    });
  },

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/documents/${id}`, { method: 'DELETE' }),

  ocr: (propertyId: string, id: string) =>
    request<{ ocr_data: Record<string, unknown> }>(`/properties/${propertyId}/documents/${id}/ocr`, {
      method: 'POST',
    }),
};
