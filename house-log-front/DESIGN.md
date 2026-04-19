# AGENTS.md — HouseLog Frontend

## Objetivo

Este arquivo define as regras específicas de frontend para qualquer agente que trabalhe no `house-log-front`.

O agente deve atuar como:
- engenheiro frontend sênior;
- product designer sênior;
- especialista em design system;
- especialista em UX/UI mobile-first;
- mantenedor da consistência visual e estrutural do HouseLog.

Toda alteração no frontend deve:
- respeitar o sistema real;
- respeitar os contratos existentes;
- respeitar o design system oficial;
- preservar facilidade de manutenção;
- permitir personalização futura;
- evitar duplicação visual e estrutural.

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

### Regra obrigatória de implementação
No frontend, a base de componentes deve seguir:
- **Tailwind CSS para styling**
- **shadcn/ui como sistema base de componentes**
- **Radix UI como primitives acessíveis**
- **tokens centralizados em `globals.css`**
- **componentes reutilizáveis antes de criar estilos locais**

É proibido:
- criar um sistema paralelo ao shadcn/ui;
- estilizar páginas ignorando os componentes base sem necessidade;
- duplicar componentes equivalentes já existentes;
- misturar padrões conflitantes de UI;
- criar classes locais para campos/botões/cards se já houver variante reutilizável;
- inventar biblioteca de componentes diferente sem justificativa forte.

---

## Arquivos de referência prioritários

Antes de alterar UI ou comportamento, leia quando aplicável:
- `src/app/globals.css`
- `src/lib/api.ts`
- `src/lib/auth-context.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/*`
- `src/app/provider/layout.tsx`
- `src/app/provider/settings/page.tsx`
- `src/app/provider/settings/provider-settings.module.css`
- `src/components/services/service-chat.tsx`

---

## Regra crítica do frontend

O agente nunca deve:
- inventar fluxo inexistente;
- inventar estrutura de dados;
- quebrar contratos de `src/lib/api.ts`;
- criar componente visual desalinhado do sistema;
- duplicar estilos que já existem em componentes base;
- fazer UI “bonita” mas menos usável;
- espalhar hardcodes visuais em páginas;
- contornar shadcn/ui sem necessidade real.

Sempre:
1. ler os arquivos envolvidos;
2. validar contratos consumidos;
3. entender os componentes base já existentes;
4. verificar se há componente shadcn/ui reutilizável antes de criar novo;
5. só depois implementar.

---

## Design System oficial

### Nome
**The Architectural Lens**

### Direção obrigatória
Toda UI deve seguir esse padrão:

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
- menos blocos duros.

### O produto deve parecer
- premium;
- confiável;
- forte;
- profissional;
- elegante;
- moderno;
- implementável;
- rápido de entender;
- excelente em desktop e mobile.

---

## Paleta e superfícies

### Paleta principal
- Primary / Finance: `#b8c3ff`
- Secondary / Health: `#4edea3`
- Tertiary / Maintenance: `#ffb95f`
- Base noturna: `#0b1326`
- Camadas: `#060e20` até `#31394d`

### Regras
- não usar preto puro absoluto;
- não usar borda dura como padrão de composição;
- separar por superfície e espaçamento;
- usar blur/glow com moderação;
- profundidade por camada tonal, não por sombra material pesada.

---

## No-Line Rule

Regra obrigatória:
- não usar divisores sólidos como padrão;
- não usar layout “caixa sobre caixa”;
- separar blocos por:
  - tonalidade;
  - espaçamento;
  - hierarquia;
  - agrupamento;
  - contraste sutil.

---

## Tipografia

### Fonte principal
- `Inter`

### Regras
- títulos fortes e claros;
- metadata legível;
- labels consistentes;
- excelente leitura em mobile;
- contraste mínimo WCAG AA;
- espaçamento vertical com respiro.

---

## DNA dos componentes

### Base obrigatória
Toda UI deve priorizar os componentes de `src/components/ui/*`.

Sempre que possível:
- reutilizar `Button`
- reutilizar `Input`
- reutilizar `Textarea`
- reutilizar `Select`
- reutilizar `Card`
- criar variantes via `class-variance-authority` / padrão do projeto
- manter coesão com shadcn/ui

### Cards
- raio externo: `1.5rem`
- raio interno: `0.75rem`
- sem divisores rígidos
- profundidade por superfície
- hover/tap com leve lift
- sem exagero de sombra
- devem ser elegantes, proporcionais e escaneáveis

### Botões
- primário com presença premium
- secundário suave/glass quando fizer sentido
- terciário discreto
- foco visível
- estados claros
- toque confortável

### Inputs
- usar os componentes base como fonte única
- fundo suave
- foco por lift e glow discreto
- sem borda agressiva
- sem estilo local duplicado
- confortáveis em mobile
- excelente legibilidade em claro/escuro

### Navegação mobile
- floating dock
- visual de ilha flutuante
- sem encostar nas bordas
- premium e clara

---

## Tokens obrigatórios

Sempre reutilizar antes de criar novos:
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

### Regra
- páginas não devem reinventar tokens;
- componentes base devem concentrar o estilo;
- novas variantes devem ser semânticas e reutilizáveis.

---

## Regra de personalização

O frontend deve permanecer fácil de personalizar.

Toda nova implementação deve favorecer alteração futura de:
- cores
- superfícies
- radius
- spacing
- blur
- glow
- tipografia
- cards
- inputs
- botões
- sidebar
- dock mobile
- hierarquia visual
- densidade da UI

### Estratégia obrigatória
1. tokens globais;
2. tokens semânticos;
3. variantes reutilizáveis;
4. componentes base com shadcn/ui;
5. páginas apenas consumindo o sistema.

### Proibido
- hardcode visual espalhado;
- estilos locais redundantes;
- múltiplos padrões de card/input no sistema;
- mini design systems por página.

---

## Regras de UX/UI obrigatórias

Toda tela deve priorizar:
- leitura imediata;
- baixa fadiga visual;
- clareza operacional;
- bom uso em campo;
- responsividade real;
- contraste suficiente;
- foco visível;
- touch targets >= 44px no mobile;
- loading/empty/error states;
- CTAs claros;
- densidade controlada;
- excelente escaneabilidade.

---

## Áreas prioritárias do frontend

1. `Provider Settings`
2. `Provider Opportunities`
3. `Provider Opportunity Detail`
4. `Provider Service Detail com Chat`
5. `Provider Dashboard`
6. `Owner Dashboard`
7. `Property Detail`

---

## Regras técnicas obrigatórias

- não quebrar `src/lib/api.ts`;
- não inventar endpoints;
- não usar `any` sem necessidade real;
- manter tipagem forte;
- validar mobile e desktop;
- preservar dark/light quando aplicável;
- evitar excesso de blur/glow;
- manter performance boa;
- não piorar UX atual;
- usar Tailwind CSS e shadcn/ui como base oficial.

---

## Método obrigatório de trabalho

### 1. Diagnóstico
Antes de editar:
- leia arquivos envolvidos;
- identifique inconsistências;
- identifique dependências;
- identifique riscos;
- identifique componentes base reutilizáveis.

### 2. Plano
Antes de implementar:
- liste arquivos que serão alterados;
- liste melhorias propostas;
- explique aderência ao design system;
- explique como a solução reutiliza Tailwind + shadcn/ui.

### 3. Implementação
Implemente de forma:
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
5. riscos / validações manuais

---

## Critério de aceite

Uma alteração de frontend só está pronta se:
- respeitar The Architectural Lens;
- respeitar tokens existentes;
- respeitar contratos reais;
- reutilizar corretamente Tailwind CSS + shadcn/ui;
- melhorar ou preservar mobile;
- melhorar ou preservar desktop;
- manter foco visível;
- manter boa legibilidade;
- não gerar regressão visual;
- não duplicar estrutura;
- estar pronta para revisão humana.

---

## Em caso de ambiguidade

Se houver ambiguidade:
- escolher a solução mais conservadora;
- preservar o fluxo real;
- não inventar UI sem aderência ao dado;
- explicar a decisão antes de aplicar.

Se houver bloqueio:
- não improvisar;
- descrever limitação;
- propor a menor correção segura possível.