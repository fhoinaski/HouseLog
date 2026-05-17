# AGENTS.md — HouseLog

## Purpose

HouseLog is a SaaS for property technical management, maintenance, service orders, documents, expenses, providers, credentials, handover, diagnostics, warranties and operational history.

It is not an open marketplace. It is a private technical operating system for premium properties, owners, managers, builders and vetted providers.

Main domains:
- `house-log-front` → frontend/PWA
- `house-log-back` → backend/API

Domain-specific instructions may exist in:
- `house-log-front/AGENTS.md`
- `house-log-back/AGENTS.md`
- subdirectories closer to the task

Nearest `AGENTS.md` rules override broader rules when they conflict.

---

## Token efficiency

Work with minimum context.

Do not scan the whole repository unless explicitly requested.

Before opening files:
1. Search first.
2. Open only files directly related to the task.
3. Read only relevant sections.
4. Do not re-read files already inspected in the same session.
5. Do not inspect unrelated routes, tests, docs, configs or migrations.
6. Do not summarize large files unless requested.
7. Do not perform broad exploration without a concrete reason.

For technical debt tasks:
- Start from `docs/TECH_DEBT_REGISTER.md`.
- Locate the exact TD item.
- Search by the TD id and related keywords.
- Open only files explicitly mentioned by the TD or directly matched by search.
- Do not inspect all routes just because routes are mentioned.

---

## Architecture rules

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

## Security rules

Always follow these rules:

- Never accept `tenantId` from request body.
- Always derive `tenantId` from authenticated context.
- Never query sensitive resources only by `id`.
- Always validate `tenantId + resourceId`.
- For nested resources, validate the full chain when applicable:
  - `tenantId`;
  - `propertyId`;
  - `roomId`;
  - `serviceOrderId`;
  - `documentId`;
  - `credentialId`.
- Do not leak secrets, credential values, tokens, signed URLs or plaintext in:
  - responses;
  - logs;
  - audit logs;
  - test snapshots.
- Do not store public link tokens in plaintext.
- Do not use internal resource IDs as public access tokens.
- Do not use `Math.random()` for security-sensitive values.
- Do not use `Date.now()` as an ID.
- Do not use `ts-ignore` to hide type problems.
- Do not silence TypeScript errors with unsafe casts.
- Preserve audit logging for sensitive actions.

---

## Implementation rules

Before editing:
- identify the affected domain;
- search for existing patterns;
- check related contracts;
- choose the smallest safe change;
- identify the regression test to add or update.

During implementation:
- prefer targeted edits;
- preserve existing behavior;
- avoid broad refactors;
- keep code typed, readable and maintainable;
- follow existing naming, structure and error patterns.

For frontend:
- respect the official design system: **The Architectural Lens**;
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

## Work mode

Before editing files, respond briefly with:
1. cause/root issue;
2. files you will touch;
3. test you will add or update.

Keep this under 8 lines.

After implementation, final output must include only:
1. files changed;
2. what changed;
3. validations run;
4. remaining risks or manual steps.

Keep final responses short.

---

## Audit mode

When asked to audit:
- Do not alter files.
- Read only the requested files unless a direct dependency is necessary.
- Return a compact table:
  - finding;
  - file;
  - risk;
  - fix now: yes/no;
  - reason.
- Do not explain general concepts.
- Do not generate long reports unless explicitly requested.

---

## Validation

Run only validations relevant to changed files first.

Use full validation only when the change justifies it or before final delivery.

Prefer:
- targeted tests;
- type-check;
- lint/build only when related or requested;
- `git diff --check`.

Do not run expensive commands repeatedly.

Suggested validation by area:

Backend/API:
```bash
npm run type-check
npm run test:api
npm run build
git diff --check