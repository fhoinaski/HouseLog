# 10 - AI Workflow

## Fluxo curto

1. Identifique dominio afetado.
2. Leia `AGENTS.md` e o `AGENTS.md` mais proximo se houver frontend/backend.
3. Busque por identificador especifico.
4. Abra apenas arquivos diretamente relacionados.
5. Confirme contracts e consumidores quando payload mudar.
6. Planeje a menor mudanca segura.
7. Edite somente o escopo pedido.
8. Rode validacao relevante.
9. Responda com arquivos, mudancas, validacoes e riscos.

## Antes de editar

Declare brevemente:

- causa ou raiz do problema;
- arquivos que serao tocados;
- teste ou validacao que sera executado.

## Quando parar e confirmar

- A tarefa exige endpoint ou entidade nova nao documentada.
- Ha conflito entre docs, contracts e codigo.
- A mudanca exige migration nao solicitada.
- O escopo cruza muitas fronteiras sem necessidade clara.
- Uma correcao segura exigiria alterar contrato publico.

## O que nunca fazer

- Ler o projeto inteiro por curiosidade.
- Refatorar fora do escopo.
- Alterar frontend e backend juntos sem necessidade.
- Criar fluxo UI sem backend real.
- Criar backend sem consumidor/contrato quando a tarefa pede frontend.
- Substituir regra de seguranca por checagem visual.

