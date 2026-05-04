-- ============================================================
-- P0-14 — FASE C: Relatório de Sobras (Órfãos)
-- ============================================================
-- PROPÓSITO: Identificar registros que AINDA têm tenant_id = NULL
--   após a Fase B. Esses registros requerem atenção manual.
--
-- Executar APÓS a Fase B. Resultado esperado depois de backfill
-- bem-sucedido: todas as colunas derivable = 0, orphaned >= 0.
--
-- REGISTROS ÓRFÃOS são aqueles cujo parent também não tem tenant_id.
-- Eles precisam de investigação humana antes de qualquer ação.
-- NÃO apague orphans automaticamente — podem ser dados importantes.
--
-- FASE D (FUTURA — NÃO IMPLEMENTAR AGORA):
--   Quando orphaned = 0 em todas as tabelas, é seguro adicionar:
--     ALTER TABLE <tabela> RENAME TO <tabela>_old;
--     ... (recriar com NOT NULL)
--   OU usar CHECK constraint + trigger.
--   D1/SQLite não suporta ALTER COLUMN; requer recrear tabela.
--   Estratégia recomendada: nova migration 0020_tenant_not_null.sql
--   com padrão: CREATE TABLE ... AS SELECT + DROP + RENAME.
--   Executar somente após:
--     1. Fase C retornar orphaned = 0 em todas as tabelas.
--     2. Validação em dev por ≥ 24 h.
--     3. Backup completo confirmado.
-- ============================================================

-- Registros cujo parent também é null (irresolvíveis pelo backfill):
SELECT 'properties' AS table_name, id, owner_id, created_at
FROM properties
WHERE tenant_id IS NULL
ORDER BY created_at DESC
LIMIT 50;

SELECT 'rooms' AS table_name, r.id, r.property_id,
       p.tenant_id AS parent_tenant, r.created_at
FROM rooms r
LEFT JOIN properties p ON p.id = r.property_id
WHERE r.tenant_id IS NULL
ORDER BY r.created_at DESC
LIMIT 50;

SELECT 'inventory_items' AS table_name, i.id, i.property_id,
       p.tenant_id AS parent_tenant, i.created_at
FROM inventory_items i
LEFT JOIN properties p ON p.id = i.property_id
WHERE i.tenant_id IS NULL
ORDER BY i.created_at DESC
LIMIT 50;

SELECT 'service_orders' AS table_name, s.id, s.property_id,
       p.tenant_id AS parent_tenant, s.created_at
FROM service_orders s
LEFT JOIN properties p ON p.id = s.property_id
WHERE s.tenant_id IS NULL
ORDER BY s.created_at DESC
LIMIT 50;

SELECT 'expenses' AS table_name, e.id, e.property_id,
       p.tenant_id AS parent_tenant, e.reference_month, e.created_at
FROM expenses e
LEFT JOIN properties p ON p.id = e.property_id
WHERE e.tenant_id IS NULL
ORDER BY e.created_at DESC
LIMIT 50;

SELECT 'documents' AS table_name, d.id, d.property_id,
       p.tenant_id AS parent_tenant, d.type, d.created_at
FROM documents d
LEFT JOIN properties p ON p.id = d.property_id
WHERE d.tenant_id IS NULL
ORDER BY d.created_at DESC
LIMIT 50;

SELECT 'maintenance_schedules' AS table_name, m.id, m.property_id,
       p.tenant_id AS parent_tenant, m.title, m.created_at
FROM maintenance_schedules m
LEFT JOIN properties p ON p.id = m.property_id
WHERE m.tenant_id IS NULL
ORDER BY m.created_at DESC
LIMIT 50;

SELECT 'pix_charges' AS table_name, pc.id, pc.property_id,
       p.tenant_id AS parent_tenant, pc.status, pc.created_at
FROM pix_charges pc
LEFT JOIN properties p ON p.id = pc.property_id
WHERE pc.tenant_id IS NULL
ORDER BY pc.created_at DESC
LIMIT 50;

SELECT 'service_bids' AS table_name, b.id, b.service_id,
       so.tenant_id AS parent_tenant, b.status, b.created_at
FROM service_bids b
LEFT JOIN service_orders so ON so.id = b.service_id
WHERE b.tenant_id IS NULL
ORDER BY b.created_at DESC
LIMIT 50;

SELECT 'service_messages' AS table_name, sm.id, sm.service_order_id,
       so.tenant_id AS parent_tenant, sm.created_at
FROM service_messages sm
LEFT JOIN service_orders so ON so.id = sm.service_order_id
WHERE sm.tenant_id IS NULL
ORDER BY sm.created_at DESC
LIMIT 50;

SELECT 'audit_log' AS table_name, al.id, al.property_id, al.entity_type,
       p.tenant_id AS parent_tenant, al.created_at
FROM audit_log al
LEFT JOIN properties p ON p.id = al.property_id
WHERE al.tenant_id IS NULL
ORDER BY al.created_at DESC
LIMIT 50;
