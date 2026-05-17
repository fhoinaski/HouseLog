# CLAUDE.md — HouseLog

## Project context

HouseLog is a premium multi-tenant SaaS for technical property records, maintenance history, service orders, credentials, documents, diagnostics, warranties, handover, and provider operations.

The product is not an open marketplace. It is a private technical operating system for premium properties, builders, owners, managers, and vetted providers.

## Priorities

Always prioritize:

1. security;
2. tenant isolation;
3. resource-level authorization;
4. clean TypeScript;
5. no `any`;
6. small safe diffs;
7. regression tests;
8. maintainability;
9. Cloudflare/D1/R2/KV/Queues compatibility;
10. no feature creep.

## Global rules

- Do not accept `tenantId` from request body.
- Always derive `tenantId` from authenticated context.
- Never query sensitive resources only by `id`.
- Always validate `tenantId + resourceId`.
- For nested resources, validate the full chain:
  - `tenantId`;
  - `propertyId`;
  - `roomId`, `serviceOrderId`, `documentId`, `credentialId`, when applicable.
- Do not leak secrets, tokens, signed URLs, credential values, or plaintext in:
  - responses;
  - logs;
  - audit logs;
  - test snapshots.
- Do not use `Math.random()` for security-sensitive values.
- Do not use `Date.now()` as an ID.
- Use safe ID/token helpers already present in the project.
- Do not use `any`.
- Do not use `ts-ignore`.
- Do not silence TypeScript errors with unsafe casts.
- Do not refactor by taste.
- Do not change UI unless the task explicitly requires it.
- Do not create new features while fixing bugs.
- Prefer the smallest safe diff.

## Work mode

Before editing files, respond briefly with:

1. cause/root issue;
2. files you will touch;
3. test you will add or update.

Keep this under 8 lines.

After implementation, final output must be short:

1. correction made;
2. files changed;
3. tests run;
4. validations run;
5. remaining risks.

Keep this under 10 lines.

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

## Implementation mode

When asked to implement:

- Confirm the real bug in code first.
- Only fix confirmed issues.
- Add or update regression tests.
- Preserve existing public API contracts unless the task explicitly says to change them.
- Preserve existing status codes unless there is a security reason to change them.
- Update docs only when the task requires it or when security behavior changes.

## Validation commands

Prefer running only the validations relevant to the change.

For backend/API changes:

```bash
npm run type-check
npm run test:api
npm run build
git diff --check