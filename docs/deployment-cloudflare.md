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

- Em production, configurar apenas dominios oficiais em `CORS_ORIGINS`.
- `CORS_ORIGINS=*` nao e aceito porque a API responde com `credentials: true`.
- Origins desconhecidas ficam sem `Access-Control-Allow-Origin`.
- Em production, `CORS_ORIGINS` vazio falha fechado e bloqueia qualquer origin.
- Em dev, `http://localhost:3000` e `http://127.0.0.1:3000` sao adicionados automaticamente.
- Previews/staging devem entrar explicitamente na allowlist, por exemplo:

```bash
CORS_ORIGINS=https://house-log.vercel.app,https://preview-houselog.vercel.app
```
