# Banco de dados

Banco principal: Cloudflare D1 com Drizzle.

Entidades principais:

- `tenants`, `tenant_members`
- `users`
- `properties`
- `rooms`, `inventory_items`
- `service_orders`, `service_bids`, `service_messages`
- `service_requests`, `bids`
- `documents`, `expenses`, `maintenance_schedules`
- `property_access_credentials`
- `audit_links`, `service_share_links`
- `provider_ratings`, `provider_endorsements`, `provider_availability`

Migration multi-tenant:

- `0014_tenant_foundation.sql` cria `tenants` e `tenant_members`.
- Adiciona `tenant_id` nullable nas entidades principais.
- Cria tenants legados por owner de propriedade.
- Popula memberships legados de owner, manager e colaboradores.

Regra evolutiva: manter `tenant_id` nullable ate todas as rotas sensiveis filtrarem por tenant. Depois, promover para obrigatorio em nova migration planejada.

## Endurecimento de tenant_id

A migration `0032_tenant_backfill_and_null_guards.sql` executa backfill idempotente das tabelas antigas e bloqueia novos registros criticos com `tenant_id` nulo por triggers SQLite/D1. Ela nao recria tabelas legadas, porque isso exige confirmacao previa de que nao existem orfaos em producao.

Tabelas antigas corrigidas no schema e protegidas por triggers:

- `properties`
- `rooms`
- `inventory_items`
- `service_orders`
- `service_bids`
- `audit_links`
- `documents`
- `expenses`
- `maintenance_schedules`
- `property_collaborators`
- `property_invites`
- `service_share_links`
- `property_access_credentials`
- `service_requests`
- `bids`
- `service_messages`
- `provider_ratings`
- `pix_charges`
- `nfe_imports`

`audit_log` continua nullable por desenho: eventos legados, autenticacao e eventos globais podem nao ter `property_id` seguro para derivacao. Feeds tenant-aware devem continuar filtrando `tenant_id` e ignorando linhas sem escopo.

Ordem segura em producao:

1. Fazer backup do D1.
2. Executar `src/db/backfill/phase_a_diagnostic.sql`.
3. Aplicar migrations D1 ate `0032_tenant_backfill_and_null_guards.sql`.
4. Revisar os `SELECT changes()` emitidos pela migration.
5. Executar `src/db/backfill/phase_c_orphan_report.sql`.
6. Investigar qualquer sobra com `tenant_id IS NULL`; nao atribuir tenant manualmente sem evidencia por parent.

Comandos de referencia:

```sh
wrangler d1 export houselog-db --output backup-before-tenant-guards.sql
wrangler d1 execute houselog-db --file src/db/backfill/phase_a_diagnostic.sql
wrangler d1 migrations apply houselog-db
wrangler d1 execute houselog-db --file src/db/backfill/phase_c_orphan_report.sql
```
