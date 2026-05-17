# HouseLog Calm OS

`HouseLog Calm OS` e o padrao visual oficial para a migracao gradual do HouseLog para uma interface clara, premium, calma e mobile-first.

## Direcao

- Fundo off-white/areia para reduzir peso visual.
- Cards brancos com bordas suaves e sombras discretas.
- Tipografia limpa, contraste acessivel e hierarquia curta.
- Botoes e areas clicaveis grandes, especialmente no mobile.
- Status visuais claros, sem depender apenas de texto.
- Navegacao clara e app-like, sem aparencia dark/tech.

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
- Tokens antigos continuam ativos ate cada area ser migrada.

## Piloto

O primeiro piloto e `/provider/dashboard`.

Escopo inicial:
- fundo claro;
- cards brancos;
- badges e icones suaves;
- bottom/top nav claras via `.hl-calm-os`;
- cards clicaveis de propostas;
- layout mobile-first.

## Regras De Migracao

- Migrar por tela ou componente, nao por troca global.
- Preferir wrapper explicito (`.hl-calm-os`) em vez de seletores `:has()` para novos blocos.
- Componentes compartilhados de layout/lista devem preferir `bg-hl-surface`, `border-hl-border`, `shadow-hl-subtle`, `text-hl-text` e `text-hl-text-muted`.
- Cards clicaveis devem usar `Link` ou `button`, ter `focus-visible` claro e area de toque confortavel.
- Nao apagar tokens antigos antes de mapear consumidores.
- Nao alterar contrato de API como parte da migracao visual.
- Preservar loading, empty e error states.
- Manter contraste acessivel em texto, icones e status.
