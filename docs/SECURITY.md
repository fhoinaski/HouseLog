# Seguranca do HouseLog

## Principios

Seguranca e requisito estrutural do HouseLog. O produto lida com imoveis premium, historico tecnico, documentos, credenciais, anexos, fornecedores e dados operacionais sensiveis. Toda alteracao deve reduzir risco de vazamento, acesso indevido e perda de rastreabilidade.

Principios obrigatorios:

- negar por padrao;
- validar input externo;
- autorizar por usuario, papel, tenant e propriedade;
- nunca confiar em dados de contexto enviados pelo cliente;
- minimizar dados em responses;
- nao expor secrets, tokens, ciphertext ou keys privadas;
- registrar auditoria em acoes criticas;
- preservar isolamento multi-tenant.

## Credenciais criptografadas

Credenciais e segredos nunca devem ser armazenados em texto claro. O backend deve persistir apenas representacoes criptografadas, hashes ou metadados seguros, conforme o fluxo existente.

Nunca retornar em response:

- senha;
- hash de senha;
- refresh token hash;
- MFA secret;
- ciphertext de credencial;
- segredo original;
- token sensivel;
- chave privada de integracao.

Audit logs e logs operacionais tambem nao devem registrar esses valores.

## Midia privada e R2

Arquivos privados em R2 nao podem ser expostos por key bruta, URL publica indevida ou path interno. O padrao seguro e servir midia privada por endpoint autenticado e autorizado.

Regras:

- nao aceitar key R2 privada bruta em payload publico;
- nao retornar key R2 privada em response;
- nao aceitar URL publica R2 para categoria privada;
- validar escopo de tenant/propriedade/documento quando midia estiver associada a entidade de dominio;
- nunca assumir que uma URL externa e segura quando ela representa storage privado do HouseLog.

Novas features sem upload devem aceitar somente referencias permitidas pelo padrao atual, como endpoints autenticados internos ou URLs explicitamente validas e nao privadas.

## Sessao e refresh token

O refresh token é armazenado exclusivamente em cookie `HttpOnly` com as seguintes propriedades:

- `HttpOnly`: inacessível a JavaScript — protege contra XSS.
- `Secure`: enviado apenas por HTTPS em ambiente `production`.
- `SameSite=Lax`: protege contra CSRF em POSTs cross-site.
- `Path=/api/v1/auth`: limita o escopo do cookie aos endpoints de autenticação.
- `Max-Age`: coerente com o TTL do refresh token (padrão 30 dias).

Nome do cookie: `houselog_refresh`.

Regras:

- Nunca retornar refresh token no JSON body.
- Nunca aceitar refresh token via body — apenas via cookie.
- Nunca logar o valor cru do refresh token.
- O hash SHA-256 é o único valor persistido no banco.
- O access token (JWT, TTL 1h) é armazenado **exclusivamente em memória React** (módulo `storage.ts`), jamais em `localStorage` ou `sessionStorage`. Ele é perdido ao recarregar a página e obtido novamente via cookie HttpOnly no boot do `AuthProvider`.
- O frontend usa `credentials: 'include'` em todas as chamadas à API para enviar o cookie automaticamente.
- Em caso de 401 em endpoint privado, o frontend tenta uma renovação silenciosa via cookie antes de redirecionar para login (deduplicação via promise compartilhada em `session.ts`).

Nota de compatibilidade de deployment: em ambientes onde frontend e API estão em domínios distintos (ex: vercel.app e workers.dev), `SameSite=Lax` não envia o cookie em POSTs cross-site. A solução definitiva é custom domain same-site (ex: api.houselog.app + app.houselog.app).

## R2 — Armazenamento privado por padrão

Todos os objetos R2 do HouseLog são considerados privados por padrão. Nenhum arquivo de domínio (documentos, fotos, vídeos, evidências, faturas, itens de inventário) deve ser acessível por URL pública permanente.

### Política de acesso ao bucket

- O bucket R2 **deve** ter a opção "Public access" desabilitada no painel Cloudflare.
- Objetos são servidos **exclusivamente** via Worker autenticado (`c.env.STORAGE.get(key)`).
- Nenhuma URL assinada de leitura (presigned GET) é emitida. O acesso é proxied pelo Worker, que valida `tenantId` e `propertyId` em cada requisição.
- A variável `R2_PUBLIC_URL` é utilizada **apenas** para geração de thumbnails via Cloudflare Image Resizing (feature opcional). Se não configurada, thumbnails usam o arquivo original como fallback. Em ambientes seguros: **não configure `R2_PUBLIC_URL`** para manter o bucket totalmente privado.

### Categorias de chave

| Categoria | Classificação | Endpoint de acesso |
|-----------|---------------|-------------------|
| `avatars` | público | `GET /api/v1/media/{key}` (sem auth) |
| `photos` | privado | `GET /properties/:id/media/*` ou `/services/:id/media/*` |
| `videos` | privado | `GET /services/:id/media/*` |
| `documents` | privado | `GET /properties/:propertyId/documents/:id/download` |
| `invoices` | privado | `GET /provider/service-orders/:id/invoice` (se implementado) |
| `inventory` | privado | `GET /properties/:propertyId/inventory/:id/photo` |

### Validações obrigatórias antes de servir R2

- Verificar `tenantId` do JWT contra o tenant do imóvel (no DB).
- Verificar que o usuário tem acesso ao imóvel (`assertPropertyAccess`).
- Verificar que a chave R2 começa com `{propertyId}/` (prefixo de property).
- Para evidências de OS: verificar que a chave está registrada na OS específica (`allowedKeys.has(key)`).
- Para downloads de documento: verificar que `tenantId` e `propertyId` do documento batem com o contexto.
- Nunca retornar a chave R2 interna em respostas de erro.
- `file_url` em respostas de documentos deve ser o endpoint autenticado (`/api/v1/properties/.../documents/.../download`), nunca a chave bruta.

### Regras de upload

- Validar MIME type e extensão com `validatePrivateUpload` antes de qualquer gravação em R2.
- `tenantId` é sempre injetado do contexto JWT — nunca aceitar do client.
- `buildR2Key({ propertyId, category, filename })` garante que a chave contém o `propertyId` como prefixo.

## CORS seguro em producao

Em producao, CORS deve usar origins explicitas. Nao usar `*` com credenciais.

Regras:

- `CORS_ORIGINS=*` nao deve abrir credenciais em producao;
- origins locais devem ser permitidas apenas em desenvolvimento;
- ausencia de configuracao segura em producao deve falhar de forma fechada;
- rotas autenticadas nao devem depender de CORS como mecanismo de autorizacao.

## Audit log

Acoes criticas devem chamar `writeAuditLog`, incluindo:

- criacao, update e delete de entidades relevantes;
- mudancas de status;
- alteracoes de permissao;
- acesso ou modificacao de credenciais;
- eventos de compartilhamento/token;
- acoes administrativas.

O audit log deve incluir `tenantId` e `propertyId` sempre que aplicavel. Dados sensiveis devem ser sanitizados com `sanitizeAuditData`.

## Protecao contra vazamento cross-tenant

Toda rota privada deve impedir acesso cruzado entre tenants. O padrao e:

- resolver tenant no backend com `resolveTenant`;
- validar o imovel por `tenantId + propertyId`;
- filtrar queries por `tenant_id`;
- validar que entidades relacionadas pertencem ao mesmo tenant e, quando aplicavel, ao mesmo property;
- retornar 404 para registros fora do escopo.

Nao use apenas `id` como criterio de busca para entidade sensivel.

## Dados sensiveis

Dados sensiveis incluem:

- credenciais;
- tokens;
- secrets;
- ciphertext;
- chaves R2;
- dados financeiros;
- documentos privados;
- anexos privados;
- logs com payload de autenticacao;
- dados pessoais desnecessarios ao fluxo atual.

Antes de registrar, retornar ou enviar dados, confirme se o consumidor precisa daquele campo.

## Rotas publicas e tokenizadas

Rotas publicas ou baseadas em token devem:

- validar token;
- validar expiracao;
- validar escopo minimo;
- evitar retorno de dados internos;
- nao permitir enumeracao;
- nao liberar acesso cross-tenant;
- registrar auditoria quando houver impacto operacional.

Token publico nao substitui tenant, propriedade e escopo de entidade.

## Tokens de links publicos (audit links, share links, invites)

Aplicado a partir de P0-PUBLIC-LINKS-HASH-01 (2026-05-12):

- O banco de dados armazena apenas o hash SHA-256 do token (`token_hash TEXT`).
- O token puro (nanoid) e emitido apenas uma vez na criacao e nunca mais relido do banco.
- Lookup publico e feito por hash: `WHERE token_hash = sha256(token_apresentado)`.
- Registros legados sem `token_hash` usam fallback de lookup por `token` ate que o script de backfill seja executado.
- `sanitizeAuditData` redacta automaticamente todos os campos de token:
  `token`, `accessToken`, `refreshToken`, `publicAccessToken`, `inviteToken`, `shareToken`, `auditToken` e suas variantes `_hash` e snake_case.
- Links expirados ou revogados retornam `410 Gone` (nao `409`).
- Tokens malformados (< 8 chars) retornam `400 Bad Request`.
- DTOs publicos nao expem `tenant_id`, `service_id` interno, `token`, nem IDs de entidade interna.
- Criacao de share link e invite registra `writeAuditLog` com `action: share_link_created / invite_created`.

Migration: `0027_public_link_token_hash.sql` — adiciona `token_hash TEXT` e indices nas tabelas `audit_links`, `service_share_links`, `property_invites`.

Backfill pendente: executar `UPDATE ... SET token_hash = sha256(token) WHERE token_hash IS NULL` para registros pre-existentes antes de remover fallback de token plaintext.

## O que nunca fazer

- Nunca aceitar `tenantId` do cliente como fonte de verdade.
- Nunca buscar entidade sensivel apenas por `id`.
- Nunca expor senha, hash, token, secret, ciphertext ou key R2 privada.
- Nunca logar payload sensivel sem sanitizacao.
- Nunca criar rota publica para midia privada sem autorizacao.
- Nunca usar CORS permissivo como solucao de autenticacao.
- Nunca retornar dados de outro tenant como erro de permissao detalhado.
- Nunca criar regra de autorizacao paralela ignorando helpers existentes.

## Checklist de seguranca antes de concluir uma task

- A rota usa `authMiddleware` quando privada?
- O tenant e resolvido com `resolveTenant`?
- Toda query sensivel filtra `tenantId` e `propertyId` quando aplicavel?
- Vínculos com room, service order, document e inventory validam mesmo tenant/property?
- O payload rejeita `tenantId` e campos server-only?
- Secrets, ciphertext, tokens e R2 keys privadas estao fora de responses e logs?
- Mutacoes criticas usam `writeAuditLog`?
- Audit payload foi sanitizado com `sanitizeAuditData` quando necessario?
- Soft delete foi considerado para historico tecnico?
- `npm run type-check`, `npm run test:api`, `npm run lint` e `git diff --check` passam?
