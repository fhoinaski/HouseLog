-- P1-01C: technical handover packages scoped by tenant and property.

CREATE TABLE IF NOT EXISTS handover_packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'handover',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  prepared_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  completed_at TEXT,
  summary_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_handover_packages_tenant ON handover_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_packages_property ON handover_packages(property_id);
CREATE INDEX IF NOT EXISTS idx_handover_packages_property_status ON handover_packages(property_id, status);
CREATE INDEX IF NOT EXISTS idx_handover_packages_type ON handover_packages(property_id, type);
CREATE INDEX IF NOT EXISTS idx_handover_packages_reviewed_by ON handover_packages(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_handover_packages_approved_by ON handover_packages(approved_by);
CREATE INDEX IF NOT EXISTS idx_handover_packages_summary_document ON handover_packages(summary_document_id);
CREATE INDEX IF NOT EXISTS idx_handover_packages_created_at ON handover_packages(property_id, created_at);
CREATE INDEX IF NOT EXISTS idx_handover_packages_completed_at ON handover_packages(property_id, completed_at);
