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

## Decisao parcial

Aprovar o CRM premium claro como direcao visual, mas nao promover ainda como tema padrao.

Motivo: a variacao clara comunica melhor produto premium, CRM patrimonial, construtora e prontuario tecnico de imovel. A execucao ainda precisa ajustes de contraste e consistencia em topbar, cards de imoveis e excesso de cor em acoes rapidas.

## Achados da primeira revisao manual

- CRM premium claro: melhor direcao comercial, mas execucao incompleta.
- CRM premium dark: bom modo tecnico/opcional para uso interno, auditoria ou preferencia individual.
- Tema atual: mais consistente no conjunto, porem mais tech/dark e menos alinhado ao publico premium.
- `/properties`: aprovado como direcao visual para CRM premium claro, com ajustes menores.
- Observacao: manter o botao `Abrir imovel` e a logo/topbar sob revisao nas proximas capturas.

Principais pontos a corrigir antes de nova rodada:

- Topbar no CRM premium claro com baixo contraste.
- Logo/texto HouseLog quase invisivel no tema claro.
- Navegacao ativa/inativa com pouca hierarquia.
- Cards de imoveis em `/properties` ainda escuros demais no tema claro.
- Botoes rapidos nos cards usam cores fortes demais e competem visualmente.
- Tema claro fica hibrido quando mistura fundo claro com cards escuros.

## Achados da segunda rodada de refinamento

- `/dashboard`: revisar metricas e acoes rapidas como superficies claras, com cor reservada para status e hierarquia.
- `/properties/:id`: preservar o hero com overlay quando houver foto, mas manter metricas e blocos operacionais em superficie documental clara.
- `/properties/:id/systems`: manter cards de sistemas tecnicos como lista CRM, com status discretos e sombra leve.
- `/properties/:id/map`: manter pontos tecnicos legiveis, com risco visivel sem transformar os cards em blocos coloridos.
- `/properties/:id/services`: tratar ordens de servico como lista operacional, reduzindo aparencia de dashboard decorativo.
- `/settings`: manter `Aparencia` e `Previa visual` legiveis, com aviso experimental discreto.

## Evidencias visuais esperadas

Para cada tela obrigatoria, registrar prints ou observacoes nos tres temas:

- `Atual`
- `CRM premium`
- `CRM premium dark`

As evidencias devem cobrir desktop e mobile quando a tela tiver comportamento responsivo relevante. O objetivo nao e produzir uma galeria final de marketing, mas criar base objetiva para comparar clareza, densidade, contraste e percepcao premium em telas reais.

| Tela | Tema | Problema encontrado | Severidade | Acao recomendada |
| --- | --- | --- | --- | --- |
| `/dashboard` | Atual |  |  |  |
| `/dashboard` | CRM premium |  |  |  |
| `/dashboard` | CRM premium dark |  |  |  |
| `/properties` | Atual |  |  |  |
| `/properties` | CRM premium |  |  |  |
| `/properties` | CRM premium dark |  |  |  |
| `/properties/:id` | Atual |  |  |  |
| `/properties/:id` | CRM premium |  |  |  |
| `/properties/:id` | CRM premium dark |  |  |  |
| `/properties/:id/systems` | Atual |  |  |  |
| `/properties/:id/systems` | CRM premium |  |  |  |
| `/properties/:id/systems` | CRM premium dark |  |  |  |
| `/properties/:id/map` | Atual |  |  |  |
| `/properties/:id/map` | CRM premium |  |  |  |
| `/properties/:id/map` | CRM premium dark |  |  |  |
| `/properties/:id/services` | Atual |  |  |  |
| `/properties/:id/services` | CRM premium |  |  |  |
| `/properties/:id/services` | CRM premium dark |  |  |  |
| `/settings` | Atual |  |  |  |
| `/settings` | CRM premium |  |  |  |
| `/settings` | CRM premium dark |  |  |  |

Severidades permitidas:

- `baixa`: ajuste visual pequeno, sem impacto relevante no uso.
- `media`: afeta leitura, hierarquia ou percepcao, mas nao bloqueia fluxo.
- `alta`: prejudica fluxo importante, mobile ou tomada de decisao.
- `bloqueadora`: impede uso seguro, reduz contraste critico ou quebra componente.

## Checklist de contraste

Validar nos tres temas:

- Texto primario sobre fundo de pagina.
- Texto secundario em cards.
- Botoes primarios.
- Botoes secundarios.
- Badges de status.
- Inputs.
- Foco visivel.
- Menu inferior mobile.
- Dialogs e sheets.
- Estados desabilitados.

Criterios:

- Texto comum deve atingir contraste confortavel.
- Acoes principais devem ser claramente identificaveis.
- Status nao podem depender apenas de cor.
- Foco deve ser visivel em todos os temas.
- Elementos desabilitados devem parecer indisponiveis sem ficarem ilegiveis.
- Em mobile, navegacao inferior e acoes contextuais nao devem competir com o conteudo principal.

## Como capturar screenshots

1. Rodar o frontend local.
2. Abrir `/settings > Aparencia`.
3. Escolher o tema.
4. Navegar para cada tela obrigatoria.
5. Capturar desktop em largura `1440px`.
6. Capturar mobile em largura `390px`.
7. Salvar prints em pasta local nao versionada: `.review/crm-premium-theme/`.
8. Nao commitar prints por padrao.

Sugestao de nomenclatura:

- `.review/crm-premium-theme/dashboard-current-desktop.png`
- `.review/crm-premium-theme/dashboard-crm-premium-mobile.png`
- `.review/crm-premium-theme/property-systems-crm-premium-dark-desktop.png`

## Regras desta revisao visual

- Nao alterar codigo durante a captura de evidencias.
- Nao trocar o tema padrao.
- Nao alterar `tokens.css`.
- Nao promover `crm-premium` como tema global antes da decisao final.
- Ajustes pontuais de preview devem permanecer restritos a seletores como `[data-theme="crm-premium"]`.
- Documentar processo, achados e decisoes de revisao antes de promover qualquer identidade.
