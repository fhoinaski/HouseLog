-- Technical map points linked to a property and optionally to systems/rooms.

CREATE TABLE IF NOT EXISTS technical_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  technical_system_id TEXT REFERENCES technical_systems(id),
  room_id TEXT REFERENCES rooms(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  position_x REAL,
  position_y REAL,
  floor INTEGER NOT NULL DEFAULT 0,
  reference_image_url TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_technical_points_tenant ON technical_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_points_property ON technical_points(property_id);
CREATE INDEX IF NOT EXISTS idx_technical_points_system ON technical_points(technical_system_id);
CREATE INDEX IF NOT EXISTS idx_technical_points_room ON technical_points(room_id);
CREATE INDEX IF NOT EXISTS idx_technical_points_type ON technical_points(property_id, type);
CREATE INDEX IF NOT EXISTS idx_technical_points_risk ON technical_points(property_id, risk_level);
