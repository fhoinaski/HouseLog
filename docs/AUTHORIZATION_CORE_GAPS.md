# AUTHORIZATION_CORE_GAPS.md - HouseLog

## 1. Objetivo

Este documento registra os gaps restantes do Authorization Core do HouseLog por dominio.

O objetivo e orientar proximas etapas sem reintroduzir regra espalhada, sem inventar permissoes novas e sem perder alinhamento com as fronteiras reais do produto.

Referencias:

- `docs/ACTION_AUTHORIZATION_MATRIX.md`
- `docs/TECH_DEBT_REGISTER.md`
- `docs/BOUNDARY_MAP.md`
- `docs/AUDIT_EVENT_CATALOG.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Diagnostico

O Authorization Core ja existe como camada inicial e cobre algumas actions sensiveis com helpers nomeados.

Ainda ha tres tipos principais de gap:

- helpers que existem, mas ainda delegam para `canAccessProperty`;
- regras relevantes que continuam locais nas rotas;
- falta de granularidade futura para provider, links publicos, search e multi-tenant.

Este documento deve ser lido como mapa operacional de proximas refatoracoes incrementais, nao como nova policy automatica.

---

## 3. Estado atual do core

Helpers ja existentes:

- `canAccessProperty`
- `canRevealCredentialSecret`
- `canListCredentials`
- `canCreateCredential`
- `canUpdateCredential`
- `canDeleteCredential`
- `canGenerateTemporaryCredentialAccess`
- `canCreateAuditLink`
- `canMarkMaintenanceDone`
- `canUploadDocument`
- `canDeleteDocument`
- `canRequestDocumentOCR`
- `canCreateServiceOrder`
- `canViewServiceOrder`
- `canMutateServiceOrder`
- `canAccessProviderPortal`
- `canSubmitProviderProposal`
- `listAccessiblePropertyIds`

Observacao: varios helpers ja nomeiam a action correta, mas ainda preservam a regra atual baseada em acesso contextual ao imovel. Isso e intencional para compatibilidade, mas ainda nao resolve granularidade final.

---

## 4. Gaps por dominio

### 4.1 Credentials

- **Coberto hoje**:
  - `canListCredentials`
  - `canCreateCredential`
  - `canUpdateCredential`
  - `canDeleteCredential`
  - `canRevealCredentialSecret`
  - `canGenerateTemporaryCredentialAccess`
- **Ainda depende de helper generico**:
  - listagem, criacao, edicao e remocao delegam para `canAccessProperty`;
  - geracao temporaria delega para a regra de revelacao.
- **Ainda espalhado em rota**:
  - validacoes de existencia da credencial;
  - compatibilidade com rota legada de revelacao via `GET`;
  - detalhes de auditoria e payload minimo por acao.
- **Policy futura mais granular**:
  - diferenciar metadados, segredo, acesso temporario, compartilhamento e revogacao;
  - exigir contexto operacional ou motivo para revelacao;
  - restringir por role/membership/tenant quando multi-tenant existir.
- **Prioridade sugerida**: P0.

### 4.2 Documents

- **Coberto hoje**:
  - `canUploadDocument`
  - `canDeleteDocument`
  - `canRequestDocumentOCR`
- **Ainda depende de helper generico**:
  - os tres helpers delegam para `canAccessProperty`.
- **Ainda espalhado em rota**:
  - validacao de documento pertencente ao imovel;
  - lifecycle de soft delete;
  - regras de arquivo, OCR, R2 e metadata;
  - parte da auditoria documental ainda depende de cada handler.
- **Policy futura mais granular**:
  - diferenciar documento patrimonial, evidencia de OS, nota fiscal, contrato e documento sensivel;
  - restringir OCR por tipo, tamanho, origem e risco de dado sensivel;
  - exigir motivo para exclusao em documentos criticos.
- **Prioridade sugerida**: P1.

### 4.3 Maintenance

- **Coberto hoje**:
  - `canMarkMaintenanceDone`
- **Ainda depende de helper generico**:
  - conclusao de manutencao delega para `canAccessProperty`.
- **Ainda espalhado em rota**:
  - verificacao do agendamento;
  - calculo de `last_done` e `next_due`;
  - compatibilidade entre `mark-done` e caminho legado;
  - criacao/edicao/listagem de manutencoes ainda nao tem helpers por action.
- **Policy futura mais granular**:
  - separar criar, editar, excluir e concluir manutencao;
  - permitir execucao por provider atribuido apenas quando o dominio suportar esse contexto;
  - diferenciar manutencao preventiva comum de rotinas criticas.
- **Prioridade sugerida**: P1.

### 4.4 Service Orders

- **Coberto hoje**:
  - `canCreateServiceOrder`
  - `canViewServiceOrder`
  - `canMutateServiceOrder`
- **Ainda depende de helper generico**:
  - visualizacao e mutacao delegam para `canAccessProperty`;
  - criacao preserva a regra atual de owner/manager/colaborador com `can_open_os`.
- **Ainda espalhado em rota**:
  - transicoes de status;
  - anexos, fotos, audio, video e checklist;
  - atribuicao de provider;
  - validacoes de OS pertencente ao imovel;
  - auditoria ainda usa nomes parcialmente historicos em algumas actions.
- **Policy futura mais granular**:
  - `canChangeServiceOrderStatus`;
  - `canAssignProvider`;
  - `canUploadServiceEvidence`;
  - `canCloseServiceOrderWithEvidence`;
  - diferenciar owner/manager, provider atribuido, temp provider e link publico.
- **Prioridade sugerida**: P0/P1.

### 4.5 Provider Proposals

- **Coberto hoje**:
  - `canSubmitProviderProposal`;
  - auditoria `provider_proposal_submitted` no fluxo principal de bids.
- **Ainda depende de helper generico**:
  - o helper atual recebe `property_id` e `service_order_id`, mas a regra efetiva ainda cobre role (`provider` ou `admin`), nao elegibilidade completa da oportunidade.
- **Ainda espalhado em rota**:
  - OS existente;
  - OS sem execucao direta;
  - status `requested`;
  - proposta pendente duplicada;
  - valor e dados da proposta.
- **Policy futura mais granular**:
  - validar provider homologado/elegivel;
  - considerar categorias/especialidades;
  - bloquear provider fora da rede ou sem contexto;
  - usar o contexto da OS em `canSubmitProviderProposal` para validar elegibilidade real quando o dominio suportar essa regra.
- **Prioridade sugerida**: P1.

### 4.6 Provider Opportunities / Provider Portal

- **Coberto hoje**:
  - acesso ao portal existe no Authorization Core via `canAccessProviderPortal`;
  - filtros de oportunidades usam status `requested`, sem provider atribuido e categorias do provider.
- **Ainda depende de helper generico**:
  - elegibilidade de oportunidade fica fora do core.
- **Ainda espalhado em rota**:
  - filtros por categoria;
  - visibilidade de oportunidade;
  - leitura de OS atribuida ao provider.
- **Policy futura mais granular**:
  - `canAccessProviderPortal`;
  - `canViewProviderOpportunity`;
  - `canViewAssignedProviderService`;
  - elegibilidade por categoria, homologacao, convite, tenant e rede privada.
- **Prioridade sugerida**: P1.

### 4.7 Public Links / Audit Links

- **Coberto hoje**:
  - `canCreateAuditLink` para criacao autenticada;
  - rota publica com token, expiracao e status.
- **Ainda depende de helper generico**:
  - criacao delega para `canAccessProperty`.
- **Ainda espalhado em rota**:
  - validacao da OS;
  - escopo do link;
  - expiracao;
  - uso publico sem identidade autenticada;
  - payload de auditoria ainda inclui token em ponto legado e precisa ser endurecido.
- **Policy futura mais granular**:
  - `canCreateAuditLinkForServiceOrder`;
  - `canUseAuditLink`;
  - `canSubmitAuditLinkEvidence`;
  - escopo minimo por tipo de evidencia;
  - revogacao e auditoria sem token completo.
- **Prioridade sugerida**: P0.

### 4.8 Search

- **Coberto hoje**:
  - busca usa `canAccessProperty` quando ha `propertyId`;
  - busca global usa `listAccessiblePropertyIds`.
- **Ainda depende de helper generico**:
  - autorizacao e baseada em propriedades acessiveis, nao em permissao por tipo de resultado.
- **Ainda espalhado em rota**:
  - filtros por documentos, inventario, manutencao e OS;
  - composicao de resultados e `href`;
  - busca em OCR/documentos via query local.
- **Policy futura mais granular**:
  - `canSearchProperty`;
  - `canSearchDocuments`;
  - `canSearchServiceOrders`;
  - limites para dados sensiveis em OCR, credenciais e evidencias;
  - considerar tenant e indice dedicado quando existir.
- **Prioridade sugerida**: P1/P2.

### 4.9 Multi-tenant Futuro

- **Coberto hoje**:
  - nao ha tenant/organization formal;
  - isolamento atual depende de usuario, propriedade, manager, owner e colaboradores.
- **Ainda depende de helper generico**:
  - `property_id` funciona como contexto principal em quase todas as policies.
- **Ainda espalhado em rota**:
  - regras por owner/manager;
  - colaborador por propriedade;
  - provider por papel global ou relacao local;
  - escopos de links e provider network.
- **Policy futura mais granular**:
  - `canAccessTenant`;
  - `canManageOrganization`;
  - `canAccessPropertyWithinTenant`;
  - membership por organizacao;
  - provider network por tenant;
  - auditoria com `tenant_id`/`organization_id`.
- **Prioridade sugerida**: P0 arquitetural, execucao incremental.

---

## 5. Lista consolidada de gaps

| Gap | Dominio | Prioridade |
| --- | --- | --- |
| Revelacao e acesso temporario de credenciais ainda sem policy granular por contexto/motivo | Credentials | P0 |
| Rotas legadas e detalhes de auditoria de credenciais ainda precisam consolidacao | Credentials | P0 |
| Documentos usam helpers nomeados, mas ainda baseados em acesso generico ao imovel | Documents | P1 |
| OCR ainda precisa policy mais especifica para conteudo sensivel | Documents | P1 |
| Manutencao tem helper para concluir, mas criacao/edicao/exclusao ainda nao estao formalizadas por action | Maintenance | P1 |
| Service orders ainda precisam helpers para status, atribuicao, evidencias e fechamento | Service Orders | P0/P1 |
| Provider proposal submit ja recebe contexto minimo, mas ainda nao valida elegibilidade completa da oportunidade no core | Provider Proposals | P1 |
| Provider portal tem helper formal, mas visibilidade e elegibilidade de oportunidades ainda ficam em rota | Provider Opportunities / Portal | P1 |
| Audit links ainda precisam policy por OS, uso publico, envio de evidencia e revogacao | Public Links / Audit Links | P0 |
| Search usa propriedades acessiveis, mas nao policies por tipo de resultado | Search | P1/P2 |
| Falta tenant/organization como raiz formal de autorizacao | Multi-tenant | P0 |

---

## 6. Riscos

- Tratar helpers que delegam para `canAccessProperty` como policy final pode cristalizar acesso amplo demais.
- Regras locais em rota tendem a divergir quando novas actions forem criadas.
- Provider e temp provider exigem contexto operacional, nao devem ganhar acesso amplo por role global.
- Search pode expor metadados sensiveis se novos tipos de resultado forem adicionados sem helper especifico.
- Sem tenant/organization, `property_id` continua sendo o principal limite de seguranca, o que limita escala B2B.

---

## 7. Proximos passos recomendados

1. Priorizar P0: public links/audit links, service order status/assignment e granularidade de credenciais.
2. Evoluir `canSubmitProviderProposal` para usar o contexto da oportunidade/OS em regras reais de elegibilidade sem mudar contrato publico.
3. Criar helpers especificos de visibilidade para oportunidades e servicos atribuidos no provider portal.
4. Criar helpers especificos para search por tipo de resultado antes de adicionar novos indices.
5. Atualizar `ACTION_AUTHORIZATION_MATRIX.md` para refletir helpers ja criados em documentos, service orders e provider proposal.
6. Planejar multi-tenant como evolucao incremental, sem misturar schema, policies e UI em uma unica etapa.
