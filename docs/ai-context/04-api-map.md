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

## Provider — rotas de upload (2026-05-17)

- `POST /api/v1/provider/services/:id/invoice` — nota fiscal; qualquer status.
- `POST /api/v1/provider/services/:id/photos` — evidencia pos-execucao (`type: 'after'`); requer status `approved` ou `in_progress` e provider atribuido. Retorna `{ url, type }` onde `url` aponta para `/api/v1/properties/:propertyId/services/:id/media/:key` (sem R2 key exposta).

## Regras para IA

- Nao inventar endpoint.
- Nao inventar payload.
- Nao aceitar `tenantId` do cliente.
- Conferir consumidor direto antes de mudar response.
- Conferir contracts antes de mudar backend ou frontend.
- Public routes devem ter token seguro, expiracao, escopo minimo e payload minimo.

