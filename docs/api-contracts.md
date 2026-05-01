# Contratos de API

Contratos compartilhados ficam em `packages/contracts`.

Schemas iniciais:

- `auth`
- `tenant`
- `property`
- `room`
- `service-order`
- `bid`
- `message`
- `document`
- `finance`
- `provider`

Uso atual:

- Backend ja usa schemas compartilhados para `property`, `service-order` e `message`.
- Frontend deve migrar gradualmente tipos locais em `src/lib/api/_core.ts` para tipos exportados por `@houselog/contracts`.

Erros:

O helper novo suporta o formato padrao:

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

O helper antigo `err()` foi preservado para nao quebrar consumidores existentes. O client frontend ja aceita os dois formatos.
