# CREDENTIAL_ACCESS_POLICY.md - HouseLog

## 1. Objetivo

Este documento define a primeira politica explicita de acesso a credenciais do HouseLog.

Credenciais de imoveis premium incluem Wi-Fi, alarmes, fechaduras, portoes, aplicativos e outros acessos sensiveis. Elas fazem parte do prontuario tecnico do imovel, mas devem ser tratadas como segredos auditaveis, nao como campos comuns.

Esta politica e incremental. Ela documenta o comportamento atual e orienta os helpers do backend sem criar uma policy engine completa.

Referencias:

- `docs/SECURITY_REVIEW.md`
- `docs/TECH_DEBT_REGISTER.md`
- `docs/adr/ADR-004-credentials-are-auditable-secrets.md`
- `docs/adr/ADR-005-architecture-evolves-to-multi-tenant.md`
- `house-log-back/apps/api/src/lib/authorization.ts`
- `house-log-back/apps/api/src/routes/credentials.ts`

---

## 2. Principios

1. Credencial e segredo auditavel.
2. Listagem nunca deve retornar `secret`.
3. Revelacao deve ser acao explicita.
4. Revelacao deve ter regra mais restrita que acesso geral ao imovel.
5. Provider e temp_provider nao acessam credenciais por rotas de propriedade.
6. Auditoria nao deve registrar o valor do segredo.
7. A politica deve evoluir para tenant, organizacao e escopo por contexto operacional.

---

## 3. Modelo atual de acesso

### Acesso geral a propriedade

Usuario pode acessar metadados de credenciais quando `canAccessProperty` retorna true.

Hoje isso significa:

- owner do imovel;
- manager direto do imovel;
- colaborador registrado em `property_collaborators`;
- exclui `provider` e `temp_provider` nas rotas de propriedade.

### Acesso sensivel a segredo

Usuario pode revelar segredo quando `canRevealCredentialSecret` retorna true.

Hoje isso significa:

- owner do imovel;
- manager direto do imovel;
- exclui colaboradores comuns;
- exclui `provider` e `temp_provider`.

Esta restricao existe porque ainda nao ha `CredentialAccessPolicy` granular por usuario, papel contextual, OS, tenant ou motivo de revelacao.

---

## 4. Matriz inicial de permissoes

| Acao | Helper backend | Politica atual | Retorna `secret` | Auditoria |
| --- | --- | --- | --- | --- |
| Listar credenciais | `canListCredentials` | acesso geral a propriedade | Nao | Nao obrigatoria nesta etapa |
| Criar credencial | `canCreateCredential` | acesso geral a propriedade | Nao | Sim, `credential_created`, sem segredo |
| Editar credencial | `canUpdateCredential` | acesso geral a propriedade | Nao | Sim, `credential_updated`, sem segredo |
| Remover credencial | `canDeleteCredential` | acesso geral a propriedade | Nao | Sim, `credential_deleted`, sem segredo |
| Revelar segredo | `canRevealCredentialSecret` | owner ou manager direto | Sim | Sim, `secret_reveal` |
| Gerar acesso temporario | `canGenerateTemporaryCredentialAccess` | mesma regra de revelacao | Sim, uso interno para gerar PIN | Sim, `temporary_credential_access_generated`, sem PIN |

---

## 5. Contratos atuais preservados

### Listagem

`GET /properties/:propertyId/credentials`

Deve retornar metadados e `has_secret`, mas nao deve retornar `secret`.

### Criacao

`POST /properties/:propertyId/credentials`

Recebe `secret`, persiste a credencial e retorna DTO mascarado.

Deve auditar `credential_created` sem gravar `secret`, username, notas ou config de integracao.

### Edicao

`PUT /properties/:propertyId/credentials/:credId`

Pode atualizar `secret`, mas retorna DTO mascarado.

Deve auditar `credential_updated` sem gravar valor anterior ou novo do segredo. Quando `secret` for alterado, registrar apenas `secret_changed: true`.

### Remocao

`DELETE /properties/:propertyId/credentials/:credId`

Aplica soft delete.

Deve auditar `credential_deleted` sem gravar segredo ou payload sensivel.

### Revelacao

Preferencial:

`POST /properties/:propertyId/credentials/:credId/secret/reveal`

Legado temporario:

`GET /properties/:propertyId/credentials/:credId/secret`

O fluxo preferencial agora usa `POST`, porque revelar segredo e uma acao explicita, sensivel e auditavel. A rota `GET` permanece temporariamente por compatibilidade com consumidores legados durante a migracao e deve retornar headers de depreciacao.

Deve:

- exigir `canRevealCredentialSecret`;
- registrar auditoria;
- nunca gravar o segredo no audit payload;
- retornar `secret_revealed: true`.

Regra de migracao:

- novos consumidores devem usar `POST /secret/reveal`;
- consumidores existentes em `GET /secret` devem ser migrados antes da remocao;
- frontend atual usa `credentialsApi.revealSecret` com `POST /secret/reveal`; nao foram encontrados consumidores diretos de `GET /secret` em `house-log-front/src` nesta revisao;
- rota `GET /secret` permanece funcional, mas marcada com `Deprecation: true`, `Warning` e `Link` para o endpoint sucessor;
- a remocao da rota legada exige busca previa de consumidores, comunicacao de release e validacao de auditoria;
- corpo com motivo/contexto de revelacao ainda nao e obrigatorio nesta etapa, mas permanece como evolucao prevista.

### Acesso temporario

`POST /properties/:propertyId/credentials/:credId/generate-temp-code`

Usa a mesma politica de revelacao, porque precisa consultar o segredo/integracao da credencial para gerar acesso temporario.

---

## 6. O que esta politica ainda nao resolve

Esta versao nao implementa:

- policy engine completa;
- motivo obrigatorio de revelacao;
- escopo por OS;
- liberacao temporaria por prestador;
- regras por tenant ou organizacao;
- criptografia/rotacao de segredos;
- motivo/contexto obrigatorio para criar, editar, remover, revelar e gerar acesso temporario;
- revogacao granular de permissao de credencial.

Esses pontos permanecem no roadmap de Authorization Core, multi-tenant e governanca de credenciais.

---

## 7. Evolucao recomendada

1. Remover consumidores restantes da rota legada `GET /secret`.
2. Registrar motivo/contexto de revelacao.
3. Criar entidade futura `CredentialAccessPolicy`.
4. Diferenciar permissao de listar, criar, editar, remover, revelar, compartilhar e gerar acesso temporario.
5. Integrar policy a tenant/organization quando multi-tenant real for introduzido.
6. Evoluir auditoria para motivo/contexto operacional sem gravar valores sensiveis.
7. Avaliar criptografia forte e rotacao de segredos.

---

## 8. Regra operacional para agentes

Ao alterar credenciais:

- nao expor `secret` em listagens, cards, logs ou estados globais;
- usar helpers nomeados de `authorization.ts`;
- nao adicionar excecao por papel sem justificativa de dominio;
- nao permitir provider/temp_provider em rotas de propriedade para credenciais;
- preservar compatibilidade de contrato, salvo decisao explicita;
- atualizar este documento se a politica mudar.
