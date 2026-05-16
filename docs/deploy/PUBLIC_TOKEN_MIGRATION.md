# Public token migration

Este procedimento finaliza a migracao dos links publicos para lookup somente por hash.

## Tabelas afetadas

- `audit_links`: coluna legada `token`, segredo em `token_hash`.
- `service_share_links`: coluna legada `token`, segredo em `token_hash`.
- `property_invites`: coluna legada `token`, segredo em `token_hash`.
- `handover_packages`: sem plaintext legado; usa `public_access_token_hash`.

## Ordem de producao

1. Fazer backup/export do D1 production.
2. Executar o backfill `house-log-back/apps/api/src/db/backfill/phase_a_token_hash_backfill.ts` contra `houselog-db`.
3. Repetir o backfill ate `verifyNoPlaintextRemaining()` retornar zero pendencias.
4. Conferir manualmente:

```sql
SELECT COUNT(*) FROM audit_links WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
SELECT COUNT(*) FROM service_share_links WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
SELECT COUNT(*) FROM property_invites WHERE token_hash IS NULL AND token NOT LIKE 'hash-only:%';
```

5. Aplicar `0028_redact_token_plaintext.sql` em production. A migration e idempotente e falha se ainda houver token plaintext sem `token_hash`.
6. Conferir que `token` ficou no formato `hash-only:<id>` para registros com `token_hash`.
7. Publicar o codigo que valida links apenas com `WHERE token_hash = sha256(token_apresentado)`.

## Risco operacional

Nao publicar o codigo hash-only antes do backfill. Registros legados sem `token_hash` deixam de resolver quando o fallback plaintext e removido.
