-- notification_prefs per user
ALTER TABLE users ADD COLUMN notification_prefs TEXT DEFAULT '{"os_status":true,"maintenance_due":true,"new_bid":true}';

-- service bids submitted by providers
CREATE TABLE IF NOT EXISTS service_bids (
  id          TEXT PRIMARY KEY,
  service_id  TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id),
  amount      REAL NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_service_bids_service  ON service_bids(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bids_provider ON service_bids(provider_id);
