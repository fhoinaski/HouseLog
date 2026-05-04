# Guia para Agentes de IA no HouseLog

## Objetivo

Este documento orienta Codex, Claude, Cursor e outros agentes de IA a trabalhar no HouseLog sem quebrar arquitetura, seguranca, contratos ou isolamento multi-tenant.

O agente nunca deve tratar o HouseLog como projeto generico. O produto e um SaaS premium para governanca tecnica e operacional de imoveis.

## Leituras obrigatorias

Antes de tarefas grandes, sempre ler:

- `SYSTEM_CONTEXT.md`;
- `AGENTS.md`;
- `house-log-back/AGENTS.md` quando houver backend;
- `house-log-front/AGENTS.md` quando houver frontend;
- `docs/ARCHITECTURE.md`;
- `docs/SECURITY.md`;
- `docs/MULTI_TENANT_RULES.md`.

Tambem consultar `docs/ROADMAP.md` quando a tarefa envolver produto, priorizacao ou nova feature.

## Fluxo obrigatorio

1. Diagnosticar.
   - Ler arquivos reais.
   - Entender o fluxo atual.
   - Identificar contratos, rotas, schemas e consumidores.
   - Mapear riscos de seguranca, multi-tenant e regressao.

2. Planejar.
   - Listar arquivos a alterar.
   - Explicar o que sera preservado.
   - Justificar a menor solucao segura.
   - Separar backend, frontend, contracts e migrations quando aplicavel.

3. Implementar pequeno.
   - Fazer mudancas incrementais.
   - Evitar refatoracao ampla sem necessidade.
   - Nao misturar UI com backend fora do escopo.
   - Nao alterar contratos sem revisar consumidores.

4. Testar.
   - Rodar comandos obrigatorios.
   - Corrigir falhas relacionadas ao diff.
   - Reportar warnings preexistentes quando nao forem do escopo.

5. Relatar riscos.
   - Explicar limitacoes.
   - Indicar gaps de teste.
   - Recomendar proxima issue objetiva.

## Comandos obrigatorios

Antes de concluir uma task de codigo, rodar:

```bash
npm run type-check
npm run test:api
npm run lint
git diff --check
```

Para tarefas apenas de documentacao, `git diff --check` e o minimo obrigatorio, salvo pedido explicito de outros comandos.

## Regras para contratos

- `packages/contracts` e fonte compartilhada para schemas Zod e tipos.
- Nao duplicar schema sem justificativa.
- Nao aceitar campos server-only em input.
- Nao quebrar formato de response sem revisar frontend.
- Updates parciais devem preservar campos nao enviados.
- Enums devem ser explicitos.
- Payload invalido deve ser rejeitado por Zod.

Campos que nao devem ser aceitos do cliente:

- `tenantId`;
- `createdBy` quando derivado do usuario autenticado;
- `createdAt`;
- `updatedAt`;
- `deletedAt`;
- secrets;
- ciphertext;
- R2 keys privadas.

## Regras multi-tenant

- Nunca aceitar `tenantId` do cliente.
- Usar `authMiddleware` e `resolveTenant` em rotas privadas tenant-aware.
- Validar `tenantId + propertyId` em toda query sensivel.
- Usar `assertTenantPropertyAccess` ou `requireTenantPropertyAccess`.
- Validar vinculos com room, service order, document e inventory no mesmo tenant/property.
- Retornar 404 para registros fora do tenant, fora do property ou soft-deleted.
- `propertyCollaborators` nao pode liberar acesso cross-tenant.

## Regras de seguranca

Nunca expor:

- secrets;
- tokens;
- senhas;
- hashes;
- MFA secret;
- ciphertext;
- credenciais;
- R2 keys privadas;
- URLs publicas indevidas para midia privada.

Mutacoes criticas devem usar `writeAuditLog`. Dados sensiveis em audit log devem passar por `sanitizeAuditData` ou pelo padrao seguro existente.

## Regras de desenvolvimento

- Nao alterar backend quando o escopo for apenas frontend.
- Nao alterar frontend quando o escopo for apenas backend.
- Nao alterar migrations fora do escopo.
- Nao alterar `package.json` sem necessidade explicita.
- Nao inventar endpoints.
- Nao inventar entidades sem aderencia ao roadmap e ao dominio.
- Nao usar `any` por conveniencia.
- Nao esconder erro estrutural com workaround fragil.
- Preservar comportamento existente quando houver ambiguidade.

## Formato recomendado de resposta final

Para tarefas de implementacao, responder com:

1. Diagnostico.
2. Arquivos alterados.
3. Endpoints ou contratos criados/alterados.
4. Regras de autorizacao e seguranca.
5. Testes adicionados.
6. Validacoes executadas.
7. Riscos restantes.
8. Proxima issue recomendada.

Para tarefas apenas de documentacao, responder com:

1. Arquivos criados ou alterados.
2. Resumo de cada arquivo.
3. Validacao executada.
4. Riscos ou observacoes.
5. Proxima recomendacao.

## Exemplos de boas tasks

- Criar entidade tenant-aware com migration, schema Drizzle, contracts Zod, rota, audit log e testes.
- Revisar uma rota existente para garantir `tenantId + propertyId` em todas as queries.
- Adicionar client frontend para endpoint ja existente, respeitando contracts.
- Corrigir vazamento de key R2 privada em response.
- Adicionar teste para bloquear acesso cross-tenant.

## Exemplos de tasks ruins

- Criar tela que consome endpoint inexistente.
- Aceitar `tenantId` no payload para simplificar implementacao.
- Buscar registro sensivel apenas por `id`.
- Expor URL publica R2 para midia privada.
- Alterar shape de response sem revisar frontend.
- Misturar varias features grandes no mesmo diff.
- Criar regra de permissao paralela ignorando helpers existentes.
