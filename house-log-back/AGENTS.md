# AGENTS.md — HouseLog Backend

## Scope

Applies to `house-log-back`.

Stack:
- Cloudflare Workers
- Hono
- D1/SQLite
- Drizzle
- R2
- KV
- Queues
- Resend
- Workers AI when applicable

Follow the root `AGENTS.md` first. This file adds backend-specific rules.

---

## Token efficiency — mandatory

Use minimum context.

Do not scan the whole backend.

Before opening files:
1. Search first.
2. Open only files directly related to the task.
3. Read only relevant sections.
4. Do not inspect all routes.
5. Do not inspect all migrations.
6. Do not inspect all tests.
7. Do not re-read files already inspected in this session.
8. Do not summarize large files unless requested.
9. Do not delegate parallel reading of many files unless explicitly requested.

If more than 3 files seem necessary, stop and briefly state why each file is needed before opening more.

---

## Search-first rules

For any task, search by the most specific identifier first:
- TD id;
- route name;
- helper name;
- schema name;
- function name;
- test name;
- error code;
- env var name;
- config key.

Never open broad directories just to understand the project.

Do not inspect all files in:
- `src/routes`
- `src/db/migrations`
- `src/tests`
- `docs`
- `scripts`

unless explicitly requested.

---

## Technical debt tasks

For TD tasks:
1. Start from `docs/TECH_DEBT_REGISTER.md`.
2. Locate the exact TD item.
3. Search by the TD id and keywords from that item.
4. Open only files explicitly mentioned or directly matched.
5. Make the smallest safe change.

Do not inspect unrelated routes, tests, docs or configs.

---

## Backend architecture rules

Always preserve:
- tenant isolation;
- property scoping;
- role-based authorization;
- resource-level authorization;
- audit logging for sensitive flows;
- secret redaction;
- stable error codes;
- frontend/backend contract compatibility.

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

---

## Tenant and authorization rules

For backend changes:

- Never accept `tenantId` from request body.
- Always derive `tenantId` from authenticated context.
- Never query sensitive resources only by `id`.
- Always scope sensitive reads/writes by `tenantId`.
- For property resources, validate `tenantId + propertyId`.
- For nested resources, validate the full parent chain when applicable:
  - `tenantId`;
  - `propertyId`;
  - `roomId`;
  - `serviceOrderId`;
  - `documentId`;
  - `credentialId`.
- Prefer shared authorization helpers over duplicated manual checks.
- If a manual authorization check remains, document why and add a regression test.
- Do not change role semantics unless explicitly requested.
- Do not expose whether a cross-tenant resource exists.
- Preserve existing 400/403/404 behavior unless there is a security reason to change it.

---

## Sensitive data rules

Never include in responses, logs, audit logs or test snapshots:

- credential plaintext;
- integration secrets;
- public link tokens;
- token hashes;
- signed URLs;
- private R2 keys;
- refresh tokens;
- authorization headers;
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

## Credentials rules

When touching credential flows:

- List endpoints must never return secrets.
- Reveal must be an explicit action.
- Reveal must validate tenant, property, role and resource access.
- Provider reveal must be scoped to an authorized service order when applicable.
- `share_with_os` must be enforced when provider access depends on service order context.
- Reveal must write audit log without plaintext.
- Audit log must not contain secret, token, token hash or signed URL.
- Do not reintroduce GET-based secret reveal.
- Do not bypass rate limits for reveal endpoints.
- Do not change encryption algorithm unless explicitly requested.

---

## Public links and token rules

When touching public links, invites, handover, audit links or share links:

- Generate token once and return it only at creation time.
- Store hash, not plaintext, when the current pattern supports it.
- Do not use internal IDs as public tokens.
- Support expiration and revocation when the domain requires it.
- Public payloads must be minimal.
- Public payloads must never include property credentials.
- Public token errors must not reveal sensitive resource existence.
- Do not log full public URLs containing tokens.
- Do not add plaintext token fallback unless explicitly required for legacy migration.

---

## Upload and media rules

When touching documents/media/uploads:

- Validate tenant/property access before file access.
- Do not expose internal R2 object keys unless the existing contract requires it.
- Prefer signed/private access patterns.
- Validate input and file metadata according to existing helpers.
- Do not make private files public by default.
- Do not log signed URLs.
- Preserve document sensitivity rules.

---

## API rules

Do not invent routes, payloads, entities or behavior.

Before changing an API contract:
1. Check the route.
2. Check validation/schema.
3. Check direct consumers only if the contract changes.
4. Check nearby tests only if behavior changes.

Use existing helpers and patterns before creating new ones.

Avoid broad refactors unless explicitly requested.

---

## Cloudflare/deploy rules

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

## Implementation rules

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

Common validations:
- `npm run type-check`
- `npm run test`
- `npm run test:api`
- `npm run build`
- `npm run check:deploy-config`
- `npm run check:deploy-config:prod`
- `git diff --check`

Run full test/build only when the change justifies it or when explicitly requested.

Suggested backend validation:
```powershell
npm run type-check
npm run test:api
npm run build
git diff --check