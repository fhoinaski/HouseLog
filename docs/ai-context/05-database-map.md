# 05 - Database Map

## Banco

Cloudflare D1/SQLite com Drizzle ORM.

## Tabelas principais

- `tenants`, `tenant_members`, `users`.
- `properties`, `rooms`, `inventory_items`.
- `service_orders`, `service_requests`, `service_bids`, `service_messages`, `bids`.
- `documents`, `expenses`, `maintenance_schedules`.
- `property_access_credentials`.
- `audit_links`, `service_share_links`, `audit_log`.
- `provider_ratings`, `provider_endorsements`, `provider_availability`.
- `technical_systems`, `technical_points`, `warranties`, `renovations`.
- `handover_packages`, `handover_checklist_items`.
- `document_ingestion` e candidates conforme migrations recentes.

## Multi-tenant

`tenant_id` e obrigatorio como regra de dominio. Dados legados com `tenant_id = null` sao risco de migracao, nao fallback universal.

## Migrations relevantes

- `0014_tenant_foundation.sql`: base multi-tenant.
- `0015_technical_systems.sql`: sistemas tecnicos.
- `0016_technical_points.sql`: pontos tecnicos.
- `0018_warranties.sql`: garantias.
- `0019_renovations.sql`: reformas.
- `0020` a `0025`: handover e checklist.
- `0027` e `0028`: hash/redacao de tokens publicos.
- `0032`: backfill e guards para `tenant_id`.
- `0033`: endurecimento de `tenant_id` not null.

## Regras para IA

- Nao criar migration sem pedido explicito.
- Nao ler todas as migrations; busque pelo nome da entidade ou ID da migration.
- Para schema, abra apenas trecho relacionado a entidade.
- Toda nova entidade de imovel precisa de `tenant_id` e `property_id`.
- Prefira soft delete para historico tecnico quando a entidade tem valor operacional.

