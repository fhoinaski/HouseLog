# DESIGN.md — The Architectural Lens

## Objetivo

Este arquivo define as regras específicas do design system oficial para qualquer agente que trabalhe em `house-log-front`.

O agente deve atuar como:
- engenheiro frontend sênior;
- especialista em Next.js App Router;
- especialista em TypeScript;
- especialista em Tailwind CSS;
- especialista em shadcn/ui;
- especialista em UX/UI mobile-first;
- mantenedor do design system oficial do HouseLog.

Toda alteração de frontend deve:
- respeitar o sistema real;
- respeitar contratos existentes;
- respeitar o design system oficial;
- preservar acessibilidade;
- preservar performance;
- manter facilidade de manutenção;
- permitir personalização futura.

---

## Stack obrigatória do frontend

O frontend deve ser construído e mantido com:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- SWR
- React Hook Form
- Zod
- Sonner
- PWA

---

## Regra principal do frontend

A base oficial de UI do HouseLog é:

- **Tailwind CSS para styling**
- **shadcn/ui como base de componentes**
- **Radix UI como primitives acessíveis**
- **tokens centralizados em `src/app/globals.css` e `src/app/tokens.css`**
- **variantes reutilizáveis antes de estilos locais**

É proibido:
- criar um design system paralelo;
- criar componentes concorrentes aos do `src/components/ui/*` sem necessidade real;
- espalhar hardcode visual em páginas;
- resolver inconsistência visual só com classes locais improvisadas;
- duplicar botão/input/card/select já existentes;
- misturar padrões visuais conflitantes.

---

## Design system oficial

O design system oficial do HouseLog chama-se:

# The Architectural Lens

Toda UI nova ou refatorada deve seguir:
- contemporânea premium;
- profundidade tonal;
- hierarquia editorial;
- assimetria intencional;
- superfícies em camadas;
- visual funcional e sofisticado;
- mobile-first real;
- menos ruído visual;
- mais clareza;
- mais respiro;
- menos aparência de dashboard genérico;
- alta legibilidade em campo.

O produto deve parecer:
- premium;
- confiável;
- operacional;
- forte;
- elegante;
- moderno;
- implementável.

---

## Arquivos de referência prioritários

Antes de alterar UI ou comportamento, ler quando aplicável:
- `src/app/globals.css`
- `src/app/tokens.css`
- `src/lib/api.ts`
- `src/lib/auth-context.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/*`
- `src/components/navigation/*`
- `src/app/layout.tsx`
- `src/app/provider/layout.tsx`
- `src/app/provider/settings/page.tsx`
- `src/components/services/service-chat.tsx`

---

## Regra crítica do frontend

O agente nunca deve:
- inventar fluxo inexistente;
- inventar dado inexistente;
- quebrar contratos de `src/lib/api.ts`;
- criar UI desalinhada do sistema;
- duplicar estilos equivalentes já resolvidos em componentes base;
- ignorar estados de loading/empty/error;
- piorar UX mobile;
- contornar shadcn/ui sem necessidade real;
- criar uma segunda linguagem visual no sistema.

Sempre:
1. ler os arquivos envolvidos;
2. validar contratos consumidos;
3. verificar componentes base existentes;
4. reutilizar antes de criar;
5. só então implementar.

---

## Tokens e fonte única de verdade visual

Toda UI deve reutilizar tokens globais antes de criar novos.

Tokens prioritários:
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

Regra:
- páginas não devem reinventar tokens;
- páginas não devem concentrar lógica de estilo;
- componentes base devem concentrar estilo reutilizável;
- novas variantes devem ser semânticas;
- novas abstrações devem reduzir duplicação.

---

## Paleta e superfícies

Paleta principal:
- Primary / Finance: `#b8c3ff`
- Secondary / Health: `#4edea3`
- Tertiary / Maintenance: `#ffb95f`
- Base: `#0b1326`
- Camadas: `#060e20` até `#31394d`

Regras:
- não usar preto absoluto como base;
- não usar borda dura como principal recurso de composição;
- separar blocos por superfície, espaçamento e hierarquia;
- usar blur e glow com moderação;
- priorizar profundidade tonal em vez de sombra pesada.

---

## No-Line Rule

Regra obrigatória:
- evitar divisores sólidos como padrão;
- evitar layout “caixa sobre caixa”;
- separar blocos por:
  - tonalidade;
  - espaçamento;
  - agrupamento;
  - contraste sutil;
  - hierarquia.

---

## Tipografia

Fonte principal:
- `Inter`

Regras:
- títulos claros e fortes;
- metadata legível;
- labels consistentes;
- legibilidade excelente em mobile;
- contraste mínimo WCAG AA;
- espaçamento vertical respirável.

---

## DNA oficial dos componentes

### Componentes base obrigatórios
Priorizar `src/components/ui/*`.

Sempre que possível:
- reutilizar `Button`
- reutilizar `Input`
- reutilizar `Textarea`
- reutilizar `Select`
- reutilizar `Card`
- criar variantes com padrão consistente
- manter aderência ao shadcn/ui

### Cards
- elegantes;
- escaneáveis;
- proporcionais;
- sem excesso de borda dura;
- profundidade por superfície;
- hover leve;
- sem exagero de sombra.

### Botões
- foco visível;
- estados claros;
- toque confortável;
- variantes semânticas;
- não criar novos padrões de botão por página.

### Inputs
- usar componentes base como fonte única;
- fundo suave;
- foco por lift e glow discreto;
- sem estilo duplicado;
- excelente leitura em claro/escuro;
- confortáveis em mobile.

### Navegação
- desktop com shell coerente;
- mobile com dock flutuante quando aplicável;
- sem improviso visual por página.

---

## Estrutura preferida de layout

Preferir componentes estruturais como:
- `app-shell`
- `app-topbar`
- `app-sidebar`
- `mobile-dock`
- `page-header`
- `page-section`
- `surface-card`
- `metric-card`

Evitar:
- reconstruir layout estrutural em cada tela;
- duplicar header/nav/card patterns;
- resolver shell por repetição de classes.

---

## Regra de personalização futura

Toda implementação deve facilitar alteração futura de:
- cores;
- superfícies;
- radius;
- spacing;
- blur;
- glow;
- tipografia;
- botões;
- inputs;
- cards;
- navegação;
- densidade visual.

Estratégia obrigatória:
1. tokens globais;
2. tokens semânticos;
3. variantes reutilizáveis;
4. componentes base;
5. páginas apenas consumindo o sistema.

É proibido:
- hardcode visual espalhado;
- estilos redundantes por página;
- múltiplos padrões de card/input no sistema;
- mini design systems locais.

---

## Regras obrigatórias de UX/UI

Toda tela deve priorizar:
- leitura imediata;
- baixa fadiga visual;
- clareza operacional;
- responsividade real;
- contraste suficiente;
- foco visível;
- touch targets >= 44px no mobile;
- loading/empty/error states;
- CTAs claros;
- densidade controlada;
- excelente escaneabilidade.

---

## Regras técnicas obrigatórias

- não quebrar `src/lib/api.ts`;
- não inventar endpoints;
- não usar `any` sem necessidade real;
- manter tipagem forte;
- validar mobile e desktop;
- preservar dark/light quando aplicável;
- não exagerar blur/glow;
- manter performance boa;
- não piorar acessibilidade;
- usar Tailwind + shadcn/ui como base oficial.

---

## Método obrigatório de trabalho

### 1. Diagnóstico
Antes de editar:
- ler os arquivos envolvidos;
- identificar inconsistências;
- identificar dependências;
- identificar riscos;
- identificar componentes base reutilizáveis.

### 2. Plano
Antes de implementar:
- listar arquivos a alterar;
- listar o que será reutilizado;
- listar o que será melhorado;
- justificar aderência ao design system.

### 3. Implementação
Implementar de forma:
- incremental;
- limpa;
- consistente;
- sem gambiarra;
- revisável.

### 4. Entrega
Sempre informar:
1. diagnóstico
2. plano
3. implementação
4. arquivos alterados
5. riscos
6. validações manuais

---

## Critério de aceite

Uma alteração de frontend só está pronta se:
- respeita The Architectural Lens;
- respeita tokens existentes;
- respeita contratos reais;
- reutiliza corretamente Tailwind + shadcn/ui;
- melhora ou preserva mobile;
- melhora ou preserva desktop;
- mantém foco visível;
- mantém boa legibilidade;
- não gera regressão visual;
- não duplica estrutura;
- está pronta para revisão humana.

---

## Em caso de ambiguidade

Se houver ambiguidade:
- escolher a solução mais conservadora;
- preservar o fluxo real;
- não inventar UI sem aderência ao dado;
- explicar a decisão antes de aplicar.

Se houver bloqueio:
- não improvisar;
- descrever a limitação;
- propor a menor correção segura possível.
