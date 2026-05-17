# 01 - Product Context

## Produto

HouseLog e um SaaS privado para gestao tecnica e operacional de imoveis premium. O produto organiza manutencao, ordens de servico, documentos, despesas, fornecedores, credenciais, handover, diagnosticos, garantias e historico tecnico.

Nao e marketplace aberto. A rede de prestadores e privada, curada e governada.

## Usuarios e papeis

- `owner`: proprietario ou responsavel principal pelo imovel.
- `manager`: gestor, administradora ou equipe operacional.
- `provider`: prestador homologado ou participante da operacao.
- `temp_provider`: prestador com acesso temporario e escopo limitado.

## Eixo do produto

O imovel e o centro do contexto. Ordens de servico sao o nucleo operacional. Documentos, mensagens, bids, despesas, credenciais, fotos, relatorios e garantias orbitam esse contexto.

## Promessas que nao podem quebrar

- Isolamento por tenant.
- Escopo por imovel.
- Autorizacao por papel e recurso.
- Rastreabilidade por audit log em acoes sensiveis.
- Midia e documentos privados por padrao.
- Credenciais tratadas como segredos auditaveis.

## Linguagem de produto

Use termos de operacao tecnica, prontuario do imovel, governanca, manutencao e historico. Evite linguagem de marketplace aberto, catalogo publico ou fluxo generico de CRUD.

