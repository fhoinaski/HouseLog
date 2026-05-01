-- First premium technical-record entity.
-- Adds real technical systems without changing existing service_orders.

CREATE TABLE IF NOT EXISTS technical_systems (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  location_summary TEXT,
  responsible_provider_id TEXT REFERENCES users(id),
  installation_date TEXT,
  last_inspection_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_technical_systems_tenant ON technical_systems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_systems_property ON technical_systems(property_id);
CREATE INDEX IF NOT EXISTS idx_technical_systems_property_status ON technical_systems(property_id, status);
CREATE INDEX IF NOT EXISTS idx_technical_systems_type ON technical_systems(property_id, type);
