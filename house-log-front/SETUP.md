# HouseLog — Guia de Setup Cloudflare

Passo a passo para criar todos os recursos na Cloudflare e rodar o projeto localmente e em produção.

## Estrutura do repositório

```
HouseLog/
├── house-log-front/   ← Next.js 16 (frontend)
└── house-log-back/
    └── apps/api/      ← Cloudflare Workers + Hono (backend)
```

---

## Pré-requisitos

```bash
# Node.js 20+
node -v

# Instalar Wrangler globalmente
npm install -g wrangler

# Autenticar com a Cloudflare
wrangler login
# Abre o browser — autorize o acesso à sua conta
```

---

## 1. Banco de Dados — D1 (SQLite)

### 1.1 Criar os bancos

```bash
# Banco de produção
wrangler d1 create houselog-db

# Banco de desenvolvimento (já criado — ID real no wrangler.toml)
wrangler d1 create houselog-db-dev
```

Cada comando retorna um `database_id`. Abra `house-log-back/apps/api/wrangler.toml` e substitua os placeholders:

```toml
# Produção
[[d1_databases]]
database_id = "COLE_AQUI_O_ID_DA_PRODUCAO_QUANDO_CRIAR"  # ← aqui

# Dev
[[env.dev.d1_databases]]
database_id = "SEU_ID_DEV_AQUI"                           # ← e aqui
```

### 1.2 Rodar as migrations

```bash
cd house-log-back/apps/api

# Dev local (offline, sem internet — para desenvolvimento)
npm run db:migrate:local
# equivale a: wrangler d1 migrations apply houselog-db-dev --local

# Dev remoto (banco dev na Cloudflare)
npm run db:migrate:dev
# equivale a: wrangler d1 migrations apply houselog-db-dev --env dev

# Produção
npm run db:migrate
# equivale a: wrangler d1 migrations apply houselog-db
```

### 1.3 Verificar as tabelas

```bash
# Banco local
wrangler d1 execute houselog-db-dev --local \
  --command "SELECT name FROM sqlite_master WHERE type='table'"

# Banco remoto dev
wrangler d1 execute houselog-db-dev --env dev \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Esperado: `users, properties, rooms, inventory_items, service_orders, audit_links, documents, expenses, maintenance_schedules, audit_log`

---

## 2. Armazenamento de Arquivos — R2

### 2.1 Criar os buckets

```bash
# Produção
wrangler r2 bucket create houselog-assets

# Dev
wrangler r2 bucket create houselog-assets-dev
```

O `wrangler.toml` já referencia esses nomes — não é necessário copiar nenhum ID para R2.

```toml
# Produção
[[r2_buckets]]
binding    = "STORAGE"
bucket_name = "houselog-assets"

# Dev
[[env.dev.r2_buckets]]
binding    = "STORAGE"
bucket_name = "houselog-assets-dev"
```

### 2.2 Configurar CORS no bucket

Crie `house-log-back/apps/api/r2-cors.json`:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://house-log.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Aplique:
```bash
wrangler r2 bucket cors put houselog-assets     --file house-log-back/apps/api/r2-cors.json
wrangler r2 bucket cors put houselog-assets-dev --file house-log-back/apps/api/r2-cors.json
```

---

## 3. Cache / Rate Limiting — KV

### 3.1 Criar o namespace

```bash
# Produção
wrangler kv namespace create "houselog-kv"

# Dev (preview)
wrangler kv namespace create "houselog-kv" --preview
```

Copie os IDs retornados no `wrangler.toml`:

```toml
# Produção
[[kv_namespaces]]
binding = "KV"
id      = "ID_PRODUCAO_AQUI"

# Dev
[[env.dev.kv_namespaces]]
binding = "KV"
id      = "ID_DEV_AQUI"     # ← já preenchido no arquivo
```

---

## 4. Filas — Queues

```bash
wrangler queues create houselog-jobs
```

O `wrangler.toml` já tem o binding configurado com esse nome.

---

## 5. Workers AI

Não requer criação manual. O binding `[ai]` é ativado automaticamente:

```toml
[ai]
binding = "AI"
```

> **Atenção:** Workers AI tem custo por token. Em dev, o OCR de notas fiscais só funciona apontando para o ambiente remoto da Cloudflare.

---

## 6. Secrets do Worker

### 6.1 Desenvolvimento local — `.dev.vars`

```bash
cp house-log-back/apps/api/.dev.vars.example house-log-back/apps/api/.dev.vars
```

Edite `house-log-back/apps/api/.dev.vars`:

```dotenv
JWT_SECRET=cole-aqui-uma-string-aleatoria-de-48-bytes
CORS_ORIGIN=http://localhost:3000
ENVIRONMENT=development
```

Gere um `JWT_SECRET` forte:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 6.2 Produção — `wrangler secret`

```bash
cd house-log-back/apps/api
wrangler secret put JWT_SECRET
# Digite o valor e pressione Enter
```

---

## 7. Frontend — Next.js

```bash
cp house-log-front/.env.local.example house-log-front/.env.local
```

Edite `house-log-front/.env.local`:

```dotenv
# Dev local (wrangler dev na porta 8787)
NEXT_PUBLIC_API_URL=http://localhost:8787/api/v1

# Dev remoto (Worker dev na Cloudflare)
# NEXT_PUBLIC_API_URL=https://houselog-api-dev.SEU-SUBDOMAIN.workers.dev/api/v1

# Produção
# NEXT_PUBLIC_API_URL=https://houselog-api.SEU-SUBDOMAIN.workers.dev/api/v1
```

---

## 8. Instalar dependências

```bash
# Frontend
cd house-log-front && npm install

# Backend
cd house-log-back/apps/api && npm install
```

---

## 9. Rodar localmente

### Terminal 1 — Worker (API)

```bash
cd house-log-back/apps/api
npm run dev
# → http://localhost:8787
# Usa banco D1 local, R2 local simulado, .dev.vars
```

### Terminal 2 — Next.js (Frontend)

```bash
cd house-log-front
npm run dev
# → http://localhost:3000
```

---

## 10. Deploy em produção

### Backend

```bash
cd house-log-back/apps/api

# Aplicar migrations no banco remoto
npm run db:migrate

# Deploy
npm run deploy
# → https://houselog-api.SEU-SUBDOMAIN.workers.dev
```

### Frontend (Vercel)

```bash
cd house-log-front
npx vercel deploy --prod

# Ou conecte o repositório no painel da Vercel e configure:
# Build Command:  cd house-log-front && npm run build
# Root Directory: house-log-front
# Environment:    NEXT_PUBLIC_API_URL = https://houselog-api.<subdomain>.workers.dev/api/v1
```

---

## 11. Checklist final

```
[ ] wrangler login
[ ] D1 prod criado → ID no wrangler.toml
[ ] D1 dev criado  → ID no wrangler.toml  (ou usar o já existente)
[ ] Migrations aplicadas: npm run db:migrate:local
[ ] R2 buckets criados: houselog-assets + houselog-assets-dev
[ ] KV namespace criado → IDs no wrangler.toml
[ ] Queue criada: houselog-jobs
[ ] house-log-back/apps/api/.dev.vars preenchido com JWT_SECRET forte
[ ] house-log-front/.env.local com NEXT_PUBLIC_API_URL
[ ] npm install em house-log-front/
[ ] npm install em house-log-back/apps/api/
[ ] wrangler dev rodando na 8787
[ ] next dev rodando na 3000
[ ] POST /api/v1/auth/register retorna token JWT ✓
```

---

## Referência rápida

```bash
# Listar recursos criados na conta
wrangler d1 list
wrangler r2 bucket list
wrangler kv namespace list
wrangler queues list

# Consultar banco local durante dev
wrangler d1 execute houselog-db-dev --local --command "SELECT * FROM users"

# Consultar banco remoto dev
wrangler d1 execute houselog-db-dev --env dev --command "SELECT * FROM users"

# Logs em tempo real do Worker (produção)
wrangler tail houselog-api

# Logs do Worker dev
wrangler tail houselog-api-dev

# Recriar banco local do zero
rm -rf house-log-back/apps/api/.wrangler/state/v3/d1
cd house-log-back/apps/api && npm run db:migrate:local
```
