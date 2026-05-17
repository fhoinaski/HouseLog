# AGENTS.md — HouseLog Frontend

## Scope

Applies to `house-log-front`.

Stack:
- Next.js App Router
- React
- TypeScript
- Tailwind
- SWR
- React Hook Form
- Zod
- PWA

Design system:
**The Architectural Lens**

Follow the root `AGENTS.md` first. This file adds frontend-specific rules.

---

## Token efficiency — mandatory

Use minimum context.

Before opening files:
1. Search first.
2. Open only files directly related to the task.
3. Read only relevant sections.
4. Do not inspect all pages.
5. Do not inspect all components.
6. Do not inspect all hooks.
7. Do not inspect all tests.
8. Do not re-read files already inspected in this session.
9. Do not summarize large files unless requested.

If more than 3 files seem necessary, stop and briefly state why each file is needed before opening more.

Do not open broad directories just to understand the project.

Do not inspect all files in:
- `src/app`
- `src/components`
- `src/lib`
- `src/__tests__`

unless explicitly requested.

---

## Search-first rules

For any task, search by the most specific identifier first:
- route segment;
- component name;
- hook name;
- API client method;
- schema name;
- test name;
- error message;
- storage key;
- SWR key.

For technical debt tasks:
- Start from the exact TD id if provided.
- Search by TD id and related keywords.
- Open only files directly matched by search.
- Do not inspect unrelated pages, components, hooks or tests.

---

## UI rules

Preserve:
- mobile-first layout;
- accessibility;
- loading states;
- empty states;
- error states;
- existing tokens/components;
- role-aware flows;
- property context;
- responsive behavior;
- The Architectural Lens visual direction.

Never:
- invent backend data;
- create UI flows unsupported by the API;
- duplicate components unnecessarily;
- hardcode fake production behavior;
- break existing responsive behavior;
- change the design system globally unless explicitly requested;
- introduce heavy visual effects in provider/mobile flows without need.

When touching UI:
- use existing components/tokens when available;
- preserve keyboard accessibility;
- preserve meaningful labels;
- preserve error feedback;
- keep copy concise and professional.

---

## Contract rules

Before changing frontend API usage:
1. Check the API client/helper.
2. Check local types/schemas.
3. Check backend route only if request/response shape changes.
4. Check direct consumers only if contract changes.
5. Preserve existing cache behavior where possible.

Never:
- invent API fields;
- assume backend returns data not present in the contract;
- silently ignore API errors;
- change payload names without backend compatibility;
- create frontend-only authorization.

---

## Auth and storage rules

- Do not store refresh tokens in localStorage.
- Do not reintroduce `hl_refresh`.
- Access token should remain in memory unless architecture changes explicitly.
- Use existing auth/session helpers.
- Do not create new auth storage behavior without backend compatibility.
- Do not expose secrets or credential values in UI state longer than necessary.
- Credential reveal must call the explicit backend reveal endpoint.
- Do not fake authorization in the frontend.
- Do not store credential plaintext in persistent browser storage.
- Do not log tokens, cookies, authorization headers or credential values.

---

## Offline/PWA rules

When touching offline flows:

- Preserve tenant/user isolation in local queues.
- Do not mix offline data between tenants.
- Do not use `userId` as `tenantId`.
- Offline queue keys must include tenant/user context when applicable.
- Failed sync must not delete pending data.
- Successful sync must not duplicate uploads/actions.
- Keep clear pending/sync/error states.
- Do not silently discard offline work.
- Do not create a second offline queue unless explicitly requested.
- Do not change service worker caching broadly unless the task is specifically about PWA caching.

---

## API/client rules

- Do not invent API fields.
- Check the API client/helper before changing payloads.
- Check backend contracts only when changing request/response shape.
- Preserve SWR cache keys unless the change explicitly requires invalidation.
- Avoid broad API client refactors.
- Keep error handling consistent with existing client helpers.
- Keep loading, empty and error states when changing data fetching.

---

## Forms and validation rules

When touching forms:

- Use existing React Hook Form/Zod patterns.
- Preserve server-side validation compatibility.
- Do not trust client validation as security.
- Keep field names aligned with backend contracts.
- Show actionable errors.
- Avoid uncontrolled/controlled inconsistencies.
- Do not use `defaultValue` where controlled `value` is required for editable reset flows.

---

## Credential UI rules

When touching credential screens:

- List views must not display secrets.
- Reveal must be explicit.
- Do not persist revealed secrets.
- Do not log revealed secrets.
- Do not expose secrets in test snapshots.
- Respect backend reveal policy.
- Keep audit reason flow if present.
- Provider reveal must include service order context when required by backend contract.

---

## Upload/document UI rules

When touching document or upload screens:

- Preserve upload error handling.
- Do not assume upload success before API confirmation.
- Do not expose private URLs directly.
- Do not log signed URLs.
- Preserve property/document context.
- Keep empty/error/loading states.
- Do not weaken delete confirmation when touching destructive document actions.

---

## Performance rules

When touching provider/mobile flows:

- Avoid expensive blur/shadow/animation changes.
- Do not add heavy charts above the fold unless needed.
- Prefer dynamic import for heavy visual components when appropriate.
- Avoid unnecessary client components.
- Avoid broad memoization unless profiling or obvious repeated rendering justifies it.

---

## Implementation rules

Before editing:
- identify affected frontend domain;
- search for existing patterns;
- check API client/types;
- choose the smallest safe change;
- identify regression test or manual validation.

During implementation:
- prefer targeted edits;
- preserve existing behavior;
- avoid broad refactors;
- keep code typed, readable and maintainable;
- follow existing naming, structure and error patterns;
- do not alter UI outside the task;
- update docs only when requested or when behavior changes.

---

## Validation

Run targeted validation first.

Only run scripts that exist in `package.json`.

Common validations:
- `npm run type-check`
- `npm run test`
- `npm run build`
- `git diff --check`

For small type-only/client changes:

```powershell
npm run type-check
git diff --check