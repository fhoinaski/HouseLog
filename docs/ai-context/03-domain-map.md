# 03 - Domain Map

## Entidades centrais

- Tenants e membros: `tenants`, `tenant_members`.
- Usuarios: `users`.
- Imoveis: `properties`.
- Ambientes e inventario: `rooms`, `inventory_items`.
- Operacao: `service_orders`, `service_requests`, `service_bids`, `service_messages`, `bids`.
- Documentos e evidencias: `documents`, fotos, anexos, R2.
- Financeiro: `expenses`, cobrancas Pix, NFe quando aplicavel.
- Manutencao: `maintenance_schedules`.
- Credenciais: `property_access_credentials`.
- Handover: `handover_packages`, `handover_checklist_items`.
- Prontuario tecnico: `technical_systems`, `technical_points`, `warranties`, `renovations`.
- Governanca: `audit_log`, `audit_links`, links de compartilhamento.

## Relacoes obrigatorias

Entidades de dominio devem ter `tenant_id`. Entidades ligadas a um imovel tambem devem ter `property_id`.

Para recursos aninhados, valide a cadeia completa quando existir:

- tenant;
- property;
- room;
- service order;
- document;
- credential;
- inventory item.

## Operacao principal

Service orders conectam solicitacoes, prestadores, bids, mensagens, documentos, evidencias, despesas e historico tecnico. Nao trate OS como modulo isolado.

## Areas sensiveis

Credenciais, documentos privados, midia R2, tokens publicos, handover, audit links, dados financeiros, historico tecnico e infraestrutura do imovel.

## Fonte para detalhes

Use `docs/domain-model-premium.md` e confirme implementacao real em contracts, schema, rotas e UI especificos.

