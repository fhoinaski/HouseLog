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

### Cobertura obrigatoria por modulo (P0-AUDIT-COVERAGE, 2026-05-14)

Todas as acoes abaixo foram verificadas e possuem `writeAuditLog` com `tenantId`+`actorId`:

| Modulo | Acoes cobertas |
|--------|----------------|
| `auth` | `register`, `login`, `login_mfa`, `login_failed`, `logout`, `token_refreshed`, `mfa_enable`, `mfa_disable`, `PASSWORD_CHANGE`, `UPDATE` |
| `documents` | `document_uploaded`, `document_downloaded`, `document_deleted`, `document_ocr_requested`, ingestao, extracao |
| `expenses` | `create`, `update`, `delete` |
| `finance` | `pix_charge_created`, `pix_mark_paid`, `nfe_imported` |
| `service-requests` | `create`, `convert_to_service` |
| `service-request-bids` | `bid_accepted` |
| `messages` | `message_created`, `message_deleted` |
| `maintenance` | `create`, `update`, `delete`, `maintenance_mark_done`, `auto_create` |
| `bids` | `create` |
| `credentials` | cobertura existente |
| `handover-packages` | `create`, `update`, `share`, `revoke`, `delete` |
| `audit-links` | `audit_link_created`, `submit` |
| `invites`, `properties`, `services`, `rooms`, `warranties`, `inventory`, `renovations`, `technical-systems`, `technical-points`, `provider` | cobertura existente |

### Regras de sanitizacao

- Nunca registrar: `password`, `password_hash`, `token`, `refreshToken`, `refreshTokenHash`, `accessToken`, `publicAccessToken`, `inviteToken`, `shareToken`, `auditToken`, `mfaSecret`, `ciphertext`, `credentialSecret`, `secret`, `r2Key`, `fileUrl`, `signedUrl`, `privateUrl`, `mediaKey`, hashes de pacotes/tokens.
- `sanitizeAuditData` e aplicado automaticamente em `newData`/`oldData` antes de persistir.
- Em eventos de auth sem usuario valido (ex: `login_failed` com usuario inexistente), `tenantId` e `actorId` podem ser `null`.

| `inventory (OCR)` | `label_ocr` (leitura de etiqueta; nunca salva automaticamente) |

### Acoes fora de escopo de audit log

- `ai.ts` (classify, transcribe, diagnose): operacoes de inferencia sem efeitos persistentes.
- `push.ts` (subscribe/unsubscribe): eventos de infra de notificacao de baixo risco.
- Rotas de leitura (GET sem efeitos colaterais): nao requerem audit log.
- `marketplace.ts` (ratings, endorse, availability): baixo risco relativo; podem ser adicionados em versao futura.

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

## Fila de evidencias offline (IndexedDB)

A fila de evidencias offline (`houselog-eq` no IndexedDB do dispositivo) permite que prestadores registrem fotos de OS sem conexao.

Regras de seguranca:

- Nunca armazenar token de acesso, refresh token ou tenantId no IndexedDB — o token e lido da memoria no momento exato do upload.
- Itens da fila armazenam apenas `propertyId`, `serviceOrderId`, `type`, `file (Blob)`, `filename`, `mimeType`, `status`, `attempts`, `createdAt` e `errorMessage`.
- `propertyId` e `serviceOrderId` sao obrigatorios no `enqueue()` — rejeitar sem eles.
- Sync so e iniciada se `getToken()` retornar um token valido (usuario autenticado com sessao ativa).
- `clearOfflineQueue()` deve ser chamado no logout para remover todos os Blobs do dispositivo.
- Sync e foreground-only: o service worker nao tem acesso ao token em memoria, portanto Background Sync API nao e usada para uploads autenticados.
- Nao expor itens da fila em respostas de API ou logs.

## OCR de etiqueta tecnica (label-ocr)

O endpoint `POST /properties/:propertyId/inventory/:itemId/label-ocr` aceita imagem de etiqueta tecnica de equipamento e retorna sugestoes de campos extraidos pela IA.

Regras de seguranca:

- Validar `tenantId`, `propertyId` e `itemId` antes de enviar qualquer dado para a IA — item de outro tenant retorna 404.
- A IA nunca salva automaticamente: o endpoint retorna apenas `{ extraction: LabelExtractResult }`. O usuario deve revisar e confirmar antes de chamar o PUT de update.
- `rawExtractedText` nao e incluido no audit log (`newData`) — pode conter texto arbitrario do produto, dados pessoais ou informacoes de identificacao sensivel da etiqueta.
- O audit log registra apenas `{ confidence, fields_found }` — metadados de qualidade da extracao, sem dados de conteudo.
- Arquivo enviado deve ter MIME de imagem (`image/jpeg`, `image/png`, `image/webp`) e tamanho > 0 — rejeitado com 422 (`INVALID_FILE_TYPE` ou `EMPTY_FILE`) caso contrario.
- Falha da IA retorna 503 (`AI_ERROR`) sem registrar audit log — nenhum dado a auditar.
- O arquivo de imagem nao e salvo em R2 pelo endpoint de OCR — e descartado apos inferencia.
- A imagem e enviada em bytes (`Uint8Array`) diretamente ao binding `env.AI` — nunca a uma API externa de terceiros.

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
