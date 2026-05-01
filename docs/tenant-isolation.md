# Isolamento multi-tenant

HouseLog usa `tenants` como unidade SaaS e `tenant_members` como membership por usuario. O escopo operacional continua ancorado em `properties`, mas entidades sensiveis agora possuem `tenant_id` para permitir isolamento direto nas queries.

Regras:

- Nunca confiar em `tenant_id` enviado pelo client sem validar membership.
- Resolver tenant pelo usuario autenticado com `resolveTenant`.
- Usar `requireTenantRole` quando a acao depende de papel no tenant.
- Provider acessa OS apenas quando atribuido, quando possui bid ativa, ou em fluxo explicitamente permitido.
- Admin nao tem acesso amplo implicito em dados de cliente.
- Rotas publicas devem depender de token, expiracao e escopo minimo.

Estado atual: migration e middleware foram criados, mas as rotas ainda precisam ser migradas incrementalmente de isolamento por propriedade para isolamento por tenant.
