# Autenticacao e permissoes

Autenticacao usa JWT Bearer. O middleware `requireAuth` valida token e injeta `userId`, `userRole` e `userEmail` no contexto.

Middleware de tenant:

- `resolveTenant`: resolve tenant ativo por membership e opcionalmente `X-Tenant-Id`.
- `requireTenantRole`: restringe a acao por papel no tenant.
- `assertTenantAccess`: helper para validar membership sem confiar em input do client.

Papeis globais atuais:

- `admin`
- `owner`
- `provider`
- `temp_provider`

Papeis de tenant:

- `owner`
- `manager`
- `provider`
- `temp_provider`

Regras criticas:

- Owner acessa dados do tenant.
- Manager acessa conforme membership.
- Provider acessa apenas OS atribuida, bid ativa ou fluxo permitido.
- `temp_provider` deve ficar restrito a escopos temporarios.
- Admin nao deve bypassar tenant sem permissao explicita na rota.
