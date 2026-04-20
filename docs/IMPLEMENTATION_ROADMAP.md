# IMPLEMENTATION_ROADMAP.md — HouseLog

## 1. Objetivo

Este documento define a ordem oficial de implementação e refatoração do HouseLog com base em:

- posicionamento premium privado;
- arquitetura-alvo;
- auditoria do frontend;
- auditoria do backend;
- necessidade de endurecimento de segurança;
- necessidade de preparar o produto para venda, operação e escala.

O objetivo não é refatorar tudo de uma vez.
O objetivo é evoluir o HouseLog em fases controladas, com menor risco possível e máxima coerência entre produto, arquitetura e execução.

---

## 2. Princípio de execução

Toda implementação deve obedecer esta lógica:

1. primeiro corrigir riscos estruturais e de segurança;
2. depois consolidar linguagem de produto e arquitetura;
3. depois refatorar shell, domínio e componentes;
4. depois evoluir tenancy, governança e provider network;
5. só então expandir a camada premium, comercial e visual.

---

## 3. Critérios de priorização

Cada item do roadmap é classificado por:

- **severidade**: crítica / alta / média / baixa
- **esforço**: baixo / médio / alto
- **dependência**: se bloqueia outras fases
- **área**: front / back / produto / segurança / arquitetura

---

## 4. Macro-fases

O roadmap é dividido em 8 fases:

1. alinhamento e documentação
2. hardening de segurança
3. autorização e boundary architecture
4. linguagem de produto e provider network privada
5. shell e design system do frontend
6. modularização técnica e governança
7. multi-tenant e organizações
8. preparação premium/comercial

---

## 5. Fase 1 — Alinhamento e documentação

### Objetivo
Congelar a direção oficial do produto e remover ambiguidades estruturais antes de alterações profundas.

### Itens
1. consolidar os documentos-base em `/docs`
2. consolidar `AGENTS.md` raiz, front e back
3. eliminar conflito entre “Echelon Slate” e “The Architectural Lens”
4. criar mapa oficial de domínios/boundaries
5. formalizar ADRs principais do projeto

### Tarefas
- atualizar `house-log-front/AGENTS.md`
- revisar `house-log-front/DESIGN.md`
- criar `BOUNDARY_MAP.md`
- criar ADRs:
  - produto não é marketplace aberto
  - design system oficial é The Architectural Lens
  - provider network é curada
  - credenciais são segredos auditáveis
  - arquitetura evolui para multi-tenant

### Critério de aceite
- não existe mais naming conflitante
- os documentos oficiais estão coerentes
- há fonte única de verdade para estratégia e arquitetura

### Prioridade
- severidade: alta
- esforço: baixo
- dependência: bloqueia fases 4, 5, 6 e 7

---

## 6. Fase 2 — Hardening de segurança

### Objetivo
Eliminar os riscos mais graves antes de qualquer expansão comercial ou refinamento premium.

### Itens críticos
1. `audit-link` deve validar acesso à propriedade
2. credenciais não podem trafegar e aparecer como texto comum
3. links públicos devem ter escopo mínimo
4. mudança de status por link público deve ser endurecida
5. revisar estratégia de sessão no frontend

### Tarefas backend
- adicionar `assertPropertyAccess` em criação de audit link
- revisar payload de `share.ts`
- remover retorno de `secret` por padrão
- criar endpoint de revelação explícita de segredo
- auditar geração de código temporário
- registrar eventos críticos de share/audit/credentials

### Tarefas frontend
- parar de tratar `secret` como dado de UI comum
- criar `SensitiveField`
- mascarar segredo por padrão
- revisar fluxo de sessão armazenada em `localStorage`

### Critério de aceite
- segredo não é exposto por padrão
- links públicos não retornam dados excessivos
- audit link não pode ser criado sem autorização real
- fluxo de credenciais passa a ser deliberado e auditável

### Prioridade
- severidade: crítica
- esforço: médio
- dependência: bloqueia venda premium e fases 4, 5, 7 e 8

---

## 7. Fase 3 — Authorization Core e Boundary Architecture

### Objetivo
Parar de depender de checagens ad hoc espalhadas e consolidar regras de acesso.

### Boundaries oficiais
- Identity & Session
- Authorization Core
- Tenant / Organization
- Property Operating System
- Service Operations
- Provider Network
- Public Access Boundary
- Audit & Evidence
- Storage Security

### Tarefas backend
- criar módulo central de authorization:
  - `canAccessProperty`
  - `canManageProperty`
  - `canViewServiceOrder`
  - `canMutateServiceOrder`
  - `canAccessCredential`
  - `canCreateShareLink`
  - `canBidOnOpportunity`
  - `canViewProvider`
- revisar rotas que hoje fazem checagem manual
- alinhar regra de `admin`
- corrigir `search` para refletir colaboradores e política oficial

### Tarefas de modelagem
- decidir formalmente:
  - se `manager` vira role global
  - ou se continua como collaborator role contextual

### Critério de aceite
- autorização centralizada
- rotas sensíveis usando helpers formais
- comportamento de roles definido oficialmente
- boundary map documentado e seguido

### Prioridade
- severidade: crítica
- esforço: médio
- dependência: bloqueia fases 4, 6 e 7

---

## 8. Fase 4 — Linguagem de produto e Provider Network privada

### Objetivo
Remover a sensação de marketplace e reforçar a tese de rede homologada e operação privada.

### Problema atual
Provider portal ainda comunica:
- oportunidades abertas
- cotação quase ampla por categoria
- lógica próxima de um marketplace interno

### Direção correta
O provider deve operar como parte de uma:
- rede homologada
- rede elegível
- rede vinculada
- rede privada por tenant/organização/propriedade

### Tarefas backend
- introduzir status de homologação do provider
- introduzir elegibilidade por contexto
- limitar `provider/opportunities`
- refatorar semântica de `marketplace`
- preparar `provider-network`

### Tarefas frontend
- trocar copy de “oportunidades abertas” por linguagem privada
- trocar linguagem de “marketplace” por rede homologada
- revisar provider dashboard, opportunities e detail
- criar componentes:
  - `ProviderTrustCard`
  - `ProviderEligibilityState`
  - `ProviderInviteState`

### Critério de aceite
- provider portal não parece marketplace aberto
- providers só veem fluxo elegível
- narrativa de confiança e rede curada está clara

### Prioridade
- severidade: alta
- esforço: médio
- dependência: bloqueia posicionamento comercial premium

---

## 9. Fase 5 — Shell e Design System do frontend

### Objetivo
Consolidar uma experiência premium real no frontend, com shell único e componentes estruturais consistentes.

### Problemas atuais
- layout owner e provider com diferenças de shell
- design system ainda híbrido
- uso de aliases legados `--hl-*`
- páginas montando estrutura própria
- faltam componentes estruturais de produto

### Estrutura-alvo
Criar:
- `components/layout/app-shell.tsx`
- `components/layout/role-shell.tsx`
- `components/layout/page-shell.tsx`
- `components/layout/page-header.tsx`
- `components/layout/page-section.tsx`
- `components/ui/surface.tsx`
- `components/ui/metric-card.tsx`
- `components/ui/action-tile.tsx`
- `components/ui/empty-state.tsx`
- `components/ui/status-card.tsx`
- `components/ui/sensitive-field.tsx`
- `components/ui/mobile-dock.tsx`

### Tarefas
- criar `AppShell` único com variantes por papel
- padronizar `safe-top` e `safe-bottom`
- eliminar novos usos de `--hl-*`
- migrar provider layout para semântica oficial
- refatorar owner dashboard e provider dashboard como referência
- consolidar `PageHeader`, `MetricCard`, `EmptyState`

### Critério de aceite
- shell unificado
- layout mais consistente entre papéis
- cards e seções com linguagem visual coerente
- provider experience alinhada à tese premium fechada

### Prioridade
- severidade: alta
- esforço: médio
- dependência: desbloqueia refinamento premium e material comercial

---

## 10. Fase 6 — Modularização técnica e governança

### Objetivo
Melhorar manutenibilidade, estabilidade de contratos e qualidade de evolução do código.

### Frontend
Separar `src/lib/api.ts` por domínio:
- `src/lib/api/auth.ts`
- `src/lib/api/properties.ts`
- `src/lib/api/services.ts`
- `src/lib/api/provider.ts`
- `src/lib/api/provider-network.ts`
- `src/lib/api/documents.ts`
- `src/lib/api/credentials.ts`
- `src/lib/api/share.ts`

Manter `src/lib/api.ts` como facade temporário.

### Backend
- extrair jobs do `index.ts`
- melhorar padronização de contratos DTO
- consolidar tipos de resposta
- revisar auditoria como serviço central

### Governança
- expandir `audit_log`
- adicionar contexto:
  - `propertyId`
  - `serviceOrderId`
  - `severity`
  - `requestId`
  - `tenantId` quando existir
- padronizar actions auditáveis

### Critério de aceite
- API client modular
- backend menos acoplado
- auditoria mais útil e consultável
- base mais preparada para crescimento

### Prioridade
- severidade: média-alta
- esforço: médio
- dependência: importante para fase 7

---

## 11. Fase 7 — Multi-tenant e Organizações

### Objetivo
Transformar o HouseLog em plataforma escalável para construtoras, carteiras e operações premium reais.

### Problema atual
O sistema é forte em `property/user/collaborator`, mas fraco em `tenant/organization`.

### Arquitetura-alvo
Adicionar:
- `organizations`
- `organizationMembers`
- `portfolios` opcionalmente
- vínculo de propriedades a organização/carteira
- provider network por tenant/organization
- herança de permissão contextual

### Etapas
1. introduzir entidades de organização
2. permitir propriedades individuais e organizacionais coexistirem
3. adaptar permissões
4. adaptar provider approval
5. adaptar dashboards e relatórios
6. preparar isolamento futuro mais forte

### Critério de aceite
- organização existe como contexto real
- propriedade pode pertencer a usuário ou organização
- provider network pode ser privada por organização
- sistema evolui sem quebrar base existente

### Prioridade
- severidade: alta
- esforço: alto
- dependência: base de escala real

---

## 12. Fase 8 — Preparação premium/comercial

### Objetivo
Fechar o ciclo entre produto, UX, segurança e venda.

### Tarefas
- consolidar property detail como “prontuário técnico do imóvel”
- revisar dashboards por ICP
- criar narrativas comerciais por segmento:
  - construtora premium
  - administradora premium
  - portfolio privado
- revisar onboarding premium
- preparar deck e site institucional
- preparar checklist de go-live premium

### Go-Live Premium Checklist
Antes de vender como premium privado:
- credenciais não expostas em claro
- public links com escopo mínimo
- auditoria mínima funcional
- provider network curada
- shell premium coerente
- tenancy mínima definida
- contrato de valor claro
- onboarding viável
- narrativa comercial consistente

### Critério de aceite
- produto parece premium privado
- fluxo crítico está protegido
- narrativa comercial está alinhada ao sistema real

### Prioridade
- severidade: alta
- esforço: médio
- dependência: depende das fases 2, 3, 4 e 5

---

## 13. Ordem recomendada de execução

### Ordem oficial
1. Fase 1 — Alinhamento e documentação
2. Fase 2 — Hardening de segurança
3. Fase 3 — Authorization Core e boundaries
4. Fase 4 — Provider network privada
5. Fase 5 — Shell e design system
6. Fase 6 — Modularização técnica e governança
7. Fase 7 — Multi-tenant e organizações
8. Fase 8 — Preparação premium/comercial

---

## 14. Backlog priorizado por item

### P0 — Crítico
- corrigir criação de audit link sem `assertPropertyAccess`
- parar de expor `secret`
- reduzir payload de share link
- revisar status update por link público
- revisar sessão em `localStorage`
- unificar design system naming

### P1 — Alto
- authorization core
- provider elegível/homologado
- shell único
- `SensitiveField`
- audit log expandido
- modularização do API client

### P2 — Médio
- refatoração de cards e seções
- provider language overhaul
- property detail como prontuário
- jobs fora de `index.ts`
- URLs assinadas para documentos

### P3 — Estrutural
- organizações
- portfolios
- provider network por tenant
- governança premium expandida

---

## 15. Dependências críticas

### Dependência A
Sem Fase 2, não há venda premium segura.

### Dependência B
Sem Fase 3, provider network e multi-tenant ficam frágeis.

### Dependência C
Sem Fase 4, a narrativa do produto continua ambígua.

### Dependência D
Sem Fase 5, a percepção premium do produto continua inconsistente.

### Dependência E
Sem Fase 7, o produto cresce com teto estrutural.

---

## 16. Regras de implementação por fase

Toda fase deve:
1. começar por diagnóstico do estado atual;
2. ser quebrada em subetapas pequenas;
3. ter checklist manual;
4. ter risco explicitado;
5. preservar compatibilidade sempre que possível.

Nunca:
- tentar executar uma macro-fase inteira em um único prompt;
- misturar redesign visual com mudança de contrato sensível;
- fazer multi-tenant e refatoração de UI ao mesmo tempo;
- quebrar fluxos externos silenciosamente.

---

## 17. Template de subetapa

Cada subetapa deve ser organizada assim:

### Nome
### Objetivo
### Arquivos-alvo
### Riscos
### Dependências
### Critério de aceite
### Prompt do Codex
### Validação manual

---

## 18. Primeiras 5 subetapas recomendadas

### Subetapa 1
Atualizar `house-log-front/AGENTS.md` para remover “Echelon Slate”.

### Subetapa 2
Corrigir criação de audit link com `assertPropertyAccess`.

### Subetapa 3
Parar de retornar `secret` por padrão no backend.

### Subetapa 4
Criar `SensitiveField` no frontend.

### Subetapa 5
Criar `AppShell` unificado inicial.

---

## 19. Critério de sucesso do roadmap

O roadmap está sendo seguido corretamente se, ao final:

- o produto está claramente posicionado como premium privado;
- a rede de providers é curada e não aberta;
- dados sensíveis são tratados como sensíveis;
- o shell do frontend é coerente e premium;
- o backend possui autorização mais centralizada;
- o sistema está pronto para crescer com tenancy e governança;
- a base fica vendável com menos risco.

---

## 20. Próximo passo imediato

Executar agora:
1. Subetapa 1 — AGENTS naming cleanup
2. Subetapa 2 — audit-link authorization fix
3. Subetapa 3 — credentials hardening plan