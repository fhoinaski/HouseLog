# UX do contexto de imovel

Este documento registra a organizacao de produto para o modo imovel do HouseLog.

## Definicoes

- `service_request` = pedido de orcamento.
- `bid` = proposta do prestador.
- `service_order` = servico aprovado/executado.
- `service_message` = conversa.
- `property_team_member` = prestador vinculado ao imovel.

## Fluxo operacional

O fluxo esperado e:

1. O gestor cria um `service_request` quando precisa pedir orcamento.
2. Prestadores respondem com `bid`.
3. Uma proposta aprovada gera ou referencia uma `service_order`.
4. A `service_order` concentra execucao, evidencias, status e `service_message`.
5. Prestadores recorrentes devem ser tratados como `property_team_member` quando houver contrato dedicado.

## Navegacao contextual

Dentro de `/properties/:id` e subrotas do imovel, a navegacao inferior mobile deve substituir a navegacao global por:

- Inicio: `/properties/:id`
- Servicos: `/properties/:id/services`
- Orcamentos: `/properties/:id/service-requests`
- Equipe: `/properties/:id/team`
- Mais: sheet com troca de imovel e modulos secundarios.

O menu contextual nao aparece em `/properties`, `/properties/new`, `/dashboard`, `/provider/*` ou `/settings`.

## PropertySwitcher

O `PropertySwitcher` mostra o imovel atual, abre uma busca client-side em cima de `propertiesApi.list` e troca o imovel preservando o modulo atual quando possivel.

Exemplos:

- `/properties/A/services` para imovel B vira `/properties/B/services`.
- `/properties/A/documents` para imovel B vira `/properties/B/documents`.
- `/properties/A` para imovel B vira `/properties/B`.

## Busca contextual

A busca contextual usa o endpoint existente de search com `propertyId` quando disponivel no cliente (`searchApi.search(q, propertyId)`). Ela deve permanecer limitada ao contexto do imovel e nao criar endpoints paralelos.

Categorias esperadas no produto:

- Servicos
- Orcamentos
- Documentos
- Ambientes
- Inventario
- Manutencao
- Prestadores
- Timeline

Hoje o contrato tipado do frontend cobre servicos, documentos, inventario e manutencao. As demais categorias dependem de ampliacao explicita do contrato de search.

## Servicos versus orcamentos

`/properties/:id/services` deve listar `service_order` como Servicos: ordens aprovadas, em execucao, concluidas ou em garantia.

`/properties/:id/service-requests` deve listar `service_request` como Orcamentos: solicitacoes enviadas para prestadores e propostas recebidas. A tela inicial existe, mas a listagem real deve aguardar contrato GET com propostas agregadas para evitar payload inventado.

## Equipe do imovel

`/properties/:id/team` deve concentrar prestadores vinculados ao imovel:

- prestadores fixos;
- prestadores temporarios;
- convites pendentes;
- historico de prestadores que ja executaram servico.

Enquanto nao houver endpoint especifico para `property_team_member`, a UI deve reaproveitar contratos reais de colaboradores/convites e marcar como TODO os blocos que dependem de contrato.

## Sugestao pos-servico

Na tela de detalhe de servico concluido/verificado, owner/admin pode ver a sugestao para adicionar o prestador atribuido a equipe do imovel. Os botoes permanecem desabilitados ate existir contrato real para vinculo fixo ou temporario.
