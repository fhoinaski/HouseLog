# Deploy Cloudflare

Backend roda em Cloudflare Workers com D1, R2, KV, Queues, Workers AI e Resend.

Comandos principais:

```bash
npm --prefix house-log-back/apps/api run build
npm --prefix house-log-back/apps/api run deploy
npm --prefix house-log-back/apps/api run db:migrate
```

Ambiente dev:

```bash
npm --prefix house-log-back/apps/api run dev
npm --prefix house-log-back/apps/api run db:migrate:dev
```

Variaveis importantes:

- `JWT_SECRET`
- `CORS_ORIGINS` ou `CORS_ORIGIN`
- `ENVIRONMENT`
- `APP_URL`
- `R2_PUBLIC_URL`
- `RESEND_API_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Regra de CORS:

- Em production, configurar apenas dominios oficiais.
- Em dev, localhost e 127.0.0.1 sao adicionados automaticamente.
