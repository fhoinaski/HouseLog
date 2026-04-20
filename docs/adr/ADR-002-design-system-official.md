# ADR-002 - The Architectural Lens e o design system oficial

## Status

Aceito.

## Contexto

O frontend ja possui tokens, Tailwind CSS, shadcn/ui, Radix UI e componentes base. Houve conflito documental anterior entre nomes de sistema visual.

Para evitar divergencia, o produto precisa de um unico design system oficial.

## Decisao

O design system oficial do HouseLog se chama The Architectural Lens.

Toda interface nova ou refatorada deve seguir:
- visual contemporaneo premium;
- profundidade tonal;
- hierarquia editorial;
- mobile-first real;
- clareza operacional;
- superficies em camadas;
- separacao por tonalidade e espacamento;
- pouca dependencia de bordas duras;
- foco visivel e contraste adequado.

Tailwind CSS e shadcn/ui sao a base oficial de implementacao frontend.

## Consequencias

### Positivas
- elimina conflito de naming;
- melhora consistencia visual;
- orienta consolidacao de componentes base;
- reduz estilos locais improvisados;
- preserva identidade premium privada.

### Custos
- paginas antigas precisarao ser migradas gradualmente;
- componentes locais duplicados devem ser substituidos por variantes reutilizaveis;
- qualquer nova UI deve justificar uso de tokens e componentes base.

## Impacto no codigo atual

Nao exige redesign completo imediato.

Futuras etapas devem priorizar:
- AppShell;
- Surface/Card primitives;
- SensitiveField;
- PageHeader/PageSection;
- consolidacao de inputs, buttons, cards e estados vazios;
- remocao de mini design systems locais.

## Regra para o Codex

O Codex deve usar The Architectural Lens como unica fonte de linguagem visual e deve evitar criar novos aliases visuais ou estilos paralelos sem decisao explicita.
