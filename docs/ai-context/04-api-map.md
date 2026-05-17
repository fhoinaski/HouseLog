# 04 - API Map

## Fonte de contratos

`packages/contracts` e a fonte compartilhada para schemas Zod e tipos. Nao duplique schema se houver contrato existente.

Schemas atuais incluem auth, tenant, property, room, service-order, bid, message, document, finance, provider, credential, handover, inventory, maintenance, renovation, report, technical-system, technical-point, warranty e document ingestion.

## Formato de erro

Formato novo suportado:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Acesso negado."
  },
  "request_id": "..."
}
```

O frontend tambem aceita formato legado preservado pelo helper antigo.

## Familias de rotas

- Auth: `/api/v1/auth/*`.
- Properties: `/api/v1/properties/*`.
- Services: `/api/v1/services/*` e rotas dentro de property.
- Provider: `/api/v1/provider/*`.
- Public/tokenized: audit links, service share, invite e handover publico.
- Documents, credentials, expenses, maintenance, inventory, warranties, renovations, systems, technical points e handover seguem escopo por property quando aplicavel.

## Propostas de OS (service_bids) — (2026-05-17)

Tabela `service_bids` ligada a `serviceOrders.id` via `service_id`. Status: `pending`, `accepted`, `rejected`.

- `GET  /api/v1/properties/:propertyId/services/:serviceId/bids` — lista propostas; requer `assertPropertyAccess` (owner/manager/admin). Valida `tenantId + propertyId + serviceId` via `loadTenantServiceOrder`.
- `POST /api/v1/properties/:propertyId/services/:serviceId/bids` — provider envia proposta; requer `role === 'provider'` e OS com `status === 'requested'` sem `assigned_to`. Bloqueia bid duplicado por provider. Body: `{ amount: number, notes?: string }`. Retorna `{ bid }` 201. Dispara email ao owner (non-blocking).
- `PATCH /api/v1/properties/:propertyId/services/:serviceId/bids/:bidId/status` — owner aceita/recusa; `role === 'provider'` bloqueado (403). Body: `{ status: 'accepted' | 'rejected' }`. Aceitar: seta `assignedTo`, `cost`, `status=approved` na OS e rejeita outros bids pending. Retorna `{ success, status }`.

## Provider — rotas de upload (2026-05-17)

- `POST /api/v1/provider/services/:id/invoice` — nota fiscal; qualquer status.
- `POST /api/v1/provider/services/:id/photos` — evidencia pos-execucao (`type: 'after'`); requer status `approved` ou `in_progress` e provider atribuido. Retorna `{ url, type }` onde `url` aponta para `/api/v1/properties/:propertyId/services/:id/media/:key` (sem R2 key exposta).

## Regras para IA

## Provider evidence upload delta (2026-05-17)

- `POST /api/v1/provider/services/:id/photos` e a rota dedicada para evidencia pos-execucao de provider. Requer `role=provider`, tenant ativo, OS por `tenantId + serviceId`, provider atribuido e status `approved` ou `in_progress`.
- A resposta retorna `{ url, type }` com `url` em `/api/v1/provider/services/:id/media/*`; nao retorna R2 key bruta nem signed URL.
- `GET /api/v1/provider/services/:id/media/*` serve midia privada apenas se a key estiver registrada na OS e a OS estiver atribuida ao provider autenticado.
- `GET /api/v1/provider/services/:id` retorna evidencias como URLs provider autenticadas e inclui `can_upload_evidence`.

- Nao inventar endpoint.
- Nao inventar payload.
- Nao aceitar `tenantId` do cliente.
- Conferir consumidor direto antes de mudar response.
- Conferir contracts antes de mudar backend ou frontend.
- Public routes devem ter token seguro, expiracao, escopo minimo e payload minimo.
