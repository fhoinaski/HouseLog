# ACTION_AUTHORIZATION_MATRIX.md - HouseLog

## 1. Objetivo

Esta matriz cruza actions explicitas prioritarias do HouseLog com a autorizacao esperada e o estado atual dos helpers/policies.

O objetivo e evitar regra espalhada, nomes contraditorios e implementacoes futuras sem Authorization Core. Este documento nao altera codigo e nao cria permissoes novas.

Referencias:

- `docs/ACTION_ENDPOINTS_CANDIDATES.md`
- `docs/AUDIT_EVENT_CATALOG.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/BOUNDARY_MAP.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Diagnostico

O HouseLog ja possui actions sensiveis e candidatas claras, mas a autorizacao ainda esta em diferentes niveis de maturidade:

- credenciais ja usam helpers nomeados;
- `createAuditLink` ja tem helper inicial;
- `markMaintenanceDone` ja tem helper inicial;
- documentos, OS e provider proposal ainda precisam de helpers formais por action;
- provider e temp_provider devem continuar restritos a contextos operacionais reais.

Esta matriz define o estado inicial para orientar proximas implementacoes sem overengineering.

---

## 3. Regras de leitura

- **Quem pode hoje** descreve o comportamento ou policy atual documentada.
- **Quem nao pode hoje** lista restricoes explicitas do dominio atual.
- **Helper atual / debito** indica se ja existe helper no Authorization Core ou se a action ainda depende de regra local/futura.
- Quando a policy ainda nao existe, a matriz deve ser usada como debito de implementation, nao como permissao implicita.

---

## 4. Matriz inicial

| Action | Boundary principal | Quem pode hoje | Quem nao pode hoje | Sensibilidade | Exige auditoria | Helper atual / debito |
| --- | --- | --- | --- | --- | --- | --- |
| `revealCredentialSecret` | Credentials and Sensitive Access | owner do imovel e manager direto | colaboradores comuns, provider, temp_provider e usuarios sem acesso ao imovel | Critica | Sim, `secret_reveal` | Existe: `canRevealCredentialSecret` |
| `generateTemporaryCredentialAccess` | Credentials and Sensitive Access | mesma regra de revelacao de segredo | colaboradores comuns, provider, temp_provider e usuarios sem acesso ao imovel | Critica | Sim, futuro `temporary_credential_access_generated` | Existe: `canGenerateTemporaryCredentialAccess`; debito: auditoria e policy granular |
| `createAuditLink` | Audit and Governance / Public Access Boundary | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto, usuarios sem acesso ao imovel | Critica | Sim, `audit_link_created` | Existe: `canCreateAuditLink`; debito: escopo mais granular por OS/link |
| `markMaintenanceDone` | Property Operating System | usuarios com acesso contextual ao imovel | provider/temp_provider sem contexto, usuarios sem acesso ao imovel | Alta | Sim, `maintenance_mark_done` | Existe: `canMarkMaintenanceDone`; debito: granularidade por maintenance |
| `documentUpload` | Documents and Evidence | usuarios com acesso contextual ao imovel conforme rota atual | provider/temp_provider sem contexto, usuarios sem acesso ao imovel | Alta | Sim, `document_uploaded` | Debito: criar `canUploadDocument` ou helper equivalente |
| `documentDelete` | Documents and Evidence | usuarios com acesso contextual ao imovel conforme rota atual | provider/temp_provider sem contexto, usuarios sem acesso ao imovel | Alta | Sim, `document_deleted` | Debito: criar `canDeleteDocument`; considerar motivo/exclusao governada |
| `documentOCRRequest` | Documents and Evidence | usuarios com acesso contextual ao documento/imovel conforme rota atual | provider/temp_provider sem contexto, usuarios sem acesso ao documento/imovel | Media/Alta | Sim, `document_ocr_requested` quando OCR virar action formal | Debito: criar `canRequestDocumentOCR` ou `canExtractDocumentMetadata` |
| `serviceOrderCreate` | Service Operations | owner/manager/colaborador autorizado conforme regras atuais de OS/propriedade | usuarios sem acesso ao imovel; provider/temp_provider fora de fluxo autorizado | Alta | Sim, `service_order_created` | Debito: criar `canCreateServiceOrder`; hoje ha checagens locais |
| `serviceOrderStatusChange` | Service Operations | usuarios autorizados no contexto da OS; provider apenas quando vinculado ao fluxo permitido | provider nao vinculado, temp_provider fora de link/escopo, usuarios sem acesso | Alta | Sim, `service_order_status_changed` | Debito: criar `canMutateServiceOrder` / `canCloseServiceOrder` |
| `providerProposalSubmit` | Provider Network / Service Operations | provider elegivel no contexto da oportunidade/OS conforme regra atual de provider flow | providers nao elegiveis, usuarios sem contexto, rede aberta generica | Alta | Sim, `provider_proposal_submitted` | Debito: criar `canBidOnOpportunity` ou helper de elegibilidade |

---

## 5. Detalhes por action

### 5.1 `revealCredentialSecret`

- **Estado atual**: implementado como action explicita preferencial via `POST /secret/reveal`.
- **Policy atual**: owner ou manager direto do imovel.
- **Helper**: `canRevealCredentialSecret`.
- **Auditoria**: obrigatoria; nao registrar `secret`.
- **Debito**: remover `GET /secret` legado e adicionar motivo/contexto quando a policy evoluir.

### 5.2 `generateTemporaryCredentialAccess`

- **Estado atual**: action existente para gerar codigo temporario.
- **Policy atual**: mesma regra de revelacao de segredo.
- **Helper**: `canGenerateTemporaryCredentialAccess`.
- **Auditoria**: deve ser obrigatoria; catalogo recomenda `temporary_credential_access_generated`.
- **Debito**: nao registrar PIN; adicionar auditoria formal, motivo e escopo.

### 5.3 `createAuditLink`

- **Estado atual**: helper inicial existe.
- **Policy atual**: acesso contextual ao imovel.
- **Helper**: `canCreateAuditLink`.
- **Auditoria**: obrigatoria.
- **Debito**: evoluir para escopo por OS, expiracao, revogacao e tenant quando existir.

### 5.4 `markMaintenanceDone`

- **Estado atual**: action explicita `POST /mark-done` iniciada, com caminho legado preservado.
- **Policy atual**: acesso contextual ao imovel.
- **Helper**: `canMarkMaintenanceDone`.
- **Auditoria**: `maintenance_mark_done`.
- **Debito**: diferenciar permissao de concluir manutencao quando houver roles/contextos mais finos.

### 5.5 `documentUpload`

- **Estado atual**: fluxo funcional de upload.
- **Policy atual**: acesso contextual ao imovel, conforme rota atual.
- **Helper**: ainda nao ha helper nomeado especifico.
- **Auditoria**: `document_uploaded`.
- **Debito**: criar `canUploadDocument`; padronizar metadata segura.

### 5.6 `documentDelete`

- **Estado atual**: fluxo funcional de exclusao; frontend ja tem confirmacao explicita.
- **Policy atual**: acesso contextual ao imovel, conforme rota atual.
- **Helper**: ainda nao ha helper nomeado especifico.
- **Auditoria**: `document_deleted`.
- **Debito**: criar `canDeleteDocument`; considerar motivo de exclusao em etapa futura.

### 5.7 `documentOCRRequest`

- **Estado atual**: OCR existe como capacidade/processamento, mas deve evoluir com action e auditoria mais claras.
- **Policy atual**: acesso contextual ao documento/imovel.
- **Helper**: ainda nao ha helper nomeado especifico.
- **Auditoria**: `document_ocr_requested` quando action formal existir.
- **Debito**: criar `canRequestDocumentOCR` ou `canExtractDocumentMetadata`; evitar gravar texto sensivel bruto.

### 5.8 `serviceOrderCreate`

- **Estado atual**: OS e unidade operacional central; criacao existe em rotas atuais.
- **Policy atual**: acesso contextual ao imovel e regras locais de rota.
- **Helper**: ainda nao ha helper formal completo.
- **Auditoria**: `service_order_created`.
- **Debito**: criar `canCreateServiceOrder`; alinhar provider/temp_provider a contexto real.

### 5.9 `serviceOrderStatusChange`

- **Estado atual**: transicoes existem em rotas de OS, mas ainda precisam consolidacao por action/helper.
- **Policy atual**: depende da rota e do contexto da OS.
- **Helper**: ainda nao ha helper formal completo.
- **Auditoria**: `service_order_status_changed`.
- **Debito**: criar `canMutateServiceOrder`, `canCloseServiceOrder` e regras por provider vinculado/link publico.

### 5.10 `providerProposalSubmit`

- **Estado atual**: envio de proposta/bid existe no provider flow.
- **Policy atual**: provider deve estar no contexto da oportunidade/OS conforme regra atual.
- **Helper**: ainda nao ha helper formal no Authorization Core inicial.
- **Auditoria**: `provider_proposal_submitted`.
- **Debito**: criar `canBidOnOpportunity`; alinhar com rede homologada/elegivel, nao marketplace aberto.

---

## 6. Riscos

- Usar "quem pode hoje" como permissao definitiva pode cristalizar regras amplas demais.
- Acesso por propriedade ainda substitui policies mais granulares em varias areas.
- Provider/temp_provider exigem cuidado: acesso deve vir de OS, elegibilidade ou link publico, nao de papel global.
- Sem tenant/organization, a matriz ainda depende de `property_id` como contexto principal.
- Actions futuras sem helper nomeado tendem a reintroduzir regra local espalhada.

---

## 7. Proximos passos recomendados

1. Priorizar helpers faltantes de maior risco: `canCreateServiceOrder`, `canMutateServiceOrder`, `canBidOnOpportunity`.
2. Criar helpers especificos para documentos: `canUploadDocument`, `canDeleteDocument`, `canRequestDocumentOCR`.
3. Adicionar auditoria formal para `generateTemporaryCredentialAccess`.
4. Evoluir `canMarkMaintenanceDone` quando houver roles mais granulares para manutencao.
5. Revisar esta matriz sempre que uma action candidata virar endpoint publico.

