import { BASE, getToken, normalizeApiMediaUrls, qs, request } from '@/lib/api/_core';
import type { CursorPage } from '@/lib/api/_core';
import type { InventoryCategory } from '@houselog/contracts';

export type { InventoryCategory };

export type InventoryItem = {
  id: string;
  property_id: string;
  room_id: string | null;
  room_name: string | null;
  category: InventoryCategory;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  color_code: string | null;
  lot_number: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  reserve_qty: number;
  storage_loc: string | null;
  photo_url: string | null;
  price_paid: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  notes: string | null;
  created_at: string;
};

// Mutable fields accepted by create/update endpoints.
// Excludes server-generated fields (id, property_id, room_name, photo_url, created_at).
// category is string here because form values are untyped strings at the call site.
export type InventoryMutationInput = {
  category: string;
  name: string;
  room_id?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  color_code?: string;
  lot_number?: string;
  supplier?: string;
  quantity?: number;
  unit?: string;
  reserve_qty?: number;
  storage_loc?: string;
  price_paid?: number;
  purchase_date?: string;
  warranty_until?: string;
  notes?: string;
};

// Result returned by the label-ocr endpoint.
// Fields are suggestions — never auto-saved, always reviewed by the user.
export type LabelExtractResult = {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  voltage: string | null;
  manufactureDate: string | null;
  warrantyUntil: string | null;
  confidence: number;
  rawExtractedText: string;
};

export type ColorEntry = {
  name: string;
  brand: string | null;
  color_code: string;
  lot_number: string | null;
  supplier: string | null;
  room_id: string | null;
  room_name: string | null;
};

export const inventoryApi = {
  list: (propertyId: string, params?: { category?: string; room_id?: string; cursor?: string }) =>
    request<CursorPage<InventoryItem>>(
      `/properties/${propertyId}/inventory${qs(params)}`
    ),

  colors: (propertyId: string) =>
    request<{ colors: ColorEntry[] }>(`/properties/${propertyId}/inventory/colors`),

  get: (propertyId: string, id: string) =>
    request<{ item: InventoryItem }>(`/properties/${propertyId}/inventory/${id}`),

  create: (propertyId: string, data: InventoryMutationInput) =>
    request<{ item: InventoryItem }>(`/properties/${propertyId}/inventory`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<InventoryMutationInput>) =>
    request<{ item: InventoryItem }>(`/properties/${propertyId}/inventory/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/inventory/${id}`, { method: 'DELETE' }),

  generateQr: (propertyId: string, id: string) =>
    request<{ qr_value: string; item_id: string }>(
      `/properties/${propertyId}/inventory/${id}/qr`,
      { method: 'POST' }
    ),

  uploadPhoto: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/inventory/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => normalizeApiMediaUrls(await r.json() as { photo_url: string }));
  },

  // Reads a technical label from an image and returns field suggestions.
  // Never saves automatically — the caller must present the result for user review.
  labelOcr: (propertyId: string, id: string, file: File): Promise<{ extraction: LabelExtractResult }> => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/inventory/${id}/label-ocr`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => {
      const body = await r.json() as { extraction: LabelExtractResult; code?: string; error?: string };
      if (!r.ok) throw new Error(body.error ?? `OCR falhou (${r.status})`);
      return body;
    });
  },
};
