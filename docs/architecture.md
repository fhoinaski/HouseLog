# Arquitetura

HouseLog e um SaaS operacional de imoveis com frontend Next.js App Router e backend Cloudflare Workers/Hono. O dominio e organizado em torno de propriedades, ordens de servico, documentos, financeiro, prestadores e marketplace.

Backend:

- Hono em Cloudflare Workers.
- D1 + Drizzle para persistencia.
- R2 para arquivos.
- KV/Queues para suporte operacional.
- Workers AI e Resend em fluxos especificos.

Frontend:

- Next.js, React, TypeScript, Tailwind e SWR.
- UI em pt-BR.
- Design system oficial: The Architectural Lens.

Fronteiras:

- `house-log-back/apps/api/src/routes`: handlers HTTP.
- `house-log-back/apps/api/src/lib/authorization.ts`: regras de autorizacao.
- `house-log-back/apps/api/src/middleware`: auth, tenant e rate limit.
- `packages/contracts`: schemas Zod e tipos compartilhados.
- `house-log-front/src/lib/api.ts`: client publico do frontend.
