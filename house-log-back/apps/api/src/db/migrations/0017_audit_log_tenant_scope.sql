-- P0-10: add tenant/property scope to audit logs without changing legacy rows.
ALTER TABLE audit_log ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE audit_log ADD COLUMN property_id TEXT REFERENCES properties(id);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_property ON audit_log(property_id);

-- Conservative backfill for logs that already carry property_id in JSON payloads.
-- Legacy rows that cannot be safely scoped remain NULL and must not be exposed by
-- future tenant-aware audit feeds.
UPDATE audit_log
SET property_id = COALESCE(
  json_extract(new_data, '$.property_id'),
  json_extract(new_data, '$.propertyId'),
  json_extract(old_data, '$.property_id'),
  json_extract(old_data, '$.propertyId')
)
WHERE property_id IS NULL;

UPDATE audit_log
SET tenant_id = (
  SELECT tenant_id
  FROM properties
  WHERE properties.id = audit_log.property_id
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;
