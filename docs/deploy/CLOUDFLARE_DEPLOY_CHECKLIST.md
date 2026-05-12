# Cloudflare Deploy Checklist

Este checklist define o minimo operacional para publicar o HouseLog sem misturar ambientes. Ele nao contem secrets reais, account id real, tokens ou dados de cliente.

## Ambientes

Use recursos separados por ambiente:

| Recurso | Dev | Staging | Production |
| --- | --- | --- | --- |
| Worker | `houselog-api-dev` | `houselog-api-staging` quando existir | `houselog-api` |
| D1 | `houselog-db-dev` | `houselog-db-staging` quando existir | `houselog-db` |
| KV | namespace exclusivo de dev | namespace exclusivo de staging | namespace exclusivo de production |
| R2 | `houselog-assets-dev` | `houselog-assets-staging` quando existir | `houselog-assets` |
| Queue geral | `houselog-jobs-dev` | `houselog-jobs-staging` quando existir | `houselog-jobs` |
| Queue ingestion | `houselog-document-ingestion-dev` | `houselog-document-ingestion-staging` quando existir | `houselog-document-ingestion` |

Regra: nunca reutilize banco, KV, bucket ou queue de dev em production.

## Criacao manual de recursos

Crie recursos manualmente e substitua os placeholders do `wrangler.toml` somente depois:

```bash
wrangler d1 create houselog-db-dev
wrangler d1 create houselog-db

wrangler kv namespace create KV --env dev
wrangler kv namespace create KV

wrangler r2 bucket create houselog-assets-dev
wrangler r2 bucket create houselog-assets

wrangler queues create houselog-jobs-dev
wrangler queues create houselog-jobs
wrangler queues create houselog-document-ingestion-dev
wrangler queues create houselog-document-ingestion
```

## Secrets obrigatorios

Configure por ambiente com `wrangler secret put`. Nunca grave estes valores em `wrangler.toml`, `.env.local`, docs ou commits.

```bash
wrangler secret put JWT_SECRET
wrangler secret put CREDENTIALS_ENCRYPTION_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

Para dev remoto, acrescente `--env dev`.

## Validacoes antes de deploy

```bash
npm run check:deploy-config
npm run type-check
npm run lint
npm run test
npm run test:api
npm run build
npm --prefix house-log-back/apps/api run build
git diff --check
```

Para production, rode tambem:

```bash
npm run check:deploy-config:prod
```

Esse comando deve falhar enquanto o `wrangler.toml` ainda usar placeholders invalidos intencionais de production.

## Checklist pre-deploy

- [ ] `database_id` de dev e production sao diferentes.
- [ ] KV de production nao usa placeholder.
- [ ] R2 dev e production usam buckets diferentes.
- [ ] Queue `QUEUE` de dev nao aponta para fila de production.
- [ ] Todo producer tem consumer correspondente no mesmo ambiente.
- [ ] Secrets foram cadastrados por `wrangler secret put`.
- [ ] `.wrangler/`, `.wrangler/cache/` e `wrangler.log` nao estao versionados.
- [ ] `npm run check:deploy-config:prod` passou antes de `npm --prefix house-log-back/apps/api run deploy`.
- [ ] Backups/export do D1 foram planejados antes de migracoes em production.

## Proibicoes

- Nao fazer deploy production com placeholders.
- Nao commitar `.wrangler/cache`.
- Nao commitar account id, email, token, secret ou arquivo local do Wrangler.
- Nao apontar dev para D1/KV/R2/queues de production.
