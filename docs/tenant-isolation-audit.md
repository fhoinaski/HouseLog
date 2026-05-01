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

## Proxima migracao necessaria

Migrar rotas por dominio para `resolveTenant` e exigir `tenant_id` nas queries. Depois disso, uma migration futura pode tornar `tenant_id` `NOT NULL` nas tabelas principais.
