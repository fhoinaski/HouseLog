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
- **Monitorar**: nao exige acao imediata, mas pode voltar a crescer.

---

## 3. Registro de debitos

### TD-001 - Encoding inconsistente em arquivos do frontend

- **Severidade**: Media
- **Area**: Frontend / Manutencao
- **Status**: Mitigado parcialmente
- **Evidencia**: varias telas e documentos historicos apresentaram textos corrompidos, especialmente em pt-BR, exigindo correcoes pontuais e uso temporario de ASCII em refatoracoes anteriores.
- **Impacto**: dificulta revisao, quebra copy de produto, aumenta risco de regressao visual e reduz confianca em alteracoes de texto.
- **Recomendacao**:
  - padronizar arquivos criticos em UTF-8 limpo;
  - adicionar verificacao automatizada de encoding em CI;
  - evitar novas alteracoes com texto corrompido;
  - priorizar telas com copy de produto e documentacao operacional.
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
- **Evidencia**: `house-log-back/apps/api/src/routes/credentials.ts` ainda expoe `GET /properties/:propertyId/credentials/:credId/secret` por compatibilidade, mas ja existe `POST /properties/:propertyId/credentials/:credId/secret/reveal` como acao preferencial. O frontend passou a consumir o endpoint `POST` em `credentialsApi.revealSecret`.
- **Impacto**: a semantica principal foi corrigida para novos consumidores, mas a rota `GET` legada ainda precisa existir temporariamente e continua sendo um ponto de atencao para caches/proxies e clareza operacional ate sua remocao.
- **Recomendacao**:
  - mapear e remover consumidores restantes de `GET /secret`;
  - manter compatibilidade temporaria durante a janela de migracao;
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

## 4. Priorizacao recomendada

### Curto prazo

1. TD-004 - concluir migracao e remover consumidores legados de `GET /secret`.
2. TD-005 - iniciar policy granular para credenciais.
3. TD-010 - desenhar e iniciar Authorization Core.
4. TD-003 - adicionar confirmacao de exclusao documental.
5. TD-002 - padronizar erro de upload multipart.

### Medio prazo

1. TD-009 - iniciar base multi-tenant incremental.
2. TD-007 - reduzir e remover alias `marketplaceApi`.
3. TD-008 - seguir consolidacao visual por rota.
4. TD-001 - automatizar verificacao de encoding.

### Monitoramento continuo

1. TD-006 - revisar crescimento de `_core.ts` a cada nova modularizacao.

---

## 5. Regras para manter este registro

- Nao registrar debito especulativo sem evidencia no codigo, docs ou refatoracao realizada.
- Ao corrigir um item, atualizar status, evidencia de mitigacao e arquivos relacionados.
- Se um item virar ADR ou tarefa de roadmap, manter o link entre os documentos.
- Se um debito for aceito como trade-off permanente, registrar explicitamente a decisao.
- Evitar duplicar itens ja cobertos por ADR sem deixar claro o ponto operacional pendente.
