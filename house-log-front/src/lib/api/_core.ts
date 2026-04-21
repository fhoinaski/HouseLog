export const BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'https://houselog-api-dev.sukinodoncai.workers.dev/api/v1';

const R2_KEY_PATTERN = /^\/?.*(photos|videos|documents|avatars|inventory|invoices)\//;
const MEDIA_FIELD_NAMES = new Set([
  'afterImageUrl',
  'after_photos',
  'attachments',
  'avatar_url',
  'beforeImageUrl',
  'before_photos',
  'cover_url',
  'fileUrl',
  'file_url',
  'invoice_url',
  'mediaUrls',
  'media_urls',
  'photo_url',
  'receipt_url',
  'url',
  'video_url',
  'audio_url',
]);

export function normalizeMediaUrl(value: string): string {
  const mediaUrl = value.trim();
  if (!mediaUrl || /^(blob|data):/i.test(mediaUrl)) return mediaUrl;

  try {
    const parsed = new URL(mediaUrl);
    const isLocalR2Url =
      ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/r2/');

    if (!isLocalR2Url) return mediaUrl;

    return `${BASE}/media/${parsed.pathname.slice('/r2/'.length)}${parsed.search}`;
  } catch {
    // Relative R2 keys are normalized below.
  }

  if (mediaUrl.startsWith('/r2/')) {
    return `${BASE}/media/${mediaUrl.slice('/r2/'.length)}`;
  }

  if (R2_KEY_PATTERN.test(mediaUrl)) {
    return `${BASE}/media/${mediaUrl.replace(/^\//, '')}`;
  }

  return mediaUrl;
}

function normalizeMediaField(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return JSON.stringify(
            parsed.map((item) => (typeof item === 'string' ? normalizeMediaUrl(item) : item))
          );
        }
      } catch {
        // Fall through and treat it as a plain string.
      }
    }

    return normalizeMediaUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? normalizeMediaUrl(item) : normalizeApiMediaUrls(item)));
  }
  return normalizeApiMediaUrls(value);
}

export function normalizeApiMediaUrls<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiMediaUrls(item)) as T;
  }

  const input = payload as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = MEDIA_FIELD_NAMES.has(key) ? normalizeMediaField(value) : normalizeApiMediaUrls(value);
  }

  return output as T;
}

export function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries as [string, string][]) : '';
}

export function getToken(): string | null {
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

export async function request<T>(
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

  const data = await res.json() as T;
  return normalizeApiMediaUrls(data);
}

// Generic fetcher for useSWRInfinite (receives relative path, injects auth)
export function apiFetcher<T>(path: string): Promise<T> {
  return request<T>(path);
}

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

export type ProviderNetworkOpportunity = ProviderServiceOrder & {
  my_bid: { id: string; amount: number; status: 'pending' | 'accepted' | 'rejected'; created_at: string } | null;
};

export type ProviderOpportunity = ProviderNetworkOpportunity;

export type AccessCredential = {
  id: string;
  property_id: string;
  category: 'wifi' | 'alarm' | 'smart_lock' | 'gate' | 'app' | 'other';
  label: string;
  username: string | null;
  notes: string | null;
  integration_type: 'intelbras' | null;
  integration_config: Record<string, unknown> | null;
  share_with_os: boolean;
  has_secret: boolean;
  created_at: string;
  updated_at: string;
};

export type AccessCredentialPayload = {
  category?: AccessCredential['category'];
  label: string;
  username?: string;
  secret: string;
  notes?: string;
  integration_type?: 'intelbras' | null;
  integration_config?: Record<string, unknown> | null;
  share_with_os?: boolean;
};

export type RevealedAccessCredential = AccessCredential & {
  secret: string;
  secret_revealed: true;
};

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
  credentials: Array<{
    category: AccessCredential['category'];
    label: string;
    username: string | null;
    secret: string;
    notes: string | null;
  }>;
};
