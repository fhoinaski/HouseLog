# HOUSELOG_EXECUTION_MASTERPLAN.md

> Guia mestre de execução técnica para evoluir o HouseLog com segurança, arquitetura limpa e foco em produto premium vendável.

**Projeto:** HouseLog
**Repositório oficial:** `fhoinaski/HouseLog`
**Produto:** Prontuário Técnico Digital do Imóvel
**Objetivo:** transformar o HouseLog em uma plataforma SaaS premium, segura, multi-tenant e vendável para gestão técnica de imóveis, manutenção, documentos, garantias, reformas, diagnósticos, orçamentos e histórico técnico.

**Versão:** 2.0 (consolidada após auditorias técnicas)
**Status do projeto na data do plano:** MVP avançado, base não-blindada para produção
**Branch ativa de execução:** `claude/project-audit-analysis-vrH4F`

---

## 1. Regra principal

Antes de criar qualquer feature nova, o HouseLog precisa passar por uma fase de consolidação.

A ordem correta é:

1. Fazer o projeto compilar.
2. Corrigir configuração de ambiente.
3. Blindar autenticação e sessão.
4. Blindar autorização multi-tenant.
5. Padronizar auditoria.
6. Completar soft delete.
7. Garantir conformidade legal (LGPD) e observabilidade antes de processar dado real.
8. Só depois evoluir IA, UX premium e funcionalidades comerciais.

**Não avançar para feature nova enquanto P0 estiver aberto.**

---

## 2. Estado atual resumido

O HouseLog já possui uma base forte:

- Frontend em Next.js 16 + React 19 + Tailwind v4.
- Backend em Cloudflare Workers + Hono + D1 + Drizzle.
- Estrutura multi-tenant iniciada com `tenant_id` em entidades centrais.
- 31 módulos de rotas: imóveis, ambientes, OS, documentos, manutenção, financeiro, provider, mensagens, garantias, reformas, handover, técnicos.
- 50 tabelas, 24 migrations versionadas, índices compostos `tenantId + propertyId`.
- Design system `The Architectural Lens` com tokens centralizados.
- Helpers de autorização (`authMiddleware`, `resolveTenant`, `requireTenantPropertyAccess`, `assertTenantPropertyAccess`) **já existem em `middleware/auth.ts`**.
- Pipeline de ingestão de documentos com candidates (4 tipos), reviews e jobs.
- Regras para agentes em `AGENTS.md` e `SYSTEM_CONTEXT.md`.
- Scripts de type-check, lint, test e build.

Mas ainda não está pronto para produção premium porque existem riscos em:

- **`wrangler.toml`** com `database_id` idêntico dev/prod, KV id placeholder, secrets vazios.
- **Bug nas filas**: producer envia para `houselog-jobs` mas consumer escuta `houselog-queue` — mensagens nunca consumidas.
- **Dev producer aponta para fila de produção** (`houselog-jobs` em ambos ambientes).
- **`requireTenantPropertyAccess` existe mas é usado em zero rotas** — todas reimplementam JOIN com `tenantId` à mão.
- Refresh token em `localStorage` e aceito por `body` em `/auth/refresh`.
- Ausência de `src/middleware.ts` no Next.
- 11 tabelas premium sem soft delete; várias com `tenantId` nullable.
- Audit log parcial (CRUD de properties/rooms/inventory/maintenance sem cobertura).
- IA de documentos ainda simulada (`FAKE_DOCUMENT_INGESTION_MODEL_NAME`).
- Sem CI configurado (`.github/workflows` não existe).
- Sem políticas LGPD, observabilidade, billing.

---

## 3. Princípios obrigatórios

Toda alteração deve seguir estes princípios:

### 3.1 Segurança

- Nunca commitar segredo real.
- Nunca aceitar `tenantId` vindo do cliente como fonte de verdade.
- Nunca expor refresh token em JavaScript.
- Nunca salvar tokens, senhas ou chaves em logs.
- Nunca retornar segredo sem autorização explícita.
- Toda mídia privada deve passar por autorização.
- Toda ação crítica deve gerar audit log.
- Qualquer segredo que já tenha estado em arquivo versionado deve ser considerado **comprometido** e rotacionado.

### 3.2 Multi-tenant

- Toda entidade sensível deve ter `tenantId` **NOT NULL**.
- `tenantId` deve ser resolvido no servidor.
- Queries devem filtrar por `tenantId` e contexto do imóvel.
- Testes devem provar que um tenant não acessa dados do outro.
- Preferir `resolveTenant` + `requireTenantPropertyAccess` em **toda** rota com `propertyId`.
- Para recurso de outro tenant retornar **404** (não 403) para não vazar existência.

### 3.3 Privacidade (LGPD)

- Toda categoria de dado pessoal precisa de base legal documentada.
- Documentos enviados a IA externa precisam de **redação de PII** antes.
- Direito de acesso, portabilidade e eliminação devem existir como endpoint.
- Retenção de logs e audit log com prazo definido.

### 3.4 Código

- TypeScript forte.
- Evitar `any`.
- Não mascarar erro com cast inseguro.
- Não duplicar regra de negócio.
- Não criar endpoint fictício.
- Não criar fluxo no frontend sem backend real.
- Não quebrar contrato sem revisar consumidores.

### 3.5 Produto

O HouseLog não é marketplace aberto.

Linguagem correta:

| Evitar | Usar |
|---|---|
| Marketplace | Rede técnica homologada |
| Oportunidades abertas | Convites técnicos |
| Prestadores aleatórios | Profissionais autorizados |
| App de chamados | Prontuário técnico do imóvel |
| Orçamento comum | Proposta técnica documentada |

---

## 4. Roadmap técnico de consolidação

A sequência foi reorganizada para colocar **LGPD e Observabilidade antes de IA real**, e **Performance/A11y/Billing antes do go-live**. A ordem final está em § 8.

---

## Sprint 0 — Diagnóstico real de build

### Objetivo

Validar o estado real do projeto com dependências instaladas, type-check, lint, testes e build.

### Prompt para agente

```txt
Você está no repositório HouseLog.

Objetivo:
Executar uma auditoria técnica validada por comandos reais, sem implementar feature nova.

Tarefas:
1. Identificar o gerenciador de pacotes correto.
2. Instalar dependências necessárias em raiz, house-log-front, house-log-back/apps/api e packages/contracts.
3. Rodar os scripts disponíveis:
   - npm install
   - npm run type-check
   - npm run lint
   - npm run test
   - npm run build
   - npm run check
4. Rodar também:
   - cd packages/contracts && npx tsc --noEmit
   - npm --prefix house-log-back/apps/api run build (wrangler dry-run)
5. Gerar relatório com:
   - comandos executados;
   - erros encontrados;
   - causa provável;
   - arquivos afetados;
   - prioridade de correção;
   - o que é bloqueador e o que não é.

Regras:
- Não alterar regra de negócio.
- Não remover teste para passar.
- Não usar `any` para esconder erro.
- Não mudar config de TypeScript para afrouxar validação.
- Não instalar biblioteca sem necessidade clara.
- Não criar feature.

Saída:
Relatório objetivo + lista P0/P1/P2.
```

### Critério de aceite

- Todos os comandos foram executados.
- Erros estão listados com causa provável.
- Nenhuma correção foi feita sem justificativa.
- Existe lista clara de bloqueadores.
- Inclui validação do pacote `@houselog/contracts`.

---

## Sprint 1 — CI e validação automática

### Objetivo

Criar GitHub Actions para impedir regressão e detectar segredos.

### Prompt para agente

```txt
Você está no repositório HouseLog.

Objetivo:
Criar pipeline de CI no GitHub Actions para validar o projeto em todo push e pull request.

Tarefas:
1. Criar `.github/workflows/ci.yml` com jobs:
   - install (raiz + workspaces)
   - type-check (front + api + contracts)
   - lint
   - test (vitest + contracts)
   - build (Next + wrangler dry-run via `wrangler deploy --dry-run`)
2. Criar `.github/workflows/security.yml` com:
   - gitleaks ou trufflehog (secret scanning) em todo push.
   - npm audit --omit=dev em raiz, front, api.
3. Criar `.github/workflows/db.yml` com:
   - `drizzle-kit check` para detectar drift entre schema e migrations.
4. Usar Node compatível com o projeto (verificar `engines` ou stack).
5. Cachear node_modules e Playwright browsers separadamente.
6. Falhar o pipeline se qualquer etapa falhar.
7. Adicionar status badge no README.

Regras:
- Não alterar código de aplicação.
- Não ignorar erro.
- Não adicionar `continue-on-error`.
- Não usar build parcial como se fosse validação completa.

Saída:
- Arquivos de workflow criados.
- Explicação curta dos jobs.
- Comandos equivalentes para rodar localmente.
```

### Critério de aceite

- CI roda em push e PR.
- Type-check, lint, test, build, secret-scan e drizzle-check são obrigatórios.
- Pipeline falha se houver erro.
- Sem `continue-on-error` em jobs críticos.

---

## Sprint 2 — Corrigir configuração Cloudflare

### Objetivo

Separar ambiente dev/prod, **corrigir o bug das filas** e remover configuração perigosa.

### 🔴 Bug crítico a corrigir

Em `house-log-back/apps/api/wrangler.toml`:

- **Produção**: producer publica em `houselog-jobs` (linha 41), consumer escuta `houselog-queue` (linha 48). Filas diferentes — `GENERATE_THUMBNAIL` e `SEND_PUSH` nunca processados.
- **Dev**: producer `QUEUE` aponta para `houselog-jobs` (linha 97) — fila de **produção**. Mensagens de dev podem cair em prod.
- **Dev**: não existe consumer para o binding `QUEUE` em dev.

### Prompt para agente

```txt
Você está no backend do HouseLog em Cloudflare Workers.

Objetivo:
Corrigir `house-log-back/apps/api/wrangler.toml` para deixar dev/prod seguros, separados e com filas funcionando.

Problemas a resolver:
1. `database_id` de dev e produção estão IDÊNTICOS (62bd81c4-77da-...) — separar.
2. KV de produção tem placeholder `COLE_AQUI_O_ID_DO_KV_PRODUCAO` — criar KV real ou bloquear deploy.
3. Bug das filas:
   - prod producer "QUEUE" -> "houselog-jobs"
   - prod consumer -> "houselog-queue"  (nunca recebe)
   Corrigir para o consumer escutar "houselog-jobs" OU mudar o producer.
4. Dev producer "QUEUE" -> "houselog-jobs" (fila de prod). Criar "houselog-jobs-dev" e apontar dev pra ela. Criar consumer dev correspondente.
5. R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, RESEND_API_KEY estão como `""` no arquivo versionado — remover do .toml e migrar para `wrangler secret put`.
6. Considerar comprometido qualquer segredo histórico no arquivo (mesmo vazio agora) — rotacionar.

Tarefas:
1. Revisar `wrangler.toml`.
2. Separar dev e production completamente (database, queue, KV, R2 bucket).
3. Remover variáveis sensíveis do arquivo versionado.
4. Manter apenas variáveis não sensíveis (CORS_ORIGINS, ENVIRONMENT, APP_URL).
5. Criar ou atualizar `.dev.vars.example`.
6. Criar `docs/deployment/cloudflare-env.md` com:
   - wrangler d1 create houselog-db / houselog-db-dev
   - wrangler kv namespace create KV / KV_DEV
   - wrangler queues create houselog-jobs / houselog-jobs-dev / houselog-document-ingestion / houselog-document-ingestion-dev
   - wrangler r2 bucket create houselog-assets / houselog-assets-dev
   - wrangler secret put JWT_SECRET
   - wrangler secret put CREDENTIALS_ENCRYPTION_KEY
   - wrangler secret put RESEND_API_KEY
   - wrangler secret put R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
7. Criar checklist pré-deploy em `docs/deployment/PREFLIGHT.md`.
8. Adicionar política de lifecycle do R2 e backup do D1.

Regras:
- Nunca inventar IDs reais.
- Nunca commitar segredo.
- Nunca reutilizar D1 dev em produção.
- Não alterar regra de negócio.
- Não quebrar scripts existentes.

Saída:
- Diff do wrangler.toml.
- Documento de deploy.
- Comandos que o Fernando deve rodar manualmente.
- Checklist de validação.
- Lista de segredos a rotacionar.
```

### Critério de aceite

- Dev e prod usam bancos, KV, R2 e filas diferentes.
- Produção não tem placeholder.
- Secrets saem do arquivo versionado.
- Producer e consumer da mesma fila têm o mesmo nome.
- Existe documentação clara de deploy e backup.

---

## Sprint 3 — Sessão segura com cookie HttpOnly + CSRF

### Objetivo

Remover refresh token do `localStorage` e do body, blindar contra CSRF.

### Prompt para agente

```txt
Você está no HouseLog, backend Hono/Cloudflare Workers e frontend Next.js.

Objetivo:
Migrar refresh token de `localStorage` e body para cookie HttpOnly, com proteção CSRF.

Backend:
1. Ajustar `/auth/login` para gravar refresh token em cookie HttpOnly + Secure + SameSite=Strict.
2. Ajustar `/auth/mfa/challenge` para gravar refresh token em cookie HttpOnly.
3. Ajustar `/auth/register` se autentica.
4. Ajustar `/auth/refresh` para ler refresh do cookie. Manter fallback de body por 1 release com deprecation warning, e remover depois (atual: routes/auth.ts:92,449).
5. Ajustar `/auth/logout` para revogar e limpar cookie.
6. Configurar:
   - HttpOnly;
   - Secure em production;
   - SameSite=Strict (não Lax) no refresh cookie;
   - Path adequado;
   - Max-Age coerente (curto para access, mais longo para refresh).
7. Implementar proteção CSRF:
   - Origin/Referer check em mutações;
   - OU double-submit cookie pattern;
   - Documentar escolha.
8. Atualizar CORS allowlist com `credentials: true` apenas para origins autorizadas.

Frontend:
1. Remover persistência de refresh token em `localStorage`.
2. Manter access token APENAS EM MEMÓRIA (não sessionStorage).
3. Atualizar `auth-context.tsx` (linhas 68-71).
4. Atualizar cliente HTTP em `src/lib/api/_core.ts` para usar `credentials: "include"`.
5. Garantir que logout limpe estado local + chame endpoint de revogação.
6. Garantir que MFA continue funcionando.
7. Atualizar schedule de refresh para usar cookie automaticamente.

Testes:
1. Login cria cookie HttpOnly.
2. Refresh usa cookie (não body).
3. Logout limpa cookie e revoga server-side.
4. Sem cookie não renova.
5. MFA continua funcionando.
6. `localStorage` não contém `hl_refresh`.
7. Request de origem não autorizada é bloqueado.

Regras:
- Não expor refresh token ao JavaScript.
- Não enfraquecer CORS.
- Não quebrar compatibilidade sem teste.
- Não aceitar tenantId do cliente.
- Não logar token em audit log nem no console.

Saída:
- Arquivos alterados.
- Explicação objetiva.
- Checklist manual no navegador.
- Plano de remoção do fallback de body.
```

### Critério de aceite

- `hl_refresh` não existe mais no `localStorage`.
- Refresh token está em cookie HttpOnly + Secure + SameSite=Strict.
- Login/refresh/logout/MFA funcionam.
- CORS aceita credenciais apenas para origins permitidos.
- CSRF protection ativa em mutações.
- Plano documentado para remover fallback de body.

---

## Sprint 4 — Middleware Next.js (Edge)

### Objetivo

Proteger rotas privadas antes da renderização SSR.

### Prompt para agente

```txt
Você está no frontend Next.js do HouseLog.

Objetivo:
Criar `src/middleware.ts` para proteger rotas privadas no Edge.

Rotas públicas:
- `/login`
- `/register`
- `/invite/[token]`
- `/share/service/[token]`
- `/audit/[token]`
- `/offline`
- `/splash`
- assets estáticos e `_next/*`

Rotas privadas:
- `/dashboard`
- `/properties/*`
- `/services/*`
- `/financial/*`
- `/schedule/*`
- `/settings/*`
- `/provider/*`

Tarefas:
1. Criar `src/middleware.ts` rodando em Edge Runtime.
2. Definir `matcher` seguro (evitar assets, _next, favicon).
3. Redirecionar usuário sem cookie de sessão para `/login` com `?from=<path>`.
4. Evitar loop de redirect (se já em /login, não redirecionar).
5. Preservar rotas públicas de convite/share/audit.
6. Manter PWA/offline funcionando (`/offline` acessível mesmo sem cookie).
7. Usar APENAS presença do cookie de refresh como gate. Validação JWT é responsabilidade do backend.
8. Não fazer fetch no middleware (latência no Edge).

Limitações a documentar:
- Middleware checa apenas presença do cookie, não validade.
- Backend é a autoridade final de autorização.
- Edge Runtime não tem APIs Node (não importar bibliotecas Node-only).

Regras:
- Middleware não substitui autorização backend.
- Não bloquear assets.
- Não quebrar rota pública.
- Não criar falsa segurança.
- Código limpo e pequeno.

Saída:
- Código completo de `src/middleware.ts`.
- Lista de rotas públicas/privadas.
- Limitações documentadas.
```

### Critério de aceite

- Rotas privadas redirecionam sem cookie.
- Rotas públicas continuam acessíveis.
- Não há loop.
- Build passa.
- Sem fetch no middleware.

---

## Sprint 5 — Authorization Core definitivo

### Objetivo

Garantir autorização multi-tenant consistente. **Adotar de fato** o `requireTenantPropertyAccess` que já existe.

### Contexto crítico

Helpers existem em `middleware/auth.ts`:
- `authMiddleware` (linha 14)
- `resolveTenant` (linha 127)
- `assertTenantPropertyAccess` (linha 80)
- `requireTenantPropertyAccess` (linha 95)

**Estado atual:** `grep -rn "requireTenantPropertyAccess" src/routes/` retorna **0 ocorrências**. Todas as 31 rotas reimplementam JOIN com `tenantId` à mão. O sprint deve corrigir isso.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Consolidar o Authorization Core e aplicar `requireTenantPropertyAccess` (ou helper equivalente) em todas as rotas sensíveis.

Tarefas:
1. Mapear todas as rotas que usam:
   - propertyId;
   - serviceId / serviceOrderId;
   - documentId;
   - credentialId;
   - warrantyId;
   - renovationId;
   - handoverPackageId;
   - inventoryItemId;
   - expenseId;
   - technicalSystemId / technicalPointId.
2. Verificar se cada rota aplica:
   - authMiddleware;
   - resolveTenant;
   - requireTenantPropertyAccess (preferencial) ou helper equivalente do domínio.
3. Migrar rotas que reimplementam JOIN com tenantId para usar o middleware reusável.
4. Criar permissões por ação:
   - view;
   - manage;
   - create;
   - update;
   - delete;
   - change_status;
   - assign;
   - evidence;
   - secret.
5. Padronizar códigos:
   - 400 TENANT_REQUIRED;
   - 401 UNAUTHORIZED;
   - 403 FORBIDDEN (apenas quando recurso existe no tenant mas role insuficiente);
   - 404 NOT_FOUND (quando recurso é de outro tenant — não vazar existência).
6. Criar testes para:
   - usuário correto acessa;
   - outro tenant retorna 404 (não 403);
   - sem tenant ativo falha;
   - provider sem permissão falha;
   - provider com assigned_service acessa apenas a OS atribuída;
   - secret exige permissão elevada.
7. Atualizar `docs/AUTHORIZATION_CORE_GAPS.md` com checklist de rotas migradas.

Rotas prioritárias (32 rotas):
- documents, credentials, services, service-requests, service-request-bids;
- service messages, bids, share, audit-links;
- warranties, renovations, handover-packages, handover-checklist-items;
- technical-systems, technical-points, maintenance, finance, expenses;
- inventory, rooms, properties, timeline, search, reports;
- provider, marketplace, invites, ai.

Regras:
- Não aceitar `tenantId` do body como autoridade.
- Não duplicar lógica em cada rota.
- Não transformar 404 em 403 quando isso vazar existência de recurso.
- Não quebrar rotas públicas legítimas.

Saída:
- Relatório de rotas auditadas (matriz: rota x guard aplicado).
- Rotas corrigidas.
- Helpers adicionados/refatorados.
- Testes adicionados.
- Pendências restantes.
```

### Critério de aceite

- Toda rota sensível passa por autorização contextual via middleware (não JOIN manual).
- `grep -rn "requireTenantPropertyAccess" src/routes/` retorna **pelo menos 25 ocorrências**.
- Teste cross-tenant retorna 404 (não 403).
- Rotas públicas seguem seguras.
- Erros são consistentes.

---

## Sprint 6 — Backfill e `tenantId` obrigatório

### Objetivo

Eliminar entidades centrais com `tenantId` nulo.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Fazer backfill seguro de `tenantId` e preparar entidades centrais para `tenantId NOT NULL`.

Tarefas:
1. Identificar tabelas com `tenantId` nullable em src/db/schema.ts.
2. Classificar:
   - entidades que devem obrigatoriamente ter tenant (properties, rooms, services, etc.);
   - entidades públicas/tokenizadas com estratégia especial (auditLinks, serviceShareLinks);
   - entidades append-only sem tenant (refreshTokens, sessions).
3. Criar script de diagnóstico em scripts/diagnose-orphans.ts:
   - listar registros com tenant_id nulo;
   - indicar origem possível do tenant via property/service/document.
4. Criar script de backfill idempotente em scripts/backfill-tenant.ts.
5. Adicionar feature flag de validação dura por 1 release:
   - aceitar mas LOGAR violação;
   - depois forçar NOT NULL.
6. Criar migration para tornar `tenant_id` obrigatório onde for seguro.
7. Atualizar schema Drizzle.
8. Atualizar inserts para sempre preencher `tenantId`.
9. Adicionar testes anti-vazamento cross-tenant.

Tabelas prioritárias:
- properties;
- rooms;
- inventory_items;
- service_orders;
- service_bids;
- documents;
- audit_links (estratégia especial: tenant_id derivado do contexto criador);
- service_messages;
- expenses;
- maintenance_schedules.

Tabelas com estratégia especial:
- serviceShareLinks (público tokenizado — adicionar tenant_id mas permitir acesso via token sem auth).
- auditLinks (mesmo padrão).

Regras:
- Não apagar dado.
- Não fazer migration destrutiva.
- Não assumir tenant quando houver ambiguidade — gerar relatório manual.
- Toda query nova deve incluir tenant.

Saída:
- Diagnóstico de registros órfãos.
- Script de backfill.
- Migration.
- Schema atualizado.
- Feature flag + período de observação.
- Testes.
```

### Critério de aceite

- Registros órfãos foram identificados.
- Backfill é idempotente.
- Inserts novos sempre preenchem tenant.
- Testes garantem tenant obrigatório.
- Entidades público-tokenizadas têm estratégia documentada.

---

## Sprint 7 — Audit log completo + retenção

### Objetivo

Criar trilha de auditoria premium com política de retenção.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Estender (não recriar) o audit log para eventos críticos do produto. Catálogo base existe em docs/AUDIT_EVENT_CATALOG.md.

Tarefas:
1. Revisar implementação atual de `writeAuditLog` em src/lib/audit.ts.
2. Atualizar catálogo em docs/AUDIT_EVENT_CATALOG.md cobrindo:
   - properties create/update/delete;
   - rooms create/update/delete;
   - inventory create/update/delete;
   - service orders create/update/status_change/assign/delete;
   - documents upload/delete;
   - credentials create/update/reveal/delete;
   - warranties create/update/delete;
   - renovations create/update/delete;
   - handover create/update/approve/archive;
   - share link create/access/revoke;
   - audit link create/access/expire;
   - document candidate apply/reject;
   - login/logout/mfa.
3. Implementar `writeAuditLog` nos eventos faltantes.
4. Sanitizar payloads (já parcial em audit.ts:6-27):
   - password;
   - token / refreshToken / access_token;
   - secret;
   - credential;
   - r2Key;
   - fileUrl / signedUrl;
   - PII conforme LGPD.
5. Garantir metadata:
   - tenantId;
   - propertyId;
   - actorId;
   - action;
   - entityType;
   - entityId;
   - requestId (obrigatório — gerar via crypto.randomUUID() no middleware se ausente).
6. Definir política de retenção:
   - audit log por X meses (definir conforme LGPD e necessidade de auditoria);
   - cron de expurgo;
   - flag de "evento legal" que sobrevive ao expurgo.

Regras:
- Nunca logar segredo.
- Não deixar audit log quebrar fluxo principal sem política clara.
- Não criar evento genérico inútil.
- Não registrar payload gigante sem necessidade.
- Não expurgar evento sem registrar o expurgo.

Saída:
- Catálogo de eventos atualizado.
- Eventos implementados.
- Testes de sanitização.
- Política de retenção em docs/AUDIT_RETENTION_POLICY.md.
- Cron de expurgo.
- Pendências.
```

### Critério de aceite

- Eventos críticos são auditados.
- Payload sensível é redatado.
- Audit log contém tenant/property/requestId.
- Testes cobrem sanitização.
- Política de retenção documentada e implementada.

---

## Sprint 8 — Soft delete premium + cascata

### Objetivo

Preservar histórico técnico e definir cascata.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Completar soft delete em entidades premium e definir comportamento de cascata.

Tarefas:
1. Mapear tabelas sem `deleted_at`.
2. Definir três categorias:
   a) Soft delete obrigatório (entidades premium): service_bids, service_messages, document_extraction_candidates, provider_ratings, property_collaborators, property_invites, image_variants, nfe_imports.
   b) Estratégia tokenizada (revogação por status): service_share_links, audit_links.
   c) Sem soft delete (append-only): audit_log, refresh_tokens, mfa_challenges.
3. Documentar a categorização em docs/SOFT_DELETE_POLICY.md.
4. Criar migration adicionando `deleted_at` na categoria (a).
5. Atualizar schema Drizzle.
6. Trocar deletes físicos por update de `deleted_at`.
7. Atualizar listagens para filtrar `deleted_at IS NULL`.
8. Definir cascata:
   - quando property é soft-deleted, rooms/services/docs ficam visíveis em relatórios históricos mas escondidos em listas operacionais;
   - documentar regra em docs/SOFT_DELETE_POLICY.md.
9. Adicionar audit log de soft delete (entityType, entityId, actor, motivo).
10. Criar testes:
    - delete vira soft delete;
    - listas filtram corretamente;
    - histórico mostra item deletado;
    - cascata não apaga FK física.

Regras:
- Não apagar dado real.
- Não quebrar FK.
- Não esconder histórico necessário.
- Não aplicar filtro em relatório histórico sem revisar regra.

Saída:
- Migration.
- Schema.
- Rotas ajustadas.
- Política de cascata documentada.
- Testes.
```

### Critério de aceite

- Delete crítico vira soft delete.
- Listas não mostram deletados.
- Histórico continua íntegro.
- Audit log registra exclusão com motivo.
- Cascata documentada e testada.

---

## Sprint 9 — LGPD & Privacidade

### Objetivo

Conformidade legal mínima antes de processar dado real de cliente premium brasileiro.

### Prompt para agente

```txt
Você está no HouseLog, backend e frontend.

Objetivo:
Implementar conformidade LGPD mínima para piloto comercial.

Tarefas backend:
1. Criar RoPA (Registro de Operações de Tratamento) em docs/legal/ROPA.md listando:
   - categorias de dado pessoal (email, telefone, endereço, fotos, documentos);
   - finalidade de cada tratamento;
   - base legal (consentimento, execução de contrato, legítimo interesse);
   - retenção.
2. Criar endpoints LGPD:
   - GET /api/v1/me/data-export → ZIP com todos os dados do usuário (assíncrono via queue);
   - POST /api/v1/me/delete-account → marca conta para eliminação, com período de 30 dias para revogar;
   - GET /api/v1/me/audit-trail → eventos do próprio usuário.
3. Implementar consent log:
   - tabela `user_consents` com versão dos termos aceitos;
   - exigir aceite em registro e em mudança de termos.
4. Auditar todos os pontos de coleta de PII e cruzar com RoPA.

Tarefas frontend:
1. Página `/legal/privacidade` com política de privacidade.
2. Página `/legal/termos` com termos de uso.
3. Checkbox de aceite no registro (com versão).
4. Em `/settings`, seção "Privacidade":
   - exportar meus dados;
   - excluir minha conta;
   - histórico de aceite.

Tarefas administrativas:
1. Definir DPO/encarregado e publicar contato.
2. Documentar processo de resposta a requisição de titular em docs/legal/DPO_PLAYBOOK.md.

Regras:
- Não processar PII sem base legal documentada.
- Não dificultar direito de eliminação.
- Não enviar PII a IA externa sem redação.
- Auditar acesso a PII.

Saída:
- RoPA.
- Endpoints LGPD.
- Páginas legais.
- Consent log.
- DPO playbook.
```

### Critério de aceite

- RoPA cobre todas as categorias de PII.
- Direito de acesso/portabilidade/eliminação funcional.
- Consent log funcional.
- Política de privacidade publicada.
- DPO definido.

---

## Sprint 10 — Observabilidade

### Objetivo

Visibilidade operacional para piloto.

### Prompt para agente

```txt
Você está no HouseLog.

Objetivo:
Implementar observabilidade mínima para operar piloto sem voar às cegas.

Tarefas backend:
1. Error tracking:
   - integrar Sentry (ou alternativa compatível com Workers);
   - capturar exceções com tenantId, propertyId, requestId, userId (sem PII além disso);
   - tagging por rota e ambiente.
2. Logs estruturados:
   - usar logger central (src/lib/logger.ts) já existente;
   - garantir JSON estruturado: level, ts, message, requestId, tenantId, route, latency_ms.
   - cuidar de sanitização (mesma lista do audit log).
3. Métricas via Cloudflare Analytics Engine ou similar:
   - request count por rota;
   - latência p50/p95/p99;
   - error rate;
   - queue lag (mensagens pendentes em houselog-jobs e houselog-document-ingestion);
   - AI calls e custo estimado (quando Sprint 11 chegar).
4. Health endpoint /health com:
   - status DB;
   - status R2;
   - status KV;
   - status queues;
   - versão do build.

Tarefas frontend:
1. Sentry no frontend para capturar erros de cliente.
2. Web Vitals (CLS, LCP, INP) reportados.

Tarefas administrativas:
1. Definir alertas:
   - 5xx > 1% em 5 min;
   - queue backlog > 100 mensagens;
   - error rate em login/refresh > 5%.
2. Definir on-call e canal de notificação.
3. Criar runbook básico em docs/RUNBOOK.md.

Regras:
- Não logar segredo.
- Não logar PII além do necessário para debug.
- Alerta deve ser acionável.
- Documentar custo da observabilidade.

Saída:
- SDKs integrados.
- Logger padronizado.
- Health endpoint.
- Dashboard de métricas.
- Runbook + alertas.
```

### Critério de aceite

- Exceções aparecem em error tracker.
- Logs estruturados em JSON.
- Health endpoint operacional.
- Alertas básicos configurados.
- Runbook documentado.

---

## Sprint 11 — IA real de documentos

### Objetivo

Transformar pipeline fake em IA utilizável com defesa LGPD.

### Prompt para agente

```txt
Você está no backend e frontend do HouseLog.

Objetivo:
Substituir ingestão fake de documentos por pipeline real com IA, revisão humana e defesa LGPD.

Decisão arquitetural padrão:
- DEFAULT: usar Workers AI (binding [ai] já configurado no wrangler.toml). Mantém dado no Cloudflare, simplifica LGPD.
- ALTERNATIVA: adapter para OpenAI/Anthropic via flag por tenant, apenas com consentimento explícito e PII redaction.

Backend:
1. Preservar fila atual (houselog-document-ingestion).
2. Ler conteúdo do documento com autorização tenant/property.
3. PII redaction antes de qualquer envio externo (CPF, RG, telefone, endereço).
4. Detecção e bloqueio básico de prompt injection no documento.
5. Integrar provider real via adapter em src/lib/ai/:
   - cloudflare.ts (default);
   - openai.ts (opcional);
   - anthropic.ts (opcional).
6. Validar saída com Zod estritamente (PropertyDocumentExtractionSchema).
7. Salvar extraction, review e candidates.
8. Confidence score real (não fixo).
9. Falhar de forma segura se IA retornar payload inválido (não criar candidate ruim).
10. Nunca aplicar alteração automaticamente sem revisão humana.
11. Remover ou isolar `FAKE_DOCUMENT_INGESTION_MODEL_NAME` para uso apenas em test/CI.

Quotas e custo:
1. Rate limit por tenant (não só por IP) em chamadas AI.
2. Quota mensal por plano (preparar para Sprint 13 — Billing).
3. Telemetria de custo por chamada.

Frontend:
1. Atualizar tela de revisão de candidates em /properties/[id]/documents/[documentId]/ingestion com diff visual:
   - valor atual no domínio;
   - valor extraído;
   - confiança em barra;
   - evidência (trecho do documento com highlight);
   - origem (página/coordenada quando aplicável);
   - editar antes de aplicar.
2. Permitir:
   - aprovar (aplica direto);
   - rejeitar (com motivo);
   - editar (abre form com extraído pré-preenchido);
   - aplicar parcialmente (apenas candidates aprovados).
3. Mostrar estados:
   - queued;
   - processing;
   - needs_review;
   - completed;
   - failed (com motivo).
4. Listar histórico de jobs e candidates aplicados.

Regras:
- Não vender IA fake.
- Não aplicar dados sem revisão.
- Não confiar em JSON de IA sem schema.
- Não expor documento privado.
- Não processar arquivo sem autorização tenant/property.
- Não enviar PII a provider externo sem consentimento.
- Não permitir prompt injection elevar privilégio.

Saída:
- Adapter de IA por provider.
- Consumer real.
- PII redaction.
- Quota e telemetria.
- Tela de revisão com diff.
- Testes.
- Documentação de limites em docs/AI_LIMITS.md.
```

### Critério de aceite

- Fake model removido ou isolado para test.
- IA real (default Workers AI) gera candidates.
- Zod valida saída.
- PII redaction antes de externo.
- Usuário revisa antes de aplicar com diff visual.
- Cross-tenant protegido.
- Quota por tenant ativa.

---

## Sprint 12 — Performance & Acessibilidade

### Objetivo

Atender padrão premium em web vitals e WCAG AA.

### Prompt para agente

```txt
Você está no frontend Next.js do HouseLog.

Objetivo:
Atingir Lighthouse ≥90 em Performance, Accessibility, Best Practices e SEO; WCAG AA mínimo.

Tarefas:
1. Auditoria de bundle:
   - rodar `next build` e analisar com @next/bundle-analyzer;
   - identificar pacotes pesados (recharts, react-pdf, qrcode);
   - lazy-load por rota (dynamic import) onde aplicável.
2. Code splitting:
   - financial dashboard com recharts → dynamic import com loading skeleton;
   - PDF renderer → carregar só quando usuário clicar em "Exportar";
   - QR code → dynamic import.
3. Imagens:
   - usar next/image em todos os componentes;
   - tamanhos responsivos;
   - lazy load nativo;
   - thumbnails via R2 já existentes.
4. Acessibilidade:
   - adicionar `eslint-plugin-jsx-a11y` ao eslint.config.mjs;
   - corrigir violações;
   - contraste mínimo 4.5:1 (verificar tokens The Architectural Lens);
   - navegação por teclado em todos os fluxos críticos;
   - aria-labels em ícones-só-ícone;
   - foco visível;
   - screen reader em forms grandes.
5. Web Vitals:
   - LCP < 2.5s;
   - INP < 200ms;
   - CLS < 0.1.
6. PWA install prompt e teste em mobile real.

Regras:
- Não sacrificar funcionalidade por performance.
- Não usar `aria-hidden` para esconder de SR sem motivo.
- Não dispensar contraste por estética.

Saída:
- Relatório Lighthouse antes/depois.
- Bundle size por rota.
- Lista de correções a11y.
- Documentação em docs/PERFORMANCE_BUDGET.md.
```

### Critério de aceite

- Lighthouse ≥90 em todas as métricas.
- Bundle inicial < 250KB gzipped.
- a11y eslint sem violações.
- WCAG AA validado em fluxos críticos.

---

## Sprint 13 — Billing e planos

### Objetivo

Modelar planos para piloto comercial e escala.

### Prompt para agente

```txt
Você está no HouseLog.

Objetivo:
Criar fundação de billing para piloto comercial. Implementação completa de gateway pode ser manual no piloto.

Tarefas backend:
1. Schema:
   - plans (id, name, price, billing_period, limits_json);
   - subscriptions (id, tenant_id, plan_id, status, started_at, current_period_end);
   - usage_meters (id, tenant_id, metric, count, period).
2. Métricas a monitorar:
   - nº de propriedades;
   - GB de documentos;
   - AI tokens consumidos;
   - usuários ativos;
   - prestadores na rede.
3. Middleware de enforcement:
   - bloquear criação de propriedade acima do limite;
   - bloquear upload acima do limite;
   - retornar 402 PAYMENT_REQUIRED com link para upgrade.
4. Webhooks placeholder para gateway:
   - subscription.created;
   - subscription.updated;
   - subscription.canceled;
   - payment.failed.
5. Para piloto: planos fixos seedados, cobrança manual fora do sistema.

Tarefas frontend:
1. /settings/billing com plano atual e uso.
2. Alerta quando perto do limite.
3. Página /plans pública.
4. CTA de upgrade.

Decisão de gateway (deferida):
- Stripe (internacional, mais robusto);
- Asaas/PagBank/Iugu (Brasil, PIX nativo);
- definir antes de Sprint 14.

Regras:
- Não bloquear acesso a histórico técnico (dado do cliente) se assinatura vencer — apenas funcionalidades novas.
- Não cobrar sem aviso.
- Auditar mudanças de plano.

Saída:
- Schema.
- Middleware de enforcement.
- Páginas de billing.
- Plans seedados.
- Documentação em docs/BILLING.md.
```

### Critério de aceite

- Schema de plans/subscriptions/usage_meters criado.
- Enforcement básico ativo (sem bloquear dados existentes).
- Uso visível ao usuário.
- Decisão de gateway documentada para piloto.

---

## Sprint 14 — Produto premium e go-live controlado

### Objetivo

Preparar piloto comercial.

### Prompt para agente

```txt
Você está no HouseLog.

Objetivo:
Preparar o produto para piloto premium controlado com construtoras, gestores ou imóveis de alto padrão.

Tarefas:
1. Auditar e remover linguagem de marketplace aberto em todo o frontend:
   - portal provider (/src/app/provider/*);
   - copy de oportunidades;
   - tabelas de comparação.
2. Ajustar copy global para:
   - Prontuário Técnico Digital;
   - Rede Técnica Homologada;
   - Histórico Técnico do Imóvel;
   - Entrega Técnica Premium.
3. Revisar e fechar telas críticas (remover placeholders):
   - dashboard owner;
   - detalhe do imóvel (page hub);
   - documentos com ingestion;
   - garantias;
   - reformas;
   - handover;
   - OS;
   - team (TODOs marcados);
   - service-requests (TODOs marcados);
   - services/[serviceId] (TODOs marcados);
   - relatório PDF.
4. Criar fluxo de demo end-to-end:
   - cadastrar imóvel;
   - criar ambiente;
   - registrar sistema técnico;
   - abrir OS;
   - anexar fotos antes/depois;
   - registrar garantia;
   - gerar relatório PDF premium;
   - ingerir 1 documento (NF de serviço) e revisar candidates;
   - exportar handover.
5. Checklist de go-live em docs/GO_LIVE_CHECKLIST.md cobrindo:
   - todos os sprints anteriores concluídos;
   - LGPD ok;
   - observabilidade ok;
   - billing seedado;
   - performance/a11y ≥90;
   - 3-5 imóveis piloto identificados;
   - SLA documentado.
6. Narrativas por ICP em docs/marketing/:
   - construtora (entrega técnica + pós-venda);
   - gestor patrimonial (governança e histórico);
   - proprietário alto padrão (prontuário pessoal);
   - engenheiro/arquiteto (rastreabilidade técnica).

Regras:
- Não inventar backend.
- Não abrir marketplace público.
- Não vender IA antes de pronta (Sprint 11).
- Não deixar tela placeholder em fluxo principal.
- Manter The Architectural Lens.

Saída:
- Lista de telas prontas/incompletas.
- Ajustes de copy.
- Checklist de demo end-to-end.
- Checklist de go-live.
- Narrativas por ICP.
```

### Critério de aceite

- Demo end-to-end funciona ponta a ponta.
- Linguagem premium consistente em todo app.
- Sem placeholder em fluxo essencial.
- Relatório mostra valor claro para cliente.
- Checklist de go-live preenchível.

---

## 5. Checklist mestre de qualidade

Antes de considerar o HouseLog pronto para piloto:

### Build e CI

- [ ] `npm run type-check` passa em front, api e contracts.
- [ ] `npm run lint` passa.
- [ ] `npm run test` passa.
- [ ] `npm run build` passa.
- [ ] `wrangler deploy --dry-run` passa.
- [ ] `drizzle-kit check` sem drift.
- [ ] GitHub Actions configurado (ci, security, db).
- [ ] Secret scanning ativo.
- [ ] PR quebrado não faz merge.

### Configuração Cloudflare

- [ ] Dev e prod com D1 separados.
- [ ] KV prod configurado (sem placeholder).
- [ ] R2 prod e dev em buckets separados.
- [ ] Filas com nome consistente entre producer e consumer.
- [ ] Dev publica em fila de dev (não de prod).
- [ ] Secrets fora do repositório.
- [ ] Segredos históricos rotacionados.
- [ ] Backup do D1 documentado.

### Segurança

- [ ] Refresh token não fica no `localStorage`.
- [ ] Refresh token em cookie HttpOnly + Secure + SameSite=Strict.
- [ ] Endpoint `/auth/refresh` sem fallback de body (após período de transição).
- [ ] Access token apenas em memória.
- [ ] CSRF protection ativa.
- [ ] CORS sem wildcard em produção.
- [ ] Middleware Next.js protegendo rotas privadas.
- [ ] Rate limit ativo.
- [ ] Logs sem segredo.
- [ ] TOTP de fato implementado (não apenas tabela).

### Multi-tenant

- [ ] Toda entidade central tem `tenantId NOT NULL`.
- [ ] `tenantId` não vem do client.
- [ ] Queries filtram por tenant.
- [ ] Teste cross-tenant existe e retorna 404.
- [ ] `requireTenantPropertyAccess` usado em ≥25 rotas.
- [ ] Rotas público-tokenizadas com estratégia especial documentada.

### Auditoria

- [ ] Eventos críticos geram audit log.
- [ ] Payload sensível é sanitizado.
- [ ] Audit log tem tenant/property/requestId.
- [ ] Ações de segredo são auditadas.
- [ ] Política de retenção implementada.

### Soft delete

- [ ] Entidades premium têm `deleted_at`.
- [ ] Cascata documentada e testada.
- [ ] Listas filtram `deleted_at IS NULL`.
- [ ] Histórico técnico preservado.

### LGPD

- [ ] RoPA documentada.
- [ ] Endpoints de export/delete funcionais.
- [ ] Consent log ativo.
- [ ] Política de privacidade publicada.
- [ ] DPO definido.

### Observabilidade

- [ ] Error tracking integrado (front + back).
- [ ] Logs estruturados em JSON.
- [ ] Health endpoint operacional.
- [ ] Alertas configurados.
- [ ] Runbook documentado.

### IA

- [ ] Fake model não aparece em produção.
- [ ] IA real (default Workers AI) validada por Zod.
- [ ] PII redaction antes de envio externo.
- [ ] Defesa contra prompt injection.
- [ ] Revisão humana obrigatória.
- [ ] Diff visual no frontend.
- [ ] Quota por tenant.
- [ ] Falhas da IA tratadas sem criar candidate ruim.

### Performance & A11y

- [ ] Lighthouse ≥90 em todas as métricas.
- [ ] Bundle inicial < 250KB gzipped.
- [ ] WCAG AA em fluxos críticos.
- [ ] PWA instalável em mobile.

### Billing

- [ ] Schema de plans/subscriptions/usage_meters.
- [ ] Enforcement de limites ativo.
- [ ] Uso visível ao usuário.
- [ ] Gateway decidido para piloto.

### Produto

- [ ] Fluxo imóvel → ambiente → OS → fotos → relatório funciona end-to-end.
- [ ] Garantias funcionam.
- [ ] Documentos com ingestion funcionam.
- [ ] Handover básico funciona.
- [ ] Relatório PDF premium existe.
- [ ] Linguagem premium aplicada em 100% do app.
- [ ] Sem marketplace aberto como narrativa principal.
- [ ] Narrativas por ICP publicadas.

---

## 6. Como o Fernando deve conduzir os agentes

Use sempre este formato:

```txt
Você está no repositório HouseLog.

Antes de alterar:
1. Leia AGENTS.md da raiz.
2. Leia AGENTS.md do domínio afetado.
3. Leia os arquivos reais envolvidos.
4. Explique diagnóstico.
5. Explique plano.
6. Só depois implemente.

Durante a implementação:
- Não invente endpoint.
- Não altere contrato sem revisar frontend/backend.
- Não use any sem justificativa.
- Não ignore erro.
- Não crie feature fora do escopo.
- Não remova teste.
- Não enfraqueça segurança.
- Não pule etapa do masterplan.

Na entrega:
1. Liste arquivos alterados.
2. Explique o que mudou.
3. Explique riscos.
4. Diga comandos rodados.
5. Diga validações manuais.
6. Diga o próximo passo recomendado.
```

---

## 7. Bugs críticos não-óbvios já identificados

Itens que devem ser corrigidos sem esperar o sprint correspondente, caso o agente esbarre neles:

1. **`wrangler.toml` queue mismatch** — producer `houselog-jobs` vs consumer `houselog-queue` (Sprint 2).
2. **Dev producer aponta para fila de produção** (Sprint 2).
3. **`requireTenantPropertyAccess` existe mas é usado em zero rotas** (Sprint 5).
4. **`database_id` idêntico dev/prod** (Sprint 2).
5. **`/auth/refresh` aceita refresh token por body e retorna no JSON** (Sprint 3).
6. **`tenantId` nullable em properties/rooms/inventory/services/bids/documents/auditLinks** (Sprint 6).
7. **Document ingestion é fake** (`FAKE_DOCUMENT_INGESTION_MODEL_NAME`) — Sprint 11.
8. **Sem `src/middleware.ts`** — Sprint 4.
9. **KV prod com placeholder `COLE_AQUI_O_ID_DO_KV_PRODUCAO`** — Sprint 2.

---

## 8. Ordem de execução recomendada

Execute nesta ordem, sem pular:

1. `Sprint 0` — Diagnóstico real de build.
2. `Sprint 1` — CI + secret scanning + drizzle check.
3. `Sprint 2` — Cloudflare config (com fix das filas).
4. `Sprint 3` — Cookie HttpOnly + CSRF.
5. `Sprint 4` — Middleware Next (Edge).
6. `Sprint 5` — Authorization Core (adoção real do middleware).
7. `Sprint 6` — Backfill tenantId NOT NULL.
8. `Sprint 7` — Audit log + retenção.
9. `Sprint 8` — Soft delete + cascata.
10. `Sprint 9` — LGPD & Privacidade.
11. `Sprint 10` — Observabilidade.
12. `Sprint 11` — IA real (Workers AI default, PII redaction, quota).
13. `Sprint 12` — Performance & A11y.
14. `Sprint 13` — Billing.
15. `Sprint 14` — Go-live premium.

**Justificativa da reordenação vs. versão anterior:**

- LGPD (Sprint 9) e Observabilidade (Sprint 10) entram **antes** da IA real porque qualquer processamento de documentos com PII precisa de base legal e monitoramento.
- Performance/A11y (Sprint 12) e Billing (Sprint 13) entram **antes** do go-live para o piloto ser realmente vendável.
- Soft delete antes de LGPD porque LGPD requer eliminação seletiva — soft delete + audit é a base.

---

## 9. Regra de parada

Se algum sprint falhar em build, teste ou segurança:

**Parar. Corrigir. Validar. Só depois avançar.**

Não acumular feature em cima de base quebrada.

Se um sprint expor um problema fundamental (ex.: Sprint 0 revela que o build não compila), pausar o roadmap e abrir um sprint de correção antes de continuar.

---

## 10. Norte final do produto

O HouseLog deve ser vendido como:

> Uma plataforma premium de governança técnica e histórico inteligente de imóveis, criada para construtoras, gestores patrimoniais, engenheiros, arquitetos e proprietários de alto padrão que precisam saber exatamente o que existe no imóvel, o que foi feito, quem fez, quando fez, quanto custou e quais garantias ainda estão válidas.

Esse é o caminho.

---

## 11. Histórico de versões

- **v1.0** — Plano inicial em 11 sprints (base).
- **v2.0** — Consolidação após auditorias técnicas: adicionados Sprint 9 (LGPD), Sprint 10 (Observabilidade), Sprint 12 (Performance/A11y), Sprint 13 (Billing); corrigida sequência para colocar LGPD/observabilidade antes da IA; identificado bug de queue mismatch no `wrangler.toml`; ajustado Sprint 5 para refletir que `requireTenantPropertyAccess` já existe mas não é adotado; ajustado Sprint 7 para estender (não recriar) o catálogo de auditoria.
