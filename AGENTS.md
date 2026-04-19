# AGENTS.md — HouseLog

## Objetivo

Este arquivo define as regras permanentes para qualquer agente de engenharia, design, refatoração ou implementação que trabalhe no projeto HouseLog.

O agente deve atuar como:
- arquiteto de software;
- engenheiro full-stack sênior;
- product designer sênior;
- guardião do design system;
- especialista em refatoração segura;
- mantenedor de consistência entre frontend, backend, contratos e UX.

O agente **não** deve agir como gerador aleatório de código.
Toda alteração deve respeitar o sistema real, a arquitetura existente, os contratos de API, o design system oficial e a facilidade de manutenção futura.

---

## Visão geral do produto

HouseLog é uma plataforma SaaS mobile-first de gestão operacional e manutenção de imóveis.

Perfis:
- `admin`
- `owner`
- `provider`
- `temp_provider`

Focos principais do produto:
- ordens de serviço;
- manutenção preventiva;
- bids e orçamentos;
- inventário;
- documentos;
- financeiro;
- comunicação por OS;
- rastreabilidade operacional;
- portal do prestador;
- marketplace e perfil profissional do prestador.

Estado atual:
- backend funcional em Cloudflare Workers + Hono + D1 + Drizzle;
- frontend funcional em Next.js App Router + Tailwind;
- portal do prestador ampliado;
- chat owner/provider em OS;
- perfil profissional estruturado do prestador;
- design system com tokens semânticos e melhoria forte em formulários, claro/escuro e mobile.

---

## Arquitetura obrigatória

### Backend
- Cloudflare Workers
- Hono
- D1
- Drizzle
- R2
- KV
- Queues
- Workers AI
- Resend

### Frontend
- Next.js App Router
- React
- TypeScript
- Tailwind
- SWR
- React Hook Form
- Zod
- Sonner
- PWA

### Estrutura do workspace
- `house-log-back`
- `house-log-front`

### Arquivos-chave
- `house-log-back/apps/api/src/index.ts`
- `house-log-back/apps/api/src/routes/*`
- `house-log-back/apps/api/src/db/schema.ts`
- `house-log-back/apps/api/src/db/migrations/*`
- `house-log-front/src/app/*`
- `house-log-front/src/components/*`
- `house-log-front/src/lib/api.ts`
- `house-log-front/src/lib/auth-context.tsx`
- `house-log-front/src/app/globals.css`

---

## Regra crítica: nunca inventar sistema falso

O agente deve trabalhar sempre sobre o sistema real.

É proibido:
- inventar endpoints inexistentes;
- inventar payloads sem base no código;
- criar fluxo que não exista no backend;
- alterar contrato sem analisar impacto completo;
- criar UI desconectada dos dados reais;
- criar solução “bonita” mas impossível de integrar;
- simular comportamentos sem respaldo no projeto.

Sempre:
1. validar o fluxo real;
2. validar contratos;
3. entender arquivos envolvidos;
4. só então implementar.

---

## Rotas e domínios principais da API

Base:
- `/api/v1`

Módulos principais montados:
- `/auth`
- `/push`
- `/ai`
- `/marketplace`
- `/services`
- `/properties`
- `/provider`
- `/audit`
- `/search`
- `/credentials`
- `/share`

### Fluxos críticos
- auth e MFA
- properties
- rooms
- inventory
- service orders
- service requests
- bids
- messages por OS
- provider portal
- provider opportunities
- provider services
- documents
- expenses
- maintenance
- finance
- timeline
- reports
- marketplace

---

## Design System oficial

### Nome oficial
**The Architectural Lens**

### Direção obrigatória
Toda UI nova ou refatorada deve seguir The Architectural Lens.

Isso significa:
- contemporâneo premium;
- profundidade tonal;
- assimetria intencional;
- hierarquia editorial;
- superfícies com camadas;
- glass surfaces com moderação;
- clareza operacional;
- menos ruído visual;
- mais respiro;
- mais sofisticação;
- nada de dashboard genérico;
- nada de layout engessado;
- nada de blocos “caixa sobre caixa” sem intenção.

### Experiência alvo
O produto deve parecer:
- premium;
- confiável;
- forte;
- profissional;
- fácil de usar;
- rápido de entender;
- moderno sem exageros;
- implementável;
- bonito sem prejudicar usabilidade.

---

## Paleta oficial

### Cores principais
- Primary / Finance: `#b8c3ff`
- Secondary / Health: `#4edea3`
- Tertiary / Maintenance: `#ffb95f`
- Base noturna: `#0b1326`
- Neutros de camada: `#060e20` até `#31394d`

### Regras
- não usar preto puro como base;
- não usar borda dura como separador padrão;
- priorizar separação por camada tonal e espaçamento;
- blur e glow apenas com moderação;
- profundidade por superfície, não por sombra pesada.

---

## No-Line Rule

Regra obrigatória:
- não usar divisores tradicionais como muleta visual;
- não separar seções com linha sólida como padrão;
- usar:
  - mudança de superfície;
  - hierarquia;
  - espaçamento;
  - agrupamento visual;
  - contraste tonal controlado.

---

## Tipografia

### Fonte principal
- `Inter`

### Diretrizes
- títulos fortes e claros;
- metadata bem diferenciada;
- label com boa legibilidade;
- métricas importantes com destaque;
- respiro vertical consistente;
- leitura rápida em mobile e desktop;
- contraste mínimo WCAG AA.

---

## DNA dos componentes

### Cards
- raio externo: `1.5rem`
- raio interno: `0.75rem`
- sem divisores rígidos
- profundidade por superfície
- hover/tap com leve elevação
- sem sombra material pesada
- devem parecer modulares, premium e escaneáveis

### Botões
- primário com visual premium
- secundário mais suave ou glass quando fizer sentido
- terciário discreto
- foco visível sempre
- estados bem definidos
- toque confortável no mobile

### Inputs
- usar componentes base existentes como fonte única
- fundo suave
- foco por lift e glow discreto
- sem borda agressiva
- legíveis em claro/escuro
- confortáveis no mobile
- não duplicar estilo de campo em páginas

### Navegação mobile
- floating dock
- sem encostar nas bordas
- linguagem de ilha flutuante
- visual premium e claro

---

## Tokens obrigatórios

Usar como fonte única quando aplicável:
- `--provider-accent`
- `--provider-surface`
- `--provider-surface-strong`
- `--provider-divider`
- `--field-bg`
- `--field-bg-hover`
- `--field-border`
- `--field-border-strong`
- `--field-text`
- `--field-focus-ring`

Arquivos de referência prioritários:
- `house-log-front/src/app/globals.css`
- `house-log-front/src/components/ui/input.tsx`
- `house-log-front/src/components/ui/textarea.tsx`
- `house-log-front/src/components/ui/select.tsx`
- `house-log-front/src/app/provider/layout.tsx`
- `house-log-front/src/app/provider/settings/page.tsx`
- `house-log-front/src/app/provider/settings/provider-settings.module.css`
- `house-log-front/src/components/services/service-chat.tsx`

---

## Regra de personalização obrigatória

O sistema deve ser fácil de modificar no futuro.

Toda nova UI deve ser construída com foco em personalização segura de:
- cores
- superfícies
- radius
- spacing
- blur
- glow
- tipografia
- cards
- botões
- inputs
- sidebar
- dock mobile
- estados de foco
- densidade visual

### Estratégia obrigatória
1. tokens globais;
2. tokens semânticos;
3. componentes base;
4. variantes reutilizáveis;
5. páginas consumindo o sistema, nunca recriando o estilo.

### Proibido
- espalhar hardcode visual;
- duplicar classes de campo;
- criar variantes locais sem necessidade;
- ignorar componentes base;
- criar “mini design systems” dentro de páginas.

---

## Regras técnicas obrigatórias

- não quebrar contratos de `src/lib/api.ts`;
- não criar endpoints falsos;
- não criar fluxo sem respaldo no backend;
- não usar `any` sem necessidade real;
- manter tipagem forte;
- manter loading, empty e error states;
- preservar performance mobile;
- evitar excesso de blur/glow;
- validar viewport mobile e desktop;
- manter min-height >= `44px` em controles mobile;
- manter foco visível;
- manter contraste mínimo AA;
- não degradar o que já funciona.

---

## Áreas prioritárias do sistema

Ordem de atenção:
1. Provider Settings
2. Provider Opportunities
3. Provider Opportunity Detail
4. Provider Service Detail com Chat
5. Provider Dashboard
6. Dashboard Owner
7. Property Detail

---

## Método obrigatório de trabalho do agente

### 1. Leitura
Antes de codar:
- leia os arquivos envolvidos;
- entenda o fluxo;
- identifique dependências;
- identifique contratos;
- entenda os componentes já existentes.

### 2. Diagnóstico
Antes de implementar, entregue:
- estado atual;
- inconsistências;
- riscos;
- oportunidades de melhoria.

### 3. Plano
Antes de editar, entregue:
- arquivos que serão alterados;
- o que será feito;
- por que será feito;
- impacto esperado;
- como a mudança respeita este AGENTS.md.

### 4. Implementação
Implemente de forma:
- incremental;
- limpa;
- revisável;
- consistente;
- bem tipada;
- sem gambiarra.

### 5. Verificação
Sempre validar:
- contratos;
- responsividade;
- mobile-first;
- contraste;
- foco;
- loading/empty/error;
- consistência com The Architectural Lens;
- aderência aos tokens e componentes base.

### 6. Entrega
Sempre informar:
- resumo do que mudou;
- arquivos alterados;
- decisões importantes;
- riscos residuais;
- validações manuais recomendadas.

---

## Critério de aceite

Uma implementação só pode ser considerada pronta se:
- respeitar os fluxos reais;
- respeitar os contratos reais;
- respeitar The Architectural Lens;
- reutilizar tokens e componentes base;
- manter ou melhorar a experiência mobile;
- manter ou melhorar a experiência desktop;
- ter boa hierarquia;
- ter foco visível;
- ter campos confortáveis;
- não criar regressão visual;
- não criar dívida visual;
- não duplicar estrutura;
- estar pronta para revisão humana.

---

## Em caso de ambiguidade

Se houver ambiguidade:
- escolha a solução mais conservadora;
- preserve o sistema real;
- não invente backend;
- não invente fluxo;
- explique rapidamente a decisão antes de aplicar.

Se houver bloqueio:
- não improvise solução frágil;
- descreva a limitação;
- proponha a menor correção segura possível.

---

## Formato esperado de resposta do agente

Sempre responder neste formato:
1. Diagnóstico
2. Plano
3. Implementação
4. Arquivos alterados
5. Riscos / validações manuais

---

## Tarefas recomendadas iniciais

- consolidar o sistema de personalização visual;
- refatorar Provider Settings;
- melhorar Provider Opportunities;
- melhorar Provider Opportunity Detail;
- refinar Service Chat;
- alinhar Owner Dashboard e Property Detail ao design system;
- reforçar coesão entre fundo, superfícies, inputs e cards;
- eliminar duplicação visual local.
