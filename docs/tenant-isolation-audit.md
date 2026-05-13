# Auditoria de isolamento por tenant

Data: 2026-04-30

## Diagnostico

O HouseLog esta estruturado principalmente por `property_id`. Esse modelo ja reduz o risco de vazamento entre imoveis quando as rotas chamam `assertPropertyAccess`/`canAccessProperty`, mas ainda nao era uma fundacao SaaS multi-tenant completa: nao havia `tenants`, `tenant_members` nem coluna `tenant_id` nas entidades sensiveis.

## Tabelas existentes mapeadas

Tabelas com dados sensiveis ou de contexto operacional:

- `users`
- `properties`
- `rooms`
- `inventory_items`
- `service_orders`
- `service_bids`
- `service_messages`
- `service_requests`
- `bids`
- `documents`
- `expenses`
- `maintenance_schedules`
- `property_access_credentials`
- `audit_links`
- `provider_ratings`
- `property_collaborators`
- `property_invites`
- `service_share_links`
- `pix_charges`
- `nfe_imports`
- `audit_log`

Tabelas globais ou tecnicas:

- `refresh_tokens`
- `user_mfa`
- `mfa_challenges`
- `push_subscriptions`
- `image_variants`
- `provider_endorsements`
- `provider_availability`
- `ai_cache`

## Tabelas que receberam tenant_id

A migration `0014_tenant_foundation.sql` adiciona `tenant_id` nullable e backfill legado para:

- `properties`, `rooms`, `inventory_items`
- `service_orders`, `service_bids`, `service_messages`
- `service_requests`, `bids`
- `documents`, `expenses`, `maintenance_schedules`
- `property_access_credentials`, `audit_links`, `provider_ratings`
- `property_collaborators`, `property_invites`, `service_share_links`
- `pix_charges`, `nfe_imports`

`users` recebeu `active_tenant_id`, porque usuario pode participar de mais de um tenant via `tenant_members`.

## Rotas sensiveis mapeadas

Rotas autenticadas com dados por propriedade:

- `/properties`
- `/properties/:propertyId/rooms`
- `/properties/:propertyId/inventory`
- `/properties/:propertyId/services`
- `/properties/:propertyId/service-requests`
- `/properties/:propertyId/service-requests/:serviceRequestId/bids`
- `/properties/:propertyId/expenses`
- `/properties/:propertyId/documents`
- `/properties/:propertyId/maintenance`
- `/properties/:propertyId/finance`
- `/properties/:propertyId/timeline`
- `/properties/:propertyId/report`
- `/properties/:propertyId/services/:serviceId/bids`
- `/properties/:propertyId/services/:serviceId/audit-link`
- `/properties/:propertyId/credentials`
- `/search`
- `/services/:serviceOrderId/messages`
- `/provider/*`
- `/marketplace/*`
- `/push/*`
- `/ai/*`

Rotas publicas por token:

- `/audit/public/:token`
- `/share/service/:token`
- `/invite/:token`

## Queries sem isolamento tenant estrito

As rotas atuais usam isolamento por propriedade, nao por `tenant_id`. Isso deve ser tratado como lacuna ate que cada query sensivel inclua `tenant_id` ou derive tenant por join validado:

- listagens e detalhes de `properties`
- todos os submodulos aninhados por `propertyId`
- chat por OS
- provider opportunities/services
- marketplace ratings/profile
- busca global
- links publicos de audit/share, que devem validar escopo e expiracao

## Status apos esta mudanca

- Fundacao de dados multi-tenant criada.
- Backfill legado preserva dados existentes.
- Middleware reutilizavel de tenant criado.
- Contratos compartilhados iniciados.
- Testes unitarios cobrem regras criticas de chat/provider.

## Status apos P0-TENANT-BACKFILL-01 (2026-05-12)

### Rotas

Todas as rotas autenticadas usam `resolveTenant` middleware. Lista confirmada:

- `properties`, `rooms`, `inventory`, `services`, `expenses`, `documents`
- `maintenance`, `credentials`, `service-requests`, `service-request-bids`
- `bids`, `audit-links`, `invites`, `share`, `messages`, `provider`
- `marketplace`, `search`, `reports`, `timeline`, `finance`
- `renovations`, `warranties`, `handover-packages`, `handover-checklist-items`
- `audit-log`

Todas as rotas retornam `400 TENANT_REQUIRED` sem membership ativo.

### Inserts

Todos os handlers de criacao injetam `tenantId` do contexto no INSERT. Verificado em:
`rooms`, `services`, `expenses`, `credentials`, `documents`, `maintenance_schedules`,
`service_orders` (auto-create), `service_requests`, `audit_links`, `provider_ratings`,
`pix_charges`, `nfe_imports`, `renovations`, `warranties`, `handover_packages`,
`handover_checklist_items`, `document_ingestion_jobs`, `technical_systems`, `technical_points`.

### Scripts de operacao

| Script | Caminho | Proposito |
| --- | --- | --- |
| `phase_a_diagnostic.sql` | `apps/api/src/db/backfill/` | Relatorio de null_tenant por tabela (read-only) |
| `phase_b_safe_backfill.sql` | `apps/api/src/db/backfill/` | Backfill idempotente — so preenche tenant_id IS NULL |
| `phase_c_orphan_report.sql` | `apps/api/src/db/backfill/` | Lista registros sem parent resolvivel |

Executar em ordem: A → B → A (comparar) → C (se null_tenant > 0 ainda).

### Cobertura de testes

| Arquivo | Escopo |
| --- | --- |
| `lib/tenant-authorization.test.ts` | `canUseTenantPropertyAccess` puro |
| `lib/backfill-diagnostics.test.ts` | `resolveChildTenant`, `resolvePropertyTenant`, `BACKFILL_STRATEGIES` |
| `lib/room-tenant.test.ts` | isolamento de rooms por tenant |
| `lib/service-tenant.test.ts` | isolamento de service orders por tenant |
| `lib/expense-tenant.test.ts` | isolamento de expenses e pix_charges |
| `lib/maintenance-tenant.test.ts` | isolamento de schedules por tenant |
| `lib/inventory-tenant.test.ts` | isolamento de inventory por tenant |
| `lib/warranty-tenant.test.ts` | isolamento de warranties por tenant |
| `lib/renovation-tenant.test.ts` | isolamento de renovations por tenant |
| `lib/handover-tenant.test.ts` | isolamento de handover por tenant |
| `lib/document-ingestion-tenant.test.ts` | isolamento de ingestion jobs por tenant |
| `lib/search-timeline-tenant.test.ts` | isolamento de busca e timeline |
| `lib/property-tenant.test.ts` | isolamento de properties por tenant |
| `routes/tenant-isolation.test.ts` | resolveTenant middleware + INSERT com tenantId + cross-tenant read |

### Tabelas com tenant_id nullable (20 tabelas — Fase D pendente)

| Tabela | Status | Derivacao |
| --- | --- | --- |
| `properties` | nullable | owner_id → tenant_members |
| `rooms` | nullable | property_id → properties.tenant_id |
| `inventory_items` | nullable | property_id → properties.tenant_id |
| `service_orders` | nullable | property_id → properties.tenant_id |
| `service_bids` | nullable | service_id → service_orders.tenant_id |
| `service_messages` | nullable | service_order_id → service_orders.tenant_id |
| `service_requests` | nullable | property_id → properties.tenant_id |
| `bids` | nullable | service_request_id → service_requests.tenant_id |
| `documents` | nullable | property_id → properties.tenant_id |
| `expenses` | nullable | property_id → properties.tenant_id |
| `maintenance_schedules` | nullable | property_id → properties.tenant_id |
| `property_collaborators` | nullable | property_id → properties.tenant_id |
| `property_invites` | nullable | property_id → properties.tenant_id |
| `property_access_credentials` | nullable | property_id → properties.tenant_id |
| `audit_links` | nullable | property_id → properties.tenant_id |
| `provider_ratings` | nullable | property_id → properties.tenant_id |
| `service_share_links` | nullable | service_id → service_orders.tenant_id |
| `pix_charges` | nullable | property_id → properties.tenant_id |
| `nfe_imports` | nullable | property_id → properties.tenant_id |
| `audit_log` | nullable | property_id → properties.tenant_id |

### Tabelas com tenant_id NOT NULL (ja seguras — nao precisam de backfill)

`tenants`, `tenant_members`, `technical_systems`, `technical_points`,
`document_ingestion_jobs`, `document_extractions`, `document_extraction_reviews`,
`document_extraction_candidates`, `warranties`, `renovations`,
`handover_packages`, `handover_checklist_items`.

## Roadmap de constraints NOT NULL (Fase D)

Pre-requisitos (todos devem estar satisfeitos antes de iniciar):

1. `phase_a_diagnostic.sql` retorna `null_tenant = 0` em todas as 20 tabelas.
2. `phase_b_safe_backfill.sql` foi aplicado e revalidado.
3. `phase_c_orphan_report.sql` retorna 0 registros sem parent resolvivel.
4. Validacao em ambiente dev por minimo 24h.
5. Backup completo confirmado (`wrangler d1 export houselog-db > backup_YYYYMMDD.sql`).

Ordem de migracao (D1/SQLite nao suporta ALTER COLUMN — requer recriacao de tabela):

1. Tabelas raiz: `properties` (sem dependentes diretos de NOT NULL aqui).
2. Dependentes de properties: `rooms`, `inventory_items`, `expenses`, `documents`,
   `maintenance_schedules`, `property_collaborators`, `property_invites`,
   `property_access_credentials`, `audit_links`, `provider_ratings`, `pix_charges`,
   `nfe_imports`, `service_requests`, `audit_log`.
3. Dependentes de service_orders: `service_bids`, `service_messages`, `service_share_links`.
4. Dependentes de service_requests: `bids`.

Migration target: `0026_tenant_not_null.sql`.

Padrao D1 para cada tabela:
```sql
CREATE TABLE rooms_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  -- ... outros campos identicos ...
);
INSERT INTO rooms_new SELECT * FROM rooms;
DROP TABLE rooms;
ALTER TABLE rooms_new RENAME TO rooms;
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
```

Executar somente com janela de manutencao e rollback testado.
