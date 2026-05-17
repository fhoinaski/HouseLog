# 06 - Security Rules

## Regras absolutas

- Nunca aceitar `tenantId` do cliente.
- Sempre derivar tenant do contexto autenticado.
- Nunca consultar recurso sensivel apenas por `id`.
- Sempre validar `tenantId + resourceId`.
- Para recursos de imovel, validar `tenantId + propertyId`.
- Nao expor secrets, tokens, ciphertext, signed URLs, R2 keys ou credenciais.
- Nao registrar dados sensiveis em logs, audit logs ou snapshots.
- Nao usar IDs internos como tokens publicos.
- Nao usar `Math.random()` para valores sensiveis.

## Auth e sessao

Refresh token fica em cookie `HttpOnly` no escopo `/api/v1/auth`. Access token fica em memoria no frontend. Nao usar `localStorage` ou `sessionStorage` para tokens.

## R2 e midia

Objetos R2 sao privados por padrao. Arquivos de dominio devem ser servidos por endpoint autenticado/autorizado. Nao retornar key interna ou URL publica permanente para midia privada.

## Credenciais

Listagens nao retornam segredo. Reveal deve ser acao explicita, autorizada, auditada e sem plaintext no audit log.

## Public links

Tokens publicos devem ser gerados uma vez, armazenados como hash quando suportado, ter expiracao/revogacao quando o dominio exigir e retornar payload minimo.

## Audit log

Mutacoes criticas usam `writeAuditLog`. Dados antigos e novos devem passar por sanitizacao. Inclua `tenantId` e `propertyId` quando aplicavel.

## Checklist rapido

- A rota privada usa auth?
- Tenant foi resolvido no backend?
- Query filtra tenant e property?
- Vinculos aninhados foram validados?
- Response remove dados sensiveis?
- Mutacao sensivel audita?

