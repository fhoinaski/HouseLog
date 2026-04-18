// Cloudflare Workers bindings type
export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  KV: KVNamespace;
  QUEUE: Queue;
  AI: Ai;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  R2_PUBLIC_URL: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  RESEND_API_KEY: string;
  APP_URL: string;
};

export type Variables = {
  userId: string;
  userRole: Role;
  userEmail: string;
};

export type Role = 'admin' | 'owner' | 'provider' | 'temp_provider';

// DB row types
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
  deleted_at: string | null;
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
  deleted_at: string | null;
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
  deleted_at: string | null;
};

export type InventoryItem = {
  id: string;
  property_id: string;
  room_id: string | null;
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
  qr_code: string | null;
  price_paid: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type ServiceOrder = {
  id: string;
  property_id: string;
  room_id: string | null;
  system_type: string;
  requested_by: string;
  assigned_to: string | null;
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
  deleted_at: string | null;
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
  deleted_at: string | null;
};

// Queue messages
export type QueueMessage =
  | { type: 'GENERATE_THUMBNAIL'; r2Key: string; itemId: string; itemType: string };

// Pagination
export type CursorPage<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};

// Standard error response
export type ApiError = {
  error: string;
  code: string;
  details?: unknown;
};

export type ServiceBid = {
  id: string;
  service_id: string;
  provider_id: string;
  provider_name?: string;
  provider_email?: string;
  provider_phone?: string | null;
  amount: number;
  notes: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};
