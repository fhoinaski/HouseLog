# Seguranca do HouseLog

## Principios

Seguranca e requisito estrutural do HouseLog. O produto lida com imoveis premium, historico tecnico, documentos, credenciais, anexos, fornecedores e dados operacionais sensiveis. Toda alteracao deve reduzir risco de vazamento, acesso indevido e perda de rastreabilidade.

Principios obrigatorios:

- negar por padrao;
- validar input externo;
- autorizar por usuario, papel, tenant e propriedade;
- nunca confiar em dados de contexto enviados pelo cliente;
- minimizar dados em responses;
- nao expor secrets, tokens, ciphertext ou keys privadas;
- registrar auditoria em acoes criticas;
- preservar isolamento multi-tenant.

## Credenciais criptografadas

Credenciais e segredos nunca devem ser armazenados em texto claro. O backend deve persistir apenas representacoes criptografadas, hashes ou metadados seguros, conforme o fluxo existente.

Nunca retornar em response:

- senha;
- hash de senha;
- refresh token hash;
- MFA secret;
- ciphertext de credencial;
- segredo original;
- token sensivel;
- chave privada de integracao.

Audit logs e logs operacionais tambem nao devem registrar esses valores.

## Midia privada e R2

Arquivos privados em R2 nao podem ser expostos por key bruta, URL publica indevida ou path interno. O padrao seguro e servir midia privada por endpoint autenticado e autorizado.

Regras:

- nao aceitar key R2 privada bruta em payload publico;
- nao retornar key R2 privada em response;
- nao aceitar URL publica R2 para categoria privada;
- validar escopo de tenant/propriedade/documento quando midia estiver associada a entidade de dominio;
- nunca assumir que uma URL externa e segura quando ela representa storage privado do HouseLog.

Novas features sem upload devem aceitar somente referencias permitidas pelo padrao atual, como endpoints autenticados internos ou URLs explicitamente validas e nao privadas.

## CORS seguro em producao

Em producao, CORS deve usar origins explicitas. Nao usar `*` com credenciais.

Regras:

- `CORS_ORIGINS=*` nao deve abrir credenciais em producao;
- origins locais devem ser permitidas apenas em desenvolvimento;
- ausencia de configuracao segura em producao deve falhar de forma fechada;
- rotas autenticadas nao devem depender de CORS como mecanismo de autorizacao.

## Audit log

Acoes criticas devem chamar `writeAuditLog`, incluindo:

- criacao, update e delete de entidades relevantes;
- mudancas de status;
- alteracoes de permissao;
- acesso ou modificacao de credenciais;
- eventos de compartilhamento/token;
- acoes administrativas.

O audit log deve incluir `tenantId` e `propertyId` sempre que aplicavel. Dados sensiveis devem ser sanitizados com `sanitizeAuditData`.

## Protecao contra vazamento cross-tenant

Toda rota privada deve impedir acesso cruzado entre tenants. O padrao e:

- resolver tenant no backend com `resolveTenant`;
- validar o imovel por `tenantId + propertyId`;
- filtrar queries por `tenant_id`;
- validar que entidades relacionadas pertencem ao mesmo tenant e, quando aplicavel, ao mesmo property;
- retornar 404 para registros fora do escopo.

Nao use apenas `id` como criterio de busca para entidade sensivel.

## Dados sensiveis

Dados sensiveis incluem:

- credenciais;
- tokens;
- secrets;
- ciphertext;
- chaves R2;
- dados financeiros;
- documentos privados;
- anexos privados;
- logs com payload de autenticacao;
- dados pessoais desnecessarios ao fluxo atual.

Antes de registrar, retornar ou enviar dados, confirme se o consumidor precisa daquele campo.

## Rotas publicas e tokenizadas

Rotas publicas ou baseadas em token devem:

- validar token;
- validar expiracao;
- validar escopo minimo;
- evitar retorno de dados internos;
- nao permitir enumeracao;
- nao liberar acesso cross-tenant;
- registrar auditoria quando houver impacto operacional.

Token publico nao substitui tenant, propriedade e escopo de entidade.

## O que nunca fazer

- Nunca aceitar `tenantId` do cliente como fonte de verdade.
- Nunca buscar entidade sensivel apenas por `id`.
- Nunca expor senha, hash, token, secret, ciphertext ou key R2 privada.
- Nunca logar payload sensivel sem sanitizacao.
- Nunca criar rota publica para midia privada sem autorizacao.
- Nunca usar CORS permissivo como solucao de autenticacao.
- Nunca retornar dados de outro tenant como erro de permissao detalhado.
- Nunca criar regra de autorizacao paralela ignorando helpers existentes.

## Checklist de seguranca antes de concluir uma task

- A rota usa `authMiddleware` quando privada?
- O tenant e resolvido com `resolveTenant`?
- Toda query sensivel filtra `tenantId` e `propertyId` quando aplicavel?
- Vínculos com room, service order, document e inventory validam mesmo tenant/property?
- O payload rejeita `tenantId` e campos server-only?
- Secrets, ciphertext, tokens e R2 keys privadas estao fora de responses e logs?
- Mutacoes criticas usam `writeAuditLog`?
- Audit payload foi sanitizado com `sanitizeAuditData` quando necessario?
- Soft delete foi considerado para historico tecnico?
- `npm run type-check`, `npm run test:api`, `npm run lint` e `git diff --check` passam?
