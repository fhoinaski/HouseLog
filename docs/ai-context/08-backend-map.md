# 08 - Backend Map

## Stack

Cloudflare Workers, Hono, TypeScript, D1/SQLite, Drizzle, R2, KV, Queues, Resend e Workers AI quando aplicavel.

## Diretorios

- `house-log-back/apps/api/src/routes`: rotas HTTP e testes proximos.
- `house-log-back/apps/api/src/db`: schema, client, types, migrations e backfills.
- `house-log-back/apps/api/src/lib`: helpers de auth, tenant, audit, media, crypto e dominio quando aplicavel.
- `packages/contracts`: schemas compartilhados usados pela API.

## Padrao de rota privada

1. `authMiddleware`.
2. `resolveTenant`.
3. Validar params/query/body com Zod.
4. Validar property e recursos aninhados.
5. Query com `tenant_id` e `property_id` quando aplicavel.
6. Mutacao sensivel com `writeAuditLog`.
7. Response sem dados sensiveis.

Helpers de autorizacao compartilhados devem receber `tenantId` e `tenantRole` do contexto resolvido. Nao criar caminhos legados sem tenant em helpers novos.

## Areas sensiveis

Auth, tenant authorization, credentials, documents/media, service orders, bids/messages, audit log, deploy config, public links, handover, uploads e offline sync.

Search usa `src/lib/search-field-policy.ts` para controlar campos permitidos e proibidos por entidade. A rota nao deve adicionar campo pesquisavel fora dessa policy.

Public links usam `src/lib/public-link-rate-limit.ts` para rate limit granular em KV por `flow + action + IP + tokenHashPrefix`. O helper recebe hash de token, nunca token plaintext. Acoes publicas de mutacao usam limite menor que leitura.

## Propostas de OS — bids.ts (2026-05-17)

- `GET/POST/PATCH /properties/:propertyId/services/:serviceId/bids` montados em `index.ts`.
- `loadTenantServiceOrder` valida `tenantId + propertyId + serviceId` com innerJoin antes de qualquer operação de bid.
- `PATCH /:bidId/status` guarda contra `role === 'provider'` logo no início do handler (antes de `assertPropertyAccess`), retornando 403 imediatamente.
- Aceitar bid: `UPDATE serviceOrders SET assigned_to, cost, status='approved'` + `db.run(sql...)` para rejeitar outros bids pending do mesmo serviceId.
- Audit log: `provider_proposal_submitted` no POST. Sem audit no PATCH (a OS já audita mutações de status).

## Provider — rotas de upload (2026-05-17)

- `POST /provider/services/:id/invoice` — `canUploadProviderInvoice` (alias de `canViewAssignedProviderService`); cria documento no D1.
- `POST /provider/services/:id/photos` — `canUploadProviderEvidence`; requer `assigned_to === userId` + status `approved`|`in_progress`; salva R2 key em `serviceOrders.afterPhotos`; audit sem R2 key. NAO usar `canManageProperty` para provider — bloqueia todos os roles de prestador.

## Regras para IA

## Provider evidence upload delta (2026-05-17)

- `routes/provider.ts`: `POST /provider/services/:id/photos` e o endpoint dedicado de upload de evidencia do provider. Busca OS por `tenantId + serviceId + assignedTo` com join em `properties` por tenant; status permitido `approved`/`in_progress`.
- `routes/provider.ts`: `GET /provider/services/:id/media/*` serve R2 privado somente para provider atribuido e somente para keys registradas em `beforePhotos`, `afterPhotos`, `videoUrl` ou `audioUrl`.
- `GET /provider/services/:id` mapeia keys privadas para URLs `/provider/services/:id/media/*` e inclui `can_upload_evidence`.
- `authorization.ts`: `canUploadProviderEvidence` exige provider atribuido e status operacional; admin nao recebe bypass nessa acao provider.

- Nao inventar rota, entidade ou payload.
- Preferir helpers compartilhados de autorizacao.
- Preservar status codes salvo motivo de seguranca.
- Nao expor existencia de recurso cross-tenant.
- Nao alterar migrations fora do escopo.
- Nao usar `any` ou `ts-ignore` para esconder problema.

## Validacao comum

Para backend, use scripts existentes: `npm run type-check`, `npm run test:api`, `npm run build` quando justificado, e `git diff --check`.
