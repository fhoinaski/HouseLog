-- Service order public share links
CREATE TABLE IF NOT EXISTS service_share_links (
  id         TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_orders(id),
  token      TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  provider_name  TEXT,       -- optional: pre-fill provider name for external providers
  provider_email TEXT,
  provider_phone TEXT,
  -- status tracking for the external provider's actions
  provider_accepted_at TEXT,
  provider_started_at  TEXT,
  provider_done_at     TEXT,
  notes_from_provider  TEXT,
  share_credentials    INTEGER NOT NULL DEFAULT 0,  -- include credentials marked share_with_os
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Access credentials / passwords per property
CREATE TABLE IF NOT EXISTS property_access_credentials (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  created_by   TEXT NOT NULL REFERENCES users(id),
  category     TEXT NOT NULL DEFAULT 'other',
  -- category: wifi | alarm | smart_lock | gate | app | other
  label        TEXT NOT NULL,
  username     TEXT,
  secret       TEXT NOT NULL,   -- password / PIN / code
  notes        TEXT,
  integration_type   TEXT,      -- 'intelbras' | NULL
  integration_config TEXT,      -- JSON blob for the integration driver
  share_with_os      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);
