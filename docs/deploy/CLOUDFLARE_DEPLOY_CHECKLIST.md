# Cloudflare Deploy Checklist

Este checklist define o minimo operacional para publicar o HouseLog sem misturar ambientes. Ele nao contem secrets reais, account id real, tokens ou dados de cliente.

## Ambientes

Use recursos separados por ambiente:

| Recurso | Dev | Staging | Production |
| --- | --- | --- | --- |
| Worker | `houselog-api-dev` | `houselog-api-staging` | `houselog-api` |
| D1 | `houselog-db-dev` | `houselog-db-staging` | `houselog-db` |
| KV | namespace exclusivo de dev | namespace exclusivo de staging | namespace exclusivo de production |
| R2 | `houselog-assets-dev` | `houselog-assets-staging` | `houselog-assets` |
| Queue geral | `houselog-jobs-dev` | `houselog-jobs-staging` | `houselog-jobs` |
| Queue ingestion | `houselog-document-ingestion-dev` | `houselog-document-ingestion-staging` | `houselog-document-ingestion` |

Regra: nunca reutilize banco, KV, bucket ou queue de dev em production.

## Criacao manual de recursos

Crie recursos manualmente e substitua os placeholders do `wrangler.toml` somente depois.
Os IDs de D1/KV nao devem ficar com valores reais no repositório público; mantenha
placeholders no commit e aplique os IDs reais apenas na copia usada para deploy do
ambiente correspondente.

```bash
wrangler d1 create houselog-db-dev
wrangler d1 create houselog-db-staging
wrangler d1 create houselog-db

wrangler kv namespace create KV --env dev
wrangler kv namespace create KV --env staging
wrangler kv namespace create KV

wrangler r2 bucket create houselog-assets-dev
wrangler r2 bucket create houselog-assets-staging
wrangler r2 bucket create houselog-assets

wrangler queues create houselog-jobs-dev
wrangler queues create houselog-jobs-staging
wrangler queues create houselog-jobs
wrangler queues create houselog-document-ingestion-dev
wrangler queues create houselog-document-ingestion-staging
wrangler queues create houselog-document-ingestion
```

Para production, a ordem segura e:

1. Criar D1 production.
2. Criar KV production.
3. Criar R2 production.
4. Criar as duas queues production.
5. Aplicar os IDs reais de D1/KV somente na copia usada para deploy.
6. Configurar secrets e origins.
7. Rodar `npm run check:deploy-config:prod`.
8. Fazer deploy apenas se o check passar.

## Secrets obrigatorios

Configure por ambiente com `wrangler secret put`. Nunca grave estes valores em `wrangler.toml`, `.env.local`, docs ou commits.

```bash
wrangler secret put JWT_SECRET
wrangler secret put CREDENTIALS_ENCRYPTION_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put VAPID_PRIVATE_KEY
```

Para dev remoto ou staging, acrescente `--env dev` ou `--env staging`.

Configure tambem os origins de production antes do deploy:

- `APP_ORIGIN=https://app.houselog.app`
- `API_ORIGIN=https://api.houselog.app`

Eles devem apontar para custom domains same-site reais. Nao use `workers.dev`
em production porque o refresh token HttpOnly depende de SameSite=Lax.

`R2_PUBLIC_URL` e opcional. Configure apenas quando o bucket publico for
intencionalmente habilitado para Image Resizing/avatars, tambem via secret:

```bash
wrangler secret put R2_PUBLIC_URL --env dev
wrangler secret put R2_PUBLIC_URL --env staging
wrangler secret put R2_PUBLIC_URL
```

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
Para validar prontidao de dev/staging antes de deploy remoto, use:

```bash
node scripts/check-deploy-config.mjs --dev-ready
node scripts/check-deploy-config.mjs --staging-ready
```

## Checklist pre-deploy

- [ ] `database_id` de dev, staging e production sao diferentes.
- [ ] KV de staging/production nao usa placeholder antes do deploy desses ambientes.
- [ ] R2 dev, staging e production usam buckets diferentes.
- [ ] Queue `QUEUE` de dev/staging nao aponta para fila de production.
- [ ] Queue `DOCUMENT_INGESTION_QUEUE` de dev/staging nao aponta para fila de production.
- [ ] Todo producer tem consumer correspondente no mesmo ambiente.
- [ ] Secrets foram cadastrados por `wrangler secret put`.
- [ ] `.wrangler/`, `.wrangler/cache/` e `wrangler.log` nao estao versionados.
- [ ] `R2_PUBLIC_URL` nao esta hardcoded no `wrangler.toml`; se necessario, foi configurado por secret.
- [ ] `APP_ORIGIN` e `API_ORIGIN` apontam para custom domains same-site reais em production.
- [ ] `npm run check:deploy-config:prod` passou antes de `npm --prefix house-log-back/apps/api run deploy`.
- [ ] Backups/export do D1 foram planejados antes de migracoes em production.

## Identificadores versionados

Resource IDs e URLs de infraestrutura nao sao secrets de autenticacao, mas
podem expor topologia. Se um ID ou URL real de dev/staging aparecer em arquivo
versionado, trate como identificador: substitua por placeholder quando isso nao
quebrar o ambiente remoto e mantenha o valor real fora do commit ou em copia
local usada para deploy.

## Proibicoes

- Nao fazer deploy production com placeholders.
- Nao commitar `.wrangler/cache`.
- Nao commitar account id, email, token, secret ou arquivo local do Wrangler.
- Nao apontar dev para D1/KV/R2/queues de production.
