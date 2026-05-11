-- P3-HANDOVER-01: extend handover packages for secure digital issuance.

ALTER TABLE handover_packages ADD COLUMN issued_at TEXT;
ALTER TABLE handover_packages ADD COLUMN issued_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE handover_packages ADD COLUMN accepted_at TEXT;
ALTER TABLE handover_packages ADD COLUMN accepted_by_name TEXT;
ALTER TABLE handover_packages ADD COLUMN accepted_by_email TEXT;
ALTER TABLE handover_packages ADD COLUMN revoked_at TEXT;
ALTER TABLE handover_packages ADD COLUMN revoked_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE handover_packages ADD COLUMN revoke_reason TEXT;
ALTER TABLE handover_packages ADD COLUMN expires_at TEXT;
ALTER TABLE handover_packages ADD COLUMN public_access_token_hash TEXT;
ALTER TABLE handover_packages ADD COLUMN snapshot_json TEXT;
ALTER TABLE handover_packages ADD COLUMN package_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_handover_packages_issued_by ON handover_packages(issued_by);
CREATE INDEX IF NOT EXISTS idx_handover_packages_revoked_by ON handover_packages(revoked_by);
CREATE INDEX IF NOT EXISTS idx_handover_packages_issued_at ON handover_packages(property_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_handover_packages_expires_at ON handover_packages(property_id, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS handover_packages_package_hash_unique ON handover_packages(package_hash);
CREATE UNIQUE INDEX IF NOT EXISTS handover_packages_public_access_token_hash_unique ON handover_packages(public_access_token_hash);