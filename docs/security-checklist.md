# Checklist de seguranca

- CORS nao deve usar `*` quando `credentials: true`.
- Produção deve configurar origins explicitas em `CORS_ORIGINS` ou `CORS_ORIGIN`.
- Localhost so deve ser liberado fora de `production`.
- Rotas autenticadas devem validar usuario, papel e contexto.
- Queries sensiveis devem filtrar por `tenant_id` ou por propriedade validada.
- Uploads devem validar MIME e tamanho.
- Logs nao devem incluir senha, token, segredo, chave PIX sensivel, credenciais de acesso ou anexos privados.
- Links publicos de audit/share devem validar token, expiracao e escopo.
- Respostas nao devem expor `password_hash`, MFA secret, refresh token hash ou segredo de credencial sem permissao explicita.

Pendencias conhecidas:

- Migrar todas as rotas sensiveis para `resolveTenant`.
- Revisar logs com `console.error` em rotas de notificacao.
- Revisar exposicao publica de midia servida por `/api/v1/media/*`.

Notas CORS:

- `CORS_ORIGINS=*` deve ser ignorado/bloqueado, nunca refletido em production.
- `CORS_ORIGINS` vazio em production deve falhar fechado.
