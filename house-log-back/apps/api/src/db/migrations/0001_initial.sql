-- HouseLog D1 Schema — Phase 1 MVP
-- All tables use TEXT PKs (nanoid), soft-delete via deleted_at

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('admin','owner','provider','temp_provider')),
  password_hash TEXT NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_login   TEXT,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users(id),
  manager_id   TEXT REFERENCES users(id),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK(type IN ('house','apt','commercial','warehouse')),
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  area_m2      REAL,
  year_built   INTEGER,
  structure    TEXT,
  floors       INTEGER DEFAULT 1,
  cover_url    TEXT,
  health_score INTEGER NOT NULL DEFAULT 50,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id) WHERE deleted_at IS NULL;

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK(type IN ('bedroom','bathroom','kitchen','living','garage','laundry','external','roof','other')),
  floor        INTEGER DEFAULT 0,
  area_m2      REAL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id) WHERE deleted_at IS NULL;

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  room_id      TEXT REFERENCES rooms(id),
  category     TEXT NOT NULL CHECK(category IN ('paint','tile','waterproof','plumbing','electrical','hardware','adhesive','sealant','other')),
  name         TEXT NOT NULL,
  brand        TEXT,
  model        TEXT,
  color_code   TEXT,
  lot_number   TEXT,
  supplier     TEXT,
  quantity     REAL DEFAULT 0,
  unit         TEXT DEFAULT 'un',
  reserve_qty  REAL DEFAULT 0,
  storage_loc  TEXT,
  photo_url    TEXT,
  qr_code      TEXT,
  price_paid   REAL,
  purchase_date TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_property ON inventory_items(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_room ON inventory_items(room_id) WHERE deleted_at IS NULL;

-- Service Orders
CREATE TABLE IF NOT EXISTS service_orders (
  id             TEXT PRIMARY KEY,
  property_id    TEXT NOT NULL REFERENCES properties(id),
  room_id        TEXT REFERENCES rooms(id),
  system_type    TEXT NOT NULL CHECK(system_type IN ('electrical','plumbing','structural','waterproofing','painting','flooring','roofing','general')),
  requested_by   TEXT NOT NULL REFERENCES users(id),
  assigned_to    TEXT REFERENCES users(id),
  title          TEXT NOT NULL,
  description    TEXT,
  priority       TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('urgent','normal','preventive')),
  status         TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','in_progress','completed','verified')),
  cost           REAL,
  before_photos  TEXT DEFAULT '[]',  -- JSON array of R2 URLs
  after_photos   TEXT DEFAULT '[]',  -- JSON array of R2 URLs
  video_url      TEXT,
  checklist      TEXT DEFAULT '[]',  -- JSON array {item, done}
  warranty_until TEXT,
  scheduled_at   TEXT,
  completed_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_services_property ON service_orders(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_status ON service_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_assigned ON service_orders(assigned_to) WHERE deleted_at IS NULL;

-- Audit Links (for temp_provider access)
CREATE TABLE IF NOT EXISTS audit_links (
  id               TEXT PRIMARY KEY,
  service_order_id TEXT NOT NULL REFERENCES service_orders(id),
  property_id      TEXT NOT NULL REFERENCES properties(id),
  created_by       TEXT NOT NULL REFERENCES users(id),
  token            TEXT UNIQUE NOT NULL,
  scope            TEXT NOT NULL DEFAULT '{}',  -- JSON
  expires_at       TEXT NOT NULL,
  accessed_at      TEXT,
  accessor_ip      TEXT,
  geo_lat          REAL,
  geo_lng          REAL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_links_token ON audit_links(token);
CREATE INDEX IF NOT EXISTS idx_audit_links_service ON audit_links(service_order_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  service_id   TEXT REFERENCES service_orders(id),
  type         TEXT NOT NULL CHECK(type IN ('invoice','manual','project','contract','deed','permit','insurance','other')),
  title        TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  file_size    INTEGER DEFAULT 0,
  ocr_data     TEXT,  -- JSON
  vendor_cnpj  TEXT,
  amount       REAL,
  issue_date   TEXT,
  expiry_date  TEXT,
  uploaded_by  TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_property ON documents(property_id) WHERE deleted_at IS NULL;

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id              TEXT PRIMARY KEY,
  property_id     TEXT NOT NULL REFERENCES properties(id),
  category        TEXT NOT NULL CHECK(category IN ('water','electricity','gas','condo','iptu','insurance','cleaning','garden','security','other')),
  amount          REAL NOT NULL,
  reference_month TEXT NOT NULL,  -- YYYY-MM
  receipt_url     TEXT,
  notes           TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(property_id, reference_month) WHERE deleted_at IS NULL;

-- Maintenance Schedules
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id            TEXT PRIMARY KEY,
  property_id   TEXT NOT NULL REFERENCES properties(id),
  system_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  frequency     TEXT NOT NULL CHECK(frequency IN ('monthly','quarterly','semiannual','annual')),
  last_done     TEXT,
  next_due      TEXT,
  auto_create_os INTEGER DEFAULT 0,  -- BOOLEAN as 0/1
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedules_property ON maintenance_schedules(property_id) WHERE deleted_at IS NULL;

-- Audit Log (IMMUTABLE — no UPDATE/DELETE ever)
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id),
  actor_ip    TEXT,
  old_data    TEXT,  -- JSON
  new_data    TEXT,  -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
