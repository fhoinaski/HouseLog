-- Tenant foundation for HouseLog SaaS isolation.
-- Incremental and legacy-compatible: tenant_id is nullable while routes are migrated.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);

CREATE TABLE IF NOT EXISTS tenant_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_user_unique ON tenant_members(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);

ALTER TABLE users ADD COLUMN active_tenant_id TEXT;
ALTER TABLE properties ADD COLUMN tenant_id TEXT;
ALTER TABLE rooms ADD COLUMN tenant_id TEXT;
ALTER TABLE inventory_items ADD COLUMN tenant_id TEXT;
ALTER TABLE service_orders ADD COLUMN tenant_id TEXT;
ALTER TABLE service_bids ADD COLUMN tenant_id TEXT;
ALTER TABLE audit_links ADD COLUMN tenant_id TEXT;
ALTER TABLE documents ADD COLUMN tenant_id TEXT;
ALTER TABLE expenses ADD COLUMN tenant_id TEXT;
ALTER TABLE maintenance_schedules ADD COLUMN tenant_id TEXT;
ALTER TABLE property_collaborators ADD COLUMN tenant_id TEXT;
ALTER TABLE property_invites ADD COLUMN tenant_id TEXT;
ALTER TABLE service_share_links ADD COLUMN tenant_id TEXT;
ALTER TABLE property_access_credentials ADD COLUMN tenant_id TEXT;
ALTER TABLE service_requests ADD COLUMN tenant_id TEXT;
ALTER TABLE bids ADD COLUMN tenant_id TEXT;
ALTER TABLE service_messages ADD COLUMN tenant_id TEXT;
ALTER TABLE provider_ratings ADD COLUMN tenant_id TEXT;
ALTER TABLE pix_charges ADD COLUMN tenant_id TEXT;
ALTER TABLE nfe_imports ADD COLUMN tenant_id TEXT;

INSERT OR IGNORE INTO tenants (id, name, slug, owner_id)
SELECT
  'legacy-' || owner_id,
  'HouseLog ' || COALESCE((SELECT name FROM users WHERE users.id = properties.owner_id), owner_id),
  'legacy-' || lower(replace(owner_id, ' ', '-')),
  owner_id
FROM properties
WHERE owner_id IS NOT NULL;

INSERT OR IGNORE INTO tenant_members (id, tenant_id, user_id, role, status)
SELECT 'legacy-owner-' || owner_id, 'legacy-' || owner_id, owner_id, 'owner', 'active'
FROM properties
WHERE owner_id IS NOT NULL;

INSERT OR IGNORE INTO tenant_members (id, tenant_id, user_id, role, status)
SELECT 'legacy-manager-' || manager_id || '-' || owner_id, 'legacy-' || owner_id, manager_id, 'manager', 'active'
FROM properties
WHERE manager_id IS NOT NULL;

INSERT OR IGNORE INTO tenant_members (id, tenant_id, user_id, role, status)
SELECT 'legacy-collab-' || pc.user_id || '-' || p.owner_id, 'legacy-' || p.owner_id, pc.user_id,
  CASE WHEN pc.role IN ('manager', 'provider') THEN pc.role ELSE 'manager' END,
  'active'
FROM property_collaborators pc
INNER JOIN properties p ON p.id = pc.property_id;

UPDATE properties SET tenant_id = 'legacy-' || owner_id WHERE tenant_id IS NULL AND owner_id IS NOT NULL;
UPDATE users SET active_tenant_id = (
  SELECT tenant_id FROM tenant_members WHERE tenant_members.user_id = users.id AND tenant_members.status = 'active' LIMIT 1
) WHERE active_tenant_id IS NULL;

UPDATE rooms SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = rooms.property_id) WHERE tenant_id IS NULL;
UPDATE inventory_items SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = inventory_items.property_id) WHERE tenant_id IS NULL;
UPDATE service_orders SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = service_orders.property_id) WHERE tenant_id IS NULL;
UPDATE documents SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = documents.property_id) WHERE tenant_id IS NULL;
UPDATE expenses SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = expenses.property_id) WHERE tenant_id IS NULL;
UPDATE maintenance_schedules SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = maintenance_schedules.property_id) WHERE tenant_id IS NULL;
UPDATE property_collaborators SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = property_collaborators.property_id) WHERE tenant_id IS NULL;
UPDATE property_invites SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = property_invites.property_id) WHERE tenant_id IS NULL;
UPDATE property_access_credentials SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = property_access_credentials.property_id) WHERE tenant_id IS NULL;
UPDATE service_requests SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = service_requests.property_id) WHERE tenant_id IS NULL;
UPDATE audit_links SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = audit_links.property_id) WHERE tenant_id IS NULL;
UPDATE provider_ratings SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = provider_ratings.property_id) WHERE tenant_id IS NULL;
UPDATE pix_charges SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = pix_charges.property_id) WHERE tenant_id IS NULL;
UPDATE nfe_imports SET tenant_id = (SELECT tenant_id FROM properties WHERE properties.id = nfe_imports.property_id) WHERE tenant_id IS NULL;
UPDATE service_bids SET tenant_id = (SELECT tenant_id FROM service_orders WHERE service_orders.id = service_bids.service_id) WHERE tenant_id IS NULL;
UPDATE service_messages SET tenant_id = (SELECT tenant_id FROM service_orders WHERE service_orders.id = service_messages.service_order_id) WHERE tenant_id IS NULL;
UPDATE service_share_links SET tenant_id = (SELECT tenant_id FROM service_orders WHERE service_orders.id = service_share_links.service_id) WHERE tenant_id IS NULL;
UPDATE bids SET tenant_id = (SELECT tenant_id FROM service_requests WHERE service_requests.id = bids.service_request_id) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON service_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_bids_tenant ON service_bids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_links_tenant ON audit_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON maintenance_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_tenant ON property_collaborators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON property_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant ON service_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bids_tenant ON bids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_tenant ON service_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_tenant ON provider_ratings(tenant_id);
