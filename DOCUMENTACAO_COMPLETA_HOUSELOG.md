# HouseLog - Documentacao Completa, Atualizada e Pronta para Google Stitch

Data da atualizacao: 18/04/2026
Escopo: produto, arquitetura, backend, frontend, dados, infraestrutura, melhorias recentes, padroes de UI e pacote de instrucoes para criar design contemporaneo no Google Stitch.

---

## 1. Resumo executivo

HouseLog e uma plataforma de gestao operacional de imoveis para owner, gestor e prestador, com foco em:
- operacao de OS e manutencao preventiva;
- historico tecnico do imovel;
- inventario e documentos com anexos;
- visao financeira e automacoes;
- colaboracao segura entre papeis.

Estado atual:
- backend funcional em Cloudflare Workers com Hono + D1 + Drizzle;
- frontend funcional em Next.js App Router + Tailwind;
- portal do prestador ampliado com oportunidades de orcamento, chat integrado e perfil profissional estruturado;
- design system com tokens e melhoria forte em campos/input para claro/escuro e mobile.

---

## 2. Novidades importantes implementadas

### 2.1 Portal do prestador ampliado
- Lista de oportunidades de orcamento para OS em aberto.
- Detalhe da oportunidade com historico de bids do proprio prestador.
- Navegacao dedicada no portal do prestador:
  - Dashboard
  - Orcamentos
  - Minhas OS
  - Configuracoes

### 2.2 Chat integrado owner/provider em OS
- Chat por OS em endpoint dedicado.
- Regra de acesso ampliada para prestador com bid ativa (pending/accepted) mesmo antes de atribuicao final.
- Envio de push para participantes relevantes ao publicar nova mensagem.

### 2.3 Perfil profissional estruturado do prestador
- Cadastro e atualizacao de:
  - hard skills por categorias;
  - apresentacao profissional (bio);
  - cursos e especializacoes;
  - formacao estruturada (instituicao, titulo, tipo, status cursando/concluido, comprovante);
  - portfolio de casos com antes/depois (titulo, descricao, imagens).
- Exposicao no perfil publico do marketplace para apoio a decisao do owner/gestor.

### 2.4 Design system e usabilidade
- Tokens semanticos para formularios (campo, borda, hover, texto, foco).
- Harmonia clara/escura melhorada.
- Inputs, textareas e selects com area de toque melhor em mobile.
- Layout responsivo da pagina de configuracoes do prestador refinado.

---

## 3. Perfis de usuario e responsabilidades

- admin:
  - visao ampla e operacoes administrativas;
  - suporte a moderacao e governanca.

- owner:
  - dono do imovel;
  - cria OS, avalia prestador, gerencia equipe e custos.

- provider:
  - executa servicos;
  - recebe atribuicoes, participa de orcamentos, atualiza perfil profissional.

- temp_provider:
  - perfil temporario com escopo restrito conforme regra de negocio.

---

## 4. Arquitetura geral

### 4.1 Backend
- Runtime: Cloudflare Workers
- Framework HTTP: Hono
- Banco: Cloudflare D1 (SQLite)
- ORM: Drizzle
- Storage: Cloudflare R2
- Cache/controle: KV
- Filas: Cloudflare Queues
- IA: Cloudflare Workers AI
- Email: Resend

### 4.2 Frontend
- Next.js (App Router)
- React + Tailwind
- SWR para dados
- RHF + Zod para formularios
- Sonner para notificacao
- PWA com manifest, service worker e pagina offline

---

## 5. Estrutura do workspace

Pastas principais:
- house-log-back
- house-log-front

Backend (foco):
- apps/api/src/index.ts
- apps/api/src/routes/*
- apps/api/src/middleware/*
- apps/api/src/db/schema.ts
- apps/api/src/db/migrations/*

Frontend (foco):
- src/app/*
- src/components/*
- src/lib/api.ts
- src/lib/auth-context.tsx
- src/app/globals.css

---

## 6. Backend - rotas montadas na API

Base: /api/v1

Montagem atual:
- /auth
- /push
- /ai
- /marketplace
- /services (mensageria)
- /properties
- /properties/:propertyId/rooms
- /properties/:propertyId/inventory
- /properties/:propertyId/services
- /properties/:propertyId/service-requests
- /properties/:propertyId/service-requests/:serviceRequestId/bids
- /properties/:propertyId/expenses
- /properties/:propertyId/documents
- /properties/:propertyId/maintenance
- /properties/:propertyId/finance
- /properties/:propertyId/timeline
- /properties/:propertyId/report
- /properties/:propertyId/services/:serviceId/bids
- /provider
- /properties/:propertyId/services/:serviceId/audit-link
- / (invites)
- /audit
- /search
- /properties/:propertyId/credentials
- /api/v1 + share

---

## 7. Backend - catalogo funcional atualizado

### 7.1 Auth e seguranca
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me
- PUT /auth/password
- PUT /auth/profile

MFA:
- POST /auth/mfa/challenge
- POST /auth/mfa/setup
- POST /auth/mfa/verify
- POST /auth/mfa/disable

### 7.2 OS e bids
- GET/POST/PUT/PATCH/DELETE de OS
- upload de fotos/video/audio
- checklist de OS
- bids por OS
- service requests + aceite de bid

### 7.3 Mensagens de OS
- GET /services/:serviceOrderId/messages
- POST /services/:serviceOrderId/messages
- DELETE /services/:serviceOrderId/messages/:id

Comportamento relevante:
- mensagens internas ocultas para provider quando aplicavel;
- provider com bid ativa pode acessar chat na fase de orcamento;
- push notification para participantes.

### 7.4 Provider portal
- GET /provider/services
- GET /provider/services/:id
- GET /provider/stats
- POST /provider/services/:id/invoice
- GET /provider/opportunities
- GET /provider/opportunities/:id

### 7.5 Marketplace
- POST /marketplace/ratings
- GET /marketplace/providers/:providerId/ratings
- GET /marketplace/providers/:providerId/profile
- POST /marketplace/providers/endorse
- GET /marketplace/providers/match
- POST /marketplace/availability
- GET /marketplace/availability
- GET /marketplace/availability/ical

---

## 8. Modelo de dados e migrations

### 8.1 Tabelas principais (recorte)
- users
- properties
- rooms
- inventoryItems
- serviceOrders
- serviceBids
- serviceMessages
- serviceRequests
- bids
- providerRatings
- providerEndorsements
- providerAvailability
- propertyCollaborators
- propertyInvites
- documents
- expenses
- maintenanceSchedules
- auditLinks
- refreshTokens
- userMfa
- mfaChallenges
- pushSubscriptions
- pixCharges
- aiCache
- nfeImports

### 8.2 Campos novos/relevantes em users (prestador)
- providerCategories
- whatsapp
- serviceArea
- pixKey
- pixKeyType
- providerBio
- providerCourses (json array)
- providerSpecializations (json array)
- providerPortfolio (json array)
- providerEducation (json estruturado)
- providerPortfolioCases (json estruturado)

### 8.3 Migrations SQL existentes
- 0001_initial.sql
- 0002_maintenance_fields.sql
- 0003_provider_features.sql
- 0004_invites.sql
- 0005_financial_warranty.sql
- 0006_team_permissions.sql
- 0007_provider_profiles_and_audio.sql
- 0007_share_credentials.sql
- 0008_invite_name.sql
- 0009_service_requests_auth_push.sql
- 0010_wave2_features.sql
- 0011_provider_categories.sql
- 0012_provider_profile_fields.sql
- 0013_provider_profile_structured.sql

Observacao:
- para novos ambientes, aplicar migrations em sequencia e validar colunas de perfil estruturado no users.

---

## 9. Frontend - rotas principais

### 9.1 App autenticado
- /(app)/dashboard
- /(app)/settings
- /(app)/properties
- /(app)/properties/new
- /(app)/properties/[id] e subrotas (access, documents, financial, inventory, maintenance, report, rooms, services, team, timeline etc)

### 9.2 Portal do prestador
- /provider/dashboard
- /provider/opportunities
- /provider/opportunities/[serviceId]
- /provider/services
- /provider/services/[serviceId]
- /provider/settings

### 9.3 Rotas publicas
- /invite/[token]
- /audit/[token]
- /share/service/[token]
- /offline

---

## 10. Frontend - cliente de API e contratos

Modulos de API exportados:
- authApi
- pushApi
- propertiesApi
- invitesApi
- roomsApi
- inventoryApi
- servicesApi
- documentsApi
- auditApi
- maintenanceApi
- reportsApi
- expensesApi
- searchApi
- bidsApi
- credentialsApi
- shareApi
- providerApi
- marketplaceApi
- messagesApi

Contratos relevantes de prestador:
- User inclui provider_education e provider_portfolio_cases.
- ProviderPublicProfile inclui provider, score e reviews anonimizadas.

---

## 11. Design System oficial: The Architectural Lens

Visao criativa oficial:
- transformar a experiencia de SaaS imobiliario em uma navegacao com linguagem de arquitetura premium;
- evitar layout de dashboard "engessado" e visual "caixotado";
- priorizar assimetria intencional, profundidade tonal, superficies de vidro e tipografia editorial;
- cada bloco deve parecer espacial, com camadas, nunca plano.

### 11.1 Creative North Star
- referencia conceitual: estrutura, transparencia e interacao de luz;
- experiencia alvo: "architectural walkthrough", nao "painel burocratico";
- principio: menos ruido visual, mais hierarquia, mais respiracao entre blocos.

### 11.2 Cores e profundidade atmosferica

Paleta principal:
- Finance (Primary): #b8c3ff
- Health (Secondary): #4edea3
- Maintenance (Tertiary): #ffb95f
- Base noturna: #0b1326
- Neutros de camada: #060e20 ate #31394d

Regra obrigatoria: No-Line Rule
- proibido usar borda solida de 1px como divisor de secao por padrao;
- separacao por mudanca tonal de superficie;
- outline-variant so em "ghost border" com baixa opacidade quando necessario para acessibilidade.

Hierarquia de superficies:
- base: surface (#0b1326)
- secao secundaria: surface-container-low (#131b2e)
- card interativo: surface-container-high (#222a3d)
- elemento flutuante/ativo: surface-container-highest (#2d3449) + blur (20px+)

### 11.3 Tipografia editorial
- fonte principal: Inter;
- display-lg (3.5rem): numeros hero e metricas de impacto;
- title-md (1.125rem): ancora de leitura (enderecos, titulos de bloco);
- label-sm (0.6875rem + uppercase + tracking): metadata;
- evitar blocos "apertados": espacamento vertical e line-height com respiracao.

### 11.4 Elevacao e camadas
- profundidade por camada tonal, nao por sombra pesada padrao;
- "cloud shadow" para elementos flutuantes: blur amplo (40-60px), opacidade moderada;
- glassmorphism em overlays: surface-variant com opacidade + backdrop blur;
- alertas criticos com glow interno sutil (nao stroke agressivo).

### 11.5 Componentes (DNA do sistema)

Cards e containers:
- raio externo: xl / 1.5rem;
- raio interno: md / 0.75rem;
- sem divisores duros; separar com espaco e tonalidade;
- hover/tap: surface-container-high -> surface-bright + escala leve (~1.02).

Botoes:
- primario: gradiente primary -> primary-container;
- secundario (glass): semitransparente + blur;
- terciario: texto com destaque por sublinhado/estado de foco.

Inputs:
- fill de base em surface-container-lowest;
- foco por "lift": sobe camada e recebe glow discreto;
- sem foco agressivo por borda dura.

Navegacao mobile:
- floating dock no rodape;
- nao encostar nas bordas da viewport;
- borda/blur com linguagem de ilha flutuante.

### 11.6 Do and Don't

Do:
- usar sobreposicao intencional entre imagem e conteudo quando fizer sentido;
- usar secondary/tertiary como sinal de prioridade (nao colorir tudo);
- preservar espaco em branco como elemento de luxo e leitura.

Don't:
- nao usar preto puro absoluto como base;
- nao usar divisores tradicionais como muleta de layout;
- nao usar sombra "default material" pesada;
- nao usar icone sem contexto textual (exceto acao universal).

### 11.7 Textura de assinatura
- aplicar ruido sutil (aprox 2% opacidade) no background base;
- objetivo: reduzir esterilidade digital e aumentar percepcao premium.

### 11.8 Mapeamento para tokens atuais do projeto

Arquivos referencia:
- house-log-front/src/app/globals.css
- house-log-front/src/components/ui/input.tsx
- house-log-front/src/components/ui/textarea.tsx
- house-log-front/src/components/ui/select.tsx
- house-log-front/src/app/provider/layout.tsx
- house-log-front/src/app/provider/settings/provider-settings.module.css

Tokens ja ativos no projeto (utilizar como fonte unica):
- --provider-accent
- --provider-surface
- --provider-surface-strong
- --provider-divider
- --field-bg
- --field-bg-hover
- --field-border
- --field-border-strong
- --field-text
- --field-focus-ring

---

## 12. Melhorias de UX mobile implementadas

- altura de campos ampliada no mobile;
- tipografia de campo otimizada para leitura e toque;
- botoes de acao com comportamento full-width em pontos criticos;
- headers de secao com quebra responsiva;
- grid de metricas do prestador sem compressao excessiva;
- navegacao do portal do prestador refeita com dock mobile + sidebar desktop.

---

## 13. Infraestrutura Cloudflare

Fonte: apps/api/wrangler.toml

Bindings principais:
- D1: houselog-db
- R2: houselog-assets
- KV
- Queue producer: houselog-jobs
- AI binding

Queue consumer:
- max_batch_size: 10
- max_retries: 3

Crons:
- 0 * * * *
- 0 6 * * *

Ambientes:
- prod/default: houselog-api
- dev: houselog-api-dev

---

## 14. Como executar local/dev

### 14.1 Backend
Diretorio: house-log-back/apps/api

Scripts:
- npm run dev
- npm run build
- npm run deploy
- npm run deploy:dev
- npm run db:generate
- npm run db:check
- npm run db:studio
- npm run db:migrate
- npm run db:migrate:dev
- npm run db:migrate:local
- npm run type-check

### 14.2 Frontend
Diretorio: house-log-front

Scripts:
- npm run dev
- npm run build
- npm run start
- npm run lint

---

## 15. Guia completo para Google Stitch (Design System The Architectural Lens)

Objetivo:
- gerar uma experiencia premium e contemporanea;
- manter aderencia total aos fluxos reais do produto;
- respeitar o Design System The Architectural Lens como regra de estilo.

### 15.1 Contexto base para colar no Stitch

"HouseLog e um SaaS de gestao de imoveis para owners, gestores e prestadores. O foco principal e operacao de ordens de servico, manutencao preventiva, financeiro e colaboracao. O modulo mais critico agora e o Portal do Prestador com oportunidades de orcamento, minhas OS, chat por OS, reputacao (avaliacoes/endossos) e perfil profissional estruturado com portfolio antes/depois. O estilo oficial do produto e The Architectural Lens: tonal depth, intentional asymmetry, glass surfaces, editorial typography e navegacao mobile com floating dock."

### 15.2 Regras visuais obrigatorias para o Stitch
- evitar grid rigido e blocos "caixa sobre caixa" sem hierarquia;
- priorizar profundidade tonal em vez de bordas duras;
- usar gradiente e blur com moderacao e intencao;
- manter contraste alto para leitura operacional;
- usar cores de sinal (secondary/tertiary) apenas em pontos de prioridade.

### 15.3 Paleta obrigatoria
- Finance/Primary: #b8c3ff
- Health/Secondary: #4edea3
- Maintenance/Tertiary: #ffb95f
- Base: #0b1326
- Camadas: #060e20 -> #31394d

Mapeamento para tokens de implementacao:
- provider-accent -> --provider-accent
- provider-surface -> --provider-surface
- provider-divider -> --provider-divider
- field-bg -> --field-bg
- field-border -> --field-border
- field-focus-ring -> --field-focus-ring

### 15.4 Estrutura minima de telas para gerar
1. Login
2. Dashboard owner
3. Lista de propriedades
4. Detalhe da propriedade
5. Provider dashboard
6. Provider opportunities (lista + filtros)
7. Provider opportunity detail (resumo + proposta + chat)
8. Provider services detail (execucao + chat + anexos)
9. Provider settings (perfil estruturado completo)
10. Marketplace provider profile publico

### 15.5 Blocos obrigatorios no Provider Settings
- cabecalho editorial de perfil;
- bloco reputacao (media, total, endossos, top score);
- hard skills com selecao visual;
- contato + area + PIX;
- formacao e certificacoes estruturadas;
- portfolio antes/depois com comparacao visual;
- troca de senha.

### 15.6 Restricoes de qualidade
- mobile-first;
- min-height de controles >= 44px no mobile;
- foco visivel em todos os controles;
- contraste minimo WCAG AA;
- estados de loading/empty/error em listas;
- proibido criar fluxo novo que nao exista no backend atual.

---

## 16. Prompt mestre pronto para Google Stitch

Copie e cole este prompt no Stitch:

"Crie um design system e telas para um SaaS chamado HouseLog (gestao de imoveis). Direcao visual oficial: The Architectural Lens. Linguagem: contemporanea premium, tonal depth, intentional asymmetry, glass surfaces e tipografia editorial. Evite dashboard generico e blocos rigidos. Paleta obrigatoria: primary #b8c3ff, secondary #4edea3, tertiary #ffb95f, base #0b1326.

Telas obrigatorias: Provider Dashboard, Provider Opportunities (lista e detalhe), Provider Service Detail com Chat, Provider Settings completo com hard skills selecionaveis, formacao estruturada, portfolio antes/depois, reputacao com metricas e reviews. Tambem incluir telas owner essenciais (dashboard e detalhe de propriedade).

Regras: mobile-first, floating dock na navegacao mobile, inputs >=44px em mobile, foco visivel, contraste AA, estados de loading/empty/error. Regra No-Line: separar secoes por tonalidade e espacamento, nao por borda dura. Componentes em estilo modular reutilizavel (cards, chips, formularios, listas, cabecalhos de secao). Resultado deve ser implementavel em Next.js + Tailwind + Radix/shadcn sem divergir dos fluxos de API existentes." 

---

## 17. Prompt de iteracao para melhorar resultado no Stitch

Se a primeira geracao vier generica, usar:

"Refine com The Architectural Lens: aumente profundidade tonal, reduza bordas duras, use camadas com glass blur e cloud shadows suaves, destaque hard skills selecionadas e melhore antes/depois do portfolio com composicao editorial. Mantenha consistencia de tokens, contraste AA, mobile-first e floating dock." 

---

## 18. Handoff para engenharia (implementacao)

### 18.1 Stack alvo
- Next.js App Router
- Tailwind v4
- class-variance-authority
- Radix UI
- lucide-react

### 18.2 Arquivos referencia para aplicar design
- house-log-front/src/app/globals.css
- house-log-front/src/components/ui/input.tsx
- house-log-front/src/components/ui/textarea.tsx
- house-log-front/src/components/ui/select.tsx
- house-log-front/src/app/provider/settings/page.tsx
- house-log-front/src/app/provider/settings/provider-settings.module.css
- house-log-front/src/components/services/service-chat.tsx

### 18.3 Regras tecnicas
- nao quebrar contratos de API em src/lib/api.ts;
- manter componentes base de formulario como fonte unica de estilo de campo;
- evitar duplicar classes de campo em paginas;
- aplicar regra No-Line em novas telas (usar tonal shift + espacamento);
- usar blur e glow com moderacao para nao degradar performance;
- validar em claro e escuro;
- validar em viewport mobile e desktop.

---

## 19. Checklist de aceite do design

Marcar como pronto apenas se todos forem verdadeiros:
- [ ] claro e escuro com harmonia visual real
- [ ] linguagem visual alinhada ao The Architectural Lens
- [ ] foco de campo visivel e consistente
- [ ] campos confortaveis em mobile
- [ ] reputacao do prestador legivel e priorizada
- [ ] hard skills com estado claro de selecionado
- [ ] portfolio antes/depois com comparacao facil
- [ ] nenhuma divergencia com fluxos e endpoints reais
- [ ] sem regressao visual em desktop

---

## 20. Riscos e atencoes

- risco: design fugir do modelo de dados real (evitar no Stitch com prompt de restricao);
- risco: excesso de efeito visual prejudicar performance mobile;
- risco: inconsistencia entre componentes base e estilos locais;
- risco: exagero de glass/blur reduzir legibilidade em telas densas;
- risco: criar fluxos que exigem endpoints inexistentes.

Mitigacao:
- usar este documento como contrato unico de produto + UI + engenharia;
- revisar sempre junto de src/lib/api.ts e rotas backend.

---

## 21. Proximos passos recomendados

1. Gerar no Google Stitch com o Prompt Mestre.
2. Iterar com Prompt de Refino ate fechar linguagem The Architectural Lens.
3. Exportar design tokens e mapear 1:1 com globals.css.
4. Implementar primeiro no Provider Settings e Provider Opportunities.
5. Rodar validacao visual em mobile real e dark mode.
6. Depois expandir para dashboard owner e detalhes de propriedade.

---

## 22. Registro de validade deste documento

Este documento reflete o estado atual do codigo e melhorias recentes observadas no projeto HouseLog em 18/04/2026, incluindo:
- ampliacao do portal do prestador;
- chat integrado em contexto de bid/OS;
- perfil estruturado e portfolio antes/depois;
- evolucao do design system para claro/escuro e mobile;
- adocao do guia visual oficial The Architectural Lens para produto, Stitch e engenharia.

---

## 23. Apresentacao detalhada do projeto (frontend + backend)

Data de referencia: 19/04/2026

### 23.1 Narrativa do produto

HouseLog e uma plataforma SaaS mobile-first de gestao operacional e manutencao de imoveis, desenhada para alinhar tres atores com objetivos diferentes, mas dependentes no mesmo fluxo:
- owner: controle financeiro, governanca e decisao final em aprovacoes;
- manager: operacao diaria, abertura de OS, comparacao de propostas e acompanhamento da execucao;
- provider: resposta rapida a oportunidades, envio de proposta, execucao com evidencia e fechamento.

A proposta central do produto e reduzir a fragmentacao operacional da administracao imobiliaria, conectando inventario, manutencao, financeiro, mensagens e documentos em um ciclo unico de trabalho, com rastreabilidade completa por imovel e por ordem de servico.

### 23.2 Como o frontend esta hoje

Stack e fundamentos:
- Next.js App Router com React e TypeScript;
- Tailwind v4 + tokens em globals.css;
- componentes de base com Radix UI e variacoes reutilizaveis;
- SWR para cache, refetch e consistencia de dados;
- formularios com RHF + Zod;
- PWA ativa (manifest, service worker, pagina offline).

Estrutura de experiencia:
- shell autenticado com top navigation e bottom navigation para foco mobile;
- rotas por contexto de papel (app geral e portal do provider);
- telas publicas para convite, auditoria e compartilhamento externo;
- estados de loading, empty e error em fluxos criticos.

Estado funcional observado no frontend:
- dashboard do manager com secoes de acoes rapidas, imoveis, orcamentos e agenda;
- portal do provider com dashboard, oportunidades, detalhes de servico e configuracoes;
- fluxo de propriedade com submodulos de inventario, financeiro, manutencao, documentos e timeline;
- chat por OS integrado ao fluxo operacional;
- componentes de PDF para relatorios e ordens de servico.

Direcao visual ativa:
- Design System The Architectural Lens como guia oficial;
- linguagem visual limpa, com foco funcional e hierarquia;
- prioridade para legibilidade, rapidez de acao e uso em campo;
- equilibrio entre clareza de dados e identidade premium sem excesso ornamental.

### 23.3 Como o backend esta hoje

Stack e runtime:
- Cloudflare Workers com Hono;
- D1 (SQLite) com Drizzle ORM;
- R2 para ativos/arquivos;
- KV para suporte operacional;
- Queues para processamento assincrono;
- Workers AI para fluxos inteligentes;
- Resend para comunicacao por email.

Topologia da API:
- base principal em /api/v1;
- modulos de autenticacao, propriedades, OS, bids, provider, marketplace, mensagens, documentos, despesas, manutencao, timeline, relatorios e busca;
- rotas aninhadas por propertyId para manter escopo e seguranca contextual.

Capacidades de plataforma no backend:
- autenticacao completa com refresh e MFA;
- governanca de acesso por papel;
- ciclo completo de OS (criacao, cotacao, aprovacao, execucao e encerramento);
- mensageria por OS com notificacao push por evento;
- convite e vinculacao de colaboradores;
- geracao de thumbnails e jobs assincronos;
- rotinas agendadas para higiene de dados e manutencoes programadas.

### 23.4 Fluxo ponta a ponta (estado operacional)

1. Onboarding owner
- owner cria conta, registra primeiro imovel e define threshold de aprovacao;
- opcionalmente convida manager e providers para o imovel.

2. Operacao manager
- manager identifica necessidade e cria OS com contexto tecnico;
- define estrategia de cotacao (direta ou multipla);
- envia para providers e acompanha propostas recebidas.

3. Governanca owner
- quando valor ultrapassa threshold, owner recebe aprovacao pendente;
- aprova ou rejeita com justificativa, mantendo trilha de decisao.

4. Execucao provider
- provider recebe oportunidade, envia bid e prazo;
- se selecionado, executa servico e registra evidencia (antes/depois);
- interage com manager/owner no chat da OS durante a execucao.

5. Fechamento financeiro e historico
- despesa e comprovantes ficam vinculados a OS e ao imovel;
- relatorios consolidam custos por periodo/categoria;
- timeline preserva historico operacional para auditoria.

### 23.5 Modelo de dados (visao consolidada)

Entidades nucleares:
- User
- Property
- PropertyUser
- ServiceOrder
- Bid
- Expense
- InventoryItem
- PreventiveMaintenance
- Message
- Document
- Notification

Relacoes-chave:
- propriedade como eixo de contexto;
- OS como unidade de execucao operacional;
- bids como mecanismo de cotacao e selecao;
- despesas e documentos como trilha financeira/auditoria;
- mensagens e notificacoes como camada de comunicacao em tempo real.

### 23.6 Integracao frontend-backend

Contratos:
- cliente frontend consome modulos de API especializados (auth, properties, services, bids, provider, marketplace, messages, etc);
- padrao de contrato centralizado evita divergencia de payloads entre telas.

Padrao de consumo:
- SWR no frontend para fetch e revalidacao inteligente;
- backend com responses padronizadas e controles de erro;
- autenticacao com tokens e refresh para continuidade de sessao.

Eventos e automacoes:
- notificacoes push por eventos de negocio (nova bid, mensagem, aprovacao, conclusao);
- queue para tarefas assincronas e reducao de latencia no caminho critico;
- cron para rotina de expiracao e manutencao automatica.

### 23.7 Pontos fortes atuais

- arquitetura consistente para evolucao incremental;
- cobertura funcional ampla do ciclo imobiliario operacional;
- separacao clara entre dominio de produto, camada visual e contratos de API;
- base pronta para escalar features de provider marketplace e analise financeira;
- design system formalizado e aplicavel com governanca.

### 23.8 Riscos tecnicos e de produto

- risco de divergencia visual se paginas novas ignorarem tokens globais;
- risco de regressao de UX mobile quando componentes locais bypassarem base UI;
- risco de acoplamento acidental entre telas e payloads nao tipados;
- risco de inflacao de complexidade em OS sem guias claros de status/transicao.

Mitigacoes em curso:
- reforco de tipagem de contratos no frontend;
- padronizacao de estados de tela e navegacao por papel;
- checklist de aceite visual e funcional antes de merge.

### 23.9 Roadmap de consolidacao (curto prazo)

1. Padronizar 100% dos fluxos de OS com estados e CTAs por papel.
2. Fechar lacunas de tipagem residual e eliminar uso de any em telas criticas.
3. Consolidar dashboards (owner, manager, provider) com metricas equivalentes.
4. Expandir trilha financeira com comparativos e exportacoes robustas.
5. Fortalecer observabilidade operacional (logs de evento por jornada critica).

### 23.10 Resumo executivo para apresentacao

HouseLog ja opera como uma plataforma full-stack coerente para gestao imobiliaria orientada a execucao. O frontend entrega experiencia mobile-first com fluxo guiado por papeis, enquanto o backend oferece base robusta em Cloudflare para seguranca, escala e automacao. O produto encontra-se em fase de consolidacao avancada, com foco em padronizacao de UX, endurecimento de contratos e aceleracao de rotinas operacionais fim-a-fim.
