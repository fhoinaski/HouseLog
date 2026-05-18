# HouseLog Calm OS

`HouseLog Calm OS` e o tema visual oficial atual do HouseLog. Ele substitui o padrao dark/tech anterior como direcao principal para novas telas, novos componentes e migracoes incrementais.

O visual dark/tech anterior passa a ser legado: pode continuar existindo em telas ainda nao migradas, mas nao deve ser usado como padrao em novas implementacoes. A migracao deve seguir por blocos controlados, sem troca global destrutiva e sem remover tokens antigos antes de mapear consumidores.

## Direcao

- Fundo off-white/areia para reduzir peso visual.
- Cards brancos com bordas suaves e sombras discretas.
- Tipografia limpa, contraste acessivel e hierarquia curta.
- Botoes e areas clicaveis grandes, especialmente no mobile.
- Status visuais claros, sem depender apenas de texto.
- Navegacao clara e app-like, sem aparencia dark/tech.
- Legibilidade, calma, usabilidade, mobile-first e confianca antes de efeito visual.
- Premium sem exagero: menos glass, menos gradiente escuro, menos contraste agressivo.

## Tokens Base (paleta refinada 2026-05-17)

Valores definidos como `@layer`-agnostic em `globals.css` (bloco `:root` unlayered ao final do arquivo), garantindo precedencia sobre `tokens.css`.

| Token | Valor | Uso |
|---|---:|---|
| `--hl-bg` | `#f7f6f3` | Fundo de pagina (off-white quente) |
| `--hl-surface` | `#ffffff` | Cards, listas, barras e modais |
| `--hl-surface-muted` | `#f2f0eb` | Hover, chips e surfaces secundarias |
| `--hl-border` | `#e4e1d9` | Bordas suaves |
| `--hl-text` | `#1c1a17` | Texto principal (quase preto quente) |
| `--hl-text-muted` | `#706b62` | Texto secundario e placeholder |
| `--hl-primary` | `#1b4f6f` | Acao principal — petroleo profundo |
| `--hl-primary-blue` | `#1b4f6f` | Alias de --hl-primary |
| `--hl-success` | `#2a7a50` | Sucesso |
| `--hl-warning` | `#b86b0e` | Atencao |
| `--hl-danger` | `#c0352c` | Erro ou risco |
| `--hl-info` | `#1f5fa8` | Informacao |
| `--hl-shadow-subtle` | ver globals.css | Sombra discreta de card |
| `--hl-shadow-soft` | ver globals.css | Sombra suave de modal/painel |
| `--hl-radius-card` | `0.75rem` | Raio de cards e modais |
| `--hl-radius-control` | `0.5rem` | Raio de inputs, botoes e chips |

## Padroes de Input, Button, Modal e Badge (2026-05-17)

### Input / Textarea / Select

- Fundo: `var(--hl-surface)` (branco)
- Texto: `var(--hl-text)`
- Borda: `1px solid var(--hl-border)`
- Placeholder: `var(--hl-text-muted)` com opacity 0.7
- Hover borda: `color-mix(in srgb, var(--hl-border) 40%, var(--hl-text-muted) 60%)`
- Focus borda: `var(--hl-primary)` + ring `0 0 0 3px color-mix(in srgb, var(--hl-primary) 15%, transparent)`
- Disabled: `var(--hl-surface-muted)` com opacity 0.6

### Button primario

- Background: `var(--hl-primary)` (`#2F5D62`)
- Texto: `#ffffff`
- Hover: `color-mix(in srgb, var(--hl-primary) 85%, #000 15%)`
- Focus ring: `0 0 0 3px color-mix(in srgb, var(--hl-primary) 25%, transparent)`

### Button secundario / outline

- Background: `var(--hl-surface)`
- Texto: `var(--hl-text)`
- Borda: `1px solid var(--hl-border)`
- Hover: `var(--hl-surface-muted)`

### Button ghost

- Background: transparent
- Texto: `var(--hl-text-muted)`
- Hover: `var(--hl-surface-muted)` + `var(--hl-text)`

### Label

- Cor: `var(--hl-text)` (nao secundario — label deve ter contraste total)

### Dialog / Modal

- Overlay: `bg-black/40`
- Conteudo: `bg-hl-surface border border-hl-border shadow-hl-soft text-hl-text`
- Titulo: `text-hl-text`
- Descricao: `text-hl-text-muted`

### Badge

- Tokens de status usam `color-mix` contra `var(--hl-surface)` para criar versoes soft:
  - Sucesso: `color-mix(in srgb, var(--hl-success) 12%, var(--hl-surface))`
  - Atencao: `color-mix(in srgb, var(--hl-warning) 12%, var(--hl-surface))`
  - Erro/urgente: `color-mix(in srgb, var(--hl-danger) 12%, var(--hl-surface))`
  - Info: `color-mix(in srgb, var(--hl-info) 12%, var(--hl-surface))`
  - Draft/neutro: `var(--hl-surface-muted)` + `var(--hl-text-muted)`

## Implementacao

- Paleta refinada: bloco `:root` unlayered no final de `globals.css`, com precedencia sobre `tokens.css`.
- Ponte Tailwind: `house-log-front/src/app/globals.css` em `@theme inline`.
- Shadcn bridge: `@layer base :root` em `globals.css` aponta para tokens `--hl-*` (nao para tokens legados dark). Isso garante que componentes shadcn (`Card`, `Dialog`, `Popover`, etc.) usem a paleta Calm OS.
- `ThemeProvider`: `defaultTheme="light"` com `enableSystem={false}` — sem classe `.dark` globalmente.
- Classes Tailwind disponiveis: `bg-hl-bg`, `bg-hl-surface`, `bg-hl-surface-muted`, `border-hl-border`, `text-hl-text`, `text-hl-text-muted`, `text-hl-primary`, `shadow-hl-subtle` e `shadow-hl-soft`.
- Wrapper oficial: `.hl-calm-os`, aplicado pelo `AppShell` autenticado para fundo, texto e navegacao clara.
- Classes auxiliares globais: `.hl-calm-card`, `.hl-calm-surface`, `.hl-calm-section`, `.hl-calm-muted`, `.hl-calm-border`, `.hl-calm-focus` e `.hl-calm-bottom-safe`.
- `--field-focus-ring`, `--nav-text-active` e `--nav-text-inactive` sobrescritos em `@layer base :root` para apontar para tokens Calm OS — nao alterar componentes de nav diretamente para foco ou cor de texto.
- Tokens antigos continuam ativos ate cada area ser migrada. Nao remover sem mapear consumidores.

## Layout e Container

### PageContainer (`src/components/layout/page-container.tsx`)

Componente padrao de container de pagina. Centraliza o conteudo, aplica padding responsivo e define largura maxima consistente.

| Variante | max-width | Uso tipico |
|---|---|---|
| `default` | 1200px | Dashboard, lista de imoveis |
| `narrow` | 1024px | Schedule, financial, provider flows |
| `form` | 3xl (768px) | Formularios de criacao/edicao |

Padding padrao: `px-4 py-5 sm:px-5 md:px-6 md:py-6`.

Uso: `<PageContainer variant="narrow" className="space-y-5">`.

Nao usar `max-w-` ou `mx-auto` inline nas pages — centralizar via `PageContainer`.

### Navegacao

**Desktop (TopNav):** Logo + pill central com items (Inicio, Imoveis, Agenda, Financeiro, Config.) + avatar de perfil a direita. Maximo ~5 items visivel.

**Mobile (BottomNav):** Dock com ate 5 items: Inicio, Imoveis, Agenda, Financeiro, Config. para owner/manager. Provider: Inicio, Oportunidades, Minhas OS, Config.

Settings agora aparece no bottom nav para owner e manager (acessivel no mobile sem depender do avatar do top nav, que e oculto no mobile).

**Navegacao contextual de imovel:** tabs dentro do detalhe do imovel — nao usar nav global para modulos internos.

## Tema Atual

- Calm OS e o tema principal do frontend.
- O tema dark/tech anterior e legado e deve ser migrado gradualmente.
- Novas telas e novos componentes devem usar `.hl-calm-os`, tokens `--hl-*` ou as classes auxiliares Calm OS.
- Telas legadas devem ser migradas quando forem tocadas ou em blocos com validacao propria.
- Manter dark apenas quando houver justificativa especifica, como viewer de midia, overlay temporario ou futuro modo alternativo.

## Regras De Migracao

- Migrar por tela ou componente, nao por troca global.
- Preferir wrapper explicito (`.hl-calm-os`) em vez de seletores `:has()` para novos blocos.
- Componentes compartilhados de layout/lista devem preferir `bg-hl-surface`, `border-hl-border`, `shadow-hl-subtle`, `text-hl-text` e `text-hl-text-muted`.
- Cards clicaveis devem usar `Link` ou `button`, ter `focus-visible` claro e area de toque confortavel.
- Nao usar `text-white`, `bg-slate-950`, `bg-zinc-950` ou `bg-black` como padrao visual de novas telas.
- Nao criar novos componentes com cores hardcoded quando houver token semantico.
- Nao apagar tokens antigos antes de mapear consumidores.
- Nao alterar contrato de API como parte da migracao visual.
- Preservar loading, empty e error states.
- Manter contraste acessivel em texto, icones e status.

## Migration Checklist

- [ ] Tela usa wrapper `.hl-calm-os`.
- [ ] Fundo usa `--hl-bg`.
- [ ] Cards usam `--hl-surface`.
- [ ] Textos usam `--hl-text` e `--hl-text-muted`.
- [ ] Bordas usam `--hl-border`.
- [ ] Status usam tokens semanticos.
- [ ] Botoes tem foco visivel.
- [ ] Cards clicaveis sao `Link` ou `button`.
- [ ] Inputs tem labels.
- [ ] Loading/error/empty estao claros.
- [ ] Mobile-first validado.
- [ ] Sem hardcoded dark desnecessario.
- [ ] Sem `div onClick` inacessivel.
