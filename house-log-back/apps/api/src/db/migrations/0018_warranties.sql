-- P1-01A: technical warranties scoped by tenant and property.

CREATE TABLE IF NOT EXISTS warranties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  inventory_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  provider_name TEXT,
  warranty_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  coverage TEXT,
  exclusions TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_warranties_tenant ON warranties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranties_property ON warranties(property_id);
CREATE INDEX IF NOT EXISTS idx_warranties_property_status ON warranties(property_id, status);
CREATE INDEX IF NOT EXISTS idx_warranties_type ON warranties(property_id, warranty_type);
CREATE INDEX IF NOT EXISTS idx_warranties_end_date ON warranties(property_id, end_date);
CREATE INDEX IF NOT EXISTS idx_warranties_room ON warranties(room_id);
CREATE INDEX IF NOT EXISTS idx_warranties_service_order ON warranties(service_order_id);
CREATE INDEX IF NOT EXISTS idx_warranties_document ON warranties(document_id);
CREATE INDEX IF NOT EXISTS idx_warranties_inventory_item ON warranties(inventory_item_id);
