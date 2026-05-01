# UX do contexto do imovel

Este documento define a direcao de UX para o HouseLog como prontuario tecnico digital. Ele e estrategico e tecnico: orienta proximos commits sem exigir renomeacao de tabelas, migrations ou novos endpoints neste momento.

## Principio central

O imovel e o centro do sistema.

Ao entrar em `/properties/:id`, o usuario deve sair mentalmente da navegacao global e entrar no contexto daquele ativo. Todas as decisoes de interface devem reforcar que o HouseLog guarda a memoria tecnica do imovel: sistemas, pontos, ambientes, documentos, garantias, reformas, manutencoes, servicos, equipe e historico.

## Menu contextual mobile sugerido

Barra principal:

- Inicio: resumo tecnico e operacional do imovel.
- Mapa: planta, pontos tecnicos e localizacao de sistemas.
- Sistemas: sistemas tecnicos do imovel.
- Servicos: ordens aprovadas, em execucao ou concluidas.
- Mais: sheet com modulos secundarios e administrativos.

## Sheet Mais

Itens sugeridos:

- Orcamentos.
- Documentos.
- Ambientes.
- Equipe.
- Manutencao.
- Reformas.
- Inventario.
- Timeline.
- Financeiro.
- Relatorio.
- Garantias.
- Trocar imovel.
- Editar imovel.

## Definicoes operacionais

- `service_request` = pedido de orcamento.
- `bid` = proposta.
- `service_order` = servico aprovado/executado.
- `service_message` = conversa.
- `property_team_member` = prestador vinculado ao imovel.

## Separacao conceitual

### Orcamentos

Orcamentos representam a fase de compra/avaliacao. O usuario ainda esta pedindo propostas, comparando escopo e decidindo quem executa.

Entidade base:

- `service_request`
- `bid`

UX:

- Listar pedidos de orcamento.
- Mostrar propostas recebidas.
- Permitir aceitar uma proposta.
- Converter uma proposta aceita em `service_order` quando os campos tecnicos obrigatorios forem definidos.

### Servicos

Servicos representam a execucao ou historico de uma ordem aprovada.

Entidade base:

- `service_order`
- `service_message`

UX:

- Mostrar status operacional.
- Registrar evidencias.
- Conversar com prestador.
- Controlar checklist, garantias, custo, conclusao e verificacao.
- Alimentar timeline e historico tecnico.

### Equipe

Equipe representa prestadores vinculados ao imovel, recorrentes ou temporarios.

Entidade alvo:

- `property_team_member`

Enquanto a entidade dedicada nao existir, a UI pode reaproveitar:

- colaboradores do imovel;
- convites;
- links temporarios de OS;
- OS concluidas/verificadas com prestador atribuido.

## Fluxo premium esperado

1. O imovel nasce com documentos, ambientes e sistemas tecnicos.
2. Pontos tecnicos registram localizacoes criticas.
3. Garantias e manuais ficam conectados aos sistemas.
4. Reformas e manutencoes alimentam a memoria tecnica.
5. `service_request` coleta propostas.
6. `bid` aprovado vira `service_order`.
7. `service_order` registra execucao, evidencias e conversa.
8. Prestadores relevantes alimentam a equipe e o historico do imovel.

## Modulos futuros no contexto do imovel

### Mapa

Deve exibir plantas, fotos de referencia e pontos tecnicos. Deve ser tratado como modulo sensivel, pois revela infraestrutura do imovel.

Relação implementada:

- `technical_systems` organiza os sistemas técnicos do imóvel.
- `technical_points` localiza pontos críticos ou operacionais dentro do imóvel.
- O mapa técnico usa `technical_points` como primeira camada real, permitindo vincular cada ponto a um sistema técnico e/ou ambiente quando houver contexto cadastrado.

### Sistemas

Deve organizar eletrica, hidraulica, automacao, impermeabilizacao, climatizacao, seguranca e demais sistemas.

### Reformas

Deve agrupar intervencoes maiores, conectando documentos, fotos, garantias, custos, prestadores e sistemas afetados.

### Garantias

Deve controlar garantias de sistemas, materiais, servicos, equipamentos e reformas, com alertas e documentos vinculados.

## Regra de navegacao

O menu contextual deve aparecer somente dentro do contexto de um imovel:

- `/properties/:id`
- subrotas tecnicas e operacionais desse imovel

Nao deve aparecer em:

- `/properties`
- `/properties/new`
- `/dashboard`
- `/provider/*`
- `/settings`

## PropertySwitcher

O seletor de imovel deve permitir trocar o ativo mantendo o modulo atual quando possivel:

- `/properties/A/services` para B vira `/properties/B/services`.
- `/properties/A/documents` para B vira `/properties/B/documents`.
- `/properties/A` para B vira `/properties/B`.

## Busca contextual

A busca dentro do imovel deve priorizar resultados vinculados ao `propertyId`.

Categorias esperadas:

- Servicos.
- Orcamentos.
- Documentos.
- Ambientes.
- Inventario.
- Manutencao.
- Prestadores.
- Timeline.
- Sistemas.
- Pontos tecnicos.
- Reformas.
- Garantias.

## Diretriz de implementacao

Nenhuma tela deve inventar endpoint ou payload. Quando o contrato nao existir:

- criar estado vazio seguro;
- documentar TODO tecnico;
- manter acao desabilitada;
- evoluir backend e frontend juntos em commit posterior.
