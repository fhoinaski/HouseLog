# AGENTS.md - HouseLog

## Purpose

HouseLog is a SaaS for property technical management, maintenance, service orders, documents, expenses, providers, credentials, handover, diagnostics, warranties and operational history.

It is a private premium technical operating system for properties, owners, managers, builders and vetted providers.

It is not:
- an open marketplace;
- a generic CRUD app;
- a public classified platform;
- a mass service-ticket system.

Main domains:
- `house-log-front` -> frontend/PWA;
- `house-log-back` -> backend/API.

Domain-specific instructions may exist in:
- `house-log-front/AGENTS.md`;
- `house-log-back/AGENTS.md`;
- subdirectories closer to the task.

Nearest `AGENTS.md` rules override broader rules when they conflict.

---

## AI Context First

Before any analysis, audit or implementation, read:

`docs/ai-context/00-index.md`

Then read only the specific `docs/ai-context/*` files required by the task.

Do not scan the whole repository before checking the AI context maps.

If a change affects architecture, domain, API, database, security, frontend, backend, tests or workflow, update the related file in `docs/ai-context/`.

Follow:

`docs/ai-context/11-update-protocol.md`

---

## Token Efficiency Rules

Work with minimum context.

Before opening files:
1. Read `docs/ai-context/00-index.md`.
2. Read only the task-specific AI context map.
3. Search first by the most specific identifier.
4. Open only files directly related to the task.
5. Read only relevant sections.
6. Do not re-read files already inspected in the same session.

Do not:
- scan the whole repository unless explicitly requested;
- inspect all routes;
- inspect all migrations;
- inspect all tests;
- inspect unrelated docs, configs or generated files;
- summarize large files unless requested.

For technical debt tasks:
- start from `docs/TECH_DEBT_REGISTER.md`;
- locate the exact TD item;
- search by TD id and related keywords;
- open only files explicitly mentioned or directly matched.

---

## Architecture Rules

Do not treat HouseLog as a generic app.

Always preserve:
- multi-role flow: `owner`, `manager`, `provider`, `temp_provider`;
- tenant isolation;
- resource-level authorization;
- property context;
- service orders as the operational core;
- bids, messages, documents, credentials and expenses as connected workflows;
- frontend/backend contract consistency.

Never:
- invent endpoints;
- invent entities;
- change payloads without checking consumers;
- duplicate existing logic;
- create frontend flows unsupported by the backend;
- use `any` without strong justification;
- refactor outside the requested scope.

---

## Security Rules

Always follow these rules:

- Never accept `tenantId` from request body.
- Always derive `tenantId` from authenticated context.
- Never query sensitive resources only by `id`.
- Always validate `tenantId + resourceId`.
- For property resources, validate `tenantId + propertyId`.
- For nested resources, validate the full parent chain when applicable:
  - `tenantId`;
  - `propertyId`;
  - `roomId`;
  - `serviceOrderId`;
  - `documentId`;
  - `credentialId`.
- Do not leak secrets, credential values, tokens, signed URLs, plaintext, authorization headers, cookies or R2 private keys in responses, logs, audit logs or test snapshots.
- Do not store public link tokens in plaintext.
- Do not use internal resource IDs as public access tokens.
- Do not use `Math.random()` for security-sensitive values.
- Do not use `Date.now()` as an ID.
- Do not use `ts-ignore` to hide type problems.
- Do not silence TypeScript errors with unsafe casts.
- Preserve audit logging for sensitive actions.

---

## AI Context Update Rule

When a completed change modifies project context, update the related AI context map:

| Change type | Required file |
|---|---|
| Product behavior | `01-product-context.md` |
| Architecture | `02-architecture-context.md` |
| Domain/entity | `03-domain-map.md` |
| API route/contract | `04-api-map.md` |
| Database/table/migration | `05-database-map.md` |
| Security/authorization | `06-security-rules.md` |
| Frontend structure/screen | `07-frontend-map.md` |
| Backend structure/route/helper | `08-backend-map.md` |
| Tests/validation commands | `09-testing-guide.md` |
| Agent workflow | `10-ai-workflow.md` |
| Update process | `11-update-protocol.md` |

Keep AI context updates short, factual and linked to real project names.

---

## Implementation Rules

Before editing:
- identify the affected domain;
- search for existing patterns;
- check related contracts;
- choose the smallest safe change;
- identify the regression test or validation to add or update.

During implementation:
- prefer targeted edits;
- preserve existing behavior;
- avoid broad refactors;
- keep code typed, readable and maintainable;
- follow existing naming, structure and error patterns.

For frontend:
- respect the official design system: The Architectural Lens;
- use existing components/tokens when available;
- always handle loading, empty and error states when touching UI;
- do not create frontend flows unsupported by backend contracts.

For backend:
- preserve tenant isolation;
- preserve role authorization;
- validate inputs;
- avoid leaking secrets or sensitive payloads;
- keep API responses consistent with existing contracts;
- prefer shared authorization helpers over duplicated manual checks;
- preserve existing status codes unless there is a security reason to change them.

---

## Work Mode

Before editing files, respond briefly with:
1. cause/root issue;
2. files you will touch;
3. test or validation you will add or run.

Keep this under 8 lines.

After implementation, final output must include only:
1. files changed;
2. what changed;
3. validations run;
4. remaining risks or manual steps.

Keep final responses short.

---

## Audit Mode

When asked to audit:
- read `docs/ai-context/00-index.md` first;
- do not alter files;
- read only the requested files unless a direct dependency is necessary;
- return a compact table with finding, file, risk, fix now and reason;
- do not explain general concepts;
- do not generate long reports unless explicitly requested.

---

## Validation

Run only validations relevant to changed files first.

For docs-only changes:

```bash
git diff --check
git status --short
```

For backend/API changes, prefer:

```bash
npm run type-check
npm run test:api
npm run build
git diff --check
```

For frontend changes, prefer:

```bash
npm run type-check
npm run lint
npm run test
npm run build
git diff --check
```
