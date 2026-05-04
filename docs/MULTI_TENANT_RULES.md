# Regras Multi-Tenant do HouseLog

## Regra central

Toda entidade de dominio do HouseLog deve ter `tenant_id`. O tenant e a unidade SaaS de isolamento e nao pode ser inferido apenas por ID de usuario, ID de propriedade ou relacionamento indireto.

Entidades ligadas ao prontuario ou operacao de um imovel tambem devem ter `property_id`.

## Query sensivel exige tenant e propriedade

Toda query sensivel deve validar `tenantId + propertyId` quando a entidade pertence a um imovel.

Padrao correto:

- resolver tenant no backend;
- validar acesso ao property dentro do tenant;
- buscar/listar/mutar entidade com filtro por `tenant_id` e `property_id`;
- retornar 404 quando a entidade nao estiver no escopo.

Padrao incorreto:

- buscar por `id` e depois tentar filtrar em memoria;
- confiar em `propertyId` sem tenant;
- confiar em `tenantId` enviado pelo cliente;
- liberar acesso por colaborador sem validar tenant.

## Nunca aceitar `tenantId` do cliente

O cliente nao e fonte de verdade para tenant. Payloads de create/update nao devem aceitar `tenantId`.

O backend deve preencher `tenantId` usando o tenant resolvido por `resolveTenant`.

## Uso obrigatorio de `resolveTenant`

Rotas tenant-aware devem usar `resolveTenant` depois de `authMiddleware`. Esse helper define o tenant efetivo do usuario autenticado e deve ser a base para queries, criacao de registros e audit logs.

Se a rota precisa operar sobre um imovel, o tenant resolvido deve ser combinado com validacao de `propertyId`.

## `assertTenantPropertyAccess` e `requireTenantPropertyAccess`

Use os helpers existentes para validar acesso ao imovel:

- `assertTenantPropertyAccess`: quando a rota precisa verificar acesso e tratar retorno/erro no proprio fluxo.
- `requireTenantPropertyAccess`: quando a rota deve bloquear imediatamente se nao houver acesso.

Esses helpers evitam duplicacao de regra e reduzem risco de acesso cross-tenant.

## Validacao de vinculos

Quando uma entidade referencia outras entidades, cada vinculo deve pertencer ao mesmo `tenantId` e, quando aplicavel, ao mesmo `propertyId`.

Validar explicitamente:

- `roomId`: room deve pertencer ao mesmo tenant/property.
- `serviceOrderId`: ordem de servico deve pertencer ao mesmo tenant/property.
- `documentId`: documento deve pertencer ao mesmo tenant/property.
- `inventoryItemId`: item de inventario deve pertencer ao mesmo tenant/property.

Para entidades com soft delete, referencias a registros deletados devem ser bloqueadas salvo regra documentada em contrario.

## Dados legados com `tenant_id = null`

Dados legados com `tenant_id = null` devem ser tratados como risco de migracao, nao como acesso universal.

Regras:

- nao criar novos registros com `tenant_id = null`;
- nao usar `tenant_id = null` como fallback automatico em rotas privadas;
- migrar dados legados de forma controlada quando houver contexto confiavel;
- quando nao houver contexto confiavel, bloquear acesso e documentar pendencia.

## Padrao de criacao

Create deve:

- usar `authMiddleware`;
- resolver tenant com `resolveTenant`;
- validar `propertyId` dentro do tenant;
- rejeitar `tenantId` no payload;
- validar references no mesmo tenant/property;
- preencher `tenantId`, `propertyId`, `createdBy` e timestamps no servidor;
- registrar audit log quando a entidade for relevante.

## Padrao de listagem

List deve:

- validar acesso ao property;
- filtrar por `tenant_id`;
- filtrar por `property_id`;
- ignorar registros com `deleted_at IS NOT NULL`;
- aplicar filtros permitidos pelo contract;
- nao retornar dados sensiveis.

## Padrao de leitura

Get by ID deve:

- validar tenant e property;
- buscar por `id + tenant_id + property_id`;
- filtrar `deleted_at IS NULL` quando houver soft delete;
- retornar 404 para registros de outro tenant, outro property ou deletados.

## Padrao de update

Update deve:

- validar tenant e property;
- buscar registro existente por `id + tenant_id + property_id`;
- bloquear update de registro soft-deleted;
- validar cada novo vinculo informado;
- preservar campos nao enviados;
- nao permitir alteracao de `tenantId`;
- registrar audit log.

## Padrao de delete

Delete deve:

- validar tenant e property;
- buscar registro por `id + tenant_id + property_id`;
- preferir soft delete para historico tecnico;
- setar `deleted_at` e `updated_at` no soft delete;
- registrar audit log;
- retornar 404 para registros fora do escopo.

## Checklist multi-tenant para novas features

- A tabela tem `tenant_id`?
- A tabela tem `property_id` quando pertence a um imovel?
- O payload rejeita `tenantId`?
- A rota usa `authMiddleware` e `resolveTenant`?
- A rota valida acesso ao property?
- Toda query sensivel filtra `tenant_id`?
- Get/update/delete filtram `tenant_id + property_id + id`?
- Vinculos com room/service order/document/inventory sao validados?
- Dados soft-deleted ficam fora de list/get/update?
- Audit log inclui `tenantId` e `propertyId`?
- Testes cobrem acesso cross-tenant?
