-- ============================================================
-- P0-14 — FASE A: Diagnóstico de tenant_id NULL
-- ============================================================
-- PROPÓSITO: Relatório somente-leitura.
-- NÃO faz UPDATE, NÃO apaga dados, NÃO altera schema.
--
-- COMO EXECUTAR (Cloudflare D1):
--   wrangler d1 execute houselog-db --command "$(cat phase_a_diagnostic.sql)"
-- Ou execute bloco a bloco no Dashboard D1 > Query.
--
-- COLUNAS RETORNADAS:
--   table_name   — nome da tabela
--   total        — total de registros (excluindo deletedAt se aplicável)
--   null_tenant  — registros com tenant_id IS NULL
--   derivable    — registros que TÊM um parent com tenant_id preenchido
--                  (candidatos seguros para backfill)
--   orphaned     — registros sem parent válido ou parent também NULL
--                  (exigem atenção manual)
-- ============================================================

-- ── 1. properties ────────────────────────────────────────────
-- Derivação: owner_id -> tenant_members (role=owner, status=active)
-- Ambíguo se o owner pertence a > 1 tenant ativo.
SELECT
  'properties'                              AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN tenant_id IS NULL
     AND owner_id IS NOT NULL
     AND (SELECT COUNT(*) FROM tenant_members tm
          WHERE tm.user_id = properties.owner_id
            AND tm.status  = 'active') = 1
    THEN 1 ELSE 0 END)                      AS derivable,
  SUM(CASE
    WHEN tenant_id IS NULL
     AND (owner_id IS NULL
      OR (SELECT COUNT(*) FROM tenant_members tm
          WHERE tm.user_id = properties.owner_id
            AND tm.status  = 'active') <> 1)
    THEN 1 ELSE 0 END)                      AS orphaned_or_ambiguous
FROM properties
WHERE deleted_at IS NULL;

-- ── 2. rooms ─────────────────────────────────────────────────
-- Derivação direta: property_id -> properties.tenant_id
SELECT
  'rooms'                                   AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN r.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN r.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN r.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM rooms r
LEFT JOIN properties p ON p.id = r.property_id
WHERE r.deleted_at IS NULL;

-- ── 3. inventory_items ───────────────────────────────────────
SELECT
  'inventory_items'                         AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN i.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN i.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN i.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM inventory_items i
LEFT JOIN properties p ON p.id = i.property_id
WHERE i.deleted_at IS NULL;

-- ── 4. service_orders ────────────────────────────────────────
SELECT
  'service_orders'                          AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN s.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN s.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN s.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM service_orders s
LEFT JOIN properties p ON p.id = s.property_id
WHERE s.deleted_at IS NULL;

-- ── 5. service_bids ──────────────────────────────────────────
-- Derivação: service_id -> service_orders.tenant_id
SELECT
  'service_bids'                            AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN b.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN b.tenant_id IS NULL
     AND so.tenant_id IS NOT NULL THEN 1 ELSE 0 END)   AS derivable,
  SUM(CASE
    WHEN b.tenant_id IS NULL
     AND so.tenant_id IS NULL   THEN 1 ELSE 0 END)     AS orphaned
FROM service_bids b
LEFT JOIN service_orders so ON so.id = b.service_id;

-- ── 6. audit_links ───────────────────────────────────────────
SELECT
  'audit_links'                             AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN al.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN al.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN al.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM audit_links al
LEFT JOIN properties p ON p.id = al.property_id;

-- ── 7. documents ─────────────────────────────────────────────
SELECT
  'documents'                               AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN d.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN d.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN d.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM documents d
LEFT JOIN properties p ON p.id = d.property_id
WHERE d.deleted_at IS NULL;

-- ── 8. expenses ──────────────────────────────────────────────
SELECT
  'expenses'                                AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN e.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN e.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN e.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM expenses e
LEFT JOIN properties p ON p.id = e.property_id
WHERE e.deleted_at IS NULL;

-- ── 9. maintenance_schedules ─────────────────────────────────
SELECT
  'maintenance_schedules'                   AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN m.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN m.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN m.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM maintenance_schedules m
LEFT JOIN properties p ON p.id = m.property_id
WHERE m.deleted_at IS NULL;

-- ── 10. property_collaborators ───────────────────────────────
SELECT
  'property_collaborators'                  AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN pc.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN pc.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN pc.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM property_collaborators pc
LEFT JOIN properties p ON p.id = pc.property_id;

-- ── 11. property_invites ─────────────────────────────────────
SELECT
  'property_invites'                        AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN pi.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN pi.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN pi.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM property_invites pi
LEFT JOIN properties p ON p.id = pi.property_id;

-- ── 12. service_share_links ──────────────────────────────────
SELECT
  'service_share_links'                     AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN ssl.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN ssl.tenant_id IS NULL
     AND so.tenant_id IS NOT NULL THEN 1 ELSE 0 END)   AS derivable,
  SUM(CASE
    WHEN ssl.tenant_id IS NULL
     AND so.tenant_id IS NULL   THEN 1 ELSE 0 END)     AS orphaned
FROM service_share_links ssl
LEFT JOIN service_orders so ON so.id = ssl.service_id
WHERE ssl.deleted_at IS NULL;

-- ── 13. property_access_credentials ─────────────────────────
SELECT
  'property_access_credentials'             AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN c.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN c.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN c.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM property_access_credentials c
LEFT JOIN properties p ON p.id = c.property_id
WHERE c.deleted_at IS NULL;

-- ── 14. service_requests ─────────────────────────────────────
SELECT
  'service_requests'                        AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN sr.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN sr.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN sr.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM service_requests sr
LEFT JOIN properties p ON p.id = sr.property_id;

-- ── 15. bids (service_requests) ──────────────────────────────
SELECT
  'bids'                                    AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN b.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN b.tenant_id IS NULL
     AND sr.tenant_id IS NOT NULL THEN 1 ELSE 0 END)   AS derivable,
  SUM(CASE
    WHEN b.tenant_id IS NULL
     AND sr.tenant_id IS NULL   THEN 1 ELSE 0 END)     AS orphaned
FROM bids b
LEFT JOIN service_requests sr ON sr.id = b.service_request_id;

-- ── 16. service_messages ─────────────────────────────────────
SELECT
  'service_messages'                        AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN sm.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN sm.tenant_id IS NULL
     AND so.tenant_id IS NOT NULL THEN 1 ELSE 0 END)   AS derivable,
  SUM(CASE
    WHEN sm.tenant_id IS NULL
     AND so.tenant_id IS NULL   THEN 1 ELSE 0 END)     AS orphaned
FROM service_messages sm
LEFT JOIN service_orders so ON so.id = sm.service_order_id
WHERE sm.deleted_at IS NULL;

-- ── 17. provider_ratings ─────────────────────────────────────
SELECT
  'provider_ratings'                        AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN pr.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN pr.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN pr.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM provider_ratings pr
LEFT JOIN properties p ON p.id = pr.property_id;

-- ── 18. pix_charges ──────────────────────────────────────────
SELECT
  'pix_charges'                             AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN pc.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN pc.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN pc.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM pix_charges pc
LEFT JOIN properties p ON p.id = pc.property_id;

-- ── 19. nfe_imports ──────────────────────────────────────────
SELECT
  'nfe_imports'                             AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN n.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN n.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN n.tenant_id IS NULL
     AND p.tenant_id IS NULL  THEN 1 ELSE 0 END)       AS orphaned
FROM nfe_imports n
LEFT JOIN properties p ON p.id = n.property_id;

-- ── 20. audit_log ────────────────────────────────────────────
SELECT
  'audit_log'                               AS table_name,
  COUNT(*)                                  AS total,
  SUM(CASE WHEN al.tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant,
  SUM(CASE
    WHEN al.tenant_id IS NULL
     AND p.tenant_id IS NOT NULL THEN 1 ELSE 0 END)    AS derivable,
  SUM(CASE
    WHEN al.tenant_id IS NULL
     AND al.property_id IS NULL THEN 1 ELSE 0 END)     AS orphaned
FROM audit_log al
LEFT JOIN properties p ON p.id = al.property_id;
