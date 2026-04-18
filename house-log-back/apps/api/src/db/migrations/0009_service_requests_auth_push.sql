-- 0009: Alinha schema Drizzle (service_requests/bids/provider_endorsements)
--       + infraestrutura para MFA TOTP, refresh rotativo e Web Push
--       + corrige coluna users.updated_at (já usada pelas rotas de auth)
--       + thumbnails para fotos (queue de resize)

-- ── users.updated_at (rotas de auth já referenciam essa coluna) ──────────────
-- SQLite não suporta "ADD COLUMN IF NOT EXISTS"; usamos bloco idempotente
-- via SELECT e PRAGMA não é prático no migrator do D1, então confiamos em
-- rodar a migration uma única vez. Caso a coluna já exista, a migration falha
-- aqui — o que é intencional para evitar estado inconsistente.
ALTER TABLE users ADD COLUMN updated_at TEXT;

-- ── service_requests (Drizzle) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
  id             TEXT PRIMARY KEY,
  property_id    TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  requested_by   TEXT NOT NULL REFERENCES users(id),
  title          TEXT NOT NULL,
  description    TEXT,
  media_urls     TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_requests_property     ON service_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status       ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_requested_by ON service_requests(requested_by);

-- ── bids (Drizzle) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
  id                  TEXT PRIMARY KEY,
  service_request_id  TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_id         TEXT NOT NULL REFERENCES users(id),
  amount              REAL NOT NULL,
  scope               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bids_service_request ON bids(service_request_id);
CREATE INDEX IF NOT EXISTS idx_bids_provider        ON bids(provider_id);

-- ── provider_endorsements (Drizzle) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_endorsements (
  id                     TEXT PRIMARY KEY,
  provider_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endorsed_by_admin_id   TEXT NOT NULL REFERENCES users(id),
  status                 TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at            TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_endorsements_provider ON provider_endorsements(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_endorsements_admin    ON provider_endorsements(endorsed_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_provider_endorsements_status   ON provider_endorsements(status);

-- ── refresh_tokens (rotação + detecção de reuso por family_id) ──────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti            TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id      TEXT NOT NULL,
  token_hash     TEXT NOT NULL,
  issued_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT,
  replaced_by    TEXT,
  user_agent     TEXT,
  ip             TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family   ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);

-- ── user_mfa (TOTP) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- segredo base32, ciframento simétrico opcional via JWT_SECRET em futuro refactor
  secret         TEXT NOT NULL,
  enabled_at     TEXT,                   -- NULL enquanto não confirmado
  last_used_at   TEXT,
  backup_codes   TEXT NOT NULL DEFAULT '[]', -- JSON array de hashes PBKDF2
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usado como "prova" do primeiro passo do login (senha ok) antes do TOTP.
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at     TEXT NOT NULL,
  consumed_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user ON mfa_challenges(user_id);

-- ── push_subscriptions (Web Push / VAPID) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint       TEXT NOT NULL UNIQUE,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  user_agent     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ── thumbnails para imagens processadas na queue ────────────────────────────
-- mapa key_original -> variants (thumb/medium). Permite UI escolher a variante.
CREATE TABLE IF NOT EXISTS image_variants (
  r2_key         TEXT PRIMARY KEY,
  thumb_key      TEXT,
  medium_key     TEXT,
  width          INTEGER,
  height         INTEGER,
  processed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
