// API client for HouseLog backend (Cloudflare Workers)
import { BASE, getToken, qs, request } from '@/lib/api/_core';
import { providerNetworkApi } from '@/lib/api/provider';
import type {
  AuthPairResponse,
  CursorPage,
  MfaChallengeResponse,
  Property,
  ServiceBid,
  ServiceOrder,
} from '@/lib/api/_core';

export { BASE, apiFetcher, clearToken, getToken, qs, request, setToken } from '@/lib/api/_core';
export type {
  AccessCredential,
  AccessCredentialPayload,
  AuthPairResponse,
  CursorPage,
  Document,
  MfaChallengeResponse,
  Property,
  PropertyDashboard,
  PropertyProvider,
  ProviderNetworkOpportunity,
  ProviderOpportunity,
  ProviderPublicProfile,
  ProviderServiceOrder,
  PublicServiceView,
  RevealedAccessCredential,
  ServiceBid,
  ServiceOrder,
  ServiceShareLink,
  User,
} from '@/lib/api/_core';
export { authApi } from '@/lib/api/auth';
export { propertiesApi } from '@/lib/api/properties';
export { documentsApi } from '@/lib/api/documents';
export { credentialsApi } from '@/lib/api/credentials';
export { providerApi, providerNetworkApi } from '@/lib/api/provider';
export { shareApi } from '@/lib/api/share';

export function isMfaChallenge(
  r: AuthPairResponse | MfaChallengeResponse
): r is MfaChallengeResponse {
  return 'mfa_required' in r && r.mfa_required === true;
}

// Web Push
export const pushApi = {
  publicKey: () => request<{ publicKey: string }>('/push/public-key'),
  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ id: string; created?: boolean; updated?: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(sub),
    }),
  unsubscribe: (endpoint: string) =>
    request<{ ok: true }>('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),
  test: () => request<{ sent: number }>('/push/test', { method: 'POST' }),
};

// Invites & Collaborators
export const invitesApi = {
  list: (propertyId: string) =>
    request<{ invites: PropertyInvite[]; collaborators: PropertyCollaborator[] }>(
      `/properties/${propertyId}/invites`
    ),

  create: (
    propertyId: string,
    data: {
      name?: string;
      email?: string;
      role: 'viewer' | 'provider' | 'manager';
      specialties?: string[];
      whatsapp?: string;
    }
  ) =>
    request<{ id: string; token: string; expires_at: string; invite_url: string; delivery: 'email' | 'whatsapp_link' }>(
      `/properties/${propertyId}/invites`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  extractFromCard: async (propertyId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/properties/${propertyId}/invites/extract-card`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Erro ao extrair dados do cartão' }));
      throw new Error((body as { error?: string }).error ?? 'Erro ao extrair dados do cartão');
    }

    return res.json() as Promise<{ suggestion: InviteCardSuggestion }>;
  },

  cancel: (propertyId: string, inviteId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/invites/${inviteId}`, { method: 'DELETE' }),

  updatePermissions: (propertyId: string, collabId: string, can_open_os: boolean) =>
    request<{ success: boolean }>(
      `/properties/${propertyId}/collaborators/${collabId}`,
      { method: 'PATCH', body: JSON.stringify({ can_open_os }) }
    ),

  removeCollaborator: (propertyId: string, collabId: string) =>
    request<{ success: boolean }>(
      `/properties/${propertyId}/collaborators/${collabId}`,
      { method: 'DELETE' }
    ),

  getInvite: (token: string) =>
    request<InviteDetails>(`/invite/${token}`),

  acceptInvite: (token: string) =>
    request<{ success: boolean; property_id: string; role: string }>(
      `/invite/${token}/accept`,
      { method: 'POST', body: '{}' }
    ),
};

// Rooms
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

// Inventory
export const inventoryApi = {
  list: (propertyId: string, params?: { category?: string; room_id?: string; cursor?: string }) =>
    request<CursorPage<InventoryItem>>(
      `/properties/${propertyId}/inventory${qs(params)}`
    ),

  colors: (propertyId: string) =>
    request<{ colors: ColorEntry[] }>(`/properties/${propertyId}/inventory/colors`),

  get: (propertyId: string, id: string) =>
    request<{ item: InventoryItem }>(`/properties/${propertyId}/inventory/${id}`),

  create: (propertyId: string, data: Partial<InventoryItem>) =>
    request<{ item: InventoryItem }>(`/properties/${propertyId}/inventory`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<InventoryItem>) =>
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
    }).then((r) => r.json() as Promise<{ photo_url: string }>);
  },
};

// Service Orders
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
    }).then((r) => r.json() as Promise<{ url: string; type: string }>);
  },

  uploadVideo: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/services/${id}/video`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then((r) => r.json() as Promise<{ video_url: string }>);
  },

  uploadAudio: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/properties/${propertyId}/services/${id}/audio`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then((r) => r.json() as Promise<{ audio_url: string }>);
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

// Audit (public token-based)
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

// Maintenance
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

// Reports
export const reportsApi = {
  healthScore: (propertyId: string) =>
    request<HealthScoreReport>(`/properties/${propertyId}/report/health-score`),

  valuationPdf: (propertyId: string) =>
    request<ValuationPayload>(`/properties/${propertyId}/report/valuation-pdf`),
};

// Expenses
export const expensesApi = {
  list: (propertyId: string, params?: { month?: string; category?: string; cursor?: string }) =>
    request<CursorPage<Expense>>(
      `/properties/${propertyId}/expenses${qs(params)}`
    ),

  summary: (propertyId: string, params?: { from?: string; to?: string }) =>
    request<ExpenseSummary>(
      `/properties/${propertyId}/expenses/summary${qs(params)}`
    ),

  create: (propertyId: string, data: Partial<Expense>) =>
    request<{ expense: Expense }>(`/properties/${propertyId}/expenses`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<Expense>) =>
    request<{ expense: Expense }>(`/properties/${propertyId}/expenses/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/expenses/${id}`, { method: 'DELETE' }),
};

// ── Types ─────────────────────────────────────────────────────────────────

export type Room = {
  id: string;
  property_id: string;
  name: string;
  type: string;
  floor: number;
  area_m2: number | null;
  notes: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  property_id: string;
  room_id: string | null;
  room_name: string | null;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
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

export type Expense = {
  id: string;
  property_id: string;
  type: 'expense' | 'revenue';
  category: string;
  amount: number;
  reference_month: string;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: number;
  recurrence_group: string | null;
  created_by: string;
  created_at: string;
};

export type ExpenseSummary = {
  total: number;
  total_revenue: number;
  by_category: { category: string; total: number; count: number }[];
  by_month: { reference_month: string; total: number; count: number }[];
  by_month_revenue: { reference_month: string; total: number }[];
  period: { from: string; to: string };
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

export type MaintenanceSchedule = {
  id: string;
  property_id: string;
  system_type: string;
  title: string;
  description: string | null;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  last_done: string | null;
  next_due: string | null;
  responsible: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
  created_at: string;
};

export type HealthScoreReport = {
  score: number;
  label: string;
  breakdown: {
    maintenance_compliance: number;
    service_backlog: number;
    preventive_ratio: number;
    age_penalty: number;
    document_completeness: number;
  };
};

export type PropertyCollaborator = {
  id: string;
  user_id: string;
  role: 'viewer' | 'provider' | 'manager';
  can_open_os: number;
  specialties?: string | null;
  whatsapp?: string | null;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
};

export type PropertyInvite = {
  id: string;
  property_id: string;
  invited_by: string;
  invited_by_name: string;
  email: string;
  invite_name?: string | null;
  whatsapp?: string | null;
  role: 'viewer' | 'provider' | 'manager';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type InviteDetails = {
  email: string | null;
  invite_name?: string | null;
  whatsapp?: string | null;
  role: string;
  expires_at: string;
  property_name: string;
  property_address: string;
  property_city: string;
  invited_by_name: string;
};

export type InviteCardSuggestion = {
  name: string;
  email: string;
  whatsapp: string;
  specialties: string[];
  confidence: number;
  notes: string;
};

export type SearchResult = {
  type: 'service' | 'document' | 'inventory' | 'maintenance';
  id: string;
  title: string;
  subtitle: string;
  property_id: string;
  href: string;
};

export type ValuationPayload = {
  property: Property;
  expenses_total: number;
  services_total: number;
  maintenance_total: number;
  health_score: number;
  health_label: string;
  health_breakdown: Record<string, number>;
  services_summary: { status: string; count: number }[];
  inventory_items: number;
  recent_services: { title: string; system_type: string; status: string; completed_at: string | null; cost: number | null }[];
  generated_at: string;
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

export const PROVIDER_CATEGORY_OPTIONS = [
  { value: 'electrical', label: 'Elétrica' },
  { value: 'plumbing', label: 'Hidráulica' },
  { value: 'structural', label: 'Estrutural' },
  { value: 'waterproofing', label: 'Impermeabilização' },
  { value: 'painting', label: 'Pintura' },
  { value: 'flooring', label: 'Pisos e revestimentos' },
  { value: 'roofing', label: 'Telhado e cobertura' },
  { value: 'hvac', label: 'Climatização (HVAC)' },
  { value: 'solar', label: 'Energia solar' },
  { value: 'pool', label: 'Piscinas' },
  { value: 'gardening', label: 'Jardinagem' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'locksmith', label: 'Chaveiro' },
  { value: 'carpentry', label: 'Marcenaria' },
  { value: 'masonry', label: 'Alvenaria' },
  { value: 'automation', label: 'Automação' },
  { value: 'alarm_cctv', label: 'Alarme e CFTV' },
  { value: 'internet_network', label: 'Internet e rede' },
  { value: 'appliances', label: 'Eletrodomésticos' },
  { value: 'pest_control', label: 'Controle de pragas' },
  { value: 'glazing', label: 'Vidracaria' },
  { value: 'welding', label: 'Serralheria' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'drainage', label: 'Drenagem' },
  { value: 'gas', label: 'Gás' },
  { value: 'elevator', label: 'Elevador' },
  { value: 'facade', label: 'Fachada' },
  { value: 'general', label: 'Serviços gerais' },
] as const;

// Full-text search
export const searchApi = {
  search: (q: string, propertyId?: string) =>
    request<{ results: SearchResult[] }>(`/search${qs({ q, propertyId })}`),
};

// Bids
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

export const marketplaceApi = providerNetworkApi;

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
