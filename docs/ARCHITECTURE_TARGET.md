# ARCHITECTURE_TARGET.md — HouseLog

## 1. Objetivo

Este documento define a arquitetura-alvo do HouseLog para evoluir o sistema atual para uma plataforma privada, escalável e segura de gestão técnica e operacional de imóveis premium.

A arquitetura-alvo deve suportar:

- multi-tenant real;
- organizações;
- propriedades;
- papéis e permissões;
- rede homologada de prestadores;
- trilha de auditoria;
- credenciais e acessos sensíveis;
- operação premium com governança.

---

## 2. Princípio arquitetural central

A arquitetura do HouseLog deve ser desenhada a partir desta hierarquia:

### Camada organizacional
- Tenant
- Organization
- Membership

### Camada patrimonial
- Property
- PropertyUnit (opcional conforme evolução)
- PropertyDocument
- PropertyTimeline
- PropertyInventory

### Camada operacional
- MaintenancePlan
- ServiceOrder
- ServiceRequest
- Bid
- Message
- Attachment
- Expense

### Camada de rede homologada
- Provider
- ProviderProfile
- ProviderApproval
- ProviderCoverageArea
- ProviderCapability
- PreferredProviderLink

### Camada de governança
- AuditLog
- AccessCredential
- CredentialAccessPolicy
- ApprovalFlow
- AccessEvent

---

## 3. Problema da arquitetura atual

O estado atual do projeto tem uma boa base funcional, mas ainda depende fortemente de:

- contexto por `property_id`;
- papéis simples;
- provider model parcialmente orientado a marketplace;
- separação organizacional ainda insuficiente;
- governança e auditoria ainda não formalizadas como núcleo.

Isso é aceitável para uma base funcional, mas insuficiente para escalar com:

- múltiplas construtoras;
- múltiplas administradoras;
- portfolios independentes;
- redes homologadas por organização;
- dados sensíveis e operação premium.

---

## 4. Arquitetura-alvo por domínio

## 4.1 Tenant / Organization

### Tenant
Representa o isolamento superior do sistema.

Exemplos:
- uma construtora;
- uma administradora;
- um family office;
- uma operação privada.

Campos esperados:
- id
- name
- slug
- type
- status
- created_at
- updated_at

### Organization
Representa a estrutura operacional dentro de um tenant, quando necessário.

Exemplos:
- unidade de negócios;
- carteira;
- núcleo operacional;
- regional.

Campos esperados:
- id
- tenant_id
- name
- type
- status

### Membership
Relaciona usuários ao tenant/organization com papéis e permissões.

Campos esperados:
- id
- tenant_id
- organization_id
- user_id
- role
- status
- created_at

---

## 4.2 Property Layer

### Property
Deve sempre pertencer a um tenant e opcionalmente a uma organization.

Campos mínimos:
- id
- tenant_id
- organization_id
- owner_user_id opcional
- manager_user_id opcional
- type
- name
- address
- city
- area_m2
- status
- created_at

### Subdomínios do imóvel
- rooms
- inventory items
- documents
- maintenance plans
- expenses
- timeline events
- service orders

Todos devem carregar contexto de tenant de forma explícita ou derivada segura.

---

## 4.3 Service Operations

### ServiceOrder
Unidade operacional central do sistema.

Campos conceituais:
- id
- tenant_id
- organization_id
- property_id
- room_id opcional
- opened_by_user_id
- assigned_provider_id opcional
- category
- title
- description
- priority
- status
- scheduled_at
- started_at
- completed_at
- verified_at
- cost_estimate
- approved_cost
- actual_cost
- created_at
- updated_at

### ServiceRequest
Camada de solicitação/cotação antes da execução final.

### Bid
Proposta enviada por prestador homologado ou elegível.

### Message
Mensagens ligadas à OS, com segregação por visibilidade.

### Attachment
Anexos de evidência, laudos, fotos, vídeos e áudios.

---

## 4.4 Provider Network Curada

### Provider
Entidade principal do prestador.

### ProviderProfile
Perfil profissional estruturado.

### ProviderApproval
Status do prestador para determinado tenant.

Exemplos de status:
- pending_review
- approved
- preferred
- backup
- blocked
- archived

### ProviderCoverageArea
Região de atuação.

### ProviderCapability
Categorias e capacidades técnicas.

### PreferredProviderLink
Relaciona provider a tenant, organization, property ou categoria com nível de preferência.

---

## 4.5 Governança e Auditoria

### AuditLog
Toda ação crítica deve ser auditável.

Eventos importantes:
- criação e edição de OS;
- mudança de status;
- envio e aceite de proposta;
- criação e leitura de credenciais;
- compartilhamento de acesso;
- criação de links públicos;
- upload e exclusão de anexos;
- alterações de perfil crítico;
- ações administrativas.

Campos mínimos:
- id
- tenant_id
- actor_user_id
- actor_role
- entity_type
- entity_id
- action
- metadata
- ip opcional
- user_agent opcional
- created_at

### AccessCredential
Credenciais sensíveis do imóvel:
- wifi
- alarme
- portão
- smart lock
- app
- outros

### CredentialAccessPolicy
Define quem pode visualizar, gerar acesso temporário ou compartilhar.

### AccessEvent
Registra toda visualização, geração de código temporário, revogação e compartilhamento.

---

## 5. Modelo de permissões

O HouseLog deve evoluir de papéis simples para um modelo de:

- role
- scope
- capability

### Exemplo
Um `provider` não deve ter acesso amplo por ser provider.
Ele deve ter acesso apenas quando:
- estiver homologado para o tenant;
- estiver vinculado àquele fluxo;
- estiver envolvido naquela OS;
- tiver permissão contextual para aquele recurso.

### Estrutura recomendada
- papel global
- papel no tenant
- papel na organization
- papel no property context
- permissões específicas por ação

---

## 6. Multi-tenant real

Toda entidade estratégica deve considerar segregação por tenant, direta ou indiretamente.

### Regra
Nada sensível deve depender apenas de `property_id` para isolamento lógico.

### Objetivo
Evitar:
- vazamento entre clientes;
- ambiguidade de ownership;
- dificuldade de auditoria;
- limitações futuras de escala.

---

## 7. Segurança arquitetural

A arquitetura-alvo deve suportar:

- segregação por tenant;
- autorização contextual;
- credenciais criptografadas;
- links públicos com escopo e expiração;
- trilha de acesso;
- revogação;
- logs seguros;
- mínimo privilégio.

---

## 8. Evolução incremental recomendada

### Etapa 1
Formalizar documentos de produto, arquitetura e segurança.

### Etapa 2
Introduzir camada conceitual de tenant e organization.

### Etapa 3
Adaptar membership e vinculação de usuários.

### Etapa 4
Refatorar provider network para modelo curado por tenant.

### Etapa 5
Criar audit log formal.

### Etapa 6
Endurecer credenciais e políticas de acesso.

### Etapa 7
Revisar frontend e fluxos por papel conforme o novo modelo.

---

## 9. Regras para futuras implementações

Toda nova feature deve:
- declarar seu vínculo com tenant;
- declarar seu modelo de autorização;
- declarar eventos auditáveis;
- evitar duplicação de regra;
- preservar o núcleo premium e privado do produto.

---

## 10. Critério de aceite arquitetural

Uma evolução arquitetural só está correta se:
- melhora isolamento;
- melhora segurança;
- melhora governança;
- melhora coerência do domínio;
- prepara o sistema para clientes premium reais;
- não aproxima o produto de um marketplace aberto genérico.