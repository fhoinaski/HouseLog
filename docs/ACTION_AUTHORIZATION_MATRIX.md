# ACTION_AUTHORIZATION_MATRIX.md - HouseLog

## 1. Objetivo

Esta matriz cruza actions explicitas prioritarias do HouseLog com a autorizacao esperada e o estado real atual dos helpers/policies.

O objetivo e evitar regra espalhada, nomes contraditorios e documentacao defasada. Este documento nao altera codigo, nao cria permissoes novas e nao inventa helpers inexistentes.

Referencias:

- `docs/AUTHORIZATION_CORE_GAPS.md`
- `docs/ACTION_ENDPOINTS_CANDIDATES.md`
- `docs/AUDIT_EVENT_CATALOG.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/BOUNDARY_MAP.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Diagnostico

O Authorization Core evoluiu alem da matriz inicial. Hoje ja existem helpers formais para credenciais, audit links, manutencao, documentos, service orders, provider proposal submit e acesso ao provider portal.

A maior parte dos gaps restantes nao e ausencia total de helper. O gap principal agora e granularidade: varios helpers ja nomeiam a action correta, mas ainda delegam para `canAccessProperty` ou preservam regra ampla para compatibilidade.

---

## 3. Regras de leitura

- **Implementado**: helper existe e ja e usado no fluxo principal da action.
- **Parcial**: helper existe, mas ainda delega para policy generica ou deixa regras importantes na rota.
- **Gap**: ainda nao ha helper formal para a action.
- **Quem pode hoje** descreve comportamento atual, nao permissao definitiva futura.
- **Observacao** registra granularidade pendente e coerencia com o dominio atual.

---

## 4. Matriz atual

| Action | Boundary principal | Quem pode hoje | Quem nao pode hoje | Sensibilidade | Exige auditoria | Helper atual | Status | Observacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `revealCredentialSecret` | Credentials and Sensitive Access | owner do imovel e manager direto | colaboradores comuns, provider, temp_provider e usuarios sem acesso | Critica | Sim, `secret_reveal` | `canRevealCredentialSecret` | Implementado | Policy mais restrita que acesso generico; ainda precisa motivo/contexto futuro |
| `generateTemporaryCredentialAccess` | Credentials and Sensitive Access | mesma regra de revelacao de segredo | colaboradores comuns, provider, temp_provider e usuarios sem acesso | Critica | Sim, `temporary_credential_access_generated` | `canGenerateTemporaryCredentialAccess` | Parcial | Helper existe, mas delega para revelacao; auditoria e escopo ainda precisam consolidacao completa |
| `createAuditLink` | Audit and Governance / Public Access Boundary | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto e usuarios sem acesso | Critica | Sim, `audit_link_created` | `canCreateAuditLink` | Parcial | Helper existe, mas delega para `canAccessProperty`; falta granularidade por OS, escopo e revogacao |
| `markMaintenanceDone` | Property Operating System | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto e usuarios sem acesso | Alta | Sim, `maintenance_mark_done` | `canMarkMaintenanceDone` | Parcial | Helper existe e action esta alinhada; falta granularidade por tipo de rotina e papel operacional |
| `documentUpload` | Documents and Evidence | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto e usuarios sem acesso | Alta | Sim, `document_uploaded` | `canUploadDocument` | Parcial | Helper existe, mas delega para `canAccessProperty`; falta policy por tipo de documento |
| `documentDelete` | Documents and Evidence | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto e usuarios sem acesso | Alta | Sim, `document_deleted` | `canDeleteDocument` | Parcial | Helper existe, mas delega para `canAccessProperty`; motivo e governanca de exclusao ficam para etapa futura |
| `documentOCRRequest` | Documents and Evidence | usuarios com acesso contextual ao imovel/documento | provider/temp_provider sem contexto e usuarios sem acesso | Media/Alta | Sim, `document_ocr_requested` | `canRequestDocumentOCR` | Parcial | Helper existe, mas falta granularidade para conteudo sensivel e tipo de documento |
| `serviceOrderCreate` | Service Operations | owner/manager ou colaborador autorizado com `can_open_os` | usuarios sem acesso; provider/temp_provider fora de fluxo autorizado | Alta | Sim, `service_order_created` | `canCreateServiceOrder` | Implementado | Preserva regra atual de abertura de OS; granularidade futura pode separar papeis e tenant |
| `serviceOrderView` | Service Operations | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Nao por padrao | `canViewServiceOrder` | Parcial | Helper existe, mas delega para `canAccessProperty`; provider atribuido exige regra futura propria |
| `serviceOrderMutate` | Service Operations | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim para mudancas relevantes | `canMutateServiceOrder` | Parcial | Helper existe, mas ainda cobre mutacoes amplas; faltam status, atribuicao, evidencias e fechamento |
| `providerProposalSubmit` | Provider Network / Service Operations | `provider` e `admin` no fluxo atual | owner, manager, temp_provider e usuarios sem papel provider/admin | Alta | Sim, `provider_proposal_submitted` | `canSubmitProviderProposal` | Parcial | Helper existe e e usado; elegibilidade da OS, duplicidade e status continuam na rota |
| `providerPortalAccess` | Provider Network | `provider`, `admin` ou colaborador com role `provider` | usuarios sem papel/contexto de provider | Media/Alta | Nao por padrao | `canAccessProviderPortal` | Implementado | Regra local foi movida para o core; elegibilidade por oportunidade/categoria ainda fica fora |

---

## 5. Detalhes por action

### 5.1 `revealCredentialSecret`

- **Helper atual**: `canRevealCredentialSecret`.
- **Status**: implementado.
- **Policy atual**: owner ou manager direto do imovel.
- **Coerencia de dominio**: segredo e tratado como acesso sensivel, nao como leitura comum.
- **Granularidade pendente**: motivo de revelacao, contexto operacional, tenant e remocao final do endpoint legado via `GET`.

### 5.2 `generateTemporaryCredentialAccess`

- **Helper atual**: `canGenerateTemporaryCredentialAccess`.
- **Status**: parcial.
- **Policy atual**: mesma regra de revelacao de segredo.
- **Coerencia de dominio**: gerar acesso temporario e acao sensivel derivada de credencial.
- **Granularidade pendente**: auditoria canonica completa, motivo, escopo e expiracao mais governada.

### 5.3 `createAuditLink`

- **Helper atual**: `canCreateAuditLink`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: link publico/auditavel pertence a Audit and Governance e Service Operations.
- **Granularidade pendente**: policy por OS, escopo minimo, revogacao, uso publico e auditoria sem token completo.

### 5.4 `markMaintenanceDone`

- **Helper atual**: `canMarkMaintenanceDone`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: conclusao preventiva pertence ao prontuario tecnico do imovel.
- **Granularidade pendente**: diferenciar criar, editar, excluir e concluir manutencao; considerar provider atribuido quando existir suporte real.

### 5.5 `documentUpload`

- **Helper atual**: `canUploadDocument`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: upload alimenta acervo tecnico/documental.
- **Granularidade pendente**: tipo documental, documento sensivel, evidencia de OS, origem e metadata segura.

### 5.6 `documentDelete`

- **Helper atual**: `canDeleteDocument`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: exclusao afeta governanca do acervo tecnico.
- **Granularidade pendente**: motivo de exclusao, restricao por tipo e regra mais forte para documentos criticos.

### 5.7 `documentOCRRequest`

- **Helper atual**: `canRequestDocumentOCR`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel/documento.
- **Coerencia de dominio**: OCR deve respeitar sensibilidade documental.
- **Granularidade pendente**: policy por tipo de documento, conteudo sensivel e origem da solicitacao.

### 5.8 `serviceOrderCreate`

- **Helper atual**: `canCreateServiceOrder`.
- **Status**: implementado.
- **Policy atual**: owner/manager do imovel ou colaborador nao viewer com `can_open_os = 1`.
- **Coerencia de dominio**: OS e unidade operacional central do HouseLog.
- **Granularidade pendente**: tenant, roles mais finos e separacao futura entre draft, request e criacao final.

### 5.9 `serviceOrderView`

- **Helper atual**: `canViewServiceOrder`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: leitura de OS deve respeitar contexto do imovel.
- **Granularidade pendente**: provider atribuido, temp provider, links publicos e visibilidade por status.

### 5.10 `serviceOrderMutate`

- **Helper atual**: `canMutateServiceOrder`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: mutacoes de OS impactam rastreabilidade operacional.
- **Granularidade pendente**: `canChangeServiceOrderStatus`, `canAssignProvider`, `canUploadServiceEvidence` e `canCloseServiceOrderWithEvidence`.

### 5.11 `providerProposalSubmit`

- **Helper atual**: `canSubmitProviderProposal`.
- **Status**: parcial.
- **Policy atual**: `provider` ou `admin`.
- **Coerencia de dominio**: proposta pertence a Provider Network privada, nao marketplace aberto.
- **Granularidade pendente**: elegibilidade por oportunidade, categoria, homologacao, tenant e OS aberta.

### 5.12 `providerPortalAccess`

- **Helper atual**: `canAccessProviderPortal`.
- **Status**: implementado.
- **Policy atual**: `provider`, `admin` ou colaborador com role `provider`.
- **Coerencia de dominio**: portal e entrada operacional para rede homologada.
- **Granularidade pendente**: separar acesso ao portal de visibilidade de oportunidades, servicos atribuidos e elegibilidade por categoria.

---

## 6. Riscos

- Helpers parciais podem ser lidos como policy final, mesmo ainda delegando para `canAccessProperty`.
- Provider global ainda tem acesso amplo ao portal; a elegibilidade fina ainda depende de filtros e regras em rota.
- Mutacoes de OS ainda precisam helpers menores para status, atribuicao e evidencias.
- Documentos e OCR exigem mais cuidado antes de ampliar automacoes ou busca sem policies por tipo.
- Sem tenant/organization, `property_id` continua sendo o limite principal de autorizacao.

---

## 7. Proximos passos recomendados

1. Priorizar granularidade de service orders: status, atribuicao, evidencias e fechamento.
2. Evoluir `canSubmitProviderProposal` para usar o contexto da OS/oportunidade em regras reais de elegibilidade sem alterar contrato publico.
3. Separar policies documentais por tipo e criticidade antes de ampliar OCR e classificacao.
4. Endurecer audit links com policy por OS, escopo, revogacao e auditoria sem token completo.
5. Atualizar `AUTHORIZATION_CORE_GAPS.md` quando novos helpers forem promovidos de parcial para implementado.
6. Planejar tenant/organization como evolucao arquitetural incremental.
