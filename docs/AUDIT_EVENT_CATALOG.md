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
| P1 | `document_uploaded` | Documents and Evidence | Alta | obrigatorio para acervo tecnico |
| P1 | `document_deleted` | Documents and Evidence | Alta | obrigatorio |
| P1 | `service_order_status_changed` | Service Operations | Alta | obrigatorio |
| P1 | `maintenance_mark_done` | Property Operating System | Alta | recomendado como nome canonico |
| P1 | `service_order_created` | Service Operations | Alta | recomendado |
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
- **Observacao**: deve ser priorizado porque a geracao de acesso temporario pode ter impacto fisico no imovel.

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

### 5.4 `maintenance_mark_done`

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

### 5.5 `document_uploaded`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Documents and Evidence / Property Operating System
- **Quando registrar**: upload de documento para o acervo tecnico do imovel.
- **Action relacionada**: upload documental existente.
- **Autorizacao esperada**: helper contextual de acesso a propriedade/documento.
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
- **Observacao**: essencial para governanca de acervo tecnico.

### 5.6 `document_deleted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Documents and Evidence / Audit and Governance
- **Quando registrar**: exclusao ou soft delete de documento.
- **Action relacionada**: exclusao documental existente.
- **Autorizacao esperada**: helper contextual de acesso a propriedade/documento.
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
- **Observacao**: deve ser acompanhado de confirmacao explicita no frontend.

### 5.7 `document_ocr_requested`

- **Prioridade**: P2
- **Sensibilidade**: Media/Alta
- **Boundary**: Documents and Evidence
- **Quando registrar**: solicitacao de OCR ou extracao de metadados de documento.
- **Action relacionada**: `extractDocumentMetadata`
- **Autorizacao esperada**: helper contextual de acesso a propriedade/documento.
- **Payload minimo**:
  - `property_id`
  - `document_id`
  - `ocr_provider` quando aplicavel
  - `requested_by`
  - `request_source`
- **Nao registrar**:
  - texto integral extraido quando nao for necessario
  - dados sensiveis detectados no OCR
- **Observacao**: recomendado antes de automatizar classificacao ou resumo documental.

### 5.8 `service_order_created`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Property Operating System
- **Quando registrar**: criacao de ordem de servico ou solicitacao operacional equivalente.
- **Action relacionada**: criacao de OS existente e futuro `createServiceOrderDraft` quando virar fluxo real.
- **Autorizacao esperada**: futuro `canCreateServiceOrder` ou helper equivalente.
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
- **Observacao**: OS e unidade operacional central do HouseLog.

### 5.9 `service_order_status_changed`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Service Operations / Audit and Governance
- **Quando registrar**: qualquer transicao relevante de status da OS.
- **Action relacionada**: fechamento, aprovacao, inicio, conclusao, verificacao ou futuro `closeServiceOrderWithEvidence`.
- **Autorizacao esperada**: futuro `canMutateServiceOrder`, `canCloseServiceOrder` ou helper equivalente.
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
- **Observacao**: deve ser base para timeline e governanca operacional.

### 5.10 `provider_proposal_submitted`

- **Prioridade**: P1
- **Sensibilidade**: Alta
- **Boundary**: Provider Network / Service Operations
- **Quando registrar**: envio de proposta por provider elegivel/homologado para uma OS ou oportunidade.
- **Action relacionada**: envio de bid/proposta existente e futuro `requestProviderProposal`.
- **Autorizacao esperada**: futuro `canBidOnOpportunity` ou helper de elegibilidade.
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
2. Priorizar P0: `secret_reveal`, `temporary_credential_access_generated` e `audit_link_created`.
3. Alinhar `maintenance_mark_done` com a action explicita de manutencao.
4. Padronizar eventos de documentos: upload, exclusao e OCR.
5. Definir helpers do Authorization Core para service order e provider proposal antes de expandir auditoria nessas areas.
6. Quando multi-tenant real for introduzido, adicionar `tenant_id` e `organization_id` aos eventos prioritarios.
