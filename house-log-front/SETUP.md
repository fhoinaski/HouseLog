# HouseLog — Guia de Setup Cloudflare

Passo a passo para criar todos os recursos na Cloudflare e rodar o projeto localmente e em produção.

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

### 1.1 Criar o banco

```bash
wrangler d1 create houselog-db
```

O comando retorna algo como:
```
✅ Successfully created DB 'houselog-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 1.2 Copiar o ID no wrangler.toml

Abra `apps/api/wrangler.toml` e substitua `REPLACE_WITH_YOUR_D1_DATABASE_ID` pelo ID retornado:

```toml
[[d1_databases]]
binding = "DB"
database_name = "houselog-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← aqui

[[env.development.d1_databases]]
binding = "DB"
database_name = "houselog-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← e aqui também
```

### 1.3 Rodar as migrations

```bash
cd apps/api

# Banco local (para dev sem internet — recomendado para desenvolvimento)
npm run db:migrate:local
# equivalente a: wrangler d1 migrations apply houselog-db --local

# Banco remoto (produção / staging na Cloudflare)
npm run db:migrate
# equivalente a: wrangler d1 migrations apply houselog-db
```

### 1.4 Verificar as tabelas

```bash
# Listar tabelas no banco local
wrangler d1 execute houselog-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# Listar tabelas no banco remoto
wrangler d1 execute houselog-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Deve retornar:
```
users, properties, rooms, inventory_items, service_orders,
audit_links, documents, expenses, maintenance_schedules, audit_log
```

---

## 2. Armazenamento de Arquivos — R2

### 2.1 Criar o bucket

```bash
# Bucket de produção
wrangler r2 bucket create houselog-assets

# Bucket de preview (para wrangler dev)
wrangler r2 bucket create houselog-assets-dev
```

O `wrangler.toml` já referencia esses nomes no binding — não é necessário copiar nenhum ID para R2, apenas garantir que os nomes batem:

```toml
[[r2_buckets]]
binding    = "STORAGE"
bucket_name         = "houselog-assets"       # produção
preview_bucket_name = "houselog-assets-dev"   # dev local
```

### 2.2 Configurar CORS no bucket (para upload direto do frontend)

Crie o arquivo `apps/api/r2-cors.json`:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://houselog.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Aplique:

```bash
wrangler r2 bucket cors put houselog-assets --file apps/api/r2-cors.json
```

---

## 3. Cache / Rate Limiting — KV (Workers KV)

### 3.1 Criar o namespace

```bash
# Namespace de produção
wrangler kv namespace create "houselog-kv"

# Namespace de preview (para wrangler dev)
wrangler kv namespace create "houselog-kv" --preview
```

Cada comando retorna um `id`. Copie ambos no `wrangler.toml`:

```toml
[[kv_namespaces]]
binding    = "KV"
id         = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"          # ← id de produção
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"          # ← id de preview

[[env.development.kv_namespaces]]
binding    = "KV"
id         = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

---

## 4. Filas — Queues (Workers Queues)

### 4.1 Criar a fila

```bash
wrangler queues create houselog-jobs
```

O `wrangler.toml` já tem o binding configurado com esse nome — nada mais a fazer.

```toml
[[queues.producers]]
binding = "QUEUE"
queue   = "houselog-jobs"

[[queues.consumers]]
queue             = "houselog-jobs"
max_batch_size    = 10
max_batch_timeout = 30
```

---

## 5. Workers AI

Não requer criação manual — o binding `[ai]` é ativado automaticamente na sua conta Cloudflare quando o wrangler.toml contém:

```toml
[ai]
binding = "AI"
```

> **Atenção:** Workers AI tem custo por token. Em dev, prefira mockar ou só testar o OCR em produção.

---

## 6. Secrets do Worker

As variáveis secretas **nunca** entram no `wrangler.toml`. São configuradas de duas formas:

### 6.1 Desenvolvimento local — `.dev.vars`

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Edite `apps/api/.dev.vars`:

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
# Executa interativamente — digite o valor e pressione Enter
wrangler secret put JWT_SECRET
```

---

## 7. Frontend — Next.js

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

```dotenv
# Em desenvolvimento local (wrangler dev rodando na 8787)
NEXT_PUBLIC_API_URL=http://localhost:8787/api/v1

# Em produção (substitua pelo URL real do seu Worker)
# NEXT_PUBLIC_API_URL=https://houselog-api.SEU-SUBDOMAIN.workers.dev/api/v1
```

---

## 8. Rodar localmente (tudo junto)

### Terminal 1 — Worker (API)

```bash
cd apps/api
npm run dev
# Inicia em http://localhost:8787
# Usa banco D1 local, R2 local (simulado), .dev.vars
```

### Terminal 2 — Next.js (Frontend)

```bash
# Na raiz do projeto
npm run dev
# Inicia em http://localhost:3000
```

---

## 9. Deploy em produção

### 9.1 Deploy do Worker

```bash
cd apps/api

# Rodar migrations no banco remoto primeiro
npm run db:migrate

# Fazer deploy
npm run deploy
# equivalente a: wrangler deploy
```

O Worker fica disponível em:
`https://houselog-api.<seu-subdomain>.workers.dev`

### 9.2 Deploy do Next.js (Vercel)

```bash
# Via CLI
npx vercel deploy --prod

# Ou conecte o repositório no painel da Vercel e configure:
# Environment Variable: NEXT_PUBLIC_API_URL = https://houselog-api.<subdomain>.workers.dev/api/v1
```

---

## 10. Checklist final

```
[ ] wrangler login
[ ] D1 criado → ID copiado no wrangler.toml (2 lugares)
[ ] Migrations aplicadas localmente (--local)
[ ] R2 bucket criado (produção + preview)
[ ] KV namespace criado → IDs copiados no wrangler.toml (id + preview_id)
[ ] Queue criada
[ ] apps/api/.dev.vars preenchido com JWT_SECRET forte
[ ] .env.local preenchido com NEXT_PUBLIC_API_URL
[ ] wrangler dev rodando na porta 8787
[ ] next dev rodando na porta 3000
[ ] POST /api/v1/auth/register funciona → retorna token JWT
```

---

## Referência rápida — comandos úteis

```bash
# Ver todos os recursos criados na sua conta
wrangler d1 list
wrangler r2 bucket list
wrangler kv namespace list
wrangler queues list

# Consultar banco local durante dev
wrangler d1 execute houselog-db --local --command "SELECT * FROM users"

# Consultar banco remoto
wrangler d1 execute houselog-db --command "SELECT * FROM users"

# Ver logs do Worker em produção (tail)
wrangler tail houselog-api

# Recriar banco local do zero (útil para testar migrations)
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```
