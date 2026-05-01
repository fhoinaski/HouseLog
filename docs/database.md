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
