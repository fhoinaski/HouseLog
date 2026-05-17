# 11 - Update Protocol

## Quando atualizar

Atualize esta pasta quando uma mudanca concluida alterar contexto de IA sobre:

- dominio;
- arquitetura;
- API ou contracts;
- banco;
- seguranca;
- frontend;
- backend;
- validacoes;
- workflow de agentes.

## Como atualizar

1. Atualize apenas o arquivo de mapa afetado.
2. Escreva em frases curtas.
3. Aponte para a fonte oficial em vez de duplicar conteudo longo.
4. Registre nomes reais de entidades, rotas, scripts e arquivos.
5. Remova informacao obsoleta quando ela puder induzir agente a erro.

## Limites

- Nao registrar secrets, tokens, URLs privadas, R2 keys ou dados reais.
- Nao transformar esta pasta em changelog detalhado.
- Nao copiar arquivos longos para ca.
- Nao usar esta pasta para decidir regra de negocio sem fonte oficial.

## Checklist de atualizacao

- O mapa continua curto?
- O agente consegue decidir qual arquivo abrir depois?
- O texto evita inferencia generica?
- Tenant isolation e security continuam explicitos?
- A validacao recomendada corresponde ao tipo de mudanca?

