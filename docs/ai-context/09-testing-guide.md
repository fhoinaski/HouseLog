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

Testes recentes de auth/sessao incluem `src/__tests__/session.test.ts`, cobrindo cooldown de refresh, 429 sem rajada de refresh, reset ao estabelecer nova sessao e preservacao de deep link/query params no redirect para login.

Testes recentes de `/properties` incluem `src/__tests__/properties-page.test.tsx` e `src/__tests__/property-list-model.test.ts`, cobrindo carteira com imoveis, card com dados completos/minimos, placeholder sem foto, link para detalhe, empty/error states e classes responsivas sem largura fixa para mobile.

Testes recentes da Timeline Tecnica incluem `src/__tests__/property-timeline-panel.test.tsx` no frontend e `src/routes/timeline.test.ts` na API, cobrindo eventos renderizados, empty/loading/error states, permissao, cross-tenant, validacao de query e ausencia de payload sensivel/R2 keys.
Testes recentes do Dashboard Executivo do Imovel incluem `src/__tests__/executive-property-dashboard.test.tsx` no frontend e `src/routes/properties-dashboard.test.ts` na API, cobrindo indicadores, estado inicial, erro controlado, permissao, cross-tenant e ausencia de payload sensivel.
Esses testes tambem cobrem `preventive_alerts`: garantia vencendo, garantia vencida, manutencao atrasada, OS parada, documentos essenciais ausentes, handover pendente e estado limpo sem alertas.

Use e2e apenas quando o fluxo visual/navegacao justificar.

## Backend

No pacote `house-log-back/apps/api`:

- `npm run type-check`
- `npm run test`
- `npm run build`
- `npm run db:check`

Use `db:check` quando schema/migration estiver no escopo.

Testes recentes de auth/sessao incluem `src/routes/auth-session.test.ts`, cobrindo cookie HttpOnly, `activeTenantId` no payload de sessao e bootstrap de tenant no primeiro acesso.

Suites de API que mockam `src/lib/jwt.ts` devem expor todos os exports usados por `authMiddleware`, incluindo `verifyJwt` e `resolveJwtSecret`, para nao transformar falha de setup em 500 artificial.

Testes recentes de Handover Digital comercial incluem `src/routes/handover-packages-delivery-events.test.ts`, cobrindo copia de link, envio Resend, link que nao corresponde ao hash do pacote, ausencia de `RESEND_API_KEY` e audit log sem token/hash/e-mail puro.

## Testes que IA deve procurar

- Cross-tenant access.
- Resource-level authorization.
- Payload sem `tenantId`.
- Secrets fora de response/log/audit.
- Public token expirado, revogado e malformado.
- Loading, empty e error states no frontend quando UI muda.
