# ADR-003 - Provider Network e rede curada homologada

## Status

Aceito.

## Contexto

O HouseLog possui provider portal, provider profile, bids e provider opportunities. O estado atual contem elementos que podem sugerir uma rede aberta.

Para o publico-alvo premium, prestadores devem ser tratados como rede homologada, curada e controlada.

## Decisao

Prestadores no HouseLog fazem parte de uma Provider Network curada.

A rede deve evoluir para suportar:
- convite;
- onboarding;
- revisao;
- homologacao;
- escopo de atuacao;
- aprovacao por organizacao;
- suspensao e revogacao;
- auditoria de decisoes relevantes.

O prestador nao deve ter acesso amplo por ser provider. O acesso deve depender de elegibilidade, atribuicao, escopo, propriedade, OS ou organizacao.

## Consequencias

### Positivas
- reforca confianca;
- evita dinamica de marketplace comum;
- permite controle por cliente/organizacao;
- melhora governanca de acesso;
- cria base para operacao premium.

### Custos
- provider opportunities precisarao de filtros mais restritos;
- rotas com nome marketplace podem permanecer por compatibilidade, mas devem ser tratadas como legado;
- sera necessario criar entidades de homologacao e escopo no futuro.

## Impacto no codigo atual

Nao exige remocao imediata das rotas atuais.

Futuras refatoracoes devem revisar:
- `/provider/opportunities`;
- `/marketplace`;
- provider profile;
- bids;
- service assignment;
- permission checks para provider.

## Regra para o Codex

O Codex nao deve criar fluxos de prestador aberto, ranking publico ou catalogo irrestrito. Qualquer tela de prestador deve preservar a ideia de rede privada homologada.

