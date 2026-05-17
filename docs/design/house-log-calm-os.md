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

## Tokens Base

| Token | Valor | Uso |
|---|---:|---|
| `--hl-bg` | `#F7F5F0` | Fundo de pagina |
| `--hl-surface` | `#FFFFFF` | Cards, listas, barras e modais |
| `--hl-surface-muted` | `#F1EFE8` | Hover, chips e surfaces secundarias |
| `--hl-border` | `#E5E1D8` | Bordas suaves |
| `--hl-text` | `#1F2933` | Texto principal |
| `--hl-text-muted` | `#6B7280` | Texto secundario |
| `--hl-primary` | `#2F5D62` | Acao principal HouseLog |
| `--hl-primary-blue` | `#2563EB` | Acao informativa ou link importante |
| `--hl-success` | `#16A34A` | Sucesso |
| `--hl-warning` | `#D97706` | Atencao |
| `--hl-danger` | `#DC2626` | Erro ou risco |
| `--hl-info` | `#2563EB` | Informacao |

## Implementacao

- Fonte de verdade: `house-log-front/src/app/tokens.css`.
- Ponte Tailwind: `house-log-front/src/app/globals.css` em `@theme inline`.
- Classes Tailwind disponiveis incluem `bg-hl-bg`, `bg-hl-surface`, `border-hl-border`, `text-hl-text`, `text-hl-text-muted`, `text-hl-primary`, `shadow-hl-subtle` e `shadow-hl-soft`.
- Wrapper oficial: `.hl-calm-os`, aplicado pelo `AppShell` autenticado para fundo, texto e navegacao clara.
- Classes auxiliares globais: `.hl-calm-card`, `.hl-calm-surface`, `.hl-calm-section`, `.hl-calm-muted`, `.hl-calm-border`, `.hl-calm-focus` e `.hl-calm-bottom-safe`.
- Tokens antigos continuam ativos ate cada area ser migrada.

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
