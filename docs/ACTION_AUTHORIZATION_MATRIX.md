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
| `serviceOrderStatusChange` | Service Operations / Audit and Governance | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim, `service_order_status_changed` | `canChangeServiceOrderStatus`; `canCloseServiceOrderWithEvidence` quando `completed` | Parcial | Helper existe e preserva regra atual; fechamento com evidencia segue com helper adicional |
| `serviceOrderUpdate` | Service Operations | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim, `service_order_updated` | `canUpdateServiceOrder` | Parcial | Helper existe e preserva regra atual; policy ainda nao separa metadados, campos sensiveis e atribuicao elegivel de provider |
| `serviceOrderDelete` | Service Operations / Audit and Governance | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim, `service_order_deleted` | `canDeleteServiceOrder` | Parcial | Helper existe e preserva regra atual; ainda falta motivo/contexto e restricao por status |
| `serviceOrderEvidenceUpload` | Service Operations / Documents and Evidence | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim, `service_order_evidence_uploaded` | `canUploadServiceEvidence` | Parcial | Helper existe e preserva regra atual; falta granularidade por tipo de evidencia |
| `serviceOrderChecklistUpdate` | Service Operations / Property Operating System | usuarios com acesso contextual ao imovel | provider nao vinculado, temp_provider fora de escopo e usuarios sem acesso | Alta | Sim, `service_order_checklist_updated` | `canUpdateServiceOrderChecklist` | Parcial | Helper existe e preserva regra atual; falta granularidade por responsabilidade e etapa da OS |
| `serviceMessageAccess` | Service Operations / Provider Network | participantes da OS, provider com bid ativo e usuarios com acesso contextual ao imovel; providers veem apenas mensagens nao internas | usuarios sem relacao com a OS, provider sem bid/atribuicao e temp_provider fora de escopo | Alta | Nao por padrao | `canViewServiceMessages`; `canSendServiceMessage`; `canViewInternalServiceMessages`; `canSendInternalServiceMessage` | Parcial | Helper nomeia leitura/envio do chat da OS; acesso por bid e propriedade ainda e montado na rota |
| `searchPropertyResults` | Search / Property Operating System | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto e usuarios sem acesso | Media/Alta | Nao por padrao | `canSearchProperty`; `canSearchServiceOrders`; `canSearchDocuments`; `canSearchInventory`; `canSearchMaintenance` | Parcial | Helpers nomeiam busca por tipo; allowlist local limita campos; documentos buscam apenas titulo e OS nao busca descricao livre |
| `providerProposalSubmit` | Provider Network / Service Operations | `provider` e `admin` no fluxo atual, com OS aberta a proposta | owner, manager, temp_provider, usuarios sem papel provider/admin, OS atribuida/fechada ou proposta pendente duplicada | Alta | Sim, `provider_proposal_submitted` | `canSubmitProviderProposal` | Parcial | Helper usa contexto minimo da OS/oportunidade; homologacao, categoria e tenant seguem pendentes |
| `providerPortalAccess` | Provider Network | `provider`, `admin` ou colaborador com role `provider` | usuarios sem papel/contexto de provider | Media/Alta | Nao por padrao | `canAccessProviderPortal` | Implementado | Regra local foi movida para o core; elegibilidade por oportunidade/categoria ainda fica fora |
| `providerOpportunityView` | Provider Network / Service Operations | `provider` e `admin` com oportunidade aberta, sem atribuicao e dentro dos filtros atuais de categoria | owner, manager, temp_provider, usuarios sem provider/admin e oportunidades atribuidas/fechadas/deletadas | Media/Alta | Nao por padrao | `canViewProviderOpportunity` | Parcial | Helper cobre visibilidade minima; homologacao, tenant, convite e disponibilidade seguem pendentes |
| `assignedProviderServiceView` | Provider Network / Service Operations | provider atribuido e `admin` | provider nao atribuido, owner/manager via provider portal, temp_provider e usuarios sem acesso ao portal | Alta | Nao por padrao | `canViewAssignedProviderService` | Parcial | Helper cobre leitura/acesso minimo a OS atribuida; stats, invoice e mutacoes ainda precisam policies especificas |
| `providerInvoiceUpload` | Provider Network / Documents and Evidence | provider atribuido e `admin` | provider nao atribuido, owner/manager via provider portal, temp_provider e usuarios sem acesso ao portal | Alta | Sim, `document_uploaded` com `upload_source = provider_invoice` | `canUploadProviderInvoice` | Parcial | Helper nomeia a action e preserva regra atual; policy por status e documento fiscal fica pendente |

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
- **Coerencia de dominio**: mutacoes de OS impactam rastreabilidade operacional e hoje funcionam como guarda amplo de compatibilidade.
- **Granularidade pendente**: separar status, edicao, exclusao, atribuicao, evidencia, checklist e fechamento em helpers especificos quando a regra real existir.

### 5.11 `serviceOrderStatusChange`

- **Helper atual**: `canChangeServiceOrderStatus`; `canCloseServiceOrderWithEvidence` quando o status alvo e `completed`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel, com exigencia atual de foto "depois" para conclusao.
- **Coerencia de dominio**: status de OS define a linha do tempo operacional do prontuario tecnico.
- **Granularidade pendente**: transicoes por papel, provider atribuido e endpoint dedicado futuro para fechamento.

### 5.12 `serviceOrderUpdate`

- **Helper atual**: `canUpdateServiceOrder`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: edicao de OS muda metadados operacionais e ja audita `service_order_updated`.
- **Granularidade pendente**: separar metadados comuns, campos de custo, agenda e campos sensiveis; atribuicao de provider deve virar action/helper proprio apenas quando houver elegibilidade real de rede homologada.

### 5.13 `serviceOrderDelete`

- **Helper atual**: `canDeleteServiceOrder`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: exclusao logica afeta governanca e historico tecnico.
- **Granularidade pendente**: exigir motivo/contexto e restringir por status, papel e relacionamento operacional.

### 5.14 `serviceOrderEvidenceUpload`

- **Helper atual**: `canUploadServiceEvidence`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: evidencia operacional sustenta rastreabilidade da OS.
- **Granularidade pendente**: tipo de evidencia, provider atribuido, link publico/auditavel e limites de arquivo.

### 5.15 `serviceOrderChecklistUpdate`

- **Helper atual**: `canUpdateServiceOrderChecklist`.
- **Status**: parcial.
- **Policy atual**: acesso contextual ao imovel.
- **Coerencia de dominio**: checklist faz parte da execucao tecnica da OS e ja audita `service_order_checklist_updated`.
- **Granularidade pendente**: responsabilidade por papel, provider atribuido e regras por etapa/status da OS.

### 5.16 `serviceMessageAccess`

- **Helper atual**: `canViewServiceMessages`, `canSendServiceMessage`, `canViewInternalServiceMessages` e `canSendInternalServiceMessage`.
- **Status**: parcial.
- **Policy atual**: participantes da OS, provider com bid ativo e usuarios com acesso contextual ao imovel podem ler/enviar mensagens; providers nao podem ler/enviar mensagens internas.
- **Coerencia de dominio**: chat de OS e colaboracao operacional vinculada ao prontuario da ordem de servico, nao feature isolada do provider portal.
- **Granularidade pendente**: mover busca de bid ativo e acesso contextual para uma policy mais completa quando houver contexto de thread/mensagem mais formal; anexos de chat continuam URLs simples e nao devem ser tratados como evidencia/documento sem passar pelos fluxos dedicados.

### 5.17 `searchPropertyResults`

- **Helper atual**: `canSearchProperty`, `canSearchServiceOrders`, `canSearchDocuments`, `canSearchInventory` e `canSearchMaintenance`.
- **Status**: parcial.
- **Policy atual**: busca por propriedade usa acesso contextual ao imovel; busca global usa `listAccessiblePropertyIds` e limita resultados a propriedades acessiveis; allowlist local define campos pesquisaveis. OS pesquisa `title` e `system_type`; documentos pesquisam apenas `title`, sem OCR.
- **Coerencia de dominio**: busca e leitura transversal de metadados do prontuario tecnico, nao permissao propria para expor dados sensiveis.
- **Consumo frontend**: resultados devem ser tratados como metadados navegaveis; a rota de destino continua responsavel por confirmar autorizacao e carregar conteudo completo.
- **Granularidade pendente**: separar campos pesquisaveis por tipo, especialmente OCR/documentos, evidencias e futuros indices multi-tenant; nao incluir credenciais ou segredos em search.

### 5.18 `providerProposalSubmit`

- **Helper atual**: `canSubmitProviderProposal`.
- **Status**: parcial.
- **Policy atual**: `provider` ou `admin`, com contexto minimo de OS aberta, sem execucao direta e sem proposta pendente duplicada.
- **Coerencia de dominio**: proposta pertence a Provider Network privada, nao marketplace aberto.
- **Granularidade pendente**: categoria, homologacao, tenant, disponibilidade e elegibilidade completa da oportunidade.

### 5.19 `providerPortalAccess`

- **Helper atual**: `canAccessProviderPortal`.
- **Status**: implementado.
- **Policy atual**: `provider`, `admin` ou colaborador com role `provider`.
- **Coerencia de dominio**: portal e entrada operacional para rede homologada.
- **Granularidade pendente**: separar acesso ao portal de visibilidade de oportunidades, servicos atribuidos e elegibilidade por categoria, homologacao, contexto e disponibilidade.

### 5.20 `providerOpportunityView`

- **Helper atual**: `canViewProviderOpportunity`.
- **Status**: parcial.
- **Policy atual**: `provider` ou `admin`, oportunidade `requested`, sem provider atribuido, nao deletada e, na listagem, respeitando os filtros atuais de categoria quando nao ha `system_type` explicito.
- **Coerencia de dominio**: oportunidades pertencem a Provider Network privada e nao devem expor OS atribuida ou fechada como oferta aberta.
- **Granularidade pendente**: homologacao, tenant, convite, disponibilidade e elegibilidade fina por propriedade/rede.

### 5.21 `assignedProviderServiceView`

- **Helper atual**: `canViewAssignedProviderService`.
- **Status**: parcial.
- **Policy atual**: `admin` pode ler OS nao deletada; provider comum so pode ler OS atribuida a si mesmo.
- **Coerencia de dominio**: servicos atribuidos sao execucao operacional privada, nao oportunidade aberta.
- **Granularidade pendente**: separar leitura, stats e mutacoes por fase/status da OS; mensagens ja possuem helpers gerais no modulo de chat da OS, enquanto evidencia e status provider-specific devem aguardar endpoint/fluxo real.

### 5.22 `providerInvoiceUpload`

- **Helper atual**: `canUploadProviderInvoice`.
- **Status**: parcial.
- **Policy atual**: mesma regra atual de OS atribuida/admin, agora nomeada como action de upload.
- **Coerencia de dominio**: nota fiscal enviada por provider vira documento vinculado a OS e ao acervo tecnico.
- **Auditoria**: usa `document_uploaded` com `upload_source = provider_invoice`.
- **Decisao de status atual**: nao restringir por fase da OS nesta etapa; o fluxo existente permite invoice em qualquer OS atribuida/admin nao deletada.
- **Granularidade pendente**: definir regra operacional para status permitido, tipo fiscal/documental e relacao com documentos sensiveis antes de bloquear upload.

### 5.23 `providerEvidenceUpload`

- **Helper atual**: nenhum helper provider-specific.
- **Status**: gap adiado.
- **Policy atual**: nao ha endpoint de evidencia especifico do provider portal; fotos, video e audio seguem no modulo geral de service orders com `canUploadServiceEvidence`.
- **Coerencia de dominio**: evidencia operacional deve continuar como parte da OS, mas o provider portal ainda nao tem contrato proprio para essa action.
- **Granularidade pendente**: criar helper apenas quando existir fluxo real para provider atribuido enviar evidencia sem depender de acesso generico ao imovel.

### 5.24 `providerServiceStatusChange`

- **Helper atual**: nenhum helper provider-specific.
- **Status**: gap adiado.
- **Policy atual**: nao ha endpoint de mudanca de status especifico do provider portal; transicoes continuam no modulo geral de service orders com `canChangeServiceOrderStatus` e `canCloseServiceOrderWithEvidence` quando aplicavel.
- **Coerencia de dominio**: status de OS atribuida e decisao operacional sensivel e deve continuar governado pelo fluxo principal ate existir contrato proprio do provider.
- **Granularidade pendente**: criar helper apenas quando houver action real para provider atribuido iniciar, pausar, concluir ou sinalizar execucao sem depender da mutacao geral de OS.

---

## 6. Riscos

- Helpers parciais podem ser lidos como policy final, mesmo ainda delegando para `canAccessProperty`.
- Provider global ainda tem acesso amplo ao portal; visibilidade minima de oportunidades tem helper, mas elegibilidade fina ainda depende de filtros e regras em rota.
- Atribuicao de provider ainda nao deve ser lida como coberta por `canUpdateServiceOrder`; permanece gap de Provider Network ate existir regra real de elegibilidade.
- Documentos e OCR exigem mais cuidado antes de ampliar automacoes ou busca sem policies por tipo.
- Sem tenant/organization, `property_id` continua sendo o limite principal de autorizacao.

---

## 7. Proximos passos recomendados

1. Priorizar granularidade de service orders: status, evidencias, checklist, exclusao e fechamento; tratar atribuicao de provider como bloco proprio de Provider Network quando a elegibilidade estiver definida.
2. Evoluir provider opportunities para homologacao, tenant, convite e disponibilidade quando esses dados estiverem maduros.
3. Separar policies documentais por tipo e criticidade antes de ampliar OCR e classificacao.
4. Endurecer audit links com policy por OS, escopo, revogacao e auditoria sem token completo.
5. Atualizar `AUTHORIZATION_CORE_GAPS.md` quando novos helpers forem promovidos de parcial para implementado.
6. Planejar tenant/organization como evolucao arquitetural incremental.
