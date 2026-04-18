# Documentacao Completa do Projeto HouseLog

## 1. Visao geral do produto

HouseLog e uma plataforma de gestao de imoveis com foco em operacao, manutencao, documentacao, financeiro e colaboracao entre proprietario, gestor e prestador.

Objetivos principais:
- Centralizar dados tecnicos e operacionais do imovel.
- Organizar ordens de servico (OS), manutencao preventiva e historico.
- Controlar inventario e documentos com anexos de midia.
- Dar visibilidade financeira por periodo e categoria.
- Viabilizar colaboracao com convites e permissoes.

Perfis de usuario no sistema:
- admin
- owner
- provider
- temp_provider (usado em acessos temporarios e fluxos especiais)

---

## 2. Arquitetura geral

### Backend
- Runtime: Cloudflare Workers
- Framework HTTP: Hono
- Banco: Cloudflare D1 (SQLite)
- Storage de arquivos: Cloudflare R2
- Rate limit: Cloudflare KV
- Filas: Cloudflare Queues
- IA: Cloudflare Workers AI (OCR de cartao no fluxo de convite)
- Email: Resend API

Arquivos-chave:
- house-log-back/apps/api/src/index.ts
- house-log-back/apps/api/src/middleware/auth.ts
- house-log-back/apps/api/src/lib/types.ts
- house-log-back/apps/api/wrangler.toml

### Frontend
- Framework: Next.js App Router
- UI: React + Tailwind + componentes UI internos
- Formularios: React Hook Form + Zod
- Dados: SWR
- Notificacoes visuais: Sonner
- PWA: manifest + service worker + tela offline

Arquivos-chave:
- house-log-front/src/app/layout.tsx
- house-log-front/src/lib/api.ts
- house-log-front/src/lib/auth-context.tsx

---

## 3. Estrutura do workspace

## 3.1 Pastas principais
- house-log-back
- house-log-front

## 3.2 Backend (resumo)
- apps/api/src/index.ts: bootstrap da API
- apps/api/src/routes: modulos de rotas
- apps/api/src/middleware: auth e rate limit
- apps/api/src/lib: utilitarios (jwt, r2, email, response, audit)
- apps/api/src/db/migrations: schema SQL versionado
- apps/api/src/db/schema.ts: schema Drizzle para fluxo service_requests/bids

## 3.3 Frontend (resumo)
- src/app/(auth): login e cadastro
- src/app/(app): area autenticada principal
- src/app/provider: portal do prestador
- src/app/audit/[token]: acesso publico via token
- src/app/invite/[token]: aceite de convite
- src/components: componentes de layout e UI
- src/lib: cliente API, auth-context, utilitarios

---

## 4. Rotas do backend e o que cada uma faz

Base URL da API: /api/v1

## 4.1 Saude e raiz

### GET /
- Retorna status basico do servico.

### GET /health
- Health check com timestamp.

Arquivo:
- house-log-back/apps/api/src/index.ts

## 4.2 Autenticacao

Arquivo:
- house-log-back/apps/api/src/routes/auth.ts

### POST /auth/register
- Cria usuario novo.
- Gera JWT e retorna user.

### POST /auth/login
- Autentica por email e senha.
- Atualiza last_login.
- Faz migracao transparente de hash legado para PBKDF2.

### POST /auth/refresh
- Renova token JWT (com pequena tolerancia para expiracao recente).

### GET /auth/me
- Retorna dados do usuario autenticado.

### PUT /auth/password
- Troca senha do usuario autenticado.

### PUT /auth/profile
- Atualiza nome e telefone.

## 4.3 Propriedades

Arquivo:
- house-log-back/apps/api/src/routes/properties.ts

### GET /properties
- Lista propriedades com paginacao e busca.
- Regras de acesso por owner, manager_id ou colaborador.

### POST /properties
- Cria propriedade (admin/owner).

### GET /properties/:id
- Busca detalhe da propriedade.

### PUT /properties/:id
- Atualiza dados da propriedade.

### DELETE /properties/:id
- Soft delete da propriedade.

### POST /properties/:id/cover
- Upload da capa do imovel para R2.

### GET /properties/:id/dashboard
- Consolida metricas do imovel para tela principal.

### GET /properties/:id/providers
- Lista colaboradores com role provider para atribuicao de OS.
- Retorna dados de perfil como specialties e whatsapp.

### POST /properties/:id/apply-template
- Aplica template operacional no imovel (criacao inicial de estruturas padrao).

## 4.4 Comodos

Arquivo:
- house-log-back/apps/api/src/routes/rooms.ts

Rotas:
- GET /properties/:propertyId/rooms
- POST /properties/:propertyId/rooms
- GET /properties/:propertyId/rooms/:id
- PUT /properties/:propertyId/rooms/:id
- DELETE /properties/:propertyId/rooms/:id

## 4.5 Inventario

Arquivo:
- house-log-back/apps/api/src/routes/inventory.ts

Rotas:
- GET /properties/:propertyId/inventory
- GET /properties/:propertyId/inventory/colors
- POST /properties/:propertyId/inventory
- GET /properties/:propertyId/inventory/:id
- PUT /properties/:propertyId/inventory/:id
- DELETE /properties/:propertyId/inventory/:id
- POST /properties/:propertyId/inventory/:itemId/photo
- POST /properties/:propertyId/inventory/:itemId/qr

## 4.6 Ordens de servico (OS)

Arquivo:
- house-log-back/apps/api/src/routes/services.ts

Rotas:
- GET /properties/:propertyId/services
- POST /properties/:propertyId/services
- GET /properties/:propertyId/services/:id
- PUT /properties/:propertyId/services/:id
- PATCH /properties/:propertyId/services/:id/status
- POST /properties/:propertyId/services/:id/photos
- POST /properties/:propertyId/services/:id/video
- POST /properties/:propertyId/services/:id/audio
- PATCH /properties/:propertyId/services/:id/checklist
- DELETE /properties/:propertyId/services/:id

Observacoes:
- Suporta anexos before/after, video e audio.
- Tem regras de permissao para abertura de OS por colaborador.

## 4.7 Orcamentos de OS (modelo legado de bids)

Arquivo:
- house-log-back/apps/api/src/routes/bids.ts

Rotas:
- GET /properties/:propertyId/services/:serviceId/bids
- POST /properties/:propertyId/services/:serviceId/bids
- PATCH /properties/:propertyId/services/:serviceId/bids/:bidId/status

## 4.8 Service Requests (fluxo novo com Drizzle)

Arquivo:
- house-log-back/apps/api/src/routes/service-requests.ts

Rota:
- POST /properties/:propertyId/service-requests

Funcao:
- Cria solicitacao com media e gera presigned URLs para upload em R2.

Arquivo:
- house-log-back/apps/api/src/routes/service-request-bids.ts

Rota:
- PATCH /properties/:propertyId/service-requests/:serviceRequestId/bids/:bidId/accept

Funcao:
- Aceita uma proposta e rejeita as demais.

## 4.9 Documentos

Arquivo:
- house-log-back/apps/api/src/routes/documents.ts

Rotas:
- GET /properties/:propertyId/documents
- POST /properties/:propertyId/documents
- GET /properties/:propertyId/documents/:id
- DELETE /properties/:propertyId/documents/:id
- POST /properties/:propertyId/documents/:id/ocr

## 4.10 Financeiro

Arquivo:
- house-log-back/apps/api/src/routes/expenses.ts

Rotas:
- GET /properties/:propertyId/expenses
- GET /properties/:propertyId/expenses/summary
- POST /properties/:propertyId/expenses
- PUT /properties/:propertyId/expenses/:id
- DELETE /properties/:propertyId/expenses/:id

Observacoes:
- Suporta type expense/revenue.
- Suporta recorrencia anual automatica (12 lancamentos).

## 4.11 Manutencao

Arquivo:
- house-log-back/apps/api/src/routes/maintenance.ts

Rotas:
- GET /properties/:propertyId/maintenance
- POST /properties/:propertyId/maintenance
- PUT /properties/:propertyId/maintenance/:id
- POST /properties/:propertyId/maintenance/:id/done
- DELETE /properties/:propertyId/maintenance/:id
- POST /properties/:propertyId/maintenance/auto-check

Observacoes:
- Existe rotina agendada para criar OS de manutencao vencida e envio de email.

## 4.12 Relatorios

Arquivo:
- house-log-back/apps/api/src/routes/reports.ts

Rotas:
- GET /properties/:propertyId/report/health-score
- GET /properties/:propertyId/report/valuation-pdf

Funcao:
- Calcula health score com breakdown.
- Retorna payload consolidado para laudo/relatorio.

## 4.13 Convites e equipe

Arquivo:
- house-log-back/apps/api/src/routes/invites.ts

Rotas:
- POST /properties/:propertyId/invites
- POST /properties/:propertyId/invites/extract-card
- GET /properties/:propertyId/invites
- DELETE /properties/:propertyId/invites/:inviteId
- GET /invite/:token
- POST /invite/:token/accept
- PATCH /properties/:propertyId/collaborators/:collabId
- DELETE /properties/:propertyId/collaborators/:collabId

Destaques:
- Convite por email ou WhatsApp com pre-cadastro.
- OCR de cartao para sugerir nome/email/telefone/especialidades.
- Controle granular can_open_os.

## 4.14 Portal do prestador

Arquivo:
- house-log-back/apps/api/src/routes/provider.ts

Rotas:
- GET /provider/services
- GET /provider/services/:id
- GET /provider/stats
- POST /provider/services/:id/invoice

Observacao importante:
- O acesso foi ampliado para quem nao tem role global provider, mas e colaborador provider em algum imovel.

## 4.15 Busca global

Arquivo:
- house-log-back/apps/api/src/routes/search.ts

Rota:
- GET /search

Funcao:
- Busca em OS, documentos, inventario e manutencao.

## 4.16 Links de auditoria (acesso publico controlado)

Arquivo:
- house-log-back/apps/api/src/routes/audit-links.ts

Rotas protegidas:
- POST /properties/:propertyId/services/:serviceId/audit-link

Rotas publicas:
- GET /audit/public/:token
- POST /audit/public/:token/submit

Funcao:
- Compartilhar acesso temporario para evidencias sem login.

---

## 5. Modelo de dados (migrations)

Migrations existentes:
- 0001_initial.sql
- 0002_maintenance_fields.sql
- 0003_provider_features.sql
- 0004_invites.sql
- 0005_financial_warranty.sql
- 0006_team_permissions.sql
- 0007_provider_profiles_and_audio.sql
- 0008_invite_name.sql

Tabelas principais:
- users
- properties
- rooms
- inventory_items
- service_orders
- service_bids
- documents
- expenses
- maintenance_schedules
- property_collaborators
- property_invites
- audit_links
- audit_log

Campos adicionados nas migracoes recentes:
- users.notification_prefs
- expenses.type, expenses.is_recurring, expenses.recurrence_group
- inventory_items.warranty_until
- property_collaborators.can_open_os
- property_invites.specialties, property_invites.whatsapp, property_invites.invite_name
- property_collaborators.specialties, property_collaborators.whatsapp
- service_orders.audio_url

---

## 6. Estrutura e fluxos do frontend

Pasta base de paginas:
- house-log-front/src/app

## 6.1 Rotas de autenticacao
- /(auth)/login
- /(auth)/register

Funcionalidades:
- Login com email/senha.
- Cadastro de conta.
- Fluxo especial por convite:
  - pre-preenchimento via query params
  - aceite automatico do convite apos cadastro
  - redirecionamento contextual

## 6.2 Rotas principais autenticadas
- /(app)/dashboard
- /(app)/settings
- /(app)/properties
- /(app)/properties/new
- /(app)/properties/[id]
- /(app)/properties/[id]/edit
- /(app)/properties/[id]/rooms
- /(app)/properties/[id]/inventory
- /(app)/properties/[id]/inventory/[itemId]/qr
- /(app)/properties/[id]/services
- /(app)/properties/[id]/services/new
- /(app)/properties/[id]/services/[serviceId]
- /(app)/properties/[id]/maintenance
- /(app)/properties/[id]/documents
- /(app)/properties/[id]/financial
- /(app)/properties/[id]/report
- /(app)/properties/[id]/team
- /(app)/properties/[id]/timeline

## 6.3 Portal do prestador
- /provider/dashboard
- /provider/services
- /provider/services/[serviceId]

## 6.4 Rotas publicas especiais
- /invite/[token]
- /audit/[token]
- /offline

## 6.5 Cliente API e modulos

Arquivo:
- house-log-front/src/lib/api.ts

Modulos principais:
- authApi
- propertiesApi
- invitesApi
- roomsApi
- inventoryApi
- servicesApi
- documentsApi
- expensesApi
- maintenanceApi
- reportsApi
- bidsApi
- providerApi
- auditApi
- searchApi

---

## 7. Funcionalidades implementadas (estado atual)

### 7.1 Operacao do imovel
- Cadastro e edicao de imoveis.
- Cadastro e gestao de comodos.
- Aplicacao de template inicial.

### 7.2 OS e manutencao
- Abertura e acompanhamento de OS.
- Checklist e upload de evidencias.
- Controle de status da OS.
- Agendamento e monitoramento de manutencao preventiva.
- Auto criacao de OS por manutencao vencida (rotina agendada).

### 7.3 Inventario e documentos
- Inventario com foto, QR e garantias.
- Upload de documentos e OCR basico para invoices.

### 7.4 Financeiro e relatorios
- Lancamentos de despesas e receitas.
- Resumos por periodo/categoria.
- Recorrencia de lancamentos.
- Health score com breakdown.
- Payload para relatorio de avaliacao.

### 7.5 Colaboracao
- Convites para equipe por role.
- Controle de permissao can_open_os.
- Convite por email e por WhatsApp com pre-cadastro.
- Extração automatica por imagem de cartao de visita.

### 7.6 Prestadores
- Portal de prestador com lista de OS e stats.
- Upload de nota fiscal pelo prestador.
- Fluxo de aceite de convite com onboarding simplificado.

### 7.7 PWA e UX
- Estrutura de PWA com rota offline.
- Caching de dados via SWR.

---

## 8. O que ainda falta implementar / gaps

## 8.1 Gap critico de banco para fluxo Drizzle

Arquivos:
- house-log-back/apps/api/src/db/schema.ts
- house-log-back/apps/api/src/routes/service-requests.ts
- house-log-back/apps/api/src/routes/service-request-bids.ts

Problema identificado:
- O schema Drizzle usa tabelas service_requests, bids e provider_endorsements.
- Essas tabelas nao aparecem nas migrations SQL atuais 0001-0008.

Impacto:
- Rotas de service-requests podem falhar em ambiente sem tabelas criadas manualmente.

Acao recomendada:
- Criar migration dedicada (ex.: 0009_service_requests_and_bids.sql) para alinhar com schema.ts.

## 8.2 Melhorias de seguranca e autenticacao
- Login por OTP em WhatsApp/SMS nao existe ainda.
- MFA/2FA nao implementado.
- Melhorar politicas de recuperacao de conta.

## 8.3 Observabilidade e operacao
- Falta centralizar logs e tracing (Sentry/OpenTelemetry).
- Falta painel de monitoramento de jobs de fila.

## 8.4 Midia e processamento
- Existe TODO em house-log-back/apps/api/src/index.ts para resize real de imagens na queue.

## 8.5 Produto e experiencia
- Melhorar onboarding de prestador no primeiro acesso com wizard dedicado.
- Notificacoes push in-app/WA ainda nao implementadas.
- Melhorar trilha de auditoria visual no frontend para todos os eventos.

---

## 9. Melhorias recomendadas (priorizadas)

## 9.1 Prioridade alta (P0/P1)
1. Criar migration para service_requests, bids e provider_endorsements.
2. Implementar OTP por WhatsApp/SMS para login rapido do prestador.
3. Finalizar resize de imagens na queue.
4. Garantir testes de regressao para fluxos de convite e aceite.

## 9.2 Prioridade media
1. Adicionar painel de observabilidade e alertas.
2. Melhorar estrategia de cache para dashboards pesados.
3. Expandir OCR com fallback e validacao semantica.

## 9.3 Prioridade baixa
1. Dashboard administrativo com KPIs globais.
2. Avaliacao de prestadores (rating/SLAs).
3. Integracoes externas (calendar, mensageria, pagamentos).

---

## 10. Como executar e operar

## 10.1 Backend
Scripts:
- npm run dev
- npm run build
- npm run deploy
- npm run deploy:dev
- npm run db:migrate
- npm run db:migrate:dev
- npm run db:migrate:local
- npm run type-check

Arquivo:
- house-log-back/apps/api/package.json

## 10.2 Frontend
Scripts:
- npm run dev
- npm run build
- npm run start
- npm run lint

Arquivo:
- house-log-front/package.json

## 10.3 Infra Cloudflare
Arquivo:
- house-log-back/apps/api/wrangler.toml

Recursos configurados:
- D1 (DB)
- R2 (STORAGE)
- KV
- Queue
- AI binding
- Crons (0 * * * * e 0 6 * * *)

---

## 11. Analise tecnica especializada (resumo executivo)

Pontos fortes:
- Arquitetura moderna e escalavel em edge.
- Boa separacao por modulos no backend e frontend.
- Cobertura funcional ampla para operacao imobiliaria.
- Evolucao rapida do fluxo de convite e prestador.

Riscos reais atuais:
- Divergencia entre schema Drizzle e migrations SQL.
- Dependencia de ambientes/segredos bem configurados para R2 presign e email.
- Falta de OTP e observabilidade avancada para producao de alta escala.

Nivel de maturidade atual:
- Produto funcional com boa base para producao controlada.
- Recomendado fechar os gaps P0/P1 antes de escalar onboarding de prestadores em massa.

---

## 12. Checklist de revisao (2x)

Revisao 1 (consistencia de escopo):
- Validada estrutura de pastas backend/frontend.
- Validado catalogo de rotas pelos arquivos de routes e index.
- Validado conjunto de migrations existente.

Revisao 2 (consistencia tecnica):
- Conferidas rotas publicas/protegidas e base path final.
- Conferida existencia de onboarding por convite no frontend.
- Conferido gap de tabelas Drizzle nao migradas no SQL.

Status:
- Documento pronto para uso como base de arquitetura, onboarding tecnico e planejamento de roadmap.
