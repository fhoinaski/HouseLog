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

### TD-004 - Revelacao de credencial usa `GET` mesmo sendo acao sensivel e auditavel

- **Severidade**: Alta
- **Area**: Backend / Seguranca / Credenciais
- **Status**: Mitigado parcialmente
- **Evidencia**: `house-log-back/apps/api/src/routes/credentials.ts` ainda expoe `GET /properties/:propertyId/credentials/:credId/secret` por compatibilidade, mas ja existe `POST /properties/:propertyId/credentials/:credId/secret/reveal` como acao preferencial. O frontend consome o endpoint `POST` em `credentialsApi.revealSecret`, nao foram encontrados consumidores diretos de `GET /secret` em `house-log-front/src`, e a rota legada agora retorna headers de depreciacao.
- **Impacto**: a semantica principal foi corrigida para novos consumidores, e o legado esta sinalizado; a rota `GET` ainda continua sendo ponto de atencao para caches/proxies e clareza operacional ate sua remocao.
- **Recomendacao**:
  - fazer busca final de consumidores em frontend, backend, docs e integracoes antes da remocao;
  - manter compatibilidade temporaria durante a janela de migracao;
  - monitorar qualquer uso remanescente do endpoint legado sinalizado por headers de depreciacao;
  - exigir body opcional com motivo/contexto quando a policy evoluir;
  - remover a rota `GET` apenas apos validacao de auditoria e comunicacao de release.
- **Relacionamento com roadmap/ADRs**: Fase 2; ADR-004.

---

### TD-005 - Permissao de revelacao de segredo ainda nao tem policy granular

- **Severidade**: Critica
- **Area**: Backend / Authorization Core / Credenciais
- **Status**: Mitigado parcialmente
- **Evidencia**: existe `assertPropertySecretAccess`, mas ainda nao ha `CredentialAccessPolicy` formal, regra por contexto operacional, motivo de revelacao, escopo por OS ou politica granular por tenant/organizacao.
- **Impacto**: credenciais sao dados sensiveis centrais para imoveis premium; sem policy granular, o sistema depende de regra ampla e dificulta governanca, auditoria e venda para operacoes institucionais.
- **Recomendacao**:
  - criar modelo de policy para acesso a credenciais;
  - diferenciar visualizar metadados, revelar segredo, compartilhar em OS e gerar codigo temporario;
  - registrar contexto da revelacao sem gravar segredo;
  - integrar com Authorization Core e multi-tenant.
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

### TD-007 - `marketplaceApi` permanece como alias legado

- **Severidade**: Media
- **Area**: Produto / Frontend / Provider Network
- **Status**: Mitigado parcialmente
- **Evidencia**: `marketplaceApi` permanece como alias para `providerNetworkApi` por compatibilidade, enquanto ADR-001 e ADR-003 definem que HouseLog nao e marketplace aberto.
- **Impacto**: nomes legados podem induzir novas implementacoes desalinhadas com rede homologada, elegibilidade e operacao privada.
- **Recomendacao**:
  - mapear consumidores restantes de `marketplaceApi`;
  - migrar imports para `providerNetworkApi`;
  - manter alias apenas durante janela de compatibilidade;
  - remover alias quando nao houver consumo.
- **Relacionamento com roadmap/ADRs**: Fase 4; ADR-001 e ADR-003.

---

### TD-008 - Componentes e telas ainda parcialmente heterogeneos

- **Severidade**: Media
- **Area**: Frontend / Design System / UX
- **Status**: Mitigado parcialmente
- **Evidencia**: varias telas foram refatoradas para `AppShell`, `PageHeader`, `PageSection`, `MetricCard`, `ServiceOrderCard`, `EmptyState`, `PropertySummaryCard` e `ActionTile`, mas ainda ha areas com composicao local, cards antigos, copy heterogenea e tokens aplicados de forma desigual.
- **Impacto**: aumenta custo de manutencao, dificulta consistencia mobile e enfraquece a narrativa do The Architectural Lens.
- **Recomendacao**:
  - continuar refatoracao incremental por rota;
  - priorizar telas do nucleo do imovel e provider flow;
  - registrar componentes consolidados no guia operacional;
  - evitar criar componentes paralelos quando um estrutural existente resolve.
- **Relacionamento com roadmap/ADRs**: Fase 5; ADR-002.

---

### TD-009 - Ausencia de multi-tenant real

- **Severidade**: Critica
- **Area**: Arquitetura / Backend / Produto / Seguranca
- **Status**: Aberto
- **Evidencia**: a arquitetura atual ainda opera principalmente por usuario, propriedade e roles simples; `ARCHITECTURE_TARGET.md` e ADR-005 definem evolucao para tenant, organizacao, memberships e isolamento formal.
- **Impacto**: limita escala B2B, construtoras, administradoras, portfolios independentes, redes homologadas por organizacao e isolamento forte de dados.
- **Recomendacao**:
  - planejar migracao incremental com `organization_id`/tenant context;
  - criar memberships e provider scopes;
  - fazer backfill de dados existentes;
  - nunca introduzir migracao destrutiva sem plano e checklist;
  - alinhar frontend a contexto organizacional quando backend estiver pronto.
- **Relacionamento com roadmap/ADRs**: Fase 7; ADR-005.

---

### TD-010 - Authorization Core completo ainda nao existe no backend

- **Severidade**: Critica
- **Area**: Backend / Seguranca / Boundary Architecture
- **Status**: Aberto
- **Evidencia**: o roadmap define necessidade de um modulo central com regras como `canAccessProperty`, `canManageProperty`, `canViewServiceOrder`, `canAccessCredential`, `canCreateShareLink` e `canBidOnOpportunity`; hoje ainda ha checagens mais distribuidas e helpers parciais.
- **Impacto**: aumenta risco de acesso indevido, divergencia entre rotas e dificuldade de evoluir provider network, public links, credenciais e multi-tenant.
- **Recomendacao**:
  - criar modulo central de authorization;
  - migrar rotas sensiveis gradualmente;
  - cobrir property, service, provider, credentials, share e search;
  - adicionar testes de permissao por papel/contexto;
  - alinhar com `BOUNDARY_MAP.md`.
- **Relacionamento com roadmap/ADRs**: Fase 3; `SECURITY_REVIEW.md`, ADR-003, ADR-004 e ADR-005.

---

### TD-011 - Search ainda nao possui policy formal por campo sensivel

- **Severidade**: Media
- **Area**: Backend / Search / Seguranca
- **Status**: Mitigado parcialmente
- **Evidencia**: `house-log-back/apps/api/src/routes/search.ts` centraliza busca por OS, documentos, inventario e manutencao. O search ja possui helpers por tipo no Authorization Core, busca ampla em OCR documental e descricao livre de OS foram removidas, e ha uma allowlist local de campos pesquisaveis por tipo.
- **Impacto**: novos campos ou indices podem expor metadados sensiveis por inferencia, especialmente OCR, descricoes operacionais, evidencias, documentos criticos e futuros dados multi-tenant.
- **Recomendacao**:
  - manter credenciais e segredos fora de search;
  - so reintroduzir OCR com policy documental explicita por tipo, origem e sensibilidade;
  - evoluir a allowlist local para policy formal se novos indices ou campos sensiveis forem adicionados;
  - considerar tenant/organization antes de search dedicado.
- **Relacionamento com roadmap/ADRs**: Fase 3 e Fase 7; Authorization Core, AI-ready checklist e ADR-005.

---

### TD-012 - Deploy Cloudflare e CI ainda dependem de configuracao final de producao

- **Severidade**: Critica
- **Area**: Deploy / Operacao / Cloudflare
- **Status**: Mitigado parcialmente
- **Evidencia**: `wrangler.toml` foi separado para usar D1, KV, R2 e queues distintos entre dev e production; o bug de filas foi corrigido; secrets sensiveis sairam do arquivo versionado; arquivos `.wrangler/` foram removidos do indice do git; `.github/workflows/ci.yml` e `npm run check:deploy-config` foram adicionados. Production ainda usa placeholders invalidos intencionais para D1/KV ate os recursos reais serem criados manualmente.
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
2. TD-004 - concluir migracao e remover consumidores legados de `GET /secret`.
3. TD-005 - iniciar policy granular para credenciais.
4. TD-010 - desenhar e iniciar Authorization Core.
5. TD-003 - adicionar confirmacao de exclusao documental.
6. TD-002 - padronizar erro de upload multipart.

### Medio prazo

1. TD-009 - iniciar base multi-tenant incremental.
2. TD-007 - reduzir e remover alias `marketplaceApi`.
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
- **Risco restante**:
  - Access token ainda persiste em `localStorage` (`hl_token`). XSS ainda pode roubar o access token (TTL 1h). Mitigação futura: manter access token apenas em memória.
  - Em deployment cross-origin (workers.dev ≠ vercel.app, domínios distintos), `SameSite=Lax` não envia o cookie em POSTs cross-site. Solução: custom domain same-site (ex: api.houselog.app + app.houselog.app) OU `SameSite=None; Secure`.
- **Próxima etapa recomendada**:
  - P0-AUTH-SESSION-02: mover access token de localStorage para memória (variável de estado React).
  - Configurar custom domain same-site para eliminar necessidade de `SameSite=None`.
- **Relacionamento com roadmap**: Sprint 3 do HOUSELOG_EXECUTION_MASTERPLAN.md.

---

### TD-014 - tenant_id nullable nas tabelas principais (mitigado parcialmente)

- **Severidade**: Critica
- **Area**: Backend / Multi-tenant / Isolamento de Dados
- **Status**: Mitigado parcialmente
- **Evidencia**: migration `0014_tenant_foundation.sql` adicionou `tenant_id` nullable em 20 tabelas e fez backfill dos dados legados via `owner_id → tenant_members`. Novas tabelas criadas após 0014 (`technical_systems`, `technical_points`, `warranties`, `renovations`, `handover_packages`, `handover_checklist_items`, `document_ingestion_jobs`, etc.) já usam `NOT NULL`. As 20 tabelas originais permanecem `nullable` enquanto o backfill de dados legados não for validado.
- **Mitigação aplicada (P0-TENANT-BACKFILL-01)**:
  - Todas as rotas autenticadas usam `resolveTenant` middleware — rejeita com 400 `TENANT_REQUIRED` se não houver membership ativo.
  - Todos os handlers de criação (rooms, services, expenses, credentials, documents, audit-links, invites, maintenance, service-requests, bids, renovations, warranties, handover) injetam `tenantId` do contexto no INSERT.
  - Scripts de diagnóstico e backfill criados em `apps/api/src/db/backfill/`:
    - `phase_a_diagnostic.sql` — relatório de `tenant_id IS NULL` por tabela (somente-leitura, compatível com `wrangler d1 execute`).
    - `phase_b_safe_backfill.sql` — backfill idempotente: preenche apenas registros `NULL` a partir do parent; nunca sobrescreve valor existente.
    - `phase_c_orphan_report.sql` — relatório de órfãos pós-backfill (registros sem parent resolvível).
  - Helpers puros para decisão de backfill: `lib/backfill-diagnostics.ts` (`resolveChildTenant`, `resolvePropertyTenant`, `BACKFILL_STRATEGIES`).
  - Testes: `lib/backfill-diagnostics.test.ts`, `lib/tenant-authorization.test.ts`, `lib/room-tenant.test.ts`, `lib/service-tenant.test.ts`, `lib/expense-tenant.test.ts` e outros por domínio. Testes de rota em `routes/tenant-isolation.test.ts` cobrem `resolveTenant`, insert com tenantId e cross-tenant read → 404.
- **Risco restante**:
  - As 20 tabelas originais ainda têm `tenant_id TEXT` sem `NOT NULL`. Registros legados não resolvíveis pelo backfill permanecem com `tenant_id IS NULL` — serão excluídos das listagens por filtragem de tenant ativo, mas podem criar débito de limpeza.
  - Sem a constraint `NOT NULL`, um bug de código poderia criar um registro sem `tenant_id` sem falha de banco.
- **Próxima etapa (Fase D — não implementar sem validação)**:
  - Executar `phase_a_diagnostic.sql` no banco de produção. Se `null_tenant = 0` em todas as tabelas, prosseguir.
  - Executar `phase_b_safe_backfill.sql`. Reexecutar `phase_a`. Se `null_tenant > 0` ainda, executar `phase_c_orphan_report.sql` para triagem manual.
  - Quando `orphaned = 0` em todas as tabelas e validação em dev por ≥ 24h: criar migration `0026_tenant_not_null.sql` usando recriação de tabela (D1/SQLite não suporta `ALTER COLUMN`). Padrão: `CREATE TABLE ... NOT NULL → INSERT FROM old → DROP old → RENAME`.
  - Executar somente com backup completo confirmado.
- **Relacionamento com roadmap/ADRs**: Sprint 4; ADR-005 (multi-tenant incremental); TD-009.

---

## 5. Regras para manter este registro

- Nao registrar debito especulativo sem evidencia no codigo, docs ou refatoracao realizada.
- Ao corrigir um item, atualizar status, evidencia de mitigacao e arquivos relacionados.
- Se um item virar ADR ou tarefa de roadmap, manter o link entre os documentos.
- Se um debito for aceito como trade-off permanente, registrar explicitamente a decisao.
- Evitar duplicar itens ja cobertos por ADR sem deixar claro o ponto operacional pendente.
