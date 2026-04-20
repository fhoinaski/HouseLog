# AUDIT_EVENT_CATALOG.md - HouseLog

## 1. Objetivo

Este documento cataloga os eventos auditaveis prioritarios do HouseLog.

O objetivo e orientar futuras implementacoes para que a auditoria seja consistente, util para operacao premium, alinhada ao Authorization Core e preparada para evolucao AI-ready sem criar camada de IA prematura.

Este catalogo nao altera codigo nem cria eventos automaticamente. Ele define nomes e criterios recomendados.

Referencias:

- `docs/BOUNDARY_MAP.md`
- `docs/TECH_DEBT_REGISTER.md`
- `docs/ACTION_ENDPOINTS_CANDIDATES.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/AI_READY_CHECKLIST.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Diagnostico

O HouseLog ja registra alguns eventos sensiveis, mas os nomes e payloads ainda tendem a crescer de forma local por rota.

Sem um catalogo operacional, o sistema corre risco de:

- auditar a mesma acao com nomes diferentes;
- gravar payload sensivel demais;
- deixar acoes criticas sem trilha;
- dificultar investigacao futura por imovel, OS, documento ou credencial;
- prejudicar futuras automacoes que dependem de eventos confiaveis.

---

## 3. Criterios de classificacao

### Prioridade

- **P0**: evento obrigatorio para seguranca, credenciais, links publicos ou acoes com exposicao externa.
- **P1**: evento importante para governanca operacional, prontuario tecnico e rastreabilidade.
- **P2**: evento recomendado para melhoria de observabilidade e AI-ready, mas dependente de maturidade do fluxo.

### Sensibilidade

- **Critica**: envolve segredo, acesso externo, permissao ou exposicao de dado sensivel.
- **Alta**: altera estado operacional relevante, documento, OS, provider ou historico tecnico.
- **Media**: registra processamento, classificacao ou apoio operacional.

### Contexto minimo

Eventos devem registrar, quando aplicavel:

- `actor_id`;
- `actor_role`;
- `property_id`;
- `service_order_id`;
- `document_id`;
- `credential_id`;
- `provider_id`;
- `previous_state`;
- `next_state`;
- `reason` ou `context` quando existir no fluxo;
- `request_id` quando a infraestrutura suportar.

Nunca registrar:

- segredo de credencial;
- token de link publico;
- arquivo bruto;
- payload pessoal excessivo;
- dados internos de provider nao necessarios para investigacao.

---

## 4. Lista priorizada

| Prioridade | Evento canonico | Boundary principal | Sensibilidade | Status recomendado |
| --- | --- | --- | --- | --- |
| P0 | `secret_reveal` | Credentials and Sensitive Access | Critica | obrigatorio |
| P0 | `temporary_credential_access_generated` | Credentials and Sensitive Access | Critica | obrigatorio |
| P0 | `audit_link_created` | Audit and Governance / Public Access Boundary | Critica | obrigatorio |
| P1 | `credential_created` | Credentials and Sensitive Access | Alta | obrigatorio sem segredo |
| P1 | `credential_updated` | Credentials and Sensitive Access | Alta | obrigatorio sem segredo |
| P1 | `credential_deleted` | Credentials and Sensitive Access | Alta | obrigatorio sem segredo |
| P1 | `document_uploaded` | Documents and Evidence | Alta | obrigatorio para acervo tecnico |
| P1 | `document_deleted` | Documents and Evidence | Alta | obrigatorio |
| P1 | `service_order_status_changed` | Service Operations | Alta | obrigatorio |
| P1 | `maintenance_mark_done` | Property Operating System | Alta | recomendado como nome canonico |
| P1 | `service_order_created` | Service Operations | Alta | recomendado |
| P1 | `service_order_evidence_uploaded` | Service Operations / Documents and Evidence | Alta | obrigatorio sem arquivo bruto |
| P1 | `service_order_updated` | Service Operations | Alta | obrigatorio com payload minimo |
| P1 | `service_order_deleted` | Service Operations / Audit and Governance | Alta | obrigatorio |
| P1 | `service_order_checklist_updated` | Service Operations / Property Operating System | Alta | recomendado |
| P1 | `provider_proposal_submitted` | Provider Network / Service Operations | Alta | recomendado |
| P2 | `document_ocr_requested` | Documents and Evidence | Media/Alta | recomendado |

---

## 5. Eventos catalogados

### 5.1 `secret_reveal`

- **Prioridade**: P0
- **Sensibilidade**: Critica
- **Boundary**: Credentials and Sensitive Access
- **Quando registrar**: toda revelacao explicita de segredo de credencial.
- **Action relacionada**: `revealCredentialSecret`
- **Autorizacao esperada**: `canRevealCredentialSecret`
- **Payload minimo**:
  - `property_id`
  - `credential_id`
  - `category`
  - `label`
  - `actor_id`
- **Nao registrar**:
  - `secret`
  - senha, PIN, token ou valor revelado
- **Observacao**: evento ja existe no fluxo de credenciais e deve permanecer como referencia para acoes sensiveis.

### 5.2 `temporary_credential_access_generated`

- **Prioridade**: P0
- **Sensibilidade**: Critica
- **Boundary**: Credentials and Sensitive Access
- **Quando registrar**: geracao de PIN, acesso temporario ou credencial derivada para entrada no imovel.
- **Action relacionada**: `generateTemporaryCredentialAccess`
- **Autorizacao esperada**: `canGenerateTemporaryCredentialAccess`
- **Payload minimo**:
  - `property_id`
  - `credential_id`
  - `expires_at`
  - `expires_hours`
  - `provider_name` quando informado
  - `actor_id`
- **Nao registrar**:
  - PIN gerado
  - segredo base da credencial
- **Observacao**: evento implementado no fluxo atual de geracao temporaria sem registrar PIN ou segredo base.

### 5.3 `audit_link_created`

- **Prioridade**: P0
- **Sensibilidade**: Critica
- **Boundary**: Audit and Governance / Public Access Boundary / Service Operations
- **Quando registrar**: criacao de link publico, auditavel ou temporario para acesso externo.
- **Action relacionada**: `createAuditLink`
- **Autorizacao esperada**: `canCreateAuditLink`
- **Payload minimo**:
  - `property_id`
  - `service_order_id` quando aplicavel
  - `scope`
  - `expires_at`
  - `actor_id`
- **Nao registrar**:
  - token completo do link
  - payload publico excessivo
- **Observacao**: links publicos devem sempre ter escopo minimo, expiracao e trilha.

### 5.4 `credential_created`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Credentials and Sensitive Access
- **Quando registrar**: criacao de credencial de acesso do imovel.
- **Action relacionada**: criacao de credencial existente.
- **Autorizacao esperada**: `canCreateCredential`.
- **Payload minimo**:
  - `property_id`
  - `credential_id`
  - `category`
  - `label`
  - `integration_type`
  - `share_with_os`
  - `actor_id`
- **Nao registrar**:
  - `secret`
  - username, notas ou config de integracao
- **Observacao**: evento implementado no fluxo principal de criacao de credencial com DTO mascarado.

### 5.5 `credential_updated`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Credentials and Sensitive Access
- **Quando registrar**: edicao de metadados ou segredo de credencial.
- **Action relacionada**: edicao de credencial existente.
- **Autorizacao esperada**: `canUpdateCredential`.
- **Payload minimo**:
  - `property_id`
  - `credential_id`
  - `category`
  - `label`
  - `integration_type`
  - `share_with_os`
  - `changed_fields`
  - `secret_changed`
  - `actor_id`
- **Nao registrar**:
  - `secret`
  - username, notas ou config de integracao
- **Observacao**: evento implementado sem gravar valor anterior ou novo do segredo; apenas `secret_changed`.

### 5.6 `credential_deleted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Credentials and Sensitive Access / Audit and Governance
- **Quando registrar**: soft delete de credencial do imovel.
- **Action relacionada**: remocao de credencial existente.
- **Autorizacao esperada**: `canDeleteCredential`.
- **Payload minimo**:
  - `property_id`
  - `credential_id`
  - `category`
  - `label`
  - `integration_type`
  - `share_with_os`
  - `actor_id`
- **Nao registrar**:
  - `secret`
  - username, notas ou config de integracao
- **Observacao**: evento implementado no fluxo principal de remocao, preservando resposta atual.

### 5.7 `maintenance_mark_done`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Property Operating System / Audit and Governance
- **Quando registrar**: conclusao de rotina de manutencao preventiva.
- **Action relacionada**: `markMaintenanceDone`
- **Autorizacao esperada**: `canMarkMaintenanceDone`
- **Payload minimo**:
  - `property_id`
  - `maintenance_schedule_id`
  - `previous_last_done`
  - `previous_next_due`
  - `last_done`
  - `next_due`
  - `auto_create_os`
  - `actor_id`
- **Nao registrar**:
  - dados nao relacionados ao agendamento
- **Observacao**: `maintenance_mark_done` e o nome canonico para a conclusao preventiva, incluindo o endpoint preferencial `POST /mark-done` e o caminho legado `/done`.

### 5.8 `document_uploaded`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Documents and Evidence / Property Operating System
- **Quando registrar**: upload de documento para o acervo tecnico do imovel.
- **Action relacionada**: upload documental existente.
- **Autorizacao esperada**: `canUploadDocument`.
- **Payload minimo**:
  - `property_id`
  - `document_id`
  - `type`
  - `title`
  - `file_mime_type` quando disponivel
  - `file_size` quando disponivel
  - `actor_id`
- **Nao registrar**:
  - arquivo bruto
  - URL assinada temporaria
  - conteudo integral extraido
- **Observacao**: evento implementado no fluxo principal de upload documental. Essencial para governanca de acervo tecnico.

### 5.9 `document_deleted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Documents and Evidence / Audit and Governance
- **Quando registrar**: exclusao ou soft delete de documento.
- **Action relacionada**: exclusao documental existente.
- **Autorizacao esperada**: `canDeleteDocument`.
- **Payload minimo**:
  - `property_id`
  - `document_id`
  - `type`
  - `title`
  - `actor_id`
  - `reason` quando existir no fluxo
- **Nao registrar**:
  - conteudo do documento
  - URL permanente ou temporaria sem necessidade
- **Observacao**: evento implementado no fluxo principal de exclusao documental. Deve ser acompanhado de confirmacao explicita no frontend.

### 5.10 `document_ocr_requested`

- **Prioridade**: P2
- **Sensibilidade**: Media/Alta
- **Boundary**: Documents and Evidence
- **Quando registrar**: solicitacao de OCR ou extracao de metadados de documento.
- **Action relacionada**: `extractDocumentMetadata`
- **Autorizacao esperada**: `canRequestDocumentOCR`.
- **Payload minimo**:
  - `property_id`
  - `document_id`
  - `ocr_provider` quando aplicavel
  - `requested_by`
  - `request_source`
- **Nao registrar**:
  - texto integral extraido quando nao for necessario
  - dados sensiveis detectados no OCR
- **Observacao**: evento implementado no fluxo principal de OCR documental. Recomendado antes de automatizar classificacao ou resumo documental.

### 5.11 `service_order_created`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Property Operating System
- **Quando registrar**: criacao de ordem de servico ou solicitacao operacional equivalente.
- **Action relacionada**: criacao de OS existente e futuro `createServiceOrderDraft` quando virar fluxo real.
- **Autorizacao esperada**: `canCreateServiceOrder`.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `system_type`
  - `priority`
  - `status`
  - `requested_by`
  - `actor_id`
- **Nao registrar**:
  - anexos brutos
  - dados pessoais excessivos
- **Observacao**: evento implementado no fluxo principal de criacao de OS com payload minimo. OS e unidade operacional central do HouseLog.

### 5.12 `service_order_status_changed`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Audit and Governance
- **Quando registrar**: qualquer transicao relevante de status da OS.
- **Action relacionada**: fechamento, aprovacao, inicio, conclusao, verificacao ou futuro `closeServiceOrderWithEvidence`.
- **Autorizacao esperada**: `canMutateServiceOrder` no fluxo atual; helpers mais granulares podem surgir para fechamento e evidencias.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `previous_status`
  - `next_status`
  - `actor_id`
  - `evidence_count` quando aplicavel
- **Nao registrar**:
  - fotos ou arquivos brutos
  - payload de chat
- **Observacao**: evento implementado no fluxo principal de mudanca de status de OS. Deve ser base para timeline e governanca operacional.

### 5.13 `service_order_evidence_uploaded`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Documents and Evidence
- **Quando registrar**: upload de foto, video ou audio como evidencia operacional de OS.
- **Action relacionada**: upload de evidencia em OS existente.
- **Autorizacao esperada**: `canMutateServiceOrder` no fluxo atual; futuro `canUploadServiceEvidence`.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `evidence_type`
  - `photo_type` quando aplicavel
  - `file_mime_type`
  - `file_size`
  - `actor_id`
- **Nao registrar**:
  - arquivo bruto
  - URL publica ou assinada
  - transcricao de audio ou conteudo visual
- **Observacao**: evento implementado nos fluxos atuais de foto, video e audio sem alterar os contratos de upload.

### 5.14 `service_order_updated`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations
- **Quando registrar**: edicao de metadados operacionais de OS.
- **Action relacionada**: atualizacao de OS existente.
- **Autorizacao esperada**: `canMutateServiceOrder` no fluxo atual; helpers mais granulares podem surgir para atribuicao e campos sensiveis.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `changed_fields`
  - `status`
  - `actor_id`
- **Nao registrar**:
  - snapshot completo da OS
  - URLs de evidencias
  - descricoes longas, anexos ou payload de checklist
- **Observacao**: evento implementado no fluxo atual de edicao sem alterar contrato publico.

### 5.15 `service_order_deleted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Audit and Governance
- **Quando registrar**: soft delete de OS.
- **Action relacionada**: remocao operacional de OS existente.
- **Autorizacao esperada**: `canMutateServiceOrder` no fluxo atual; futuro helper granular pode exigir motivo e contexto.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `previous_status`
  - `actor_id`
- **Nao registrar**:
  - snapshot completo da OS
  - evidencias, URLs ou anexos
  - conversas ou mensagens vinculadas
- **Observacao**: evento implementado no fluxo atual de exclusao logica sem alterar contrato publico.

### 5.16 `service_order_checklist_updated`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Property Operating System
- **Quando registrar**: atualizacao do checklist operacional de OS.
- **Action relacionada**: atualizacao de checklist existente.
- **Autorizacao esperada**: `canMutateServiceOrder` no fluxo atual; futuro helper granular pode separar checklist de edicao ampla.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `checklist_items_count`
  - `completed_items_count`
  - `actor_id`
- **Nao registrar**:
  - conteudo textual dos itens
  - evidencias, anexos ou arquivos
  - snapshots completos do checklist
- **Observacao**: evento implementado no endpoint dedicado de checklist com payload de contagem para governanca sem excesso de dados.

### 5.17 `provider_proposal_submitted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Provider Network / Service Operations
- **Quando registrar**: envio de proposta por provider no fluxo de OS ou oportunidade da rede homologada.
- **Action relacionada**: envio de bid/proposta existente e futuro `requestProviderProposal`.
- **Autorizacao esperada**: `canSubmitProviderProposal`.
- **Payload minimo**:
  - `property_id`
  - `service_order_id`
  - `provider_id`
  - `proposal_id`
  - `amount`
  - `status`
  - `actor_id`
- **Nao registrar**:
  - dados bancarios
  - detalhes pessoais excessivos do provider
- **Observacao**: deve reforcar rede homologada, nao marketplace aberto.
  Evento implementado no fluxo principal de bids com payload minimo e sem dados pessoais excessivos. Elegibilidade granular permanece como evolucao futura do Authorization Core.

---

## 6. Regras operacionais

Ao adicionar ou alterar eventos auditaveis:

1. usar nome canonico deste catalogo quando existir;
2. definir boundary principal antes da implementacao;
3. usar helper do Authorization Core antes da acao;
4. registrar IDs e estados, nao payload bruto;
5. nunca registrar segredo, token ou arquivo bruto;
6. preservar compatibilidade se o codigo ja usa nome legado;
7. atualizar este catalogo quando um evento virar contrato operacional.

---

## 7. Riscos

- Eventos com nomes diferentes para a mesma acao dificultam investigacao.
- Auditoria excessiva pode gravar dado sensivel desnecessario.
- Auditoria fraca reduz confianca em credenciais, links publicos, documentos e OS.
- Sem tenant/organization, alguns eventos ainda dependem de `property_id` como contexto principal.
- Nomes canonicos podem divergir temporariamente dos nomes ja usados no codigo; migracao deve ser incremental.

---

## 8. Proximos passos recomendados

1. Mapear eventos ja existentes no backend e comparar com este catalogo.
2. Manter P0 alinhados no backend: `secret_reveal`, `temporary_credential_access_generated` e `audit_link_created`.
3. Alinhar `maintenance_mark_done` com a action explicita de manutencao.
4. Padronizar eventos de documentos: upload, exclusao e OCR.
5. Evoluir helpers de service order e provider proposal para granularidade maior antes de expandir auditoria nessas areas.
6. Quando multi-tenant real for introduzido, adicionar `tenant_id` e `organization_id` aos eventos prioritarios.
