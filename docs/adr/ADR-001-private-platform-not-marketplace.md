# ADR-001 - HouseLog e plataforma privada, nao marketplace aberto

## Status

Aceito.

## Contexto

O HouseLog possui fluxos com prestadores, oportunidades, propostas e historico de servicos. Esses elementos poderiam ser confundidos com um marketplace aberto.

Essa interpretacao e estrategicamente incorreta para o produto.

O posicionamento oficial define o HouseLog como plataforma privada de gestao tecnica, manutencao e confianca para imoveis premium, com rede curada de prestadores homologados.

## Decisao

O HouseLog nao sera tratado como marketplace aberto.

Toda evolucao de produto, arquitetura, UX, copy e backend deve reforcar:
- plataforma privada;
- operacao premium;
- governanca;
- confianca;
- rede homologada;
- rastreabilidade.

Termos como marketplace, oportunidades abertas e diretorio publico de prestadores devem ser considerados legado ou transicionais quando aparecerem no codigo atual.

## Consequencias

### Positivas
- reduz ambiguidade estrategica;
- orienta refatoracao do provider portal;
- evita abertura prematura da rede;
- reforca valor premium e privado;
- cria criterio para rejeitar features desalinhadas.

### Custos
- alguns nomes atuais de rotas, arquivos e APIs podem permanecer desalinhados por compatibilidade;
- sera necessario migrar linguagem de produto gradualmente;
- provider discovery deve ser redesenhado como rede homologada, nao catalogo aberto.

## Impacto no codigo atual

Nao exige mudanca imediata de codigo.

Futuras refatoracoes devem revisar:
- rotas e tipos relacionados a `marketplace`;
- provider opportunities;
- copy do frontend;
- filtros de elegibilidade de prestadores;
- autorizacao contextual por organizacao/propriedade.

## Regra para o Codex

Ao trabalhar no HouseLog, o Codex deve rejeitar solucoes que transformem a rede de prestadores em marketplace aberto sem decisao explicita posterior.
