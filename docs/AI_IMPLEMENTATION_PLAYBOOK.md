# AI Implementation Playbook — HouseLog

Este documento é a fonte operacional para orientar Codex, Claude, Cursor, Copilot e outros agentes de IA durante a evolução do HouseLog.

Ele deve ser atualizado sempre que uma etapa relevante de backend, frontend, arquitetura, segurança ou produto for concluída.

Objetivo: reduzir prompts longos e repetitivos, manter contexto vivo do projeto e evitar que agentes implementem fora da arquitetura, quebrem multi-tenant, dupliquem regras ou inventem endpoints.

---

## 1. Como usar este documento

Antes de qualquer implementação relevante, o agente deve ler obrigatoriamente:

1. `SYSTEM_CONTEXT.md`
2. `AGENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SECURITY.md`
5. `docs/MULTI_TENANT_RULES.md`
6. `docs/ROADMAP.md`
7. `docs/AI_AGENT_GUIDE.md`
8. Este arquivo: `docs/AI_IMPLEMENTATION_PLAYBOOK.md`

Além disso:

- se a tarefa for backend, ler `house-log-back/AGENTS.md`;
- se a tarefa for frontend, ler `house-log-front/AGENTS.md`;
- se a tarefa envolver contracts, ler `packages/contracts/src`;
- se a tarefa envolver banco, ler `house-log-back/apps/api/src/db/schema.ts` e migrations relacionadas.

---

## 2. Regra central do HouseLog

O HouseLog não é um CRUD genérico.

O produto está evoluindo para:

- prontuário inteligente do imóvel;
- gestor de engenharia diagnóstica;
- histórico técnico valorizável;
- digital twin residencial;
- SaaS multi-tenant para construtoras, empreiteiros, técnicos e proprietários.

Toda implementação deve proteger:

- isolamento por `tenantId`;
- vínculo por `propertyId`;
- rastreabilidade;
- audit log;
- segurança de documentos e dados privados;
- UX premium com baixo data-entry.

---

## 3. Regras absolutas para agentes de IA

- Nunca aceitar `tenantId` do cliente.
- Nunca buscar entidade sensível apenas por `id`.
- Toda query sensível deve filtrar por `tenantId + propertyId`.
- Endpoints públicos/tokenizados devem ter escopo mínimo.
- Não expor `tenantId` em responses públicas quando não for necessário.
- Não expor R2 key, URL privada, secrets, tokens, raw payloads sensíveis ou conteúdo bruto em audit log.
- Não alterar backend em issue apenas de frontend.
- Não alterar frontend em issue apenas de backend.
- Não criar migrations fora do escopo.
- Não alterar contracts sem revisar consumidores.
- Não usar `any` por conveniência.
- Não criar endpoint inventado sem estar no escopo.
- Não misturar várias features grandes no mesmo diff.
- Sempre executar validações obrigatórias antes de concluir.

---

## 4. Validações obrigatórias

Para implementação de código:

```bash
npm run type-check
npm run test:api
npm run lint
git diff --check
```

Para frontend com build visual/Next:

```bash
cd house-log-front && npm run build
```

Para documentação apenas:

```bash
git diff --check
```

---

## 5. Status macro da etapa atual

### P2-AI — Pipeline de ingestão inteligente

Objetivo da etapa: permitir que documentos técnicos sejam processados por pipeline assíncrono, gerem extrações revisáveis, candidates e aplicação controlada no domínio.

Status geral esperado após conclusão:

- documento existente cria job de ingestão;
- job é enfileirado;
- consumer fake cria extraction;
- extraction pode ser revisada;
- candidates podem ser gerados;
- candidates podem ser aprovados/rejeitados;
- candidates aprovados podem ser aplicados no domínio final;
- ingestion summary permite frontend entender estado do documento.

### Checklist P2-AI

| Issue | Objetivo | Status esperado |
|---|---|---|
| P2-AI-02 | Base Drizzle/D1 para jobs, extractions e reviews | Concluída |
| P2-AI-03 | Contracts Zod para extração inteligente | Concluída |
| P2-AI-04 | Contracts Zod para jobs/reviews | Concluída |
| P2-AI-05 | POST criar ingestion job | Concluída |
| P2-AI-06 | GET listar jobs | Concluída |
| P2-AI-07 | GET detalhe job + extractions resumidas | Concluída |
| P2-AI-08 | Permissão `canRequestDocumentIngestion` | Concluída |
| P2-AI-09 | Queue producer sem IA real | Concluída |
| P2-AI-10 | Consumer fake da Queue | Concluída |
| P2-AI-11 | GET detalhe completo da extraction | Concluída |
| P2-AI-12 | PATCH revisar extraction | Concluída |
| P2-AI-13 | Gerar candidates a partir da extraction | Concluída |
| P2-AI-14 | Aprovar/rejeitar candidate | Concluída |
| P2-AI-15 | Aplicar `technical_system` | Concluída |
| P2-AI-16 | Aplicar `warranty` | Concluída |
| P2-AI-17 | Aplicar `inventory_item` | Concluída |
| P2-AI-18 | Aplicar `maintenance_recommendation` | Corrigida após bug helper/rota |
| P2-AI-19 | Listar candidates de uma extraction | Concluída ou validar localmente |
| P2-AI-20 | Resumo de ingestão do documento | Concluída |

Observação: antes de avançar para frontend, rodar auditoria completa da P2-AI e confirmar que helper, rota, contracts e testes estão consistentes.

---

## 6. Endpoints esperados da P2-AI

Base: `/properties/:propertyId/documents/:documentId`

### Jobs

- `POST /ingestion-jobs`
- `GET /ingestion-jobs`
- `GET /ingestion-jobs/:jobId`

### Extractions

- `GET /ingestion-jobs/:jobId/extractions/:extractionId`
- `PATCH /ingestion-jobs/:jobId/extractions/:extractionId/review`

### Candidates

- `POST /ingestion-jobs/:jobId/extractions/:extractionId/candidates/generate`
- `GET /ingestion-jobs/:jobId/extractions/:extractionId/candidates`
- `PATCH /ingestion-jobs/:jobId/extractions/:extractionId/candidates/:candidateId`
- `POST /ingestion-jobs/:jobId/extractions/:extractionId/candidates/:candidateId/apply`

### Summary

- `GET /ingestion-summary`

---

## 7. Tipos de candidate suportados

| Candidate | Entidade final | Status esperado |
|---|---|---|
| `technical_system` | `technical_systems` | Aplicável |
| `warranty` | `warranties` | Aplicável |
| `inventory_item` | `inventory_items` | Aplicável |
| `maintenance_recommendation` | `maintenance_schedules` | Aplicável |

Regra: se `canApplyDocumentExtractionCandidate` permitir um tipo, a rota `/apply` precisa saber aplicar esse tipo. Helper e rota nunca podem ficar inconsistentes.

---

## 8. Próxima fase: P2-UX — Revisão inteligente no frontend

Objetivo: criar interface funcional para o fluxo:

```txt
documento → job → extraction → review → candidates → apply
```

### P2-UX-01 — Tela de revisão inteligente

Escopo:

- frontend;
- API client;
- hooks;
- componentes shadcn/ui;
- tela dentro do contexto do imóvel/documento;
- estados loading/error/empty;
- sem alterar backend.

A tela deve exibir:

1. Summary de ingestão.
2. Lista de jobs.
3. Detalhe de job.
4. Detalhe da extraction.
5. Review da extraction.
6. Geração/listagem de candidates.
7. Aprovação/rejeição de candidates.
8. Aplicação de candidates aprovados.

Regras:

- Não mostrar JSON bruto como experiência principal.
- JSON bruto deve ficar recolhido em accordion técnico.
- Não permitir aplicar candidate não aprovado.
- Não permitir gerar candidates se extraction não estiver aprovada ou parcialmente aplicada.
- Não aceitar `tenantId` no frontend.
- Não inventar endpoint.
- Reutilizar contracts.
- Não usar `any`.

---

## 9. Modelo de prompt para backend

```md
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. house-log-back/AGENTS.md
4. docs/ARCHITECTURE.md
5. docs/SECURITY.md
6. docs/MULTI_TENANT_RULES.md
7. docs/AI_AGENT_GUIDE.md
8. docs/AI_IMPLEMENTATION_PLAYBOOK.md
9. Arquivos específicos da feature

Agora implemente APENAS:

[ID] — [Título]

Objetivo:
[descrever objetivo]

Escopo permitido:
- backend/API;
- contracts, se aplicável;
- schema/migration, se aplicável;
- testes.

Fora de escopo:
- Não alterar frontend.
- Não criar features paralelas.
- Não alterar endpoints fora do escopo.

Regras obrigatórias:
- Nunca aceitar tenantId do cliente.
- Toda query sensível deve filtrar tenantId + propertyId.
- Não usar any.
- Não expor dados sensíveis.
- Registrar audit log quando aplicável.

Testes obrigatórios:
[lista]

Validações obrigatórias:
- npm run type-check
- npm run test:api
- npm run lint
- git diff --check

Saída final obrigatória:
1. diagnóstico;
2. arquivos alterados;
3. comportamento implementado;
4. segurança/multi-tenant;
5. testes;
6. validações;
7. riscos;
8. próxima issue recomendada.

Antes de implementar, faça plano curto.
Depois implemente.
```

---

## 10. Modelo de prompt para frontend

```md
Antes de implementar qualquer coisa, leia obrigatoriamente:

1. SYSTEM_CONTEXT.md
2. AGENTS.md
3. house-log-front/AGENTS.md
4. docs/ARCHITECTURE.md
5. docs/SECURITY.md
6. docs/MULTI_TENANT_RULES.md
7. docs/AI_AGENT_GUIDE.md
8. docs/AI_IMPLEMENTATION_PLAYBOOK.md
9. packages/contracts
10. API client atual
11. telas/componentes relacionados

Agora implemente APENAS:

[ID] — [Título]

Objetivo:
[descrever objetivo]

Escopo permitido:
- frontend;
- API client;
- hooks;
- componentes;
- estados de UX.

Fora de escopo:
- Não alterar backend.
- Não alterar migrations.
- Não alterar contracts.
- Não inventar endpoint.

Regras técnicas:
- Reutilizar contracts.
- Não usar any.
- Não aceitar tenantId.
- Preservar rotas e payloads existentes.
- Componentes devem ser responsivos e acessíveis.
- Estados loading/error/empty devem ser claros.

Validações obrigatórias:
- npm run type-check
- npm run test:api
- npm run lint
- git diff --check
- cd house-log-front && npm run build

Saída final obrigatória:
1. diagnóstico;
2. arquivos alterados;
3. componentes criados;
4. API client/hooks;
5. fluxo implementado;
6. UX states;
7. validações;
8. riscos;
9. próxima issue recomendada.

Antes de implementar, faça plano curto.
Depois implemente.
```

---

## 11. Status consolidado da Fase P3-HANDOVER

### P3-HANDOVER — Handover Digital / Chave Digital do Imóvel

Status: **concluída**.

Checklist consolidado da fase:

| Issue | Objetivo | Status |
|---|---|---|
| P3-HANDOVER-01 | Modelagem conceitual do pacote de handover e estados | Concluída |
| P3-HANDOVER-02 | Checklist de entrega e critérios de revisão | Concluída |
| P3-HANDOVER-03 | Emissão da chave digital com expiração e revogação | Concluída |
| P3-HANDOVER-04 | Experiência interna da construtora | Concluída |
| P3-HANDOVER-05 | Experiência do proprietário para aceite digital | Concluída |
| P3-HANDOVER-06 | Integração com documentos, garantias, sistemas e inventário | Concluída |
| P3-HANDOVER-07 | Revogação, expiração e histórico do pacote | Concluída |
| P3-HANDOVER-08 | Contratos e endpoints mínimos para implementação | Concluída |
| P3-HANDOVER-UX-01 | Ajuste de copy e acessibilidade do comprovante público | Concluída |

### Resultado operacional

- pacote privado emitido com snapshot fechado;
- token público seguro com hash interno;
- endpoint público `/handover/:token` operacional;
- aceite digital público com comprovante;
- estados inválido, expirado, revogado, emitido e aceito tratados na UI;
- audit log sanitizado e sem exposição de token puro, token hash, packageHash ou R2 key.

### Próxima fase recomendada

Escolher um destes caminhos:

1. `P3-COMMERCIAL-01` — Envio do link por WhatsApp/e-mail.
2. `P3-PDF-01` — PDF completo do pacote de entrega.
3. `P3-HANDOVER-CLIENT-01` — área do cliente avançada para consulta e histórico.

---

## 11. Como atualizar este documento

Sempre que uma etapa for concluída, atualizar:

1. status da issue;
2. endpoints criados;
3. contracts criados;
4. tabelas/migrations criadas;
5. decisões técnicas relevantes;
6. riscos conhecidos;
7. próxima fase recomendada.

Não usar este arquivo para guardar secrets, tokens, URLs privadas, R2 keys ou dados reais de clientes.

---

## 12. Próximas melhorias recomendadas

### Hardening backend

- `P2-AI-HARDEN-01`: testes HTTP/D1 das rotas de ingestion/candidates.
- `P2-DX-01`: adicionar lint backend/API ao script raiz.
- `P2-AI-HARDEN-02`: revisar campos nullable legados como `maintenanceSchedules.tenantId`.

### Frontend

- `P2-UX-01`: tela de revisão inteligente.
- `P2-UX-02`: widget de ingestão no documento.
- `P2-UX-03`: widget de prontuário inteligente no Property Dashboard.
- `P2-UX-04`: experiência vazia anti data-entry.

### Produto

- `P2-PRODUCT-01`: definir linguagem premium do prontuário técnico.
- `P2-PRODUCT-02`: definir fluxo B2B2C para construtoras entregarem chave digital ao cliente.
