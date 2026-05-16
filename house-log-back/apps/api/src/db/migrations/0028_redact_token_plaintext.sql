-- Migration 0028: Redact plaintext tokens after token_hash backfill.
--
-- PRÉ-CONDIÇÃO: executar phase_a_token_hash_backfill.ts até zero registros restantes
-- antes de aplicar esta migration. Verificar com:
--   SELECT COUNT(*) FROM audit_links        WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
--   SELECT COUNT(*) FROM service_share_links WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
--   SELECT COUNT(*) FROM property_invites   WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
--
-- IDEMPOTENTE: o WHERE exclui linhas já redigidas (token LIKE 'hash-only:%').
-- NÃO destrutivo: token_hash permanece para lookup; links emitidos continuam funcionando.
-- Unicidade mantida: 'hash-only:<id>' é único por id PRIMARY KEY.

DROP TABLE IF EXISTS _token_plaintext_redaction_guard;
CREATE TABLE _token_plaintext_redaction_guard (
  pending_count INTEGER NOT NULL CHECK (pending_count = 0)
);

INSERT INTO _token_plaintext_redaction_guard (pending_count)
SELECT
  (SELECT COUNT(*) FROM audit_links WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%') +
  (SELECT COUNT(*) FROM service_share_links WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%') +
  (SELECT COUNT(*) FROM property_invites WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%');

DROP TABLE _token_plaintext_redaction_guard;

UPDATE audit_links
SET token = 'hash-only:' || id
WHERE token_hash IS NOT NULL
  AND token NOT LIKE 'hash-only:%';

UPDATE service_share_links
SET token = 'hash-only:' || id
WHERE token_hash IS NOT NULL
  AND token NOT LIKE 'hash-only:%';

UPDATE property_invites
SET token = 'hash-only:' || id
WHERE token_hash IS NOT NULL
  AND token NOT LIKE 'hash-only:%';
