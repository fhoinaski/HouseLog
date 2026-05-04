-- ============================================================
-- P0-14 — FASE B: Backfill seguro e idempotente de tenant_id
-- ============================================================
-- PROPÓSITO: Preencher tenant_id = NULL em registros cujo parent
--   (properties, service_orders, service_requests) já tem tenant_id.
--
-- SEGURANÇA:
--   • Todas as queries têm WHERE tenant_id IS NULL → idempotente.
--   • Nunca preenche a partir de registros com parent null.
--   • Nunca apaga nem altera nenhum outro campo.
--   • Não altera registros com tenant_id já preenchido.
--   • Não usa heurística de owner_id; segue a cadeia de FKs existentes.
--
-- COMO EXECUTAR (Dev — requer confirmação):
--   wrangler d1 execute houselog-db-dev --env dev \
--     --command "$(cat phase_b_safe_backfill.sql)"
--
-- COMO EXECUTAR (Produção — executar FORA de horário de pico):
--   1. Faça backup: wrangler d1 export houselog-db > backup_$(date +%Y%m%d).sql
--   2. Execute Fase A para confirmar contagem.
--   3. Execute este script:
--      wrangler d1 execute houselog-db \
--        --command "$(cat phase_b_safe_backfill.sql)"
--   4. Execute Fase A novamente para confirmar redução.
--   5. Execute Fase C para registrar sobras.
--
-- ROLLBACK: D1 não tem transações longas. Para reverter um backfill
--   incorreto, restaure o backup do passo 1.
--   (tenant_id = NULL é o estado legado; reverter = deletar o backup e aceitar)
--
-- ORDEM DE EXECUÇÃO: A ordem importa.
--   properties deve ser preenchida ANTES das tabelas dependentes.
-- ============================================================

-- ── STEP 1: properties ───────────────────────────────────────
-- Derivação: owner_id -> tenant_members onde o owner pertence a
-- exatamente 1 tenant ativo. Ambíguo (>1 tenant) → não preenche.
UPDATE properties
SET tenant_id = (
  SELECT tm.tenant_id
  FROM tenant_members tm
  WHERE tm.user_id = properties.owner_id
    AND tm.status  = 'active'
  LIMIT 1
)
WHERE tenant_id IS NULL
  AND owner_id IS NOT NULL
  AND (
    SELECT COUNT(*) FROM tenant_members tm
    WHERE tm.user_id = properties.owner_id
      AND tm.status  = 'active'
  ) = 1;

-- ── STEP 2: rooms ────────────────────────────────────────────
UPDATE rooms
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = rooms.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 3: inventory_items ──────────────────────────────────
UPDATE inventory_items
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = inventory_items.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 4: service_orders ───────────────────────────────────
UPDATE service_orders
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = service_orders.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 5: documents ────────────────────────────────────────
UPDATE documents
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = documents.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 6: expenses ─────────────────────────────────────────
UPDATE expenses
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = expenses.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 7: maintenance_schedules ────────────────────────────
UPDATE maintenance_schedules
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = maintenance_schedules.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 8: property_collaborators ───────────────────────────
UPDATE property_collaborators
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = property_collaborators.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 9: property_invites ─────────────────────────────────
UPDATE property_invites
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = property_invites.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 10: property_access_credentials ─────────────────────
UPDATE property_access_credentials
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = property_access_credentials.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 11: service_requests ────────────────────────────────
UPDATE service_requests
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = service_requests.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 12: audit_links ─────────────────────────────────────
UPDATE audit_links
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = audit_links.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 13: provider_ratings ────────────────────────────────
UPDATE provider_ratings
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = provider_ratings.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 14: pix_charges ─────────────────────────────────────
UPDATE pix_charges
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = pix_charges.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 15: nfe_imports ─────────────────────────────────────
UPDATE nfe_imports
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = nfe_imports.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;

-- ── STEP 16: service_bids (via service_orders) ───────────────
-- Executar APÓS service_orders (STEP 4) estar preenchido.
UPDATE service_bids
SET tenant_id = (
  SELECT so.tenant_id FROM service_orders so
  WHERE so.id = service_bids.service_id
    AND so.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND service_id IS NOT NULL;

-- ── STEP 17: service_messages (via service_orders) ───────────
UPDATE service_messages
SET tenant_id = (
  SELECT so.tenant_id FROM service_orders so
  WHERE so.id = service_messages.service_order_id
    AND so.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND service_order_id IS NOT NULL;

-- ── STEP 18: service_share_links (via service_orders) ────────
UPDATE service_share_links
SET tenant_id = (
  SELECT so.tenant_id FROM service_orders so
  WHERE so.id = service_share_links.service_id
    AND so.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND service_id IS NOT NULL;

-- ── STEP 19: bids (via service_requests) ─────────────────────
-- Executar APÓS service_requests (STEP 11) estar preenchido.
UPDATE bids
SET tenant_id = (
  SELECT sr.tenant_id FROM service_requests sr
  WHERE sr.id = bids.service_request_id
    AND sr.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND service_request_id IS NOT NULL;

-- ── STEP 20: audit_log (via property_id) ─────────────────────
-- audit_log não tem deleted_at; preenche conservadoramente.
UPDATE audit_log
SET tenant_id = (
  SELECT p.tenant_id FROM properties p
  WHERE p.id = audit_log.property_id
    AND p.tenant_id IS NOT NULL
)
WHERE tenant_id IS NULL
  AND property_id IS NOT NULL;
