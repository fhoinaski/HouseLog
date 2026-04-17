// API client for HouseLog backend (Cloudflare Workers)
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hl_token');
}

export function setToken(token: string) {
  localStorage.setItem('hl_token', token);
}

export function clearToken() {
  localStorage.removeItem('hl_token');
  localStorage.removeItem('hl_user');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido', code: 'UNKNOWN' }));
    const error = new Error((body as { error: string }).error ?? 'Request failed') as Error & {
      code: string;
      status: number;
      details?: unknown;
    };
    error.code = (body as { code: string }).code ?? 'UNKNOWN';
    error.status = res.status;
    error.details = (body as { details?: unknown }).details;
    throw error;
  }

  return res.json() as Promise<T>;
}

// Generic fetcher for useSWRInfinite (receives relative path, injects auth)
export function apiFetcher<T>(path: string): Promise<T> {
  return request<T>(path);
}

// Auth
export const authApi = {
  register: (data: { email: string; name: string; password: string; role?: string; phone?: string }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/auth/me'),

  refresh: (token: string) =>
    request<{ token: string }>('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProfile: (data: { name?: string; phone?: string }) =>
    request<{ user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
};

// Properties
export const propertiesApi = {
  list: (params?: { limit?: number; cursor?: string; search?: string }) =>
    request<CursorPage<Property>>(`/properties?${new URLSearchParams(params as Record<string, string>)}`),

  get: (id: string) => request<{ property: Property }>(`/properties/${id}`),

  create: (data: Partial<Property>) =>
    request<{ property: Property }>('/properties', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Property>) =>
    request<{ property: Property }>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/properties/${id}`, { method: 'DELETE' }),

  dashboard: (id: string) => request<PropertyDashboard>(`/properties/${id}/dashboard`),
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
      `/properties/${propertyId}/inventory?${new URLSearchParams(params as Record<string, string>)}`
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
      `/properties/${propertyId}/services?${new URLSearchParams(params as Record<string, string>)}`
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

  createAuditLink: (
    propertyId: string,
    id: string,
    data: { scope: { canUploadPhotos: boolean; canUploadVideo: boolean }; expires_in_hours: number }
  ) =>
    request<{ url: string; token: string; expires_at: string }>(
      `/properties/${propertyId}/services/${id}/audit-link`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

// Documents
export const documentsApi = {
  list: (propertyId: string, params?: { type?: string; cursor?: string }) =>
    request<CursorPage<Document>>(
      `/properties/${propertyId}/documents?${new URLSearchParams(params as Record<string, string>)}`
    ),

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
    request<{ schedule: MaintenanceSchedule }>(`/properties/${propertyId}/maintenance/${id}/done`, {
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
      `/properties/${propertyId}/expenses?${new URLSearchParams(params as Record<string, string>)}`
    ),

  summary: (propertyId: string, params?: { from?: string; to?: string }) =>
    request<ExpenseSummary>(
      `/properties/${propertyId}/expenses/summary?${new URLSearchParams(params as Record<string, string>)}`
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

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'provider' | 'temp_provider';
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
};

export type Property = {
  id: string;
  owner_id: string;
  manager_id: string | null;
  name: string;
  type: 'house' | 'apt' | 'commercial' | 'warehouse';
  address: string;
  city: string;
  area_m2: number | null;
  year_built: number | null;
  structure: string | null;
  floors: number;
  cover_url: string | null;
  health_score: number;
  created_at: string;
  owner_name?: string;
};

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
  notes: string | null;
  created_at: string;
};

export type ServiceOrder = {
  id: string;
  property_id: string;
  room_id: string | null;
  room_name: string | null;
  system_type: string;
  requested_by: string;
  requested_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  title: string;
  description: string | null;
  priority: 'urgent' | 'normal' | 'preventive';
  status: 'requested' | 'approved' | 'in_progress' | 'completed' | 'verified';
  cost: number | null;
  before_photos: string;
  after_photos: string;
  video_url: string | null;
  checklist: string;
  warranty_until: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  property_id: string;
  category: string;
  amount: number;
  reference_month: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type CursorPage<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export type PropertyDashboard = {
  health_score: number;
  expenses: { total: number; this_month: number };
  services: { total: number; requested: number; in_progress: number; done: number; urgent_open: number };
  inventory: { total: number; low_stock: number };
  monthly_expenses: { reference_month: string; total: number; category: string }[];
};

export type ExpenseSummary = {
  total: number;
  by_category: { category: string; total: number; count: number }[];
  by_month: { reference_month: string; total: number; count: number }[];
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

export type Document = {
  id: string;
  property_id: string;
  type: string;
  title: string;
  file_url: string;
  vendor_cnpj: string | null;
  amount: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  ocr_data: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
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
