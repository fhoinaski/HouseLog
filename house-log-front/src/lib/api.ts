// API client for HouseLog backend (Cloudflare Workers)
const BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'https://houselog-api-dev.sukinodoncai.workers.dev/api/v1';

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries as [string, string][]) : '';
}

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
  register: (data: { email: string; name: string; password: string; role?: string; phone?: string; provider_categories?: string[] }) =>
    request<AuthPairResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<AuthPairResponse | MfaChallengeResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  mfaChallenge: (challenge_token: string, code: string) =>
    request<AuthPairResponse>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ challenge_token, code }),
    }),

  me: () => request<{ user: User & { mfa_enabled?: boolean } }>('/auth/me'),

  // Rotaciona: envia refresh_token no body, recebe novo par.
  refresh: (refresh_token: string) =>
    request<AuthPairResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),

  logout: (refresh_token?: string) =>
    request<{ ok: true }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refresh_token ? { refresh_token } : {}),
    }),

  mfaSetup: () =>
    request<{ secret: string; otpauth_uri: string }>('/auth/mfa/setup', { method: 'POST' }),

  mfaVerify: (code: string) =>
    request<{ enabled: true; backup_codes: string[] }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  mfaDisable: (password: string) =>
    request<{ enabled: false }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  updateProfile: (data: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    service_area?: string;
    pix_key?: string;
    pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    provider_bio?: string;
    provider_courses?: string[];
    provider_specializations?: string[];
    provider_portfolio?: string[];
    provider_education?: Array<{
      institution: string;
      title: string;
      type: 'college' | 'technical' | 'course' | 'certification' | 'other';
      status: 'in_progress' | 'completed';
      certificationUrl?: string;
    }>;
    provider_portfolio_cases?: Array<{
      title: string;
      description?: string;
      beforeImageUrl?: string;
      afterImageUrl?: string;
    }>;
    provider_categories?: string[];
  }) =>
    request<{ user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),

  updateNotificationPrefs: (prefs: Record<string, boolean>) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PUT', body: JSON.stringify({ notification_prefs: JSON.stringify(prefs) }),
    }),
};

export type AuthPairResponse = {
  token: string;           // alias de access_token para compat
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
};

export type MfaChallengeResponse = {
  mfa_required: true;
  challenge_token: string;
};

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

// Properties
export const propertiesApi = {
  list: (params?: { limit?: number; cursor?: string; search?: string }) =>
    request<CursorPage<Property>>(`/properties${qs(params)}`),

  get: (id: string) => request<{ property: Property }>(`/properties/${id}`),

  create: (data: Partial<Property>) =>
    request<{ property: Property }>('/properties', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Property>) =>
    request<{ property: Property }>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/properties/${id}`, { method: 'DELETE' }),

  dashboard: (id: string) => request<PropertyDashboard>(`/properties/${id}/dashboard`),

  applyTemplate: (id: string, type: 'house' | 'apt' | 'commercial' | 'warehouse') =>
    request<{ created: { rooms: number; maintenance: number } }>(`/properties/${id}/apply-template`, {
      method: 'POST', body: JSON.stringify({ type }),
    }),

  providers: (id: string) =>
    request<{ providers: PropertyProvider[] }>(`/properties/${id}/providers`),
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

// Documents
export const documentsApi = {
  list: (propertyId: string, params?: { type?: string; cursor?: string }) =>
    request<CursorPage<Document>>(
      `/properties/${propertyId}/documents${qs(params)}`
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

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'provider' | 'temp_provider';
  provider_categories?: string[];
  phone: string | null;
  whatsapp?: string | null;
  service_area?: string | null;
  pix_key?: string | null;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
  provider_bio?: string | null;
  provider_courses?: string[];
  provider_specializations?: string[];
  provider_portfolio?: string[];
  provider_education?: Array<{
    institution: string;
    title: string;
    type: 'college' | 'technical' | 'course' | 'certification' | 'other';
    status: 'in_progress' | 'completed';
    certificationUrl?: string;
  }>;
  provider_portfolio_cases?: Array<{
    title: string;
    description?: string;
    beforeImageUrl?: string;
    afterImageUrl?: string;
  }>;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
};

export type ProviderPublicProfile = {
  provider: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    whatsapp: string | null;
    service_area: string | null;
    provider_bio: string | null;
    provider_courses: string[];
    provider_specializations: string[];
    provider_portfolio: string[];
    provider_education: Array<{
      institution: string;
      title: string;
      type: 'college' | 'technical' | 'course' | 'certification' | 'other';
      status: 'in_progress' | 'completed';
      certificationUrl?: string;
    }>;
    provider_portfolio_cases: Array<{
      title: string;
      description?: string;
      beforeImageUrl?: string;
      afterImageUrl?: string;
    }>;
    provider_categories: string[];
  };
  score: {
    total_ratings: number;
    avg_stars: number | null;
    avg_quality: number | null;
    avg_punctuality: number | null;
    avg_communication: number | null;
    avg_price: number | null;
    endorsements: number;
    top_score: number;
  };
  reviews: Array<{
    stars: number;
    quality: number | null;
    punctuality: number | null;
    communication: number | null;
    price: number | null;
    comment: string | null;
    created_at: string;
  }>;
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
  warranty_until: string | null;
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
  audio_url: string | null;
  checklist: string;
  warranty_until: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
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
  warranties_expiring: { id: string; name: string; warranty_until: string; days_left: number }[];
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

export type PropertyProvider = {
  collab_id: string;
  user_id: string;
  role: string;
  can_open_os: number;
  specialties: string | null;
  whatsapp: string | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
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

export type ServiceBid = {
  id: string;
  service_id: string;
  provider_id: string;
  provider_name?: string;
  provider_email?: string | null;
  provider_phone?: string | null;
  amount: number;
  notes: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type ProviderServiceOrder = ServiceOrder & {
  property_name: string;
  property_address: string;
  property_id: string;
};

export type ProviderOpportunity = ProviderServiceOrder & {
  my_bid: { id: string; amount: number; status: 'pending' | 'accepted' | 'rejected'; created_at: string } | null;
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

// Access Credentials
export type AccessCredential = {
  id: string;
  property_id: string;
  category: 'wifi' | 'alarm' | 'smart_lock' | 'gate' | 'app' | 'other';
  label: string;
  username: string | null;
  secret: string;
  notes: string | null;
  integration_type: 'intelbras' | null;
  integration_config: Record<string, unknown> | null;
  share_with_os: boolean;
  created_at: string;
  updated_at: string;
};

export const credentialsApi = {
  list: (propertyId: string) =>
    request<{ credentials: AccessCredential[] }>(`/properties/${propertyId}/credentials`),

  create: (propertyId: string, data: Omit<AccessCredential, 'id' | 'property_id' | 'created_at' | 'updated_at'>) =>
    request<{ credential: AccessCredential }>(`/properties/${propertyId}/credentials`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<Omit<AccessCredential, 'id' | 'property_id' | 'created_at' | 'updated_at'>>) =>
    request<{ credential: AccessCredential }>(`/properties/${propertyId}/credentials/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ deleted: boolean }>(`/properties/${propertyId}/credentials/${id}`, { method: 'DELETE' }),

  generateTempCode: (propertyId: string, id: string, data: { expires_hours?: number; provider_name?: string }) =>
    request<{ temp_pin: string; expires_at: string; expires_hours: number; note: string }>(
      `/properties/${propertyId}/credentials/${id}/generate-temp-code`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

// Service Share Links
export type ServiceShareLink = {
  token: string;
  url: string;
  expires_at: string;
};

export type PublicServiceView = {
  service: ServiceOrder & { room_name: string | null; requested_by_name: string };
  property: { name: string; address: string; city: string; type: string };
  link: {
    token: string;
    expires_at: string;
    provider_name: string | null;
    provider_accepted_at: string | null;
    provider_started_at: string | null;
    provider_done_at: string | null;
    notes_from_provider: string | null;
    share_credentials: boolean;
  };
  credentials: Pick<AccessCredential, 'category' | 'label' | 'username' | 'secret' | 'notes'>[];
};

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8787';

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error((body as { error: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const shareApi = {
  createLink: (propertyId: string, serviceId: string, data?: {
    expires_hours?: number;
    provider_name?: string;
    provider_email?: string;
    provider_phone?: string;
    share_credentials?: boolean;
  }) =>
    request<ServiceShareLink>(
      `/properties/${propertyId}/services/${serviceId}/share-link`,
      { method: 'POST', body: JSON.stringify(data ?? {}) }
    ),

  getPublic: (token: string) =>
    publicRequest<PublicServiceView>(`/api/v1/public/share/service/${token}`),

  updateStatus: (token: string, data: { action: 'accept' | 'start' | 'done'; provider_name?: string; notes?: string }) =>
    publicRequest<{ action: string; updated_at: string }>(
      `/api/v1/public/share/service/${token}/status`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
};

// Provider portal
export const providerApi = {
  services: (params?: { status?: string; cursor?: string }) =>
    request<CursorPage<ProviderServiceOrder>>(`/provider/services${qs(params)}`),

  opportunities: (params?: { system_type?: string; cursor?: string }) =>
    request<CursorPage<ProviderOpportunity>>(`/provider/opportunities${qs(params)}`),

  getOpportunity: (id: string) =>
    request<{ order: ProviderServiceOrder; my_bids: ServiceBid[] }>(`/provider/opportunities/${id}`),

  getService: (id: string) =>
    request<{ order: ProviderServiceOrder; my_bids: ServiceBid[] }>(`/provider/services/${id}`),

  stats: () =>
    request<{ stats: Record<string, number>; total: number; recent_bids: ServiceBid[] }>('/provider/stats'),
};

export const marketplaceApi = {
  providerProfile: (providerId: string) =>
    request<ProviderPublicProfile>(`/marketplace/providers/${providerId}/profile`),

  endorseProvider: (providerId: string, notes?: string) =>
    request<{ id: string; provider_id: string; status: 'APPROVED' }>('/marketplace/providers/endorse', {
      method: 'POST',
      body: JSON.stringify({ provider_id: providerId, notes }),
    }),
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
