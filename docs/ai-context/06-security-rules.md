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

## Secrets e infra

Nao versionar secrets. `.dev.vars` nunca deve ser rastreado; mantenha apenas `.dev.vars.example` com placeholders. Identificadores de infraestrutura nao sao secrets, mas devem ser tratados com cuidado em repositorio publico. Em Cloudflare Workers, secrets de producao devem ser configurados via `wrangler secret put`, nunca em `wrangler.toml`.

## Credenciais

Listagens nao retornam segredo. Reveal deve ser acao explicita, autorizada, auditada e sem plaintext no audit log.

## Public links

Tokens publicos devem ser gerados uma vez, armazenados como hash quando suportado, ter expiracao/revogacao quando o dominio exigir e retornar payload minimo.
Rotas publicas tokenizadas devem aplicar rate limit granular por fluxo, IP e prefixo do hash do token. Nunca usar token plaintext em chave de rate limit, audit log, logs ou snapshots. Respostas publicas devem evitar diferenciar token inexistente de token malformado quando isso facilitar enumeracao.

## Audit log

Mutacoes criticas usam `writeAuditLog`. Dados antigos e novos devem passar por sanitizacao. Inclua `tenantId` e `propertyId` quando aplicavel.

## Provider — autorizacao de upload

`canUploadProviderEvidence` (authorization.ts): provider deve estar atribuido (`assignedTo === userId`) e OS deve ter status `approved` ou `in_progress`; admin nao tem bypass nessa acao provider. Nao usar `canManageProperty` para upload de evidencia de prestador - esse helper bloqueia todos os `isProviderRole`. Audit log de upload nao deve conter R2 key, signed URL ou conteudo do arquivo.

## Checklist rapido

## Provider evidence upload (2026-05-17)

- Upload de evidencia de provider usa somente `/api/v1/provider/services/:id/photos`; nao usa `canManageProperty`.
- Autorizacao exige tenant ativo, `role=provider`, OS por `tenantId + serviceId`, provider atribuido (`assignedTo === userId`) e status `approved` ou `in_progress`.
- Midia de evidencia do provider e servida por `/api/v1/provider/services/:id/media/*`, validando `tenantId + serviceId + assignedTo + propertyId` e key registrada na OS.
- Respostas e audit log nao incluem R2 key bruta, signed URL, URL publica permanente ou conteudo do arquivo.

- A rota privada usa auth?
- Tenant foi resolvido no backend?
- Query filtra tenant e property?
- Vinculos aninhados foram validados?
- Response remove dados sensiveis?
- Mutacao sensivel audita?

## Authorization Core

Helpers de autorizacao para property e abertura de OS dependem de tenant ativo. Nao adicionar fallback por `propertyId + userId` sem `tenantId`.

## Search

Campos pesquisaveis ficam em `SEARCH_FIELD_POLICY`. Nao incluir OCR, descricoes livres, credenciais, segredos, URLs privadas ou R2 keys em search sem nova policy explicita e testes.
