-- P1-01B: technical renovation/intervention records scoped by tenant and property.

CREATE TABLE IF NOT EXISTS renovations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TEXT,
  completed_at TEXT,
  contractor_name TEXT,
  contractor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  cost REAL,
  notes TEXT,
  before_photos TEXT NOT NULL DEFAULT '[]',
  after_photos TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_renovations_tenant ON renovations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renovations_property ON renovations(property_id);
CREATE INDEX IF NOT EXISTS idx_renovations_property_status ON renovations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_renovations_category ON renovations(property_id, category);
CREATE INDEX IF NOT EXISTS idx_renovations_room ON renovations(room_id);
CREATE INDEX IF NOT EXISTS idx_renovations_service_order ON renovations(service_order_id);
CREATE INDEX IF NOT EXISTS idx_renovations_document ON renovations(document_id);
CREATE INDEX IF NOT EXISTS idx_renovations_contractor ON renovations(contractor_id);
CREATE INDEX IF NOT EXISTS idx_renovations_started_at ON renovations(property_id, started_at);
CREATE INDEX IF NOT EXISTS idx_renovations_completed_at ON renovations(property_id, completed_at);
