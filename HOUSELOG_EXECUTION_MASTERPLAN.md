# HOUSELOG_EXECUTION_MASTERPLAN.md

> Guia mestre de execução técnica para evoluir o HouseLog com segurança, arquitetura limpa e foco em produto premium vendável.

**Projeto:** HouseLog  
**Repositório oficial:** `fhoinaski/HouseLog`  
**Produto:** Prontuário Técnico Digital do Imóvel  
**Objetivo:** transformar o HouseLog em uma plataforma SaaS premium, segura, multi-tenant e vendável para gestão técnica de imóveis, manutenção, documentos, garantias, reformas, diagnósticos, orçamentos e histórico técnico.

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
7. Só depois evoluir IA, UX premium e funcionalidades comerciais.

**Não avançar para feature nova enquanto P0 estiver aberto.**

---

## 2. Estado atual resumido

O HouseLog já possui uma base forte:

- Frontend em Next.js + React + Tailwind.
- Backend em Cloudflare Workers + Hono + D1 + Drizzle.
- Estrutura multi-tenant iniciada.
- Módulos de imóveis, ambientes, OS, documentos, manutenção, financeiro, provider, mensagens, garantias, reformas e handover.
- Design system `The Architectural Lens`.
- Regras para agentes em `AGENTS.md`.
- Scripts de type-check, lint, test e build.

Mas ainda não está pronto para produção premium porque existem riscos em:

- configuração `wrangler.toml`;
- separação dev/prod;
- refresh token em `localStorage`;
- ausência de middleware Next para proteção SSR;
- autorização ainda não aplicada de forma 100% consistente;
- audit log parcial;
- IA de documentos ainda simulada;
- testes e CI insuficientes.

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

### 3.2 Multi-tenant

- Toda entidade sensível deve ter `tenantId`.
- `tenantId` deve ser resolvido no servidor.
- Queries devem filtrar por `tenantId` e contexto do imóvel.
- Testes devem provar que um tenant não acessa dados do outro.
- Preferir `resolveTenant` + `requireTenantPropertyAccess`.

### 3.3 Código

- TypeScript forte.
- Evitar `any`.
- Não mascarar erro com cast inseguro.
- Não duplicar regra de negócio.
- Não criar endpoint fictício.
- Não criar fluxo no frontend sem backend real.
- Não quebrar contrato sem revisar consumidores.

### 3.4 Produto

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
2. Instalar dependências necessárias.
3. Rodar os scripts disponíveis:
   - npm install
   - npm run type-check
   - npm run lint
   - npm run test
   - npm run build
   - npm run check, se existir
4. Rodar comandos separados no frontend e backend se necessário.
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

---

## Sprint 1 — CI e validação automática

### Objetivo

Criar GitHub Actions para impedir regressão.

### Prompt para agente

```txt
Você está no repositório HouseLog.

Objetivo:
Criar pipeline de CI no GitHub Actions para validar o projeto em todo push e pull request.

Tarefas:
1. Criar `.github/workflows/ci.yml`.
2. Usar Node compatível com o projeto.
3. Instalar dependências.
4. Rodar:
   - type-check;
   - lint;
   - tests;
   - build.
5. Separar frontend e backend se necessário.
6. Usar cache de npm.
7. Falhar o pipeline se qualquer etapa falhar.

Regras:
- Não alterar código de aplicação.
- Não ignorar erro.
- Não adicionar `continue-on-error`.
- Não usar build parcial como se fosse validação completa.

Saída:
- Arquivo CI criado.
- Explicação curta dos jobs.
- Comandos equivalentes para rodar localmente.
```

### Critério de aceite

- CI roda em push e PR.
- Type-check, lint, test e build são obrigatórios.
- Pipeline falha se houver erro.

---

## Sprint 2 — Corrigir configuração Cloudflare

### Objetivo

Separar ambiente dev/prod e remover configuração perigosa.

### Prompt para agente

```txt
Você está no backend do HouseLog em Cloudflare Workers.

Objetivo:
Corrigir `house-log-back/apps/api/wrangler.toml` para deixar dev/prod seguros e separados.

Problemas a resolver:
- `database_id` de dev e produção não podem ser iguais.
- KV de produção não pode ter placeholder.
- Secrets não devem ficar no `wrangler.toml`.
- R2/Resend/JWT/CREDENTIALS devem ser configurados via `wrangler secret put`.

Tarefas:
1. Revisar `wrangler.toml`.
2. Separar dev e production.
3. Remover variáveis sensíveis vazias do arquivo versionado.
4. Manter apenas variáveis não sensíveis.
5. Criar ou atualizar `.env.example`.
6. Criar `docs/deployment/cloudflare-env.md`.
7. Documentar comandos:
   - wrangler d1 create
   - wrangler kv namespace create
   - wrangler r2 bucket create
   - wrangler secret put JWT_SECRET
   - wrangler secret put CREDENTIALS_ENCRYPTION_KEY
   - wrangler secret put RESEND_API_KEY
8. Criar checklist pré-deploy.

Regras:
- Nunca inventar IDs reais.
- Nunca commitar segredo.
- Nunca reutilizar D1 dev em produção.
- Não alterar regra de negócio.
- Não quebrar scripts existentes.

Saída:
- Diff dos arquivos.
- Comandos que o Fernando deve rodar manualmente.
- Checklist de validação.
```

### Critério de aceite

- Dev e prod usam bancos diferentes.
- Produção não tem placeholder.
- Secrets saem do arquivo versionado.
- Existe documentação clara de deploy.

---

## Sprint 3 — Sessão segura com cookie HttpOnly

### Objetivo

Remover refresh token do `localStorage`.

### Prompt para agente

```txt
Você está no HouseLog, backend Hono/Cloudflare Workers e frontend Next.js.

Objetivo:
Migrar refresh token de `localStorage` para cookie HttpOnly, Secure e SameSite.

Backend:
1. Ajustar `/auth/login` para gravar refresh token em cookie HttpOnly.
2. Ajustar `/auth/mfa/challenge` para gravar refresh token em cookie HttpOnly.
3. Ajustar `/auth/register` se o registro também autentica o usuário.
4. Ajustar `/auth/refresh` para ler refresh token do cookie.
5. Ajustar `/auth/logout` para revogar e limpar cookie.
6. Configurar:
   - HttpOnly;
   - Secure em production;
   - SameSite=Lax ou Strict;
   - Path adequado;
   - Max-Age coerente.
7. Manter fallback temporário de body apenas se necessário e documentar remoção futura.

Frontend:
1. Remover persistência de refresh token em `localStorage`.
2. Evitar persistir access token por longo prazo.
3. Atualizar `auth-context.tsx`.
4. Atualizar cliente HTTP para usar `credentials: "include"`.
5. Garantir que logout limpe estado local.
6. Garantir que MFA continue funcionando.

Testes:
1. Login cria cookie.
2. Refresh usa cookie.
3. Logout limpa cookie.
4. Sem cookie não renova.
5. MFA continua funcionando.
6. `localStorage` não contém refresh token.

Regras:
- Não expor refresh token ao JavaScript.
- Não enfraquecer CORS.
- Não quebrar compatibilidade sem teste.
- Não aceitar tenantId do cliente.
- Não logar token.

Saída:
- Arquivos alterados.
- Explicação objetiva.
- Checklist manual no navegador.
```

### Critério de aceite

- `hl_refresh` não existe mais no `localStorage`.
- Refresh token está em cookie HttpOnly.
- Login/refresh/logout/MFA funcionam.
- CORS aceita credenciais apenas para origins permitidos.

---

## Sprint 4 — Middleware Next.js

### Objetivo

Proteger rotas privadas antes da renderização.

### Prompt para agente

```txt
Você está no frontend Next.js do HouseLog.

Objetivo:
Criar `src/middleware.ts` para proteger rotas privadas.

Rotas públicas prováveis:
- `/login`
- `/register`
- `/invite`
- `/share`
- `/audit`
- `/offline`
- `/splash`
- assets estáticos
- `_next/*`

Rotas privadas prováveis:
- `/dashboard`
- `/properties`
- `/services`
- `/financial`
- `/schedule`
- `/settings`
- `/provider`
- `/audit-log`

Tarefas:
1. Criar `src/middleware.ts`.
2. Definir matcher seguro.
3. Redirecionar usuário sem sessão para `/login`.
4. Evitar loop de redirect.
5. Preservar rotas públicas de convite/share/audit.
6. Manter PWA/offline funcionando.
7. Usar cookie de sessão/refresh como base de decisão.
8. Não tentar validar JWT no Edge se não houver segredo disponível.

Regras:
- Middleware não substitui autorização backend.
- Não bloquear assets.
- Não quebrar rota pública.
- Não criar falsa segurança.
- Código limpo e pequeno.

Saída:
- Código completo.
- Lista de rotas públicas/privadas.
- Limitações documentadas.
```

### Critério de aceite

- Rotas privadas redirecionam sem sessão.
- Rotas públicas continuam acessíveis.
- Não há loop.
- Build passa.

---

## Sprint 5 — Authorization Core definitivo

### Objetivo

Garantir autorização multi-tenant consistente.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Consolidar o Authorization Core e aplicar em todas as rotas sensíveis.

Contexto:
Já existem helpers como:
- `authMiddleware`
- `resolveTenant`
- `requireTenantPropertyAccess`
- `assertTenantPropertyAccess`

Tarefas:
1. Mapear todas as rotas que usam:
   - propertyId;
   - serviceId;
   - documentId;
   - credentialId;
   - warrantyId;
   - renovationId;
   - handoverId.
2. Verificar se cada rota aplica:
   - authMiddleware;
   - resolveTenant;
   - requireTenantPropertyAccess ou helper equivalente.
3. Criar permissões por ação:
   - view;
   - manage;
   - create;
   - update;
   - delete;
   - change_status;
   - evidence;
   - secret.
4. Padronizar códigos:
   - 400 TENANT_REQUIRED;
   - 401 UNAUTHORIZED;
   - 403 FORBIDDEN;
   - 404 NOT_FOUND.
5. Evitar vazamento cross-tenant por mensagem de erro.
6. Criar testes para:
   - usuário correto acessa;
   - outro tenant não acessa;
   - sem tenant ativo falha;
   - provider sem permissão falha;
   - secret exige permissão elevada.

Rotas prioritárias:
- documents;
- credentials;
- services;
- service messages;
- bids;
- share links;
- audit links;
- warranties;
- renovations;
- handover;
- technical systems;
- technical points;
- maintenance;
- finance.

Regras:
- Não aceitar `tenantId` do body como autoridade.
- Não duplicar lógica em cada rota.
- Não transformar 404 em 403 quando isso vazar existência de recurso.
- Não quebrar rotas públicas legítimas.

Saída:
- Relatório de rotas auditadas.
- Rotas corrigidas.
- Helpers adicionados/refatorados.
- Testes adicionados.
- Pendências restantes.
```

### Critério de aceite

- Toda rota sensível passa por autorização contextual.
- Teste cross-tenant existe.
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
1. Identificar tabelas com `tenantId` nullable.
2. Classificar:
   - entidades que devem obrigatoriamente ter tenant;
   - entidades públicas/tokenizadas que podem ter tratamento especial.
3. Criar script de diagnóstico:
   - listar registros com tenant_id nulo;
   - indicar origem possível do tenant via property/service/document.
4. Criar script de backfill idempotente.
5. Criar migration para tornar `tenant_id` obrigatório onde for seguro.
6. Atualizar schema Drizzle.
7. Atualizar inserts para sempre preencher `tenantId`.
8. Adicionar testes.

Tabelas prioritárias:
- properties;
- rooms;
- inventory_items;
- service_orders;
- service_bids;
- documents;
- audit_links;
- service_messages;
- expenses;
- maintenance_schedules.

Regras:
- Não apagar dado.
- Não fazer migration destrutiva.
- Não assumir tenant quando houver ambiguidade.
- Se não der para inferir, gerar relatório manual.
- Toda query nova deve incluir tenant.

Saída:
- Diagnóstico.
- Script de backfill.
- Migration.
- Schema atualizado.
- Testes.
```

### Critério de aceite

- Registros órfãos foram identificados.
- Backfill é idempotente.
- Inserts novos sempre preenchem tenant.
- Testes garantem tenant obrigatório.

---

## Sprint 7 — Audit log completo

### Objetivo

Criar trilha de auditoria premium.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Padronizar audit log para eventos críticos do produto.

Tarefas:
1. Revisar implementação atual de `writeAuditLog`.
2. Criar catálogo de eventos se ainda não existir.
3. Aplicar audit log em:
   - properties create/update/delete;
   - rooms create/update/delete;
   - inventory create/update/delete;
   - service orders create/update/status_change/delete;
   - documents upload/delete;
   - credentials create/update/reveal/delete;
   - warranties create/update/delete;
   - renovations create/update/delete;
   - handover create/update/approve/archive;
   - share link create/access/revoke;
   - audit link create/access/expire;
   - document candidate apply/reject.
4. Sanitizar payloads:
   - password;
   - token;
   - refreshToken;
   - secret;
   - credential;
   - r2Key;
   - fileUrl;
   - signedUrl.
5. Garantir metadata:
   - tenantId;
   - propertyId;
   - actorId;
   - action;
   - entityType;
   - entityId;
   - requestId, se existir.

Regras:
- Nunca logar segredo.
- Não deixar audit log quebrar fluxo principal sem política clara.
- Não criar evento genérico inútil.
- Não registrar payload gigante sem necessidade.

Saída:
- Catálogo de eventos.
- Eventos implementados.
- Testes de sanitização.
- Pendências.
```

### Critério de aceite

- Eventos críticos são auditados.
- Payload sensível é redatado.
- Audit log contém tenant/property.
- Testes cobrem sanitização.

---

## Sprint 8 — Soft delete premium

### Objetivo

Preservar histórico técnico.

### Prompt para agente

```txt
Você está no backend do HouseLog.

Objetivo:
Completar soft delete em entidades premium.

Tarefas:
1. Mapear tabelas sem `deleted_at`.
2. Definir onde soft delete é obrigatório.
3. Criar migration adicionando `deleted_at`.
4. Atualizar schema Drizzle.
5. Trocar deletes físicos por update de `deleted_at`.
6. Atualizar listagens para filtrar `deleted_at IS NULL`.
7. Garantir que histórico técnico possa mostrar item deletado quando for evento histórico.
8. Adicionar audit log de soft delete.
9. Criar testes.

Tabelas suspeitas:
- service_bids;
- service_messages;
- document_extraction_candidates;
- provider_ratings;
- property_collaborators;
- property_invites;
- service_share_links;
- image_variants;
- nfe_imports.

Regras:
- Não apagar dado real.
- Não quebrar FK.
- Não esconder histórico necessário.
- Não aplicar filtro em relatório histórico sem revisar regra.

Saída:
- Migration.
- Schema.
- Rotas ajustadas.
- Testes.
```

### Critério de aceite

- Delete crítico vira soft delete.
- Listas não mostram deletados.
- Histórico continua íntegro.
- Audit log registra exclusão.

---

## Sprint 9 — IA real de documentos

### Objetivo

Transformar pipeline fake em IA utilizável.

### Prompt para agente

```txt
Você está no backend e frontend do HouseLog.

Objetivo:
Substituir ingestão fake de documentos por pipeline real com IA e revisão humana.

Backend:
1. Preservar fila atual.
2. Ler conteúdo do documento com segurança.
3. Integrar provider real:
   - Workers AI, se suficiente;
   - ou OpenAI/Anthropic/Gemini via adapter.
4. Validar saída com Zod.
5. Salvar extraction, review e candidates.
6. Criar confidence score.
7. Falhar de forma segura se IA retornar payload inválido.
8. Nunca aplicar alteração automaticamente sem revisão humana.

Frontend:
1. Criar tela de revisão de candidates com diff:
   - valor atual;
   - valor extraído;
   - confiança;
   - evidência;
   - origem;
   - editar antes de aplicar.
2. Permitir:
   - aprovar;
   - rejeitar;
   - editar;
   - aplicar.
3. Mostrar estados:
   - queued;
   - processing;
   - needs_review;
   - completed;
   - failed.

Regras:
- Não vender IA fake.
- Não aplicar dados sem revisão.
- Não confiar em JSON de IA sem schema.
- Não expor documento privado.
- Não processar arquivo sem autorização tenant/property.

Saída:
- Adapter de IA.
- Consumer real.
- Testes.
- Tela de revisão.
- Documentação de limites.
```

### Critério de aceite

- Fake model removido ou isolado para ambiente test.
- IA real gera candidates.
- Zod valida saída.
- Usuário revisa antes de aplicar.
- Cross-tenant protegido.

---

## Sprint 10 — Produto premium e go-live controlado

### Objetivo

Preparar piloto comercial.

### Prompt para agente

```txt
Você está no HouseLog.

Objetivo:
Preparar o produto para piloto premium controlado com construtoras, gestores ou imóveis de alto padrão.

Tarefas:
1. Remover linguagem de marketplace aberto.
2. Ajustar copy para:
   - Prontuário Técnico Digital;
   - Rede Técnica Homologada;
   - Histórico Técnico do Imóvel;
   - Entrega Técnica Premium.
3. Criar ou revisar telas:
   - dashboard owner;
   - detalhe do imóvel;
   - documentos;
   - garantias;
   - reformas;
   - handover;
   - OS;
   - relatório PDF.
4. Criar fluxo de demo:
   - cadastrar imóvel;
   - criar ambiente;
   - registrar sistema técnico;
   - abrir OS;
   - anexar fotos;
   - gerar relatório;
   - registrar garantia.
5. Criar checklist de go-live.

Regras:
- Não inventar backend.
- Não abrir marketplace público.
- Não vender IA antes de pronta.
- Não deixar tela placeholder em fluxo principal.
- Manter The Architectural Lens.

Saída:
- Lista de telas prontas/incompletas.
- Ajustes de copy.
- Checklist de demo.
- Pendências para vender.
```

### Critério de aceite

- Demo principal funciona ponta a ponta.
- Linguagem premium consistente.
- Sem placeholder em fluxo essencial.
- Relatório mostra valor claro para cliente.

---

## 5. Checklist mestre de qualidade

Antes de considerar o HouseLog pronto para piloto:

### Build e CI

- [ ] `npm run type-check` passa.
- [ ] `npm run lint` passa.
- [ ] `npm run test` passa.
- [ ] `npm run build` passa.
- [ ] GitHub Actions configurado.
- [ ] PR quebrado não faz merge.

### Segurança

- [ ] Refresh token não fica no `localStorage`.
- [ ] Cookie HttpOnly ativo.
- [ ] CORS sem wildcard em produção.
- [ ] Secrets fora do repositório.
- [ ] Dev/prod com D1 separados.
- [ ] KV prod configurado.
- [ ] R2 prod configurado.
- [ ] Rate limit ativo.
- [ ] Logs sem segredo.

### Multi-tenant

- [ ] Toda entidade central tem `tenantId`.
- [ ] `tenantId` não vem do client.
- [ ] Queries filtram por tenant.
- [ ] Teste cross-tenant existe.
- [ ] Rotas sensíveis usam autorização contextual.

### Auditoria

- [ ] Eventos críticos geram audit log.
- [ ] Payload sensível é sanitizado.
- [ ] Audit log tem tenant/property.
- [ ] Ações de segredo são auditadas.

### Produto

- [ ] Fluxo imóvel → ambiente → OS → fotos → relatório funciona.
- [ ] Garantias funcionam.
- [ ] Documentos funcionam.
- [ ] Handover básico funciona.
- [ ] Relatório PDF existe.
- [ ] Linguagem premium aplicada.
- [ ] Sem marketplace aberto como narrativa principal.

### IA

- [ ] Fake model não aparece em produção.
- [ ] IA real validada por Zod.
- [ ] Revisão humana obrigatória.
- [ ] Diff visual no frontend.
- [ ] Falhas da IA são tratadas.

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

Na entrega:
1. Liste arquivos alterados.
2. Explique o que mudou.
3. Explique riscos.
4. Diga comandos rodados.
5. Diga validações manuais.
6. Diga o próximo passo recomendado.
```

---

## 7. Ordem de execução recomendada

Execute nesta ordem, sem pular:

1. `Sprint 0` — Diagnóstico real de build.
2. `Sprint 1` — CI.
3. `Sprint 2` — Cloudflare config.
4. `Sprint 3` — Cookie HttpOnly.
5. `Sprint 4` — Middleware Next.
6. `Sprint 5` — Authorization Core.
7. `Sprint 6` — Backfill tenantId.
8. `Sprint 7` — Audit log.
9. `Sprint 8` — Soft delete.
10. `Sprint 9` — IA real.
11. `Sprint 10` — Go-live premium.

---

## 8. Regra de parada

Se algum sprint falhar em build, teste ou segurança:

**Parar. Corrigir. Validar. Só depois avançar.**

Não acumular feature em cima de base quebrada.

---

## 9. Norte final do produto

O HouseLog deve ser vendido como:

> Uma plataforma premium de governança técnica e histórico inteligente de imóveis, criada para construtoras, gestores patrimoniais, engenheiros, arquitetos e proprietários de alto padrão que precisam saber exatamente o que existe no imóvel, o que foi feito, quem fez, quando fez, quanto custou e quais garantias ainda estão válidas.

Esse é o caminho.
