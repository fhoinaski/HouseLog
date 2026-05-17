# AI Context - HouseLog

Camada curta de contexto para agentes de IA no HouseLog.

Use estes arquivos para reduzir leitura de tokens, navegar o projeto com seguranca e evitar inferencias sem base no codigo ou na documentacao oficial.

## Como usar

1. Comece por `00-index.md`.
2. Leia apenas o mapa relacionado a tarefa.
3. Quando for editar codigo, consulte o `AGENTS.md` mais proximo.
4. Para comportamento real, confirme em contracts, rotas, schema ou consumidor direto.

## Regras

- Esta pasta nao substitui `AGENTS.md`.
- Esta pasta nao cria regras de negocio.
- Esta pasta nao autoriza novos endpoints, entidades ou payloads.
- Tenant isolation, autenticacao, autorizacao, escopo por imovel e auditoria continuam obrigatorios.

