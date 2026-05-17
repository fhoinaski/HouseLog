# TECH_DEBT_REGISTER.md - HouseLog

## 1. Objetivo

Este documento registra debitos tecnicos concretos identificados durante as refatoracoes recentes do HouseLog.

O objetivo nao e listar ideias genericas. O objetivo e manter um registro operacional, revisavel e priorizavel para orientar as proximas fases do roadmap sem perder contexto.

Este registro deve ser lido em conjunto com:

- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/ARCHITECTURE_TARGET.md`
- `docs/SECURITY_REVIEW.md`
- `docs/BOUNDARY_MAP.md`
- `docs/adr/ADR-001-private-platform-not-marketplace.md`
- `docs/adr/ADR-003-provider-network-curated.md`
- `docs/adr/ADR-004-credentials-are-auditable-secrets.md`
- `docs/adr/ADR-005-architecture-evolves-to-multi-tenant.md`

---

## 2. Criterios de classificacao

### Severidade

- **Critica**: pode bloquear escala, seguranca, isolamento, venda premium ou confianca operacional.
- **Alta**: risco relevante para evolucao do produto, governanca ou manutencao.
- **Media**: atrito real de manutencao, UX, consistencia ou confiabilidade.
- **Baixa**: melhoria incremental sem risco imediato.

### Status

- **Aberto**: ainda precisa de correcao.
- **Mitigado parcialmente**: existe contencao ou refatoracao inicial, mas o debito permanece.
- **Mitigado**: correcao aplicada no escopo auditado, com protecao para reduzir regressao.
- **Monitorar**: nao exige acao imediata, mas pode voltar a crescer.

---

## 3. Registro de debitos

### TD-001 - Encoding inconsistente em arquivos do frontend

- **Severidade**: Media
- **Area**: Frontend / Manutencao
- **Status**: Mitigado
- **Evidencia**: auditoria em `house-log-front/src`, documentacao critica e `packages/contracts` encontrou e corrigiu mojibake em `house-log-front/src/app/(app)/properties/[id]/documents/[documentId]/ingestion/page.tsx`; foi adicionado `npm run check:encoding` para alertar sobre sequencias criticas de encoding em arquivos de texto.
- **Impacto**: a ocorrencia critica encontrada foi corrigida e a verificacao reduz risco de regressao em copy de produto, documentacao e revisao tecnica.
- **Recomendacao**:
  - rodar `npm run check:encoding` em revisoes com alteracao de copy ou documentacao;
  - adicionar `npm run check:encoding` ao CI quando o pipeline for criado;
  - evitar novas alteracoes com texto corrompido;
  - manter monitoramento de textos ASCII herdados e revisar apenas quando houver melhoria editorial planejada.
- **Relacionamento com roadmap/ADRs**: Fase 1 e Fase 5 do roadmap; suporte ao The Architectural Lens e consistencia editorial.

---

### TD-002 - `documentsApi.upload` tem tratamento de erro fraco

- **Severidade**: Media
- **Area**: Frontend / API Client / Documentos
- **Status**: Aberto
- **Evidencia**: `house-log-front/src/lib/api/documents.ts` preserva upload via `fetch(...).then((r) => r.json())`, sem checar `res.ok` nem normalizar erro como `request<T>`.
- **Impacto**: falhas de upload podem aparecer como erro generico, JSON invalido ou estado inconsistente; prejudica suporte e UX em acervo documental.
- **Recomendacao**:
  - criar helper interno para upload multipart autenticado;
  - manter contrato de API, mas padronizar erro no cliente;
  - aplicar o mesmo padrao depois em uploads de inventario, OS e auditoria.
- **Relacionamento com roadmap/ADRs**: Fase 5 e Fase 6 do roadmap; area de documentos como acervo tecnico do imovel.

---

### TD-003 - Exclusao de documento sem confirmacao explicita

- **Severidade**: Media
- **Area**: Frontend / UX / Governanca documental
- **Status**: Aberto
- **Evidencia**: a tela `/properties/[id]/documents` chama `documentsApi.delete` diretamente a partir da acao de remover documento.
- **Impacto**: risco de remocao acidental de evidencia tecnica, nota, manual, contrato ou documento com valor operacional.
- **Recomendacao**:
  - adicionar dialog de confirmacao antes da exclusao;
  - exibir titulo/tipo do documento antes de confirmar;
  - considerar motivo de exclusao em etapa futura se o backend evoluir para auditoria documental mais formal.
- **Relacionamento com roadmap/ADRs**: Fase 2 e Fase 5 do roadmap; `SECURITY_REVIEW.md` em Files e Audit.

---

### TD-004 - Revelacao de credencial usava `GET` mesmo sendo acao sensivel e auditavel

- **Severidade**: Alta
- **Area**: Backend / Seguranca / Credenciais
- **Status**: Mitigado
- **Evidencia**: `house-log-back/apps/api/src/routes/credentials.ts` usa `POST /properties/:propertyId/credentials/:credId/reveal` como unico caminho funcional de revelacao. `GET /properties/:propertyId/credentials/:credId/secret` e `POST /properties/:propertyId/credentials/:credId/secret/reveal` nao possuem handler funcional. O frontend consome `credentialsApi.revealSecret` com `POST /reveal`.
- **Impacto**: a semantica de action sensivel ficou explicita, com body validado, motivo obrigatorio e audit log sem segredo.
- **Recomendacao**:
  - nao reintroduzir fallback para `GET /secret` ou `POST /secret/reveal`;
  - manter testes de regressao para o endpoint unico `POST /reveal`;
  - evoluir policy granular sem alterar a garantia de que listagens nao retornam segredo.
- **Relacionamento com roadmap/ADRs**: Fase 2; ADR-004.

---

### TD-005 - Permissao de revelacao de segredo ainda nao tem policy granular

- **Severidade**: Critica
- **Area**: Backend / Authorization Core / Credenciais
- **Status**: Mitigado
- **Mitigado em**: 2026-05-16
- **Evidencia**: policy granular implementada com as seguintes garantias:
  - reveal é POST explícito (`POST /:credId/reveal`) — nenhum GET retorna segredo;
  - `reason` obrigatório server-side: `z.string().trim().min(10).max(500)` em `credentialRevealSchema`;
  - `serviceOrderId` opcional no body — registrado no audit log quando fornecido;
  - caminho de provider: `canProviderRevealCredential` valida OS via `tenantId + propertyId + assignedTo + status IN ('approved','in_progress')` antes de liberar reveal;
  - provider só revela se `share_with_os=true` na credencial;
  - tenant `manager` bloqueado intencionalmente no reveal (documentado em `tenant-authorization.ts`);
  - `has_secret` corrigido para refletir presença real do segredo (`!= null && !== ''`);
  - audit log registra `reason`, `category`, `label`, `service_order_id` — nunca o plaintext;
  - rate limit: 10 reveals/hora por userId;
  - `tenantId` nunca vem do body — sempre do contexto autenticado.
- **Status original**: Mitigado parcialmente — existia `canRevealCredential` mas sem path de provider, sem serviceOrderId, sem max em reason e com has_secret hardcoded.
- **Risco residual**: sem MFA/TTL visual de reveal; provider não consegue revelar credenciais de OS em `requested` (pré-aprovação) — comportamento intencional.
- **Arquivos alterados**:
  - `packages/contracts/src/schemas/credential.ts` — reason max(500), serviceOrderId opcional
  - `apps/api/src/lib/authorization.ts` — `canProviderRevealCredential` + `PROVIDER_REVEAL_ALLOWED_STATUSES`
  - `apps/api/src/routes/credentials.ts` — provider path, has_secret fix, serviceOrderId no audit
  - `apps/api/src/lib/tenant-authorization.ts` — comentário G4 (tenant manager bloqueado)
  - `apps/api/src/routes/credential-reveal-provider.test.ts` — testes TD-005 fase 2
- **Nota sobre status de OS**: o usuário especificou `accepted`/`scheduled`/`in_progress`; o schema real usa `approved`/`in_progress` (não existe status `accepted` nem `scheduled` — `scheduledAt` é timestamp, não status). Mapeamento: `accepted → approved`, `scheduled` sem equivalente direto (omitido).
- **Relacionamento com roadmap/ADRs**: Fase 2 e Fase 3; ADR-004 e ADR-005.

---

### TD-006 - `_core.ts` pode virar novo monolito do cliente de API

- **Severidade**: Media
- **Area**: Frontend / Arquitetura / API Client
- **Status**: Monitorar
- **Evidencia**: a modularizacao de `src/lib/api.ts` criou `src/lib/api/_core.ts` para remover dependencia ciclica entre facade e modulos de dominio. O arquivo agora concentra helpers e tipos compartilhados dos dominios extraidos.
- **Impacto**: se novos dominios continuarem despejando tipos e utilitarios em `_core.ts`, o debito original de `api.ts` pode reaparecer em outro arquivo.
- **Recomendacao**:
  - manter `_core.ts` restrito a HTTP, auth token, query string e tipos realmente transversais;
  - mover tipos de dominio para arquivos especificos conforme cada modulo amadurecer;
  - impedir que `_core.ts` importe dominios;
  - revisar tamanho e responsabilidades a cada nova extracao.
- **Relacionamento com roadmap/ADRs**: Fase 6 do roadmap; Boundary Architecture.

---

### TD-007 - Alias legado `marketplaceApi` removido

- **Severidade**: Media
- **Area**: Produto / Frontend / Provider Network
- **Status**: Mitigado
- **Evidencia**: auditoria confirmou que nao havia consumidores reais de `marketplaceApi`; o alias legado foi removido de `house-log-front/src/lib/api.ts` e o frontend mantem apenas `providerNetworkApi`.
- **Impacto**: nomes legados deixam de ser exportados pelo barrel publico do frontend, reduzindo risco de novas implementacoes desalinhadas com rede homologada, elegibilidade e operacao privada.
- **Recomendacao**:
  - manter novos consumidores usando `providerNetworkApi`;
  - evitar reintroduzir nomenclatura de marketplace aberto no frontend.
- **Relacionamento com roadmap/ADRs**: Fase 4; ADR-001 e ADR-003.

---

### TD-008 - Componentes e telas ainda parcialmente heterogeneos

- **Severidade**: Media
- **Area**: Frontend / Design System / UX
- **Status**: Mitigado parcialmente
- **Evidencia**: varias telas foram refatoradas para `AppShell`, `PageHeader`, `PageSection`, `MetricCard`, `ServiceOrderCard`, `EmptyState`, `PropertySummaryCard` e `ActionTile`, mas ainda ha areas com composicao local, cards antigos, copy heterogenea e tokens aplicados de forma desigual.
- **Impacto**: aumenta custo de manutencao, dificulta consistencia mobile e enfraquece a narrativa visual premium do produto.
- **Mitigacao aplicada (2026-05-17)**:
  - Provider service detail (`/provider/services/[serviceId]`): adicionado `OfflineSyncStatus` + barra de acoes em campo (botao Enviar evidencia com fila offline), exibicao de `after_photos`, checklist read-only com progresso, imagens clicaveis migradas de `img onClick` para `button` + `img alt=""`.
  - ServiceChat (`components/services/service-chat.tsx`): adicionado `aria-label` acessivel via `aria-labelledby` na Textarea, padding seguro para teclado virtual (`pb-[env(safe-area-inset-bottom,0px)]`), estado `forbidden` com mensagem explicita e `disabled` no composer, `aria-label` no botao de envio.
  - Provider dashboard (`/provider/dashboard`): separados estados de loading (skeleton), erro (mensagem + retry) e vazio real; metricas nao exibem zero silencioso em erro.
  - Oportunidades (`/provider/opportunities`): chips de filtro receberam `aria-pressed` e `role="group"` acessivel.
  - Settings (`/provider/settings`): chips de hard skills receberam `aria-pressed`.
- **Upload de evidencia pelo prestador (resolvido 2026-05-17)**: criada rota dedicada `POST /provider/services/:id/photos` em `apps/api/src/routes/provider.ts` com `canUploadProviderEvidence` (requer `assigned_to === userId` + status `approved`|`in_progress`). A rota opera com `accessLevel` equivalente a `assigned_service`, sem tocar `canManageProperty`. Audit log registrado sem R2 key. Frontend deve re-habilitar botao de envio de evidencia via offline queue apontando para a nova rota.
- **Hardening adicional do upload provider (2026-05-17)**: o frontend provider passou a usar `providerApi.uploadEvidence` online e a fila `houselog-oq` apenas offline/falha de rede; o backend passou a retornar evidencias do detalhe provider como URLs autenticadas `/provider/services/:id/media/*` e a expor `can_upload_evidence`. A rota de midia provider valida `tenantId + serviceId + assignedTo + propertyId` e key registrada na OS, sem R2 key bruta ou signed URL.
- **HouseLog Calm OS base (2026-05-17)**: tokens globais `--hl-*` foram adicionados de forma aditiva em `house-log-front/src/app/tokens.css`, expostos ao Tailwind em `globals.css` e documentados em `docs/design/house-log-calm-os.md`; `/provider/dashboard` virou tela piloto clara, sem migracao global.
- **Provider services Calm OS (2026-05-17)**: `/provider/services` foi migrada para Calm OS com cards Link mobile-first, filtros acessiveis, loading skeleton, erro com retry, vazio real e aviso de offline sem alterar API.
- **Calm OS shell (2026-05-17)**: `AppShell` passou a aplicar o wrapper explicito `.hl-calm-os`; top nav, bottom nav e property mobile nav usam navegacao clara sem depender do seletor `:has()` do piloto.
- **Provider service detail Calm OS (2026-05-17)**: `/provider/services/[serviceId]` foi migrada parcialmente para Calm OS em loading/error, detalhes, checklist, evidencias e historico de propostas sem alterar upload, chat, fila offline ou API.
- **Provider opportunities/settings Calm OS (2026-05-17)**: `/provider/opportunities`, `/provider/opportunities/[serviceId]` e `/provider/settings` foram migradas parcial ou integralmente para Calm OS preservando proposta, chat, formularios e contratos.
- **Shared visual variants Calm OS (2026-05-17)**: `visual-system.ts` migrou PageSection, MetricCard, ActionTile, ServiceOrderCard, PropertySummaryCard, EmptyState e ChatPanel para surface branca, borda suave e sombra discreta, reduzindo heterogeneidade em owner/manager sem alterar logica.
- **Owner entry Calm OS (2026-05-17)**: dashboard owner/manager e lista de imoveis receberam base Calm OS em surfaces, cards e reducao de overlays dark/glass sem alterar APIs.
- **Recomendacao**:
  - continuar refatoracao incremental por rota;
  - re-habilitar botao de upload de evidencia no service detail do provider (frontend) apos validacao da nova rota backend;
  - registrar componentes consolidados no guia operacional;
  - evitar criar componentes paralelos quando um estrutural existente resolve.
- **Relacionamento com roadmap/ADRs**: Fase 5; ADR-002.

---

### TD-009 - Ausencia de multi-tenant real (mitigado parcialmente)

- **Severidade**: Critica
- **Area**: Arquitetura / Backend / Produto / Seguranca
- **Status**: Mitigado parcialmente
- **Evidencia**: a arquitetura atual ainda opera principalmente por usuario, propriedade e roles simples; `ARCHITECTURE_TARGET.md` e ADR-005 definem evolucao para tenant, organizacao, memberships e isolamento formal.
- **Impacto**: limita escala B2B, construtoras, administradoras, portfolios independentes, redes homologadas por organizacao e isolamento forte de dados.
- **Mitigação aplicada (base multi-tenant concluída)**:
  - `tenants` e `tenant_members` criadas e populadas (0014).
  - `tenant_id` presente e NOT NULL (DDL) em 19 tabelas críticas após 0033.
  - `resolveTenant` middleware em todas as rotas autenticadas; rejeita 400 sem membership ativo.
  - Backfill completo de dados legados via 0032; scripts de diagnóstico e relatório de órfãos disponíveis.
  - Isolamento cross-tenant testado e funcional (routes/tenant-isolation.test.ts, routes/idor-isolation.test.ts).
  - Schema Drizzle consistente com DDL em todas as tabelas críticas.
- **Pendente (próximas fases)**:
  - `organization_id` dentro de um tenant (sub-unidades, carteiras, regionais).
  - Memberships com escopo por organization.
  - Provider scopes homologados por tenant.
  - Frontend alinhado a contexto organizacional.
  - Nenhuma dessas fases deve introduzir migração destrutiva sem plano e checklist.
- **Relacionamento com roadmap/ADRs**: Fase 7; ADR-005.

---

### TD-010 - Authorization Core completo ainda nao existe no backend

- **Severidade**: Critica
- **Area**: Backend / Seguranca / Boundary Architecture
- **Status**: Mitigado parcialmente
- **Evidencia (2026-05-16 — auditoria TD-010 Phase 1+2)**:

  **Auditoria Phase 1 — funcoes existentes:**
  - `tenant-authorization.ts`: `canUseTenantPropertyAccess` (pura), `canAccessTenantProperty` (DB-backed), `listAccessibleTenantPropertyIds`
  - `authorization.ts`: 50+ funcoes cobrindo property, service order, documents, credentials, provider, share, search e audit log
  - As funcoes retornam ou `TenantScopedDecision` (union discriminada com status/code) ou `boolean`; inconsistencia de tipo e interna ao modulo

  **Rotas ja usando authorization.ts:** documents.ts, rooms.ts (via `requireTenantPropertyAccess`), properties.ts (via `assertPropertyAccess`), share.ts (pos-migracao)

  **Gaps confirmados na auditoria:**
  1. `canCreateShareLink` — AUSENTE, implementado inline em share.ts (CORRIGIDO nesta sessao)
  2. `canUserOpenOS` em `middleware/auth.ts` — duplica logica de `canCreateServiceOrder`; dead code
  3. "Legacy paths" sem tenantId em `canAccessProperty`, `canCreateServiceOrder`, `canCreateServiceRequest` — inalcancaveis via middleware mas compilam sem isolamento
  4. `properties.ts GET /` — usa SQL inline para listar properties acessiveis em vez de `listAccessiblePropertyIds`

  **Phase 2 — correcoes aplicadas (2026-05-16):**
  - Adicionado `canCreateShareLink` em `authorization.ts` com dois gates: manage-level property access + verificacao de que a OS pertence ao tenant+property
  - `share.ts` migrado: substituiu `assertPropertyAccess` + check inline por chamada unica a `canCreateShareLink`
  - Criado `routes/share-idor.test.ts` com 4 testes: cross-tenant IDOR (404), cross-property IDOR (404), collaborator viewer (403), criacao autorizada (201)

  **Phase 2 controlada — delta (2026-05-17):**
  - Adicionado `canAccessDocument` em `authorization.ts` com gates `tenantId + propertyId + documentId` e validacao da cadeia de `serviceOrderId` quando o documento esta vinculado a OS.
  - `documents.ts` migrado em rotas P0 de leitura/download/OCR para usar `canAccessDocument`.
  - `properties.ts GET /` migrado para `listAccessiblePropertyIds`, removendo a decisao inline de propriedades acessiveis.
  - `handover-checklist-items.ts` passou a ler referencias opcionais com `tenantId + propertyId + resourceId`, evitando fetch inicial por id isolado.
  - Criado `lib/authorization-document.test.ts` com cobertura de documento autorizado, OS fora da cadeia tenant/property e property cross-tenant.

  **Phase 3 incremental — residuos removidos (2026-05-17):**
  - Removido `canUserOpenOS` de `middleware/auth.ts` por dead code comprovado.
  - `canAccessProperty`, `canCreateServiceOrder` e `canCreateServiceRequest` deixaram de manter fallback legado sem tenant; agora delegam apenas ao helper tenant-aware e negam quando `tenantId`/`tenantRole` ausente.
  - Criado `lib/authorization-core.test.ts` com cobertura de caminho autorizado, sem permissao, cross-tenant, property invalida e ausencia de tenant sem query legada.

  **Phase 3 incremental — Inventory IDOR (2026-05-17):**
  - `routes/inventory.ts` passou a repetir `tenantId + propertyId + itemId + deletedAt IS NULL` nas mutacoes finais de update/delete e nos updates de foto/QR.
  - Selects pos-mutacao passaram a buscar por `id + tenantId + propertyId + deletedAt IS NULL`, mantendo a pre-validacao existente e sem alterar contrato publico.
  - Criado/ajustado `routes/inventory-idor.test.ts` com cobertura de update autorizado, update cross-tenant, update cross-property, delete cross-property, select pos-update sem retorno fora do property, foto e QR.
  **Phase 3 incremental - Rooms write IDOR (2026-05-17):**
  - `rooms.ts` passou a aplicar `id + tenantId + propertyId` tambem nos writes finais de PUT e DELETE; `routes/tenant-isolation.test.ts` cobre PUT/DELETE autorizado, cross-property e cross-tenant.

  **Phase 3 incremental — Renovations reference IDOR (2026-05-17):**
  - `routes/renovations.ts` passou a ler referencias vinculaveis (`room`, `service_order`, `document`) diretamente por `referenceId + tenantId + propertyId`, alinhado ao padrao de warranties.
  - `canLinkRenovationReference` foi mantido como decisao defensiva apos a leitura escopada.
  - Criado `routes/renovations-reference-idor.test.ts` com cobertura de referencia autorizada, outro tenant, outro imovel no mesmo tenant, referencia inexistente e update com referencia invalida.

  **Phase 3 incremental — nested route residuals (2026-05-17):**
  - `rooms.ts`: writes finais de PUT/DELETE mantem `id + tenantId + propertyId` e agora tambem repetem `deletedAt IS NULL`.
  - `renovations.ts`: select pos-update e delete final repetem `id + tenantId + propertyId + deletedAt IS NULL`; `readReference` ja busca referencias por `id + tenantId + propertyId`.
  - `expenses.ts`: update final, select pos-update e delete final repetem `expenseId + tenantId + propertyId + deletedAt IS NULL`.
  - Criado `routes/expenses-idor.test.ts` com cobertura de update autorizado, cross-tenant, cross-property, recurso inexistente e select pos-update sem retorno fora do property.

- **Impacto residual**: os residuos confirmados de nested routes em Rooms, Inventory, Renovations e Expenses foram endurecidos sem alterar contratos publicos. Permanece risco de regressao se novos endpoints nao repetirem `tenantId + propertyId + resourceId` nas mutacoes/selects finais; rotas com `assertPropertyAccess` inline ainda devem ser migradas gradualmente para helpers de action quando houver mudanca no modulo.
- **Recomendacao**:
  - padronizar retorno de authorization.ts para `TenantScopedDecision` em vez de `boolean` onde aplicavel;
  - cobrir `canBidOnOpportunity` com DB validation se oportunidades forem ativadas.
  - migrar autorizacoes inline restantes por modulo, priorizando documentos, financas, inventario e propriedades.
- **Relacionamento com roadmap/ADRs**: Fase 3; `SECURITY_REVIEW.md`, ADR-003, ADR-004 e ADR-005.

---

### TD-011 - Search possui policy formal por campo sensivel

- **Severidade**: Media
- **Area**: Backend / Search / Seguranca
- **Status**: Mitigado
- **Evidencia**: `house-log-back/apps/api/src/lib/search-field-policy.ts` define `SEARCH_FIELD_POLICY` com campos permitidos, proibidos/sensiveis, nota por entidade e exigencia de tenant scope. `routes/search.ts` usa essa policy sem ampliar escopo: OS segue em `title/system_type`, documentos seguem em `title`, OCR e descricoes livres continuam fora, e credenciais/segredos nao entram em search.
- **Impacto**: novos campos ou indices passam a ter barreira explicita e testavel antes de expor metadados sensiveis por inferencia.
- **Recomendacao**:
  - manter credenciais e segredos fora de search;
  - so reintroduzir OCR com policy documental explicita por tipo, origem e sensibilidade;
  - atualizar `SEARCH_FIELD_POLICY` e seus testes antes de qualquer novo campo pesquisavel;
  - considerar tenant/organization antes de search dedicado.
- **Relacionamento com roadmap/ADRs**: Fase 3 e Fase 7; Authorization Core, AI-ready checklist e ADR-005.

---

### TD-012 - Deploy Cloudflare e CI ainda dependem de configuracao final de producao

- **Severidade**: Critica
- **Area**: Deploy / Operacao / Cloudflare
- **Status**: Mitigado parcialmente
- **Evidencia**: `wrangler.toml` foi separado para usar D1, KV, R2 e queues distintos entre dev e production; o bug de filas foi corrigido; secrets sensiveis sairam do arquivo versionado; arquivos `.wrangler/` foram removidos do indice do git; `.github/workflows/ci.yml` e `npm run check:deploy-config` foram adicionados. Production ainda usa placeholders invalidos intencionais para D1/KV ate os recursos reais serem criados manualmente.
- **Evidencia adicional (2026-05-17)**: `npm run check:deploy-config` passa para CI/local com avisos; `npm run check:deploy-config:prod` falha corretamente enquanto D1/KV production usam placeholders. `wrangler.toml` nao contem secrets sensiveis; IDs/URLs reais de dev/staging sao identificadores de infraestrutura, nao credenciais. `docs/deploy/CLOUDFLARE_DEPLOY_CHECKLIST.md` e `docs/deployment-cloudflare.md` documentam a ordem manual para production antes de liberar deploy.
- **Impacto**: a configuracao perigosa que misturava dev/prod foi bloqueada, mas production ainda nao deve receber deploy ate substituir placeholders por IDs reais e cadastrar secrets via `wrangler secret put`.
- **Recomendacao**:
  - criar D1/KV/R2/queues reais de production;
  - substituir placeholders invalidos no `wrangler.toml`;
  - cadastrar secrets por ambiente com `wrangler secret put`;
  - rodar `npm run check:deploy-config:prod` antes de qualquer deploy;
  - manter `.wrangler/`, `.wrangler/cache/` e `wrangler.log` fora do git.
- **Relacionamento com roadmap/ADRs**: Sprint 1 e Sprint 2 do masterplan; seguranca operacional para MVP privado premium.

---

## 4. Priorizacao recomendada

### Curto prazo

1. TD-012 - concluir IDs reais/secrets de producao e validar `check:deploy-config:prod`.
2. TD-010 - desenhar e iniciar Authorization Core.
3. TD-003 - adicionar confirmacao de exclusao documental.
4. TD-002 - padronizar erro de upload multipart.

### Medio prazo

1. TD-009 - iniciar base multi-tenant incremental.
2. TD-007 - manter nomenclatura `providerNetworkApi` sem alias legado.
3. TD-008 - seguir consolidacao visual por rota.
4. TD-011 - evoluir allowlist local de search antes de novos indices.
5. TD-001 - automatizar verificacao de encoding.

### Monitoramento continuo

1. TD-006 - revisar crescimento de `_core.ts` a cada nova modularizacao.

---

---

### TD-013 - Refresh token em localStorage (mitigado)

- **Severidade**: Critica
- **Area**: Backend / Frontend / Segurança / Sessão
- **Status**: Mitigado
- **Evidencia**: refresh token era retornado no body de login/register/mfa e salvo em `localStorage` (`hl_refresh`). `/auth/refresh` e `/auth/logout` aceitavam `refresh_token` pelo body. Qualquer XSS podia roubar a sessão.
- **Mitigação aplicada (P0-AUTH-SESSION-01)**:
  - Backend agora seta `houselog_refresh` em cookie `HttpOnly; SameSite=Lax; Path=/api/v1/auth; Secure (prod)`.
  - Refresh token nunca retorna no JSON body.
  - `/auth/refresh` lê exclusivamente do cookie via `getCookie()` (Hono).
  - `/auth/logout` revoga pelo cookie e limpa com `Set-Cookie: Max-Age=0`.
  - Frontend removeu `hl_refresh` do localStorage em `storage.ts` e `auth-context.tsx`.
  - `credentials: 'include'` adicionado ao fetch global para envio automático do cookie.
  - Testes: `routes/auth-session.test.ts` cobre login/register/refresh/logout.
- **Mitigação adicional (P0-AUTH-SESSION-02, 2026-05-13)**:
  - `storage.ts` moveu access token de `localStorage` para variável de módulo em memória (`let _accessToken`). `setToken` / `getToken` / `clearToken` não tocam mais `localStorage`.
  - `clearLegacyAuthStorage()` adicionado: remove `hl_token` e `hl_refresh` legados; chamado no boot do `AuthProvider`.
  - `AuthProvider` bootstrapa via cookie HttpOnly em **toda** inicialização (sem atalho por `localStorage`). User profile (`hl_user`) mantido em `localStorage` apenas para UI otimista.
  - `session.ts` ganhou `refreshAccessToken()` (deduplicação via promise compartilhada) e `shouldAttemptRefresh()`.
  - `http.ts` agora faz retry silencioso em 401: tenta refresh antes de redirecionar para `/login`.
  - Testes novos em `auth-session.test.ts`: CORS real (`buildCorsOriginHandler`) + bloco "Armazenamento — refresh_token jamais exposto no body".
  - `SECURITY.md` atualizado para refletir access token em memória como estado atual.
- **Mitigação adicional (TD-013 — 2026-05-16)**:
  - `APP_ORIGIN` e `API_ORIGIN` adicionados ao tipo `Bindings` e ao `wrangler.toml` por ambiente.
  - `validateProductionConfig()` em `apps/api/src/lib/env-validation.ts` lança erro fatal no startup se `APP_ORIGIN` ou `API_ORIGIN` estiverem ausentes em `ENVIRONMENT=production`.
  - `cors.ts` atualizado: `APP_ORIGIN` é automaticamente incluído no allowlist de CORS além de `CORS_ORIGINS`.
  - Produção configurada com `APP_ORIGIN=https://app.houselog.app` e `API_ORIGIN=https://api.houselog.app`.
  - Testes em `apps/api/src/lib/env-validation.test.ts` cobrem: ausência de APP_ORIGIN/API_ORIGIN em production (lança), ausência em dev/staging (não lança), string vazia, APP_ORIGIN no allowlist CORS, sem wildcard, sem localhost em production.
  - `docs/SECURITY.md` atualizado com política de custom domain.
  - `.dev.vars.example` documenta APP_ORIGIN e API_ORIGIN com valores para dev.
- **Risco restante**:
  - Custom domain `app.houselog.app` e `api.houselog.app` precisam ser configurados no painel Cloudflare e na Vercel antes do deploy de produção.
  - Sem CSRF tokens — `SameSite=None` não é opção segura (correto manter `Lax`).
- **Relacionamento com roadmap**: Sprint 3 do HOUSELOG_EXECUTION_MASTERPLAN.md.

---

### TD-014 - tenant_id nullable nas tabelas principais (mitigado)

- **Severidade**: Critica
- **Area**: Backend / Multi-tenant / Isolamento de Dados
- **Status**: Mitigado
- **Evidencia**: migration `0014_tenant_foundation.sql` adicionou `tenant_id` nullable em 20 tabelas e fez backfill dos dados legados via `owner_id → tenant_members`. Novas tabelas criadas após 0014 (`technical_systems`, `technical_points`, `warranties`, `renovations`, `handover_packages`, `handover_checklist_items`, `document_ingestion_jobs`, etc.) já usam `NOT NULL`. Migration `0032_tenant_backfill_and_null_guards.sql` completou o backfill de produção e adicionou triggers que bloqueiam INSERT/UPDATE com tenant_id NULL nas 19 tabelas críticas. Migration `0033_tenant_not_null.sql` aplica o constraint NOT NULL real no DDL via recriação de tabela.
- **Mitigação aplicada (P0-TENANT-BACKFILL-01)**:
  - Todas as rotas autenticadas usam `resolveTenant` middleware — rejeita com 400 `TENANT_REQUIRED` se não houver membership ativo.
  - Todos os handlers de criação (rooms, services, expenses, credentials, documents, audit-links, invites, maintenance, service-requests, bids, renovations, warranties, handover) injetam `tenantId` do contexto no INSERT.
  - Scripts de diagnóstico e backfill em `apps/api/src/db/backfill/`:
    - `phase_a_diagnostic.sql` — relatório de `tenant_id IS NULL` por tabela (somente-leitura).
    - `phase_b_safe_backfill.sql` — backfill idempotente: preenche apenas registros `NULL` a partir do parent.
    - `phase_c_orphan_report.sql` — relatório de órfãos pós-backfill.
  - Helpers puros: `lib/backfill-diagnostics.ts` (`resolveChildTenant`, `resolvePropertyTenant`, `BACKFILL_STRATEGIES`, `CRITICAL_NULLABLE_TENANT_TABLES`).
  - Testes: `lib/backfill-diagnostics.test.ts`, `lib/tenant-authorization.test.ts`, `lib/room-tenant.test.ts`, `lib/service-tenant.test.ts`, `lib/expense-tenant.test.ts` e outros por domínio. `routes/tenant-isolation.test.ts`, `routes/tenant-not-null.test.ts` (Fase D).
- **Mitigação aplicada (Fase D — 0033)**:
  - Migration `0032_tenant_backfill_and_null_guards.sql`: backfill completo com `SELECT changes()` por tabela + triggers BEFORE INSERT/UPDATE bloqueando NULL em 19 tabelas críticas. `audit_log` permanece nullable (eventos globais sem tenant scope são legítimos).
  - Migration `0033_tenant_not_null.sql`: recriação de 19 tabelas com DDL `NOT NULL` em `tenant_id`. Padrão `CREATE new → INSERT FROM old → DROP old → RENAME`. PRAGMA foreign_keys OFF durante a operação + foreign_key_check ao final. Triggers de 0032 descartados automaticamente ao DROP; constraint DDL substitui enforcement por trigger.
  - Schema Drizzle `schema.ts`: `.notNull()` declarado em todas as 19 tabelas desde a migração de schema (consistente com o DDL após 0033).
  - `routes/tenant-not-null.test.ts`: 14 testes cobrindo consistência estrutural, idempotência, decisões de backfill, enforcement de camada de aplicação, relatório de órfãos e invariantes de BACKFILL_STRATEGIES.
- **Risco restante**:
  - `audit_log.tenant_id` permanece nullable por design — eventos de autenticação global (login_failed, token_refreshed) não têm tenant scope.
  - Registros irresolvíveis (orphaned) identificados pelo `phase_c_orphan_report.sql` precisam de triagem manual por operador; não foram apagados automaticamente.
- **Comandos de execução em produção**:
  ```bash
  # 1. Confirmar precondições (deve retornar null_tenant = 0 em todas as tabelas)
  wrangler d1 execute houselog-db --command "$(cat apps/api/src/db/backfill/phase_a_diagnostic.sql)"
  # 2. Backup
  wrangler d1 export houselog-db > backup_$(date +%Y%m%d_%H%M).sql
  # 3. Aplicar migration
  wrangler d1 migrations apply houselog-db
  # 4. Verificar integridade
  wrangler d1 execute houselog-db --command "PRAGMA foreign_key_check;"
  ```
- **Relacionamento com roadmap/ADRs**: Sprint 4; ADR-005 (multi-tenant incremental); TD-009.

---

### TD-015 - Tokens de links públicos em plaintext (mitigado)

- **Severidade**: Critica
- **Area**: Backend / Segurança / Links Públicos
- **Status**: Mitigado
- **Evidencia**: `audit_links`, `service_share_links` e `property_invites` armazenavam o token puro (`nanoid`) em `TEXT` legível e faziam lookup direto por valor plaintext. Qualquer leitura do banco (dump, log, acesso indevido a D1) expunha tokens válidos.
- **Mitigação aplicada (P0-PUBLIC-LINKS-HASH-01, 2026-05-12)**:
  - Migration `0027_public_link_token_hash.sql`: adiciona `token_hash TEXT` e índices nas três tabelas.
  - Schema Drizzle: `tokenHash` adicionado em `auditLinks`, `serviceShareLinks`, `propertyInvites`.
  - `apps/api/src/lib/token-hash.ts`: helper `sha256TokenHash(token)` compartilhado.
  - Novos registros: `token = 'hash-only:<id>'` (satisfaz NOT NULL UNIQUE, não é utilizável para lookup direto); somente `tokenHash` é o segredo persistido.
  - Lookup público: `WHERE (token_hash = ? OR (token_hash IS NULL AND token = ?))` — hash-first, fallback plaintext somente para registros legados sem hash (desativado automaticamente após migration 0028).
  - Token puro gerado em memória, emitido uma única vez na response de criação, nunca persistido nem retornado em listagens.
  - Share link `POST`: sempre cria link novo (revoga o anterior via `deletedAt`); token anterior não é relido do banco.
  - `writeAuditLog` em `share_link_created` e `invite_created` — sem URL completa nem token hash no payload.
  - `sanitizeAuditData` expandido: 14+ campos novos redactados — `inviteToken`, `shareToken`, `auditToken`, `signedUrl`, `privateUrl` e variantes.
  - DTOs públicos: `service_id`, `tenant_id`, `token` removidos dos responses; invite create retorna `invite_url` sem campo `token`.
  - HTTP corretos: 400 (malformado), 404 (não encontrado), 410 (expirado ou revogado) em todos os três domínios.
  - 39 testes: `lib/public-links-hash.test.ts` — sha256, sanitize, audit GET/submit, share GET/PATCH/create, invite GET/listing/create, redaction INSERT, 410 expiry/revoke, invariante hash-only.
  - Migration `0028_redact_token_plaintext.sql`: idempotente, redige plaintext legado após backfill.
  - Script `db/backfill/phase_a_token_hash_backfill.ts`: TypeScript, calcula sha256 em lote por tabela; `verifyNoPlaintextRemaining()` confirma zero pendentes antes de aplicar 0028.
- **Mitigação adicional (2026-05-17)**:
  - `apps/api/src/lib/public-link-rate-limit.ts`: helper de rate limit granular para links publicos usando KV existente, com chave `flow + action + IP + tokenHashPrefix`.
  - `audit-links.ts`: GET publico e submit/upload publico limitados antes do lookup por token.
  - `share.ts`: GET publico e PATCH de status publico limitados antes do lookup por token.
  - `invites.ts`: GET publico passa a limitar por hash do token recebido e usa resposta generica para token curto/inexistente, reduzindo enumeracao.
  - `public-handover.ts`: GET publico e aceite publico limitados por hash do token recebido.
  - Testes: `routes/public-link-rate-limit.test.ts`, ajustes em `lib/public-links-hash.test.ts` e `routes/public-routes-auth.test.ts`; cobertura inclui rate key sem token plaintext, limites GET/mutacao e resposta generica de invite invalido.
- **Risco restante**:
  - Coluna `token TEXT` legada ainda presente nas três tabelas (NOT NULL UNIQUE mantida com valor `hash-only:<id>` ou plaintext para registros pré-existentes sem hash).
  - Backfill (`phase_a_token_hash_backfill.ts`) e migration `0028_redact_token_plaintext.sql` ainda não executados em produção.
  - Enquanto o fallback de lookup plaintext estiver ativo, registros sem `token_hash` ainda são acessíveis por token puro (protegido por expiração e soft delete).
  - Rate limit granular usa Cloudflare KV, não contador atomico; pode subcontar sob concorrencia alta. Durable Object fica como opcao futura se houver abuso real.
- **Próxima etapa (produção)**:
  1. Executar `phase_a_token_hash_backfill.ts` em produção.
  2. Confirmar `verifyNoPlaintextRemaining()` retorna `{ clean: true }` nas três tabelas.
  3. Aplicar `0028_redact_token_plaintext.sql` via `wrangler d1 execute`.
  4. Após 0028, o fallback de lookup plaintext é automaticamente inerte (registros têm `token_hash IS NOT NULL`).
- **Relacionamento com roadmap/ADRs**: Sprint 3; SECURITY.md seção "Tokens de links publicos"; ADR-004.

---

### TD-016 - Identificadores de infraestrutura e URL real em arquivos rastreados (mitigado)

- **Severidade**: Alta
- **Area**: Segurança / Configuração / Infra
- **Status**: Mitigado parcialmente
- **Evidencia** (encontrada em auditoria de secrets 2026-05-14):
  - `house-log-front/src/lib/api/core/config.ts`: URL real `houselog-api-dev.sukinodoncai.workers.dev` hardcoded como fallback — revelava subdomain Cloudflare e roteava silenciosamente builds sem `NEXT_PUBLIC_API_URL` para o Worker dev real.
  - `house-log-back/apps/api/wrangler.toml`: `R2_PUBLIC_URL` com domínio real do bucket dev (`pub-3ff8849…r2.dev`) no bloco `[env.dev.vars]` — contradizia política de R2 privado por padrão (SECURITY.md) e expunha URL do bucket público.
  - `house-log-back/apps/api/.dev.vars.example`: mesma URL R2 real no arquivo de exemplo rastreado.
  - `docs/auth-routing-security.md`: URL real do Worker dev na documentação.
  - `.gitignore` (detectado em auditoria 2026-05-16): padrão `apps/api/.dev.vars` usava caminho relativo errado — não cobria `house-log-back/apps/api/.dev.vars`. Arquivo `.dev.vars` com secrets reais seria commitado silenciosamente se criado.
- **Classificação confirmada**: auditoria recente do histórico Git/infra confirmou que não há secret real versionado (JWT_SECRET, chave de criptografia, API key, VAPID key, token Cloudflare ou chave R2). As ocorrências são identificadores/URLs de infraestrutura: subdomínio `workers.dev` antigo, URL pública R2 dev antiga, D1 dev ID e KV dev IDs antigo/atual. Identificadores de infra não são credenciais de autenticação, mas exigem cuidado porque o repositório é público.
- **Repositório público**: `https://github.com/fhoinaski/HouseLog.git` — múltiplos branches publicados. Todo o histórico com os identificadores está acessível publicamente.
- **Decisão atual (2026-05-17)**: `ROTACIONAR/DESATIVAR RECURSO`. `git filter-repo` não é necessário agora e não deve ser tratado como ação emergencial.
- **Mitigação aplicada (2026-05-14)**:
  - `config.ts`: fallback substituído por `http://localhost:8787/api/v1`.
  - `wrangler.toml`: `R2_PUBLIC_URL` removida do bloco `[env.dev.vars]`; substituída por comentário com placeholder.
  - `.dev.vars.example`: URL real substituída por placeholder `pub-YOUR_HASH.r2.dev`.
  - `docs/auth-routing-security.md`: URL real substituída por `<seu-subdomain>.workers.dev`.
  - `wrangler.toml` production/staging usam placeholders intencionais para D1/KV até provisionamento manual seguro. O bloco `env.dev` atual mantém IDs reais de D1/KV dev, classificados como identificadores de infraestrutura, não secrets.
- **Mitigação adicional (2026-05-16)**:
  - `.gitignore`: padrão corrigido de `apps/api/.dev.vars` para `**/.dev.vars`; negação corrigida para `!**/.dev.vars.example`. Agora cobre `.dev.vars` em qualquer subpasta do repositório.
  - `scripts/check-deploy-config.mjs`: adicionados checks de secret scan — `.dev.vars` versionado, `R2_PUBLIC_URL` hardcoded, account subdomain em `workers.dev`, IDs reais conhecidos.
  - `docs/HISTORY_CLEANUP.md`: plano documentado para `git filter-repo` caso o repositório precise ser aberto sem histórico de identificadores. Não executado.
- **Proteções atuais**:
  - `.gitignore` protege `.dev.vars` com `**/.dev.vars` e mantém apenas exemplos rastreáveis via `!**/.dev.vars.example`.
  - `.dev.vars.example` usa placeholders e não contém secrets reais.
- **Risco restante**:
  - Histórico git contém os identificadores removidos: `sukinodoncai.workers.dev` (commits `0177ca8`, `adcb849`, `e0c050f`, `d1aa1fb`), `pub-3ff8849243ae4ec2b6f124cf71160801.r2.dev` (commit `9b27477`), `62bd81c4`/`30d1ccab` (commits `338b26f` até `90bbc4e`) e KV dev atual (`348ed46bc04c4921a5874a5254957e45`) em `wrangler.toml`.
  - Risco técnico: médio-baixo, porque os itens são resource IDs/URLs e não permitem autenticação sem credenciais Cloudflare.
  - Risco reputacional/processual: médio, porque identificadores reais em histórico público podem gerar questionamento em due diligence, investidor, transferência de repositório ou auditoria formal.
- **Ação recomendada**:
  - Desativar public access ou excluir o bucket R2 dev antigo (`pub-3ff8849...r2.dev`) no painel Cloudflare.
  - Excluir/recriar recursos dev expostos se houver preocupação com enumeração ou vínculo público: D1 dev e KV dev antigo/atual.
  - Manter secret scan e bloqueio de `.dev.vars` versionado.
  - Redigir documentação pública externa se ela não precisar preservar evidências internas.
  - Tratar `git filter-repo` como limpeza opcional, não emergencial. Executar apenas se due diligence/investidor, transferência do repositório ou auditoria formal exigirem histórico limpo, ou se o bucket R2 exposto não puder ser desativado/deletado.
- **Regras de rotação de segredos**:
  - Secrets Cloudflare Workers (`JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `RESEND_API_KEY`, credenciais R2): rotar via `wrangler secret put <KEY> [--env dev]` por ambiente. Nunca gravar em `wrangler.toml`, `.dev.vars` commitado ou código-fonte.
  - `NEXT_PUBLIC_API_URL`: configurar em variáveis de ambiente da plataforma (Vercel environment variables) por ambiente; em dev local, usar `.env.local` (gitignored).
  - Após rotação de qualquer secret: revogar o valor anterior no painel Cloudflare antes de remover do dashboard para evitar janela de acesso duplo.
- **Relacionamento com roadmap/ADRs**: SECURITY.md seção "R2 — Armazenamento privado por padrão"; TD-012; ADR-004.

### TD-017 - Lacunas de audit log em acoes criticas (mitigado)

- **Severidade**: Alta
- **Area**: Seguranca / Rastreabilidade / Produto premium
- **Status**: Mitigado
- **Evidencia** (auditoria de audit log 2026-05-14):
  - `auth.ts`: `logout`, `refresh` (rotacao de token) e `login_failed` (usuario inexistente ou senha incorreta) nao geravam `writeAuditLog`. Eventos de autenticacao criticos para deteccao de brute-force e rastreabilidade de sessao ficavam sem registro.
  - `documents.ts`: `GET /:id/download` nao registrava acesso ao arquivo. Usuarios premium nao tinham trilha de quem baixou quais documentos.
  - `finance.ts`: `POST /pix` (criar cobrança PIX), `POST /pix/:id/mark-paid` (conciliacao) e `POST /nfe` (importar XML) sem registro. Mutacoes financeiras sem rastreabilidade.
  - `service-requests.ts`: criacao e conversao para OS sem registro.
  - `service-request-bids.ts`: aceite de orcamento sem registro.
  - `messages.ts`: criacao e exclusao (soft-delete) de mensagens sem registro.
- **Mitigacao aplicada (2026-05-14)**:
  - `auth.ts`: adicionado `writeAuditLog` para `login_failed` (ambos caminhos: usuario inexistente e senha incorreta), `logout` e `token_refreshed`. Eventos sem tenant ativo registram `tenantId: null` conforme schema permite.
  - `documents.ts`: adicionado `writeAuditLog` com `action: 'document_downloaded'`, `tenantId`, `propertyId` e `actorIp` antes de retornar o stream do R2.
  - `finance.ts`: adicionado import de `writeAuditLog` e chamadas para `pix_charge_created` (com `newData` sem `pix_key`), `pix_mark_paid` e `nfe_imported`. `pix_key` nao persiste no audit log.
  - `service-requests.ts`: adicionado import e `writeAuditLog` em `create` e `convert_to_service` (dentro do bloco try para atomicidade).
  - `service-request-bids.ts`: adicionado import e `writeAuditLog` em `bid_accepted` antes do `return ok()`.
  - `messages.ts`: adicionado import e `writeAuditLog` em `message_created` e `message_deleted`, com `propertyId` extraido do resultado de `loadParticipants`.
- **Testes adicionados**: `src/routes/audit-coverage.test.ts` com 13 testes cobrindo:
  - `login_failed` sem dados sensiveis (user inexistente e senha incorreta)
  - `logout` com `actorId` correto
  - `token_refreshed` sem token bruto no payload
  - `pix_charge_created` com `tenantId` e sem `pix_key`
  - `pix_mark_paid` com `tenantId`
  - `nfe_imported` com `tenantId`
  - `service_request create` com `tenantId` e `propertyId`
  - `bid_accepted` com `tenantId` e `propertyId`
  - `message_created` com `tenantId` e `propertyId`
  - `message_deleted` com `tenantId` e `propertyId`
  - `document_downloaded` com `tenantId`, `propertyId` e sem `r2Key`/`fileUrl`
  - tenantId obrigatorio em evento de scope de tenant
- **Risco residual**:
  - `marketplace.ts` (ratings, endorse, availability) ainda sem audit log. Risco baixo relativo aos modulos financeiros/auth.
  - `ai.ts` e `push.ts` sem audit log por decisao consciente (sem efeitos persistentes de dados ou baixo risco de seguranca).
- **Documentacao**: SECURITY.md secao "Audit log" atualizada com tabela de cobertura por modulo e regras de sanitizacao.
- **Relacionamento**: SECURITY.md secao "Audit log"; ADR-004 (credenciais auditaveis).

### TD-018 - Perda de evidencias de OS quando prestador esta offline (mitigado)

- **Severidade**: Alta
- **Area**: UX / Confiabilidade / Produto premium
- **Status**: Mitigado
- **Evidencia** (auditoria PWA 2026-05-14):
  - `handlePhotoUpload` na pagina de detalhes da OS chamava `servicesApi.uploadPhoto` sem fallback offline. Se o prestador estava sem sinal, o upload falhava silenciosamente com `toast.error` e a foto era perdida.
  - Nenhuma fila de pendentes, sem status de sincronizacao, sem retry automatico.
  - O service worker existente (`public/sw.js`) usava `networkOnly` para todas as rotas `/api/*` — sem capacidade de interceptar uploads para Background Sync.
- **Mitigacao aplicada (2026-05-14)**:
  - `src/lib/offline-evidence-queue.ts`: fila IDB-backed (`houselog-eq` DB) com itens `{ id, serviceOrderId, propertyId, type, file: Blob, filename, mimeType, status, attempts, createdAt, errorMessage }`. Operacoes: `enqueue`, `getPending`, `updateItem`, `clearSynced`, `clearAll`. Validacao: `propertyId` e `serviceOrderId` obrigatorios — nenhum dado sensivel armazenado (sem token, sem tenantId).
  - `src/lib/use-offline-sync.ts`: hook `useOfflineSync()` com `sync()`, `pendingCount`, `syncingCount`, `failedCount`, `isSyncing`. Escuta evento `window.online` para sync automatica. Mutex via `syncingRef` para evitar concorrencia. `processPendingUploads(token)` exportado para testabilidade. `clearOfflineQueue()` exportado para logout.
  - `src/components/offline-sync-status.tsx`: indicador visual compacto — spinner durante sync, badge de warning para falhas (com botao de retry), badge informativo para pendentes aguardando conexao.
  - `src/app/(app)/properties/[id]/services/[serviceId]/page.tsx`: `handlePhotoUpload` agora detecta `!navigator.onLine || err instanceof TypeError` para enfileirar offline ao inves de mostrar apenas erro. Sync status visivel na secao de evidencias.
  - `src/lib/auth-context.tsx`: `logout` chama `clearOfflineQueue()` para nao deixar fotos do usuario no dispositivo apos logout.
- **Testes adicionados**: `src/__tests__/offline-evidence.test.ts` com 11 testes (Vitest + fake-indexeddb):
  - Cria item com status pending e campos corretos
  - Persiste no IDB — getAll retorna o item
  - Rejeita se propertyId ausente
  - Rejeita se serviceOrderId ausente
  - getPending retorna pending+failed, ignora synced+uploading
  - clearAll esvazia fila no logout
  - Upload bem-sucedido marca synced e remove da fila
  - Chama endpoint correto com token e campos da evidencia
  - Falha de rede preserva item com status failed e Blob intacto
  - Retry nao duplica — mesmo id apos falha e reenvio
- **Risco residual**:
  - Background Sync API nao implementada no service worker (`public/sw.js`). Sync e foreground-only (depende do token em memoria). Se o usuario fechar o app offline e abrir depois sem recarregar, a sync automatica so ocorre ao voltar online com o app aberto. Aceitavel para v1 — documentado.
  - Itens com status `failed` apos 3+ tentativas nao sao descartados automaticamente. Fila pode acumular falhas persistentes (ex: arquivo rejeitado pelo servidor). Melhoria futura: limite de tentativas + descarte automatico.
  - Blobs ficam no IndexedDB do dispositivo ate sync ou logout. Em dispositivos com armazenamento limitado, arquivos grandes podem causar quota errors. Mitigacao futura: validar tamanho antes de enfileirar.
- **Mitigacao adicional (2026-05-17)**:
  - A tela de OS usa a fila unificada `houselog-oq`, isolada por `tenantId + userId`; a fila legada `houselog-eq` nao e migrada sem contexto confiavel e passa a ser limpa no boot/logout.
  - Sync foreground tenta rodar tambem no mount quando existe access token em memoria, alem do evento `window.online`; mutex continua impedindo concorrencia.
  - Upload offline bloqueia Blob acima de 5 MB antes de persistir no IndexedDB.
  - Itens com `attempts >= 5` ou idade acima de 7 dias passam para `requires_action`, preservando o Blob para decisao manual em vez de retry infinito.
  - `OfflineSyncStatus` diferencia pendente, sincronizando, falha e requer acao.
  - Testes de fila offline cobrem limite de Blob, sync com/sem token, token nao persistido, max attempts, idade maxima e limpeza da fila legada.
- **Mitigacao adicional (2026-05-17) — UX requires_action**:
  - `offline-queue.ts`: `retryManualItem(id, tenantId, userId)` valida ownership antes de resetar item para `pending` com `attempts=0`; `removeItem(id, tenantId, userId)` valida ownership antes de deletar do IDB — Blob nunca removido sem confirmacao explicita do usuario.
  - `use-offline-queue-sync.ts`: tipo `OqItemView` (sem Blob, sem token), `manualActionItems: OqItemView[]`, `retryManualItem` e `removeManualItem` adicionados ao estado do hook `useOfflineQueueSync`.
  - `offline-sync-status.tsx`: botao `requires_action` agora expande painel (`role="dialog"`, `aria-expanded`) com lista de itens, botao "Tentar novamente" (RotateCcw) e botao "Remover pendencia" (X) com confirmacao inline — sem delecao silenciosa.
  - 6 novos testes em `offline-queue.test.ts` cobrindo `getManualActionByUser`, `retryManualItem` e `removeItem` com isolamento de tenant/usuario.
- **Risco residual apos hardening**:
  - Background Sync permanece fora do escopo por seguranca: o service worker nao tem acesso ao access token em memoria e o token nao deve ser persistido em IndexedDB/localStorage.
- **Documentacao**: SECURITY.md secao sobre armazenamento de dados no dispositivo.

---

### TD-019 - Inventory Label OCR — leitura de etiqueta tecnica sem auto-save (mitigado)

- **Severidade**: Media
- **Area**: Backend / Frontend / IA / Inventario
- **Status**: Mitigado
- **Evidencia** (auditoria de inventario 2026-05-15):
  - `inventoryCreateSchema` (contracts) e `InventoryItem` (types.ts) nao incluiam `serial_number` nem `warranty_until` — campos existiam no schema Drizzle mas eram silenciosamente descartados no create/update.
  - Nenhum mecanismo de leitura automatica de etiqueta tecnica (marca, modelo, S/N, garantia) — usuario precisava preencher manualmente apos fotografia do equipamento.
  - Fluxo de OCR nao existia: sem endpoint, sem validacao de tenant/item, sem tela de revisao, sem audit log.
- **Mitigacao aplicada (2026-05-15)**:
  - Migration `0029_inventory_ocr_fields.sql`: `ALTER TABLE inventory_items ADD COLUMN serial_number TEXT`.
  - Schema Drizzle: `serialNumber: text('serial_number')` adicionado apos `warrantyUntil`.
  - `packages/contracts/src/schemas/inventory.ts`: `serial_number` e `warranty_until` adicionados ao `inventoryCreateSchema` (e derivado `inventoryUpdateSchema`).
  - `apps/api/src/lib/types.ts`: `serial_number` e `warranty_until` adicionados ao tipo `InventoryItem`.
  - `apps/api/src/lib/ai.ts`: funcao `extractLabelData(ai, db, imageBytes)` com modelo `@cf/llava-hf/llava-1.5-7b-hf`, cache por SHA-256, schema Zod com `.catch()` em todos os campos, tipo `LabelExtractResult` exportado.
  - `apps/api/src/routes/inventory.ts`:
    - `inventorySelect` inclui `serial_number`.
    - POST create e PUT update propagam `serial_number` e `warranty_until`.
    - Novo endpoint `POST /:itemId/label-ocr`: valida tenant/property/item, aceita multipart `file` (MIME imagem, max 5 MB, nao vazio), chama `extractLabelData`, registra audit log `label_ocr` sem `rawExtractedText`, retorna `{ extraction }`. Nunca salva automaticamente.
    - 503 `AI_ERROR` em falha de inferencia — sem audit log quando IA falha.
  - `house-log-front/src/lib/api/inventory.ts`: `serial_number` em `InventoryItem` e `InventoryMutationInput`; tipo `LabelExtractResult` exportado; metodo `inventoryApi.labelOcr(propertyId, itemId, file)`.
  - `house-log-front/src/components/inventory/label-ocr-dialog.tsx`: dialog de revisao com campos editaveis (marca, modelo, S/N, garantia), indicador de confianca, secao de dados extras (capacidade, tensao, data de fabricacao) somente-leitura, accordion de texto bruto. Estado inicializado no mount — remonta via `key` no parent para evitar stale state.
  - `house-log-front/src/app/(app)/properties/[id]/inventory/page.tsx`: botao "Ler etiqueta" no dialog de edicao (somente para itens existentes), campo `serial_number` no formulario, fluxo OCR (file picker → loading → `LabelOcrDialog` → `setValue` nos campos → salvar manualmente).
  - **Testes adicionados**: `apps/api/src/routes/inventory-ocr.test.ts` — 8 testes cobrindo:
    - 403 tenant sem acesso nao executa OCR
    - 404 item de outro tenant (isolamento cross-tenant)
    - 422 MIME invalido (`INVALID_FILE_TYPE`)
    - 422 arquivo vazio (`EMPTY_FILE`)
    - 200 campos e confidence corretos na response
    - 503 falha da IA (`AI_ERROR`) sem quebrar o servidor
    - `updateWhere` nao e chamado (OCR nunca salva automaticamente)
    - Audit log com `tenantId`, `propertyId`, `actorId`, sem `rawExtractedText` em `newData`
- **Risco residual**:
  - Cache de OCR por SHA-256 (`ai_cache`) nao tem TTL: resultados de etiquetas identicas sao reutilizados indefinidamente. Se a etiqueta mudar fisicamente (ex: adesivo substituido), o cache pode retornar dados desatualizados ate ser eviccionado manualmente. Risco baixo dado que a IA nunca salva automaticamente — o usuario sempre revisa.
  - `rawExtractedText` pode conter dados pessoais ou informacoes sensiveis presentes na etiqueta (nome de tecnico, numero de contrato, etc). Ja excluido do audit log; nao e persistido pelo endpoint. Se futuramente armazenado, aplicar redacao ou politica de retencao.
  - Modelo `llava-1.5-7b-hf` tem acuracia variavel para etiquetas com fonte pequena, reflexo ou angulo ruim. Confianca (`confidence`) e autoavaliacao do modelo — pode ser superestimada. O dialogo de revisao obrigatorio mitiga o risco de dados incorretos sendo salvos.
- **Relacionamento com roadmap/ADRs**: SECURITY.md secao "OCR de etiqueta tecnica"; TD-011 (search nao indexa campos OCR); ADR-004 (dados auditaveis).

---

## 5. Regras para manter este registro

- Nao registrar debito especulativo sem evidencia no codigo, docs ou refatoracao realizada.
- Ao corrigir um item, atualizar status, evidencia de mitigacao e arquivos relacionados.
- Se um item virar ADR ou tarefa de roadmap, manter o link entre os documentos.
- Se um debito for aceito como trade-off permanente, registrar explicitamente a decisao.
- Evitar duplicar itens ja cobertos por ADR sem deixar claro o ponto operacional pendente.
