# Revisao do tema CRM premium

## Objetivo da revisao

Validar a percepcao visual do tema atual em comparacao com as variacoes CRM premium e CRM premium dark antes de promover qualquer identidade como padrao do HouseLog.

A revisao deve confirmar se a nova direcao visual reforca o posicionamento do HouseLog como memoria tecnica digital e prontuario tecnico premium de imoveis, sem comprometer clareza operacional, legibilidade, contraste, densidade de dados ou consistencia com The Architectural Lens.

## Como testar

1. Abrir o app em ambiente local ou ambiente de homologacao.
2. Acessar `/settings`.
3. Entrar em `Aparencia`.
4. Usar o controle `Previa visual`.
5. Alternar entre:
   - `Atual`;
   - `CRM premium`;
   - `CRM premium dark`.
6. Navegar pelas telas obrigatorias abaixo sem recarregar a pagina.
7. Registrar observacoes por tela e decidir se o tema esta pronto, precisa de ajustes ou deve ser descartado.

## Telas obrigatorias para validar

- `/dashboard`
- `/properties`
- `/properties/:id`
- `/properties/:id/systems`
- `/properties/:id/map`
- `/properties/:id/services`
- `/settings`

## Criterios de avaliacao

- Clareza: a tela comunica rapidamente o que importa?
- Sensacao premium: a interface parece adequada para imoveis de alto padrao, construtoras e gestao patrimonial?
- Sensacao CRM: a experiencia favorece operacao recorrente, acompanhamento e comparacao?
- Contraste: texto, botoes, status e bordas atendem leitura confortavel?
- Legibilidade mobile: informacoes e acoes continuam claras em telas pequenas?
- Excesso de cor: accents e status competem com o conteudo?
- Hierarquia visual: titulos, secoes, listas e acoes tem prioridade clara?
- Densidade operacional: listagens e modulos mostram informacao suficiente sem parecerem poluidos?

## Checklist de revisao

| Tela | Atual | CRM premium | CRM premium dark | Observacoes | Decisao |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` |  |  |  |  |  |
| `/properties` |  |  |  |  |  |
| `/properties/:id` |  |  |  |  |  |
| `/properties/:id/systems` |  |  |  |  |  |
| `/properties/:id/map` |  |  |  |  |  |
| `/properties/:id/services` |  |  |  |  |  |
| `/settings` |  |  |  |  |  |

## Regras desta revisao

- Nao alterar codigo durante a revisao.
- Nao trocar o tema padrao.
- Nao alterar `tokens.css`.
- Nao alterar `tokens.crm-premium.css`.
- Nao alterar `globals.css`.
- Apenas documentar o processo, achados e decisoes de revisao.
