# 09 - Testing Guide

## Regra geral

Rode apenas validacoes relevantes ao diff. Para documentacao, `git diff --check` e o minimo.

## Scripts raiz

- `npm run type-check`: frontend e API.
- `npm run test`: testes da API.
- `npm run test:api`: testes da API.
- `npm run lint`: lint frontend.
- `npm run build`: build frontend.
- `npm run check`: type-check, test e lint.
- `npm run check:encoding`: checagem de encoding.
- `npm run check:deploy-config`: config de deploy.

## Frontend

No pacote `house-log-front`:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

Testes recentes de auth/sessao incluem `src/__tests__/session.test.ts`, cobrindo cooldown de refresh e reset ao estabelecer nova sessao.

Use e2e apenas quando o fluxo visual/navegacao justificar.

## Backend

No pacote `house-log-back/apps/api`:

- `npm run type-check`
- `npm run test`
- `npm run build`
- `npm run db:check`

Use `db:check` quando schema/migration estiver no escopo.

Testes recentes de auth/sessao incluem `src/routes/auth-session.test.ts`, cobrindo cookie HttpOnly, `activeTenantId` no payload de sessao e bootstrap de tenant no primeiro acesso.

## Testes que IA deve procurar

- Cross-tenant access.
- Resource-level authorization.
- Payload sem `tenantId`.
- Secrets fora de response/log/audit.
- Public token expirado, revogado e malformado.
- Loading, empty e error states no frontend quando UI muda.

