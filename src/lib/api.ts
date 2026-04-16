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

  uploadPhoto: (propertyId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
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
