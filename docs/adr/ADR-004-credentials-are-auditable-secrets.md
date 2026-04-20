# ADR-004 - Credenciais sao segredos auditaveis

## Status

Aceito.

## Contexto

Credenciais de imoveis incluem Wi-Fi, alarmes, portoes, fechaduras, aplicativos e outros acessos sensiveis.

Esses dados nao podem ser tratados como texto comum de UI nem retornados por padrao em DTOs de listagem.

O backend ja iniciou endurecimento incremental para nao retornar `secret` por padrao e para usar revelacao explicita auditada.

## Decisao

Credenciais do HouseLog sao segredos auditaveis.

O contrato padrao deve:
- omitir `secret`;
- indicar apenas `has_secret`;
- retornar metadados operacionais nao sensiveis.

A revelacao deve:
- ser acao explicita;
- ser autorizada por regra mais restrita que acesso geral a propriedade;
- registrar auditoria;
- nunca gravar o segredo em audit log;
- preparar caminho para criptografia, rotacao e politicas granulares.

## Consequencias

### Positivas
- reduz vazamento acidental;
- melhora postura de seguranca;
- prepara UX sensivel;
- cria base para governanca premium;
- diferencia listagem de revelacao.

### Custos
- frontend precisa lidar com estado mascarado;
- consumidores antigos que dependiam de `secret` em listagem precisam migrar;
- revelacao ainda exige evolucao futura para policy mais granular e criptografia.

## Impacto no codigo atual

O modulo de credenciais deve manter:
- DTO padrao sem `secret`;
- endpoint explicito de revelacao;
- auditoria de `secret_reveal`;
- componente frontend para informacao sensivel.

Futuras etapas devem avaliar:
- migrar revelacao de GET para POST;
- criptografar segredos em repouso;
- registrar motivo de revelacao;
- criar CredentialAccessPolicy;
- limitar copia e compartilhamento por papel/contexto.

## Regra para o Codex

O Codex nao deve expor segredo em listagens, cards, logs, estados globais ou audit payloads. Toda revelacao deve ser explicita e auditavel.

