-- P1-01D: checklist items for technical handover packages.

CREATE TABLE IF NOT EXISTS handover_checklist_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  handover_package_id TEXT NOT NULL REFERENCES handover_packages(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  inventory_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  condition TEXT,
  evidence_urls TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_handover_items_tenant ON handover_checklist_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_property ON handover_checklist_items(property_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_package ON handover_checklist_items(handover_package_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_package_status ON handover_checklist_items(handover_package_id, status);
CREATE INDEX IF NOT EXISTS idx_handover_items_package_sort ON handover_checklist_items(handover_package_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_handover_items_room ON handover_checklist_items(room_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_inventory ON handover_checklist_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_document ON handover_checklist_items(document_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_service_order ON handover_checklist_items(service_order_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_completed_by ON handover_checklist_items(completed_by);
