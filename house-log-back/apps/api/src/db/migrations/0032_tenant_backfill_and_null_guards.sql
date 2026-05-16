-- P0-15: safe tenant_id backfill plus null guards for critical legacy tables.
--
-- This migration is intentionally incremental:
-- 1. Backfill only rows with tenant_id IS NULL where the parent already has
--    a safe tenant_id.
-- 2. Report row counts with SELECT changes() for D1 migration logs.
-- 3. Add triggers that block new critical rows from persisting tenant_id NULL.
--
-- It does not rebuild legacy SQLite tables. Rebuild/NOT NULL migrations should
-- only happen after orphan reports are clean in production.

UPDATE properties
SET tenant_id = (
  SELECT tm.tenant_id
  FROM tenant_members tm
  WHERE tm.user_id = properties.owner_id
    AND tm.status = 'active'
  LIMIT 1
)
WHERE tenant_id IS NULL
  AND owner_id IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM tenant_members tm
    WHERE tm.user_id = properties.owner_id
      AND tm.status = 'active'
  ) = 1;
SELECT 'properties' AS table_name, changes() AS rows_backfilled;

UPDATE rooms
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = rooms.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'rooms' AS table_name, changes() AS rows_backfilled;

UPDATE inventory_items
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = inventory_items.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'inventory_items' AS table_name, changes() AS rows_backfilled;

UPDATE service_orders
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = service_orders.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'service_orders' AS table_name, changes() AS rows_backfilled;

UPDATE documents
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = documents.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'documents' AS table_name, changes() AS rows_backfilled;

UPDATE expenses
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = expenses.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'expenses' AS table_name, changes() AS rows_backfilled;

UPDATE maintenance_schedules
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = maintenance_schedules.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'maintenance_schedules' AS table_name, changes() AS rows_backfilled;

UPDATE property_collaborators
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = property_collaborators.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'property_collaborators' AS table_name, changes() AS rows_backfilled;

UPDATE property_invites
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = property_invites.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'property_invites' AS table_name, changes() AS rows_backfilled;

UPDATE property_access_credentials
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = property_access_credentials.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'property_access_credentials' AS table_name, changes() AS rows_backfilled;

UPDATE service_requests
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = service_requests.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'service_requests' AS table_name, changes() AS rows_backfilled;

UPDATE audit_links
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = audit_links.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'audit_links' AS table_name, changes() AS rows_backfilled;

UPDATE provider_ratings
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = provider_ratings.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'provider_ratings' AS table_name, changes() AS rows_backfilled;

UPDATE pix_charges
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = pix_charges.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'pix_charges' AS table_name, changes() AS rows_backfilled;

UPDATE nfe_imports
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = nfe_imports.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'nfe_imports' AS table_name, changes() AS rows_backfilled;

UPDATE service_bids
SET tenant_id = (SELECT so.tenant_id FROM service_orders so WHERE so.id = service_bids.service_id AND so.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND service_id IS NOT NULL;
SELECT 'service_bids' AS table_name, changes() AS rows_backfilled;

UPDATE service_messages
SET tenant_id = (SELECT so.tenant_id FROM service_orders so WHERE so.id = service_messages.service_order_id AND so.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND service_order_id IS NOT NULL;
SELECT 'service_messages' AS table_name, changes() AS rows_backfilled;

UPDATE service_share_links
SET tenant_id = (SELECT so.tenant_id FROM service_orders so WHERE so.id = service_share_links.service_id AND so.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND service_id IS NOT NULL;
SELECT 'service_share_links' AS table_name, changes() AS rows_backfilled;

UPDATE bids
SET tenant_id = (SELECT sr.tenant_id FROM service_requests sr WHERE sr.id = bids.service_request_id AND sr.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND service_request_id IS NOT NULL;
SELECT 'bids' AS table_name, changes() AS rows_backfilled;

UPDATE audit_log
SET tenant_id = (SELECT p.tenant_id FROM properties p WHERE p.id = audit_log.property_id AND p.tenant_id IS NOT NULL)
WHERE tenant_id IS NULL AND property_id IS NOT NULL;
SELECT 'audit_log' AS table_name, changes() AS rows_backfilled;

CREATE INDEX IF NOT EXISTS idx_service_share_links_tenant ON service_share_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_access_credentials_tenant ON property_access_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pix_charges_tenant ON pix_charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfe_imports_tenant ON nfe_imports(tenant_id);

CREATE TRIGGER IF NOT EXISTS properties_tenant_id_required_insert
BEFORE INSERT ON properties
WHEN NEW.tenant_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'properties.tenant_id is required');
END;
CREATE TRIGGER IF NOT EXISTS properties_tenant_id_required_update
BEFORE UPDATE OF tenant_id ON properties
WHEN NEW.tenant_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'properties.tenant_id is required');
END;

CREATE TRIGGER IF NOT EXISTS rooms_tenant_id_required_insert BEFORE INSERT ON rooms WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'rooms.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS rooms_tenant_id_required_update BEFORE UPDATE OF tenant_id ON rooms WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'rooms.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS inventory_items_tenant_id_required_insert BEFORE INSERT ON inventory_items WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'inventory_items.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS inventory_items_tenant_id_required_update BEFORE UPDATE OF tenant_id ON inventory_items WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'inventory_items.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS service_orders_tenant_id_required_insert BEFORE INSERT ON service_orders WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_orders.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS service_orders_tenant_id_required_update BEFORE UPDATE OF tenant_id ON service_orders WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_orders.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS documents_tenant_id_required_insert BEFORE INSERT ON documents WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'documents.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS documents_tenant_id_required_update BEFORE UPDATE OF tenant_id ON documents WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'documents.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS expenses_tenant_id_required_insert BEFORE INSERT ON expenses WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'expenses.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS expenses_tenant_id_required_update BEFORE UPDATE OF tenant_id ON expenses WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'expenses.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS maintenance_schedules_tenant_id_required_insert BEFORE INSERT ON maintenance_schedules WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'maintenance_schedules.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS maintenance_schedules_tenant_id_required_update BEFORE UPDATE OF tenant_id ON maintenance_schedules WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'maintenance_schedules.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS property_collaborators_tenant_id_required_insert BEFORE INSERT ON property_collaborators WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_collaborators.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS property_collaborators_tenant_id_required_update BEFORE UPDATE OF tenant_id ON property_collaborators WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_collaborators.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS property_invites_tenant_id_required_insert BEFORE INSERT ON property_invites WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_invites.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS property_invites_tenant_id_required_update BEFORE UPDATE OF tenant_id ON property_invites WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_invites.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS property_access_credentials_tenant_id_required_insert BEFORE INSERT ON property_access_credentials WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_access_credentials.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS property_access_credentials_tenant_id_required_update BEFORE UPDATE OF tenant_id ON property_access_credentials WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'property_access_credentials.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS service_requests_tenant_id_required_insert BEFORE INSERT ON service_requests WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_requests.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS service_requests_tenant_id_required_update BEFORE UPDATE OF tenant_id ON service_requests WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_requests.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS audit_links_tenant_id_required_insert BEFORE INSERT ON audit_links WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'audit_links.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS audit_links_tenant_id_required_update BEFORE UPDATE OF tenant_id ON audit_links WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'audit_links.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS provider_ratings_tenant_id_required_insert BEFORE INSERT ON provider_ratings WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'provider_ratings.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS provider_ratings_tenant_id_required_update BEFORE UPDATE OF tenant_id ON provider_ratings WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'provider_ratings.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS pix_charges_tenant_id_required_insert BEFORE INSERT ON pix_charges WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'pix_charges.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS pix_charges_tenant_id_required_update BEFORE UPDATE OF tenant_id ON pix_charges WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'pix_charges.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS nfe_imports_tenant_id_required_insert BEFORE INSERT ON nfe_imports WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'nfe_imports.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS nfe_imports_tenant_id_required_update BEFORE UPDATE OF tenant_id ON nfe_imports WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'nfe_imports.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS service_bids_tenant_id_required_insert BEFORE INSERT ON service_bids WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_bids.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS service_bids_tenant_id_required_update BEFORE UPDATE OF tenant_id ON service_bids WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_bids.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS service_messages_tenant_id_required_insert BEFORE INSERT ON service_messages WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_messages.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS service_messages_tenant_id_required_update BEFORE UPDATE OF tenant_id ON service_messages WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_messages.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS service_share_links_tenant_id_required_insert BEFORE INSERT ON service_share_links WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_share_links.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS service_share_links_tenant_id_required_update BEFORE UPDATE OF tenant_id ON service_share_links WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'service_share_links.tenant_id is required'); END;

CREATE TRIGGER IF NOT EXISTS bids_tenant_id_required_insert BEFORE INSERT ON bids WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'bids.tenant_id is required'); END;
CREATE TRIGGER IF NOT EXISTS bids_tenant_id_required_update BEFORE UPDATE OF tenant_id ON bids WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'bids.tenant_id is required'); END;
