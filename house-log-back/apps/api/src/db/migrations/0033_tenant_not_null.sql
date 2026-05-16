-- ============================================================
-- P0-14 Fase D: NOT NULL DDL em 19 tabelas críticas de tenant_id
-- ============================================================
--
-- PRECONDIÇÕES OBRIGATÓRIAS (verificar ANTES de executar):
--   1. Rodar phase_a_diagnostic.sql → confirmar null_tenant = 0 em TODAS tabelas.
--   2. Rodar phase_c_orphan_report.sql → confirmar orphaned = 0.
--   3. Backup completo confirmado:
--        wrangler d1 export houselog-db > backup_$(date +%Y%m%d_%H%M).sql
--   4. Migration 0032_tenant_backfill_and_null_guards.sql já aplicada.
--
-- ESTRATÉGIA: SQLite não suporta ALTER COLUMN.
--   Padrão: CREATE new → INSERT FROM old → DROP old → RENAME.
--   Os triggers de 0032 são descartados automaticamente ao DROP de cada tabela.
--   A constraint NOT NULL no DDL substitui o enforcement por trigger.
--
-- EXECUÇÃO EM PRODUÇÃO:
--   wrangler d1 execute houselog-db \
--     --command "$(cat 0033_tenant_not_null.sql)"
--
-- ROLLBACK: restaurar backup do passo 3.
--   D1 aplica a migration atomicamente — se qualquer INSERT falhar
--   (linha com tenant_id NULL sobreviveu ao backfill), a migration inteira
--   reverte e as tabelas originais são preservadas.
--
-- AUDIT_LOG: permanece nullable por design (eventos globais sem tenant scope).
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ══════════════════════════════════════════════════════════════
-- 1. properties
-- ══════════════════════════════════════════════════════════════
CREATE TABLE properties_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  manager_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  area_m2 REAL,
  year_built INTEGER,
  structure TEXT,
  floors INTEGER DEFAULT 1,
  cover_url TEXT,
  health_score INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO properties_new (
  id, tenant_id, owner_id, manager_id, name, type, address, city,
  area_m2, year_built, structure, floors, cover_url, health_score,
  created_at, deleted_at
)
SELECT
  id, tenant_id, owner_id, manager_id, name, type, address, city,
  area_m2, year_built, structure, floors, cover_url, health_score,
  created_at, deleted_at
FROM properties;
DROP TABLE properties;
ALTER TABLE properties_new RENAME TO properties;
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
SELECT 'properties' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 2. rooms
-- ══════════════════════════════════════════════════════════════
CREATE TABLE rooms_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  floor INTEGER DEFAULT 0,
  area_m2 REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO rooms_new (
  id, tenant_id, property_id, name, type, floor, area_m2, notes,
  created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, name, type, floor, area_m2, notes,
  created_at, deleted_at
FROM rooms;
DROP TABLE rooms;
ALTER TABLE rooms_new RENAME TO rooms;
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);
SELECT 'rooms' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 3. inventory_items
-- ══════════════════════════════════════════════════════════════
CREATE TABLE inventory_items_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  room_id TEXT REFERENCES rooms(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  color_code TEXT,
  lot_number TEXT,
  supplier TEXT,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'un',
  reserve_qty REAL DEFAULT 0,
  storage_loc TEXT,
  photo_url TEXT,
  qr_code TEXT,
  price_paid REAL,
  purchase_date TEXT,
  warranty_until TEXT,
  serial_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO inventory_items_new (
  id, tenant_id, property_id, room_id, category, name, brand, model,
  color_code, lot_number, supplier, quantity, unit, reserve_qty,
  storage_loc, photo_url, qr_code, price_paid, purchase_date,
  warranty_until, serial_number, notes, created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, room_id, category, name, brand, model,
  color_code, lot_number, supplier, quantity, unit, reserve_qty,
  storage_loc, photo_url, qr_code, price_paid, purchase_date,
  warranty_until, serial_number, notes, created_at, deleted_at
FROM inventory_items;
DROP TABLE inventory_items;
ALTER TABLE inventory_items_new RENAME TO inventory_items;
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_property ON inventory_items(property_id);
CREATE INDEX IF NOT EXISTS idx_inventory_room ON inventory_items(room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warranty ON inventory_items(property_id, warranty_until);
SELECT 'inventory_items' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 4. service_orders
-- ══════════════════════════════════════════════════════════════
CREATE TABLE service_orders_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  room_id TEXT REFERENCES rooms(id),
  system_type TEXT NOT NULL,
  requested_by TEXT NOT NULL REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'requested',
  cost REAL,
  before_photos TEXT NOT NULL DEFAULT '[]',
  after_photos TEXT NOT NULL DEFAULT '[]',
  video_url TEXT,
  audio_url TEXT,
  checklist TEXT NOT NULL DEFAULT '[]',
  warranty_until TEXT,
  scheduled_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO service_orders_new (
  id, tenant_id, property_id, room_id, system_type, requested_by,
  assigned_to, title, description, priority, status, cost,
  before_photos, after_photos, video_url, audio_url, checklist,
  warranty_until, scheduled_at, completed_at, created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, room_id, system_type, requested_by,
  assigned_to, title, description, priority, status, cost,
  before_photos, after_photos, video_url, audio_url, checklist,
  warranty_until, scheduled_at, completed_at, created_at, deleted_at
FROM service_orders;
DROP TABLE service_orders;
ALTER TABLE service_orders_new RENAME TO service_orders;
CREATE INDEX IF NOT EXISTS idx_services_tenant ON service_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_property ON service_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_services_assigned ON service_orders(assigned_to);
SELECT 'service_orders' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 5. service_bids  (depende de service_orders — executar após step 4)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE service_bids_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO service_bids_new (
  id, tenant_id, service_id, provider_id, amount, notes, status,
  created_at, updated_at
)
SELECT
  id, tenant_id, service_id, provider_id, amount, notes, status,
  created_at, updated_at
FROM service_bids;
DROP TABLE service_bids;
ALTER TABLE service_bids_new RENAME TO service_bids;
CREATE INDEX IF NOT EXISTS idx_service_bids_tenant ON service_bids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_bids_service ON service_bids(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bids_provider ON service_bids(provider_id);
SELECT 'service_bids' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 6. documents  (pode referenciar service_orders — executar após step 4)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE documents_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  service_id TEXT REFERENCES service_orders(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  ocr_data TEXT,
  vendor_cnpj TEXT,
  amount REAL,
  issue_date TEXT,
  expiry_date TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO documents_new (
  id, tenant_id, property_id, service_id, type, title, file_url,
  file_size, ocr_data, vendor_cnpj, amount, issue_date, expiry_date,
  uploaded_by, created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, service_id, type, title, file_url,
  file_size, ocr_data, vendor_cnpj, amount, issue_date, expiry_date,
  uploaded_by, created_at, deleted_at
FROM documents;
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_property ON documents(property_id);
SELECT 'documents' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 7. expenses
-- ══════════════════════════════════════════════════════════════
CREATE TABLE expenses_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  reference_month TEXT NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_group TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO expenses_new (
  id, tenant_id, property_id, category, amount, type, reference_month,
  is_recurring, recurrence_group, receipt_url, notes, created_by,
  created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, category, amount, type, reference_month,
  is_recurring, recurrence_group, receipt_url, notes, created_by,
  created_at, deleted_at
FROM expenses;
DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(property_id, reference_month);
SELECT 'expenses' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 8. maintenance_schedules
-- ══════════════════════════════════════════════════════════════
CREATE TABLE maintenance_schedules_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  system_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,
  last_done TEXT,
  next_due TEXT,
  responsible TEXT,
  auto_create_os INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO maintenance_schedules_new (
  id, tenant_id, property_id, system_type, title, description,
  frequency, last_done, next_due, responsible, auto_create_os,
  notes, created_at, deleted_at
)
SELECT
  id, tenant_id, property_id, system_type, title, description,
  frequency, last_done, next_due, responsible, auto_create_os,
  notes, created_at, deleted_at
FROM maintenance_schedules;
DROP TABLE maintenance_schedules;
ALTER TABLE maintenance_schedules_new RENAME TO maintenance_schedules;
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON maintenance_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_property ON maintenance_schedules(property_id);
SELECT 'maintenance_schedules' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 9. property_collaborators
-- ══════════════════════════════════════════════════════════════
CREATE TABLE property_collaborators_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT REFERENCES users(id),
  can_open_os INTEGER NOT NULL DEFAULT 0,
  specialties TEXT DEFAULT '[]',
  whatsapp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO property_collaborators_new (
  id, tenant_id, property_id, user_id, role, invited_by,
  can_open_os, specialties, whatsapp, created_at
)
SELECT
  id, tenant_id, property_id, user_id, role, invited_by,
  can_open_os, specialties, whatsapp, created_at
FROM property_collaborators;
DROP TABLE property_collaborators;
ALTER TABLE property_collaborators_new RENAME TO property_collaborators;
CREATE UNIQUE INDEX IF NOT EXISTS property_collaborators_property_user_unique ON property_collaborators(property_id, user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_tenant ON property_collaborators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_property ON property_collaborators(property_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON property_collaborators(user_id);
SELECT 'property_collaborators' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 10. property_invites
-- ══════════════════════════════════════════════════════════════
CREATE TABLE property_invites_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL,
  token_hash TEXT,
  invite_name TEXT,
  specialties TEXT DEFAULT '[]',
  whatsapp TEXT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO property_invites_new (
  id, tenant_id, property_id, invited_by, email, role, token,
  token_hash, invite_name, specialties, whatsapp, expires_at,
  accepted_at, created_at
)
SELECT
  id, tenant_id, property_id, invited_by, email, role, token,
  token_hash, invite_name, specialties, whatsapp, expires_at,
  accepted_at, created_at
FROM property_invites;
DROP TABLE property_invites;
ALTER TABLE property_invites_new RENAME TO property_invites;
CREATE UNIQUE INDEX IF NOT EXISTS property_invites_token_unique ON property_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON property_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON property_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON property_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_property ON property_invites(property_id);
SELECT 'property_invites' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 11. service_share_links  (depende de service_orders — após step 4)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE service_share_links_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_id TEXT NOT NULL REFERENCES service_orders(id),
  token TEXT NOT NULL,
  token_hash TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  provider_name TEXT,
  provider_email TEXT,
  provider_phone TEXT,
  provider_accepted_at TEXT,
  provider_started_at TEXT,
  provider_done_at TEXT,
  notes_from_provider TEXT,
  share_credentials INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO service_share_links_new (
  id, tenant_id, service_id, token, token_hash, created_by,
  expires_at, provider_name, provider_email, provider_phone,
  provider_accepted_at, provider_started_at, provider_done_at,
  notes_from_provider, share_credentials, created_at, deleted_at
)
SELECT
  id, tenant_id, service_id, token, token_hash, created_by,
  expires_at, provider_name, provider_email, provider_phone,
  provider_accepted_at, provider_started_at, provider_done_at,
  notes_from_provider, share_credentials, created_at, deleted_at
FROM service_share_links;
DROP TABLE service_share_links;
ALTER TABLE service_share_links_new RENAME TO service_share_links;
CREATE UNIQUE INDEX IF NOT EXISTS service_share_links_token_unique ON service_share_links(token);
CREATE INDEX IF NOT EXISTS idx_service_share_links_tenant ON service_share_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_share_links_token_hash ON service_share_links(token_hash);
SELECT 'service_share_links' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 12. property_access_credentials
-- ══════════════════════════════════════════════════════════════
CREATE TABLE property_access_credentials_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL DEFAULT 'other',
  label TEXT NOT NULL,
  username TEXT,
  secret TEXT NOT NULL,
  notes TEXT,
  integration_type TEXT,
  integration_config TEXT,
  integration_secret TEXT,
  share_with_os INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO property_access_credentials_new (
  id, tenant_id, property_id, created_by, category, label, username,
  secret, notes, integration_type, integration_config, integration_secret,
  share_with_os, created_at, updated_at, deleted_at
)
SELECT
  id, tenant_id, property_id, created_by, category, label, username,
  secret, notes, integration_type, integration_config, integration_secret,
  share_with_os, created_at, updated_at, deleted_at
FROM property_access_credentials;
DROP TABLE property_access_credentials;
ALTER TABLE property_access_credentials_new RENAME TO property_access_credentials;
CREATE INDEX IF NOT EXISTS idx_property_access_credentials_tenant ON property_access_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_access_credentials_property ON property_access_credentials(property_id);
SELECT 'property_access_credentials' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 13. service_requests
-- ══════════════════════════════════════════════════════════════
CREATE TABLE service_requests_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  media_urls TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO service_requests_new (
  id, tenant_id, property_id, requested_by, title, description,
  media_urls, status, created_at, updated_at
)
SELECT
  id, tenant_id, property_id, requested_by, title, description,
  media_urls, status, created_at, updated_at
FROM service_requests;
DROP TABLE service_requests;
ALTER TABLE service_requests_new RENAME TO service_requests;
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant ON service_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_property ON service_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_requested_by ON service_requests(requested_by);
SELECT 'service_requests' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 14. bids  (depende de service_requests — após step 13)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE bids_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO bids_new (
  id, tenant_id, service_request_id, provider_id, amount, scope,
  status, created_at, updated_at
)
SELECT
  id, tenant_id, service_request_id, provider_id, amount, scope,
  status, created_at, updated_at
FROM bids;
DROP TABLE bids;
ALTER TABLE bids_new RENAME TO bids;
CREATE INDEX IF NOT EXISTS idx_bids_tenant ON bids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bids_service_request ON bids(service_request_id);
CREATE INDEX IF NOT EXISTS idx_bids_provider ON bids(provider_id);
SELECT 'bids' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 15. audit_links  (depende de service_orders e properties — após steps 1 e 4)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE audit_links_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_order_id TEXT NOT NULL REFERENCES service_orders(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  token_hash TEXT,
  scope TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  accessed_at TEXT,
  accessor_ip TEXT,
  geo_lat REAL,
  geo_lng REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO audit_links_new (
  id, tenant_id, service_order_id, property_id, created_by,
  token, token_hash, scope, expires_at, accessed_at, accessor_ip,
  geo_lat, geo_lng, status, created_at
)
SELECT
  id, tenant_id, service_order_id, property_id, created_by,
  token, token_hash, scope, expires_at, accessed_at, accessor_ip,
  geo_lat, geo_lng, status, created_at
FROM audit_links;
DROP TABLE audit_links;
ALTER TABLE audit_links_new RENAME TO audit_links;
CREATE UNIQUE INDEX IF NOT EXISTS audit_links_token_unique ON audit_links(token);
CREATE INDEX IF NOT EXISTS idx_audit_links_tenant ON audit_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_links_token ON audit_links(token);
CREATE INDEX IF NOT EXISTS idx_audit_links_token_hash ON audit_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_links_service ON audit_links(service_order_id);
SELECT 'audit_links' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 16. service_messages  (depende de service_orders — após step 4)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE service_messages_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  attachments TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
INSERT INTO service_messages_new (
  id, tenant_id, service_order_id, author_id, body,
  internal, attachments, created_at, deleted_at
)
SELECT
  id, tenant_id, service_order_id, author_id, body,
  internal, attachments, created_at, deleted_at
FROM service_messages;
DROP TABLE service_messages;
ALTER TABLE service_messages_new RENAME TO service_messages;
CREATE INDEX IF NOT EXISTS idx_service_messages_tenant ON service_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_service ON service_messages(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_created ON service_messages(service_order_id, created_at);
SELECT 'service_messages' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 17. provider_ratings  (depende de properties e service_orders)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE provider_ratings_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  rated_by TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL,
  quality INTEGER,
  punctuality INTEGER,
  communication INTEGER,
  price INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO provider_ratings_new (
  id, tenant_id, provider_id, property_id, service_order_id,
  rated_by, stars, quality, punctuality, communication, price,
  comment, created_at
)
SELECT
  id, tenant_id, provider_id, property_id, service_order_id,
  rated_by, stars, quality, punctuality, communication, price,
  comment, created_at
FROM provider_ratings;
DROP TABLE provider_ratings;
ALTER TABLE provider_ratings_new RENAME TO provider_ratings;
CREATE UNIQUE INDEX IF NOT EXISTS provider_ratings_service_rated_by_unique ON provider_ratings(service_order_id, rated_by);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_tenant ON provider_ratings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_provider ON provider_ratings(provider_id);
SELECT 'provider_ratings' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 18. pix_charges  (depende de properties e service_orders)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE pix_charges_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  merchant_name TEXT NOT NULL,
  merchant_city TEXT NOT NULL,
  txid TEXT NOT NULL,
  br_code TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO pix_charges_new (
  id, tenant_id, service_order_id, property_id, created_by,
  pix_key, pix_key_type, amount_cents, merchant_name, merchant_city,
  txid, br_code, description, status, paid_at, expires_at, created_at
)
SELECT
  id, tenant_id, service_order_id, property_id, created_by,
  pix_key, pix_key_type, amount_cents, merchant_name, merchant_city,
  txid, br_code, description, status, paid_at, expires_at, created_at
FROM pix_charges;
DROP TABLE pix_charges;
ALTER TABLE pix_charges_new RENAME TO pix_charges;
CREATE UNIQUE INDEX IF NOT EXISTS pix_charges_txid_unique ON pix_charges(txid);
CREATE INDEX IF NOT EXISTS idx_pix_charges_tenant ON pix_charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pix_charges_service ON pix_charges(service_order_id);
CREATE INDEX IF NOT EXISTS idx_pix_charges_property ON pix_charges(property_id);
SELECT 'pix_charges' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- 19. nfe_imports  (depende de properties, documents e expenses — após steps 1, 6 e 7)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE nfe_imports_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  chave_acesso TEXT,
  cnpj_emitente TEXT,
  nome_emitente TEXT,
  valor_total REAL,
  data_emissao TEXT,
  raw_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO nfe_imports_new (
  id, tenant_id, property_id, document_id, expense_id,
  chave_acesso, cnpj_emitente, nome_emitente, valor_total,
  data_emissao, raw_summary, created_at
)
SELECT
  id, tenant_id, property_id, document_id, expense_id,
  chave_acesso, cnpj_emitente, nome_emitente, valor_total,
  data_emissao, raw_summary, created_at
FROM nfe_imports;
DROP TABLE nfe_imports;
ALTER TABLE nfe_imports_new RENAME TO nfe_imports;
CREATE UNIQUE INDEX IF NOT EXISTS nfe_imports_chave_acesso_unique ON nfe_imports(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_imports_tenant ON nfe_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfe_property ON nfe_imports(property_id);
SELECT 'nfe_imports' AS migrated_table, changes() AS rows_preserved;

-- ══════════════════════════════════════════════════════════════
-- Verificação de integridade referencial
-- ══════════════════════════════════════════════════════════════
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;

SELECT
  'Phase D complete' AS status,
  19 AS tables_migrated,
  'tenant_id NOT NULL enforced at DDL level' AS enforcement,
  '0032 triggers auto-dropped with original tables' AS triggers_note;
