# AI_PROMPT_TEMPLATES.md — HouseLog

Este arquivo define os modelos oficiais de prompt para usar com Codex, Claude, Cursor, AI Studio ou qualquer agente de IA que altere o projeto HouseLog.

O HouseLog é um SaaS premium de prontuário técnico digital de imóveis, com foco em gestão técnica, manutenção residencial, clientes, chamados, diagnósticos, orçamentos, fotos, relatórios, garantias, histórico de serviços executados e evolução multi-tenant sem vazamento de dados entre empresas.

Use estes templates para impedir alterações fora do escopo, proteger a arquitetura, manter segurança e garantir entregas revisáveis.

---

## 1. Regras gerais para qualquer prompt

Todo prompt de implementação deve conter:

1. arquivos obrigatórios para leitura;
2. contexto do produto;
3. objetivo claro;
4. escopo permitido;
5. fora de escopo;
6. estrutura esperada;
7. regras técnicas;
8. regras de segurança;
9. validações obrigatórias;
10. saída final obrigatória.

Nunca envie prompt genérico como:

```txt
Melhore essa tela.
```

Sempre envie prompt fechado, como:

```txt
Agora implemente APENAS: P2-DASH-01 — Transformar Property Dashboard em painel de saúde técnica.
```

---

## 2. Template mestre — qualquer alteração

```txt
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. HOUSELOG_EXECUTION_MASTERPLAN.md
4. docs/ARCHITECTURE.md
5. docs/SECURITY.md
6. docs/MULTI_TENANT_RULES.md
7. docs/AI_AGENT_GUIDE.md
8. docs/AI_IMPLEMENTATION_PLAYBOOK.md
9. docs/adr/*, se existir ADR relacionada ao módulo alterado
10. Arquivos diretamente relacionados à funcionalidade solicitada
11. Contracts/Zod relacionados ao domínio alterado
12. Componentes, hooks, helpers e clientes de API já existentes antes de criar novos

Se houver impacto no frontend, leia também:
- house-log-front/AGENTS.md
- house-log-front/src/lib/api.ts
- house-log-front/src/lib/api/* relacionado ao domínio
- componentes atuais reutilizáveis do módulo afetado

Se houver impacto no backend, leia também:
- house-log-back/AGENTS.md
- house-log-back/apps/api/src/index.ts
- house-log-back/apps/api/src/db/schema.ts
- house-log-back/apps/api/src/middleware/auth.ts
- rotas, libs e testes relacionados ao domínio afetado

Contexto obrigatório:
O HouseLog é um SaaS premium de prontuário técnico digital de imóveis, com foco em histórico técnico, manutenção, documentos, garantias, reformas, ordens de serviço, relatórios e governança multi-tenant.

Agora implemente APENAS:
[ID-DA-ISSUE] — [TÍTULO DA TAREFA]

Objetivo:
[Explique o resultado esperado em 2 a 5 linhas.]

Escopo permitido:
- [item 1]
- [item 2]
- [item 3]

Fora de escopo:
- Não alterar backend, se a tarefa for apenas frontend.
- Não alterar frontend, se a tarefa for apenas backend.
- Não criar endpoint sem autorização explícita.
- Não criar migration sem autorização explícita.
- Não alterar contracts sem autorização explícita.
- Não refatorar módulos inteiros fora do escopo.
- Não implementar feature extra.

Regras obrigatórias:
- Não inventar endpoint.
- Não inventar entidade.
- Não alterar contrato sem revisar frontend e backend.
- Não aceitar tenantId vindo do cliente.
- Toda query sensível deve respeitar tenant/property access.
- Não usar any por conveniência.
- Não remover validação, teste ou segurança para fazer compilar.
- Não mascarar erro com workaround frágil.
- Não quebrar compatibilidade com os fluxos existentes.
- Não alterar design system fora do padrão The Architectural Lens.
- Não criar UI genérica; reaproveite componentes existentes.

Antes de editar código, entregue um plano curto contendo:
1. arquivos lidos;
2. fluxo atual identificado;
3. contratos impactados;
4. riscos de regressão;
5. plano de alteração.

Depois implemente com a menor alteração segura possível.

Validações obrigatórias:
- npm run type-check
- npm run lint
- npm run test
- npm run build
- git diff --check

Se algum comando falhar:
- não esconda o erro;
- informe o erro real;
- explique a causa provável;
- corrija somente se estiver dentro do escopo.

Saída final obrigatória:
1. diagnóstico curto;
2. arquivos alterados;
3. o que foi implementado;
4. contratos afetados;
5. comportamento preservado;
6. validações executadas;
7. riscos restantes;
8. próxima issue recomendada.
```

---

## 3. Template frontend — Property Dashboard / UI premium

```txt
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. HOUSELOG_EXECUTION_MASTERPLAN.md
4. house-log-front/AGENTS.md
5. docs/ARCHITECTURE.md
6. docs/SECURITY.md
7. docs/MULTI_TENANT_RULES.md
8. docs/AI_AGENT_GUIDE.md
9. docs/AI_IMPLEMENTATION_PLAYBOOK.md
10. house-log-front/src/app/(app)/properties/[id]/page.tsx
11. house-log-front/src/lib/api.ts
12. house-log-front/src/lib/api/properties.ts
13. house-log-front/src/lib/api/document-ingestion.ts
14. contracts relacionados ao domínio alterado
15. componentes atuais do módulo afetado
16. house-log-front/src/app/globals.css
17. house-log-front/src/app/tokens.css

Agora implemente APENAS:
[ID-DA-ISSUE] — [TÍTULO DA TAREFA]

Contexto:
[Explique onde a tela está hoje, o que já existe e o que precisa evoluir.]

Objetivo:
[Explique a melhoria esperada na experiência do usuário.]

Escopo permitido:
- frontend;
- tela/módulo especificado;
- reorganização visual;
- componentes pequenos;
- uso de dados já disponíveis;
- loading/error/empty states.

Fora de escopo:
- Não alterar backend.
- Não alterar contracts.
- Não criar endpoint.
- Não criar migration.
- Não alterar regra de negócio.
- Não refatorar todos os módulos.

Estrutura desejada:
1. [seção 1]
2. [seção 2]
3. [seção 3]

Regras UX:
- Visual premium.
- Não parecer ERP.
- Não parecer lista seca de atalhos.
- Copy curta e clara em pt-BR.
- Não mostrar JSON.
- Não usar termos técnicos internos na UI.
- Usar linguagem de produto: prontuário, saúde técnica, análise, sugestão, pendência, histórico.
- Responsivo.
- Todo estado deve ter loading, empty e error state.
- Seguir The Architectural Lens.

Regras técnicas:
- Não usar any.
- Não enviar tenantId.
- Não inventar endpoint.
- Não criar múltiplas chamadas caras desnecessárias.
- Preservar rotas atuais.
- Preservar cards/links existentes quando possível.
- Manter build passando.

Validações obrigatórias:
- npm run type-check
- npm run lint
- git diff --check
- cd house-log-front && npm run build

Saída final obrigatória:
1. diagnóstico curto;
2. arquivos alterados;
3. nova estrutura da tela;
4. componentes criados/reutilizados;
5. dados usados;
6. comportamento preservado;
7. validações executadas;
8. riscos restantes;
9. próxima issue recomendada.

Antes de implementar, faça plano curto.
Depois implemente.
```

---

## 4. Template backend — segurança / multi-tenant

```txt
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. HOUSELOG_EXECUTION_MASTERPLAN.md
4. house-log-back/AGENTS.md
5. docs/ARCHITECTURE.md
6. docs/SECURITY.md
7. docs/MULTI_TENANT_RULES.md
8. docs/AUTHORIZATION_CORE_GAPS.md, se existir
9. house-log-back/apps/api/src/index.ts
10. house-log-back/apps/api/src/middleware/auth.ts
11. house-log-back/apps/api/src/lib/tenant-authorization.ts
12. house-log-back/apps/api/src/lib/authorization.ts
13. house-log-back/apps/api/src/db/schema.ts
14. rotas diretamente afetadas
15. testes existentes relacionados ao domínio alterado

Contexto:
O HouseLog é SaaS multi-tenant. Segurança e isolamento por tenant/property são prioridade maior que velocidade de feature.

Agora implemente APENAS:
[ID-DA-ISSUE] — [TÍTULO DA CORREÇÃO]

Objetivo:
[Explique o problema de segurança/autorização e o resultado esperado.]

Escopo permitido:
- backend;
- rotas afetadas;
- helpers/middlewares existentes;
- testes de segurança;
- ajustes mínimos de schema somente se explicitamente solicitado.

Fora de escopo:
- Não alterar frontend, salvo se contrato quebrar e for explicitamente necessário.
- Não criar feature nova.
- Não criar entidade nova.
- Não alterar fluxo de produto.

Regras obrigatórias:
- Nunca aceitar tenantId do body.
- Nunca confiar em propertyId sem validar acesso.
- Toda rota privada deve usar authMiddleware.
- Toda rota tenant-aware deve usar resolveTenant quando aplicável.
- Toda rota por imóvel deve validar requireTenantPropertyAccess ou helper equivalente.
- Retornar 401 para não autenticado.
- Retornar 400 TENANT_REQUIRED quando faltar tenant ativo.
- Retornar 403 apenas quando o usuário autenticado não tiver permissão.
- Retornar 404 quando o recurso não existir ou estiver fora do escopo permitido.
- Evitar mensagens que revelem existência de recurso de outro tenant.
- Adicionar ou ajustar testes cross-tenant.
- Não remover testes existentes.
- Não usar any.

Antes de editar, entregue:
1. rotas afetadas;
2. risco atual;
3. estratégia de correção;
4. testes necessários.

Validações obrigatórias:
- npm run type-check:api
- npm run test:api
- git diff --check

Saída final obrigatória:
1. arquivos alterados;
2. correção aplicada;
3. testes criados/alterados;
4. gaps ainda pendentes;
5. comandos executados;
6. resultado dos testes.
```

---

## 5. Template IA / Document Ingestion

```txt
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. HOUSELOG_EXECUTION_MASTERPLAN.md
4. house-log-front/AGENTS.md, se houver UI
5. house-log-back/AGENTS.md, se houver backend
6. docs/ARCHITECTURE.md
7. docs/SECURITY.md
8. docs/MULTI_TENANT_RULES.md
9. docs/AI_AGENT_GUIDE.md
10. docs/AI_IMPLEMENTATION_PLAYBOOK.md
11. house-log-front/src/lib/api/document-ingestion.ts
12. house-log-back/apps/api/src/lib/document-ingestion-queue.ts
13. house-log-back/apps/api/src/routes/documents.ts
14. house-log-back/apps/api/src/db/schema.ts
15. contracts relacionados a ingestion/document extraction
16. telas e componentes atuais de revisão de análise

Agora implemente APENAS:
[ID-DA-ISSUE] — [TÍTULO DA TAREFA]

Contexto:
O HouseLog possui pipeline de ingestão de documentos para transformar documentos técnicos em sugestões revisáveis para o prontuário do imóvel.

Objetivo:
[Explique a evolução desejada da IA ou revisão humana.]

Escopo permitido:
- usar pipeline existente;
- preservar revisão humana;
- validar saída com Zod/contracts;
- criar estados loading/error/empty;
- usar linguagem de produto: análise, sugestão, prontuário, pendência.

Fora de escopo:
- Não aplicar sugestões automaticamente sem revisão humana.
- Não vender simulação como IA real.
- Não criar endpoint se já existir endpoint compatível.
- Não expor prompt interno, token ou dado sensível.
- Não enviar tenantId do frontend.

Regras técnicas:
- Toda saída de IA deve passar por schema Zod estrito.
- Toda sugestão deve ter confidenceScore quando aplicável.
- Toda aplicação de sugestão deve registrar audit log.
- Toda operação deve validar tenant/property/document access.
- Não mostrar JSON bruto na UI.
- Não usar termos candidate/job/extraction na UI final.

Validações obrigatórias:
- npm run type-check
- npm run lint
- npm run test:api
- cd house-log-front && npm run build
- git diff --check

Saída final obrigatória:
1. diagnóstico curto;
2. arquivos alterados;
3. fluxo de IA/revisão alterado;
4. contratos usados;
5. validações executadas;
6. riscos restantes;
7. próxima issue recomendada.
```

---

## 6. Exemplo pronto — P2-DASH-01

```txt
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. HOUSELOG_EXECUTION_MASTERPLAN.md
4. house-log-front/AGENTS.md
5. docs/ARCHITECTURE.md
6. docs/SECURITY.md
7. docs/MULTI_TENANT_RULES.md
8. docs/AI_AGENT_GUIDE.md
9. docs/AI_IMPLEMENTATION_PLAYBOOK.md
10. house-log-front/src/app/(app)/properties/[id]/page.tsx
11. house-log-front/src/lib/api/document-ingestion.ts
12. house-log-front/src/lib/api/properties.ts
13. contracts relacionados a property, ingestion, technical systems, warranties, inventory e maintenance
14. componentes atuais do Property Dashboard
15. house-log-front/src/app/globals.css
16. house-log-front/src/app/tokens.css

Agora implemente APENAS:

P2-DASH-01 — Transformar Property Dashboard em painel de saúde técnica.

Contexto:
Já existe endpoint agregado:

GET /api/v1/properties/:id/ingestion-summary

O dashboard já consome esse resumo no widget de prontuário inteligente.

Agora precisamos evoluir o dashboard do imóvel para parecer um painel técnico premium, mostrando saúde, pendências e próximos passos, e não apenas cards de módulos.

Objetivo:
Reorganizar a primeira visão do Property Dashboard para destacar a saúde técnica do imóvel, o prontuário inteligente e pendências operacionais.

Escopo permitido:
- frontend;
- Property Dashboard;
- reorganização visual;
- novos cards/componentes pequenos;
- uso dos dados já disponíveis;
- uso do property ingestion summary já criado;
- estados loading/error/empty.

Fora de escopo:
- Não alterar backend.
- Não alterar contracts.
- Não criar endpoint.
- Não criar migration.
- Não alterar regras de ingestion/candidates.
- Não refatorar todos os módulos.
- Não criar health score real complexo ainda.

Estrutura desejada:

1. Header premium do imóvel:
   - nome do imóvel;
   - endereço/cidade;
   - tipo;
   - área/ano, se disponível;
   - status visual.

2. Card principal: “Saúde técnica do imóvel”
   - usar property.healthScore se já existir;
   - se não houver dado suficiente, mostrar estado “Em formação”;
   - destacar:
     - documentos analisados;
     - sugestões pendentes;
     - dados aplicados ao prontuário;
     - falhas de análise.

3. Card: “Prontuário inteligente”
   - usar propertySummary;
   - mostrar:
     - totalDocuments;
     - documentsWithIngestion;
     - pendingExtractionReviews;
     - pendingCandidates;
     - appliedCandidates;
     - latestStatus;
   - CTA para documentos/análise.

4. Card: “Pendências técnicas”
   - destacar:
     - reviews pendentes;
     - sugestões pendentes;
     - jobs com falha;
   - se não houver pendências, mostrar “Tudo em dia no prontuário inteligente”.

5. Área de módulos:
   - manter links para documentos, sistemas, garantias, inventário, manutenções, financeiro etc.;
   - mas como segunda camada, não como foco principal.

6. Empty state anti data-entry:
   - se imóvel não tem documentos/análises, incentivar:
     - enviar manual do proprietário;
     - enviar nota fiscal;
     - enviar planta;
     - enviar relatório técnico.

Regras UX:
- Visual premium.
- Não parecer ERP.
- Não parecer lista de atalhos.
- Copy curta e clara.
- Priorizar saúde técnica e prontuário.
- Não mostrar JSON.
- Não usar termos como candidate/job na UI.
- Usar “sugestões”, “análises”, “prontuário”.
- Responsivo.
- Seguir The Architectural Lens.

Regras técnicas:
- Não usar any.
- Não enviar tenantId.
- Não inventar endpoint.
- Não criar múltiplas chamadas caras desnecessárias.
- Preservar rotas atuais.
- Preservar cards/links existentes, só reorganizar.
- Manter build passando.

Validações obrigatórias:
- npm run type-check
- npm run lint
- git diff --check
- cd house-log-front && npm run build
- npm run test:api

Saída final obrigatória:
1. diagnóstico curto;
2. arquivos alterados;
3. nova estrutura do dashboard;
4. cards/componentes criados;
5. dados usados;
6. comportamento preservado;
7. validações executadas;
8. riscos restantes;
9. próxima issue recomendada.

Antes de implementar, faça plano curto.
Depois implemente.
```

---

## 7. Checklist antes de aceitar qualquer entrega de agente

Não aceitar a entrega se:

- criou endpoint sem necessidade;
- alterou backend em tarefa frontend-only;
- alterou contract sem atualizar consumidores;
- adicionou any;
- removeu teste;
- escondeu erro de build;
- criou UI fora do The Architectural Lens;
- usou tenantId vindo do frontend;
- deixou rota sem auth/tenant/property access;
- apresentou IA fake como IA real;
- não informou validações executadas.

Aceitar somente se:

- escopo foi respeitado;
- arquivos alterados fazem sentido;
- build/type-check/lint foram executados ou erro foi explicado;
- comportamento existente foi preservado;
- riscos restantes foram listados;
- próxima issue foi recomendada.

---

## 8. Regra para sequência do projeto

A sequência prioritária do HouseLog deve ser:

1. Sprint 0 — diagnóstico real de build/test/lint;
2. Sprint 1 — CI;
3. Sprint 2 — Cloudflare/wrangler seguro;
4. Sprint 3 — refresh token em cookie HttpOnly;
5. Sprint 4 — middleware Next.js;
6. Sprint 5 — Authorization Core;
7. Sprint 6 — tenantId obrigatório/backfill;
8. Sprint 7 — audit log;
9. Sprint 8 — soft delete;
10. Sprint 9 — IA real;
11. Sprint 10 — go-live premium.

Feature nova só deve entrar se não atrapalhar segurança, build e multi-tenant.
