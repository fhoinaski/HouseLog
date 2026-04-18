-- 0010: Onda 2 — marketplace de prestadores, chat por OS, agenda,
--       pagamentos Pix, cache de IA, import NFe.

-- ── Chat por OS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_messages (
  id               TEXT PRIMARY KEY,
  service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  author_id        TEXT NOT NULL REFERENCES users(id),
  body             TEXT NOT NULL,
  -- quando true, mensagem é visível apenas para roles internos (owner/manager/admin)
  -- e nunca para o provider daquela OS.
  internal         INTEGER NOT NULL DEFAULT 0,
  attachments      TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_service_messages_service ON service_messages(service_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_messages_created ON service_messages(service_order_id, created_at);

-- ── Ratings de prestador (pós-OS) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_ratings (
  id               TEXT PRIMARY KEY,
  provider_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id      TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  rated_by         TEXT NOT NULL REFERENCES users(id),
  stars            INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
  -- quebra em dimensões comuns em marketplaces (ServiceTitan, HomeAdvisor)
  quality          INTEGER CHECK(quality BETWEEN 1 AND 5),
  punctuality      INTEGER CHECK(punctuality BETWEEN 1 AND 5),
  communication    INTEGER CHECK(communication BETWEEN 1 AND 5),
  price            INTEGER CHECK(price BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(service_order_id, rated_by)
);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_provider ON provider_ratings(provider_id);

-- ── Agenda de prestador ─────────────────────────────────────────────────────
-- Blocos de disponibilidade ou compromisso. Inspirado em Jobber/Housecall Pro.
CREATE TABLE IF NOT EXISTS provider_availability (
  id               TEXT PRIMARY KEY,
  provider_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  starts_at        TEXT NOT NULL,
  ends_at          TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK(kind IN ('busy','available','appointment')),
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_provider_avail_range ON provider_availability(provider_id, starts_at, ends_at);

-- ── Pix / cobranças da OS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pix_charges (
  id               TEXT PRIMARY KEY,
  service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
  property_id      TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by       TEXT NOT NULL REFERENCES users(id),
  pix_key          TEXT NOT NULL,
  pix_key_type     TEXT NOT NULL CHECK(pix_key_type IN ('cpf','cnpj','email','phone','random')),
  amount_cents     INTEGER NOT NULL,
  merchant_name    TEXT NOT NULL,
  merchant_city    TEXT NOT NULL,
  txid             TEXT NOT NULL UNIQUE,
  br_code          TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','expired')),
  paid_at          TEXT,
  expires_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pix_charges_service ON pix_charges(service_order_id);
CREATE INDEX IF NOT EXISTS idx_pix_charges_property ON pix_charges(property_id);

-- ── Cache de IA ─────────────────────────────────────────────────────────────
-- Evita reprocessar a mesma imagem/áudio em chamadas de dev/teste.
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key     TEXT PRIMARY KEY,      -- hash do input + modelo
  kind          TEXT NOT NULL,         -- diagnose | transcribe | classify
  result        TEXT NOT NULL,         -- JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── NFe importada ───────────────────────────────────────────────────────────
-- Referência fraca a documents para não duplicar armazenamento.
CREATE TABLE IF NOT EXISTS nfe_imports (
  id              TEXT PRIMARY KEY,
  property_id     TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id     TEXT REFERENCES documents(id) ON DELETE SET NULL,
  expense_id      TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  chave_acesso    TEXT UNIQUE,         -- 44 dígitos
  cnpj_emitente   TEXT,
  nome_emitente   TEXT,
  valor_total     REAL,
  data_emissao    TEXT,
  raw_summary     TEXT,                -- JSON com itens principais
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nfe_property ON nfe_imports(property_id);
