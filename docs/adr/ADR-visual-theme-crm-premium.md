# ADR: Direcao visual CRM premium

Status: Proposto

## Contexto

O HouseLog esta sendo reposicionado como memoria tecnica digital e prontuario tecnico premium de imoveis.

O tema atual comunica tecnologia, profundidade e operacao tecnica, mas pode parecer escuro e pesado para cliente final premium, construtoras, incorporadoras e gestao patrimonial.

O CRM premium claro foi criado como alternativa segura via `data-theme`, com preview reversivel em `/settings > Aparencia`, sem substituir The Architectural Lens e sem alterar o tema padrao do app.

## Decisao proposta

Validar o CRM premium em telas reais antes de promover qualquer tema como padrao.

Manter o tema atual como padrao ate decisao final.

Usar dados da revisao visual, screenshots e observacoes comparativas para decidir se o CRM premium deve virar o tema principal, seguir como opcao experimental ou ser ajustado antes de nova avaliacao.

## Consequencias

- Evita troca visual precipitada.
- Permite comparar temas com evidencia.
- Mantem estabilidade do produto.
- Preserva The Architectural Lens como base oficial enquanto a evolucao visual e validada.
- Pode exigir ajustes em componentes se tokens claros expuserem problemas de contraste, espacamento, densidade ou hierarquia.
- Pode revelar telas que precisam de composicao mais CRM, sem exigir redesign imediato.

## Criterios para aprovacao futura

- CRM premium deve vencer o tema atual em clareza, sensacao premium, sensacao CRM e legibilidade.
- Nao pode piorar fluxo mobile.
- Nao pode reduzir contraste.
- Nao pode deixar status menos compreensiveis.
- Nao pode quebrar componentes existentes.
- Deve preservar operacao eficiente em dashboard, imoveis, detalhe do imovel, sistemas tecnicos, mapa tecnico, servicos e configuracoes.
- Deve manter a troca reversivel ate a decisao final de produto.
