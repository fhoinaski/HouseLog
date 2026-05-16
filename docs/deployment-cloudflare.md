# Deploy Cloudflare

Backend roda em Cloudflare Workers com D1, R2, KV, Queues, Workers AI e Resend.

Antes de qualquer deploy de producao, siga tambem o checklist seguro em
`docs/deploy/CLOUDFLARE_DEPLOY_CHECKLIST.md`.

Comandos principais:

```bash
npm run check:deploy-config
npm run check:deploy-config:prod
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
- `CREDENTIALS_ENCRYPTION_KEY`
- `CORS_ORIGINS` ou `CORS_ORIGIN`
- `ENVIRONMENT`
- `APP_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `RESEND_API_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Secrets devem ser cadastrados por `wrangler secret put` e nunca gravados no
`wrangler.toml`.

`R2_PUBLIC_URL` e opcional e tambem nao deve ficar hardcoded no `wrangler.toml`.
Configure com `wrangler secret put R2_PUBLIC_URL [--env dev|staging]` apenas se
o bucket publico for intencionalmente habilitado para Image Resizing/avatars.

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
