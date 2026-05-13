-- Migration 0027: Add token_hash columns to public link tables
-- Tokens armazenados em plaintext são um risco em caso de vazamento do DB.
-- Estratégia: gravar apenas o hash SHA-256 do token; token puro apenas na emissão.
-- Backfill via UPDATE será feito via script operacional após deploy.
-- A coluna token legada é mantida temporariamente para compatibilidade reversa.

ALTER TABLE audit_links ADD COLUMN token_hash TEXT;
ALTER TABLE service_share_links ADD COLUMN token_hash TEXT;
ALTER TABLE property_invites ADD COLUMN token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_links_token_hash ON audit_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_service_share_links_token_hash ON service_share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_property_invites_token_hash ON property_invites(token_hash);
