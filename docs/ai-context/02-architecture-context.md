# 02 - Architecture Context

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind, SWR.
- Backend: Cloudflare Workers, Hono, TypeScript.
- Banco: Cloudflare D1/SQLite com Drizzle.
- Storage: Cloudflare R2.
- Contratos: Zod e tipos compartilhados em `packages/contracts`.
- Auth: JWT, refresh token HttpOnly e MFA.
- Auditoria: `writeAuditLog` com sanitizacao.

## Diretorios principais

- `house-log-front`: aplicacao web/PWA, UI, API client e experiencia por papel.
- `house-log-back`: API, rotas, middleware, schema Drizzle, migrations, helpers e testes.
- `packages/contracts`: schemas e tipos compartilhados entre frontend e backend.
- `docs`: arquitetura, seguranca, roadmap, auditoria e guias.

## Fluxo de request privado

1. Frontend chama API via client.
2. Rota Hono recebe a requisicao.
3. `authMiddleware` valida autenticacao.
4. `resolveTenant` define tenant efetivo.
5. Zod valida params, query e body.
6. Autorizacao valida papel, tenant, property e recurso.
7. Query filtra por tenant e property quando aplicavel.
8. Mutacao sensivel grava audit log.
9. Response retorna apenas dados permitidos.

## Fronteiras

- Identity and Access.
- Organization and Tenant.
- Property Operating System.
- Service Operations.
- Provider Network.
- Credentials and Sensitive Access.
- Audit and Governance.
- Documents and Evidence.
- Frontend Product Shell.

## Deploy Cloudflare

Production deve permanecer bloqueado enquanto D1/KV usarem placeholders em
`wrangler.toml`. Antes de deploy production, siga
`docs/deploy/CLOUDFLARE_DEPLOY_CHECKLIST.md` e rode
`npm run check:deploy-config:prod`.

## Regra de mudanca

Se uma tarefa atravessa fronteiras, identifique ownership, contrato, autorizacao, auditoria, impacto frontend e teste antes de editar.
