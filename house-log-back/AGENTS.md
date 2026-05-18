# AGENTS.md - HouseLog Backend

## Scope

Applies to `house-log-back`.

Stack:
- Cloudflare Workers;
- Hono;
- D1/SQLite;
- Drizzle;
- R2;
- KV;
- Queues;
- Resend;
- Workers AI when applicable.

Follow the root `AGENTS.md` first. This file adds backend-specific rules.

---

## AI Context First

Before any backend analysis, audit or implementation, read:

`../docs/ai-context/00-index.md`

Then read only the backend-specific context required by the task, usually:

- `../docs/ai-context/08-backend-map.md`
- `../docs/ai-context/06-security-rules.md`
- `../docs/ai-context/04-api-map.md`
- `../docs/ai-context/05-database-map.md`
- `../docs/ai-context/09-testing-guide.md`
- `../docs/ai-context/10-ai-workflow.md`

Do not scan `src/routes`, migrations, tests or scripts before checking the AI context maps.

If the backend change affects routes, helpers, services, authorization, security, database, API contracts, tests or structure, update the related file in `../docs/ai-context/`.

Follow:

`../docs/ai-context/11-update-protocol.md`

---

## Token Efficiency Rules

Use minimum context.

Do not scan the whole backend.

Before opening files:
1. Search first by TD id, route name, helper name, schema name, function name, test name, error code, env var name or config key.
2. Open only files directly related to the task.
3. Read only relevant sections.
4. Do not inspect all routes.
5. Do not inspect all migrations.
6. Do not inspect all tests.
7. Do not re-read files already inspected in this session.
8. Do not summarize large files unless requested.

Do not inspect all files in:
- `src/routes`;
- `src/db/migrations`;
- `src/tests`;
- `docs`;
- `scripts`.

---

## Technical Debt Tasks

For TD tasks:
1. Start from `docs/TECH_DEBT_REGISTER.md`.
2. Locate the exact TD item.
3. Search by the TD id and keywords from that item.
4. Open only files explicitly mentioned or directly matched.
5. Make the smallest safe change.

Do not inspect unrelated routes, tests, docs or configs.

---

## Backend Architecture Rules

Always preserve:
- tenant isolation;
- property scoping;
- role-based authorization;
- resource-level authorization;
- audit logging for sensitive flows;
- secret redaction;
- stable error codes;
- frontend/backend contract compatibility;
- private media/document access.

Never:
- invent routes;
- invent entities;
- invent payloads;
- change API contracts without checking direct consumers;
- duplicate existing logic;
- bypass tenant checks;
- introduce cross-tenant reads;
- weaken auth;
- use `any` without strong justification;
- use `ts-ignore`;
- refactor outside the requested scope.

Sensitive areas:
- auth helpers;
- tenant authorization;
- credentials;
- documents/media;
- service orders;
- bids/messages;
- audit log;
- deploy config;
- public links;
- handover;
- uploads;
- offline sync endpoints.

Frontend visual work is governed by `HouseLog Calm OS` in `house-log-front/AGENTS.md`.

Do not modify frontend visual files from backend tasks unless the user explicitly asks for a full-stack change.

---

## Tenant and Authorization Rules

For backend changes:
- never accept `tenantId` from request body;
- always derive `tenantId` from authenticated context;
- never query sensitive resources only by `id`;
- always scope sensitive reads/writes by `tenantId`;
- for property resources, validate `tenantId + propertyId`;
- validate the full parent chain when applicable:
  - `tenantId`;
  - `propertyId`;
  - `roomId`;
  - `serviceOrderId`;
  - `documentId`;
  - `credentialId`;
- prefer shared authorization helpers over duplicated manual checks;
- if a manual authorization check remains, document why and add a regression test;
- provider access must be explicitly scoped;
- owner and manager access must respect tenant, property and resource boundaries;
- do not change role semantics unless explicitly requested;
- do not expose whether a cross-tenant resource exists;
- preserve existing 400/403/404 behavior unless there is a security reason to change it.

---

## Sensitive Data Rules

Never include in responses, logs, audit logs or test snapshots:
- credential plaintext;
- integration secrets;
- public link tokens;
- token hashes;
- signed URLs;
- private R2 keys;
- refresh tokens;
- authorization headers;
- cookies;
- raw cookies;
- encryption keys;
- API keys;
- full invite/share/handover URLs when they contain tokens.

Public links must use token hashes or safe token helpers.

Internal resource IDs must not be used as public access tokens.

Security-sensitive random values must use Web Crypto, not `Math.random()`.

Do not use `Date.now()` as an ID.

Do not store new public link tokens in plaintext.

Do not log decrypted credential values.

---

## Credentials Rules

When touching credential flows:
- list endpoints must never return secrets;
- reveal must be an explicit action;
- reveal must validate tenant, property, role and resource access;
- provider reveal must be scoped to an authorized service order when applicable;
- `share_with_os` must be enforced when provider access depends on service order context;
- reveal must write audit log without plaintext;
- audit log must not contain secret, token, token hash or signed URL;
- do not reintroduce GET-based secret reveal;
- do not bypass rate limits for reveal endpoints;
- do not create plaintext fallback;
- do not change encryption algorithm unless explicitly requested.

---

## Public Links and Token Rules

When touching public links, invites, handover, audit links or share links:
- generate token once and return it only at creation time;
- store hash, not plaintext, when the current pattern supports it;
- do not use internal IDs as public tokens;
- support expiration and revocation when the domain requires it;
- public payloads must be minimal;
- public payloads must never include property credentials;
- public token errors must not reveal sensitive resource existence;
- do not log full public URLs containing tokens;
- do not add plaintext token fallback unless explicitly required for legacy migration.

---

## Upload and Media Rules

When touching documents/media/uploads:
- validate tenant/property access before file access;
- do not expose internal R2 object keys unless the existing contract requires it;
- prefer private/signed access patterns;
- validate input and file metadata according to existing helpers;
- do not trust client MIME blindly;
- do not make private files public by default;
- do not log signed URLs;
- preserve document sensitivity rules.

---

## Database and Migration Rules

Before database work, read:

`../docs/ai-context/05-database-map.md`

Rules:
- do not create migration without explicit need;
- do not alter already-applied migrations;
- do not remove tenant fields;
- do not weaken indexes tied to tenant/resource lookup;
- preserve idempotent backfills;
- do not use legacy `tenant_id = null` as universal access fallback;
- confirm schema, migration and tests are aligned when database behavior changes.

---

## API Rules

Do not invent routes, payloads, entities or behavior.

Before changing an API contract:
1. Check `../docs/ai-context/04-api-map.md`.
2. Check the route.
3. Check validation/schema.
4. Check direct consumers only if the contract changes.
5. Check nearby tests only if behavior changes.

Use existing helpers and patterns before creating new ones.

Avoid broad refactors unless explicitly requested.

When changing backend contracts, update frontend API maps and consumers only when necessary.

Do not introduce frontend UI changes during backend security/API work unless explicitly required.

---

## Cloudflare/Deploy Rules

Do not create Cloudflare resources automatically.

Do not deploy production unless explicitly requested.

For deploy/config tasks, inspect only what is relevant:
- `wrangler.toml`;
- deploy/check scripts;
- `.dev.vars.example`;
- `.env.example`;
- CI only if deployment is affected;
- related docs only if commands/checklists are affected.

Production config must not accept placeholders when production deploy is requested.

Secrets must be documented, never committed.

Do not commit real secrets to:
- `wrangler.toml`;
- `.dev.vars`;
- `.env`;
- docs;
- tests;
- scripts.

Resource IDs are not secrets, but treat production identifiers carefully.

---

## AI Context Update Rule

| Change type | Required file |
|---|---|
| New/changed route | `04-api-map.md` |
| New/changed API contract | `04-api-map.md` |
| New/changed table/column/migration | `05-database-map.md` |
| New/changed authorization rule | `06-security-rules.md` |
| New/changed security behavior | `06-security-rules.md` |
| New/changed backend helper/service | `08-backend-map.md` |
| New/changed upload/media behavior | `08-backend-map.md` |
| New/changed credential/public link behavior | `06-security-rules.md` |
| New/changed tests/scripts | `09-testing-guide.md` |
| New/changed workflow rule | `10-ai-workflow.md` |

---

## Implementation Rules

Before editing:
- identify the affected backend domain;
- search for existing patterns;
- check related contracts;
- choose the smallest safe change;
- identify the regression test to add or update.

During implementation:
- prefer targeted edits;
- preserve existing behavior;
- avoid broad refactors;
- keep code typed, readable and maintainable;
- follow existing naming, structure and error patterns;
- preserve existing API response shape unless the task requires a contract change;
- update docs only when behavior, security or deployment changes.

---

## Validation

Run only relevant scripts.

Before running a script:
- confirm it exists in `package.json`;
- prefer targeted validation first;
- avoid repeating expensive commands.

Common backend validations:

```bash
npm run type-check
npm run test
npm run test:api
npm run build
git diff --check
```

For docs-only changes:

```bash
git diff --check
git status --short
```