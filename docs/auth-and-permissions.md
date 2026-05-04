# Autenticacao e permissoes

Autenticacao usa JWT Bearer. O middleware `requireAuth` valida token e injeta `userId`, `userRole` e `userEmail` no contexto.

Middleware de tenant:

- `resolveTenant`: resolve tenant ativo por membership e opcionalmente `X-Tenant-Id`.
- `requireTenantRole`: restringe a acao por papel no tenant.
- `assertTenantAccess`: helper para validar membership sem confiar em input do client.
- `canAccessTenantProperty` / `assertPropertyAccess` com `tenantId` e `tenantRole`: autoridade central para validar `tenantId + tenant_members + property`.

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

## Matriz tenant-aware inicial

| Papel | Acesso ao tenant | Acesso ao imovel | Mutacao no imovel | Segredos | Provider/OS |
|---|---|---|---|---|---|
| admin | Somente com membership ativa | Sem bypass silencioso; segue papel no tenant | Somente quando papel do tenant permite | Somente se tenant owner ou relacao direta owner/manager do imovel | Nao substitui provider |
| tenant owner | Todos os imoveis do tenant ativo | Permitido | Permitido | Permitido | Pode gerir OS do tenant |
| tenant manager | Imoveis do tenant ativo | Permitido | Permitido | Nao revela segredo por padrao, salvo relacao direta no imovel | Pode gerir OS conforme fluxo |
| provider | Membership nao concede dashboard de imovel | Bloqueado por ID direto | Bloqueado | Bloqueado | Acessa apenas OS atribuida, bid ativa ou oportunidade permitida |
| temp_provider | Membership temporaria nao concede dashboard | Bloqueado por ID direto | Bloqueado | Bloqueado | Apenas escopo temporario explicitamente validado |
| propertyCollaborator | Compatibilidade controlada | Permitido apenas se `tenant_id` do collaborator bater com tenant ativo | `manager` pode gerir; `provider` so abre OS se `can_open_os=1` | Bloqueado | Nunca abre acesso cross-tenant |

## Regra de compatibilidade legada

`propertyCollaborators` continua suportado para nao quebrar fluxos existentes, mas deixou de ser autoridade isolada: o registro precisa estar no mesmo `tenantId` ativo do usuario e o imovel tambem precisa pertencer ao mesmo tenant. Registros legados sem `tenant_id` nao devem abrir acesso em rotas tenant-aware; eles precisam de backfill seguro antes de serem reativados.
