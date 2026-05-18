# AGENTS.md - HouseLog Frontend

## Scope

Applies to `house-log-front`.

Stack:
- Next.js App Router;
- React;
- TypeScript;
- Tailwind;
- SWR;
- React Hook Form;
- Zod;
- PWA.

Design system:

`HouseLog Calm OS`

`The Architectural Lens`, `Echelon Slate`, and `DESIGN.md` are legacy/context only. Do not use them as the default visual direction.

Follow the root `AGENTS.md` first. This file adds frontend-specific rules.

---

## AI Context First

Before any frontend analysis, audit or implementation, read:

`../docs/ai-context/00-index.md`

Then read only the frontend-specific context required by the task, usually:

- `../docs/ai-context/07-frontend-map.md`
- `../docs/ai-context/04-api-map.md`
- `../docs/ai-context/06-security-rules.md`
- `../docs/ai-context/09-testing-guide.md`
- `../docs/ai-context/10-ai-workflow.md`

For visual work, also read:

- `../docs/design/house-log-calm-os.md`

Do not scan `src/app`, `src/components`, `src/lib`, hooks or tests before checking the AI context maps.

If the frontend change affects screens, components, API usage, auth flow, offline behavior, tests or structure, update the related file in `../docs/ai-context/`.

Follow:

`../docs/ai-context/11-update-protocol.md`

---

## Token Efficiency Rules

Use minimum context.

Before opening files:
1. Search first by route segment, component name, hook name, API client method, schema name, test name, error message, storage key or SWR key.
2. Open only files directly related to the task.
3. Read only relevant sections.
4. Do not inspect all pages.
5. Do not inspect all components.
6. Do not inspect all hooks.
7. Do not inspect all tests.
8. Do not re-read files already inspected in this session.

Do not open broad directories just to understand the project.

Do not inspect all files in:
- `src/app`;
- `src/components`;
- `src/lib`;
- `src/__tests__`.

---

## HouseLog Calm OS Rules

`HouseLog Calm OS` is the current official frontend theme.

Use Calm OS for all new screens, components and visual refactors.

Core direction:
- light premium interface;
- warm neutral background;
- white/elevated cards;
- soft borders;
- subtle shadows;
- strong text contrast;
- calm status colors;
- mobile-first layout;
- accessible forms and dialogs;
- clear loading, empty and error states.

Use semantic tokens whenever possible:
- `--hl-bg`
- `--hl-bg-muted`
- `--hl-surface`
- `--hl-surface-muted`
- `--hl-surface-elevated`
- `--hl-border`
- `--hl-border-strong`
- `--hl-text`
- `--hl-text-muted`
- `--hl-text-soft`
- `--hl-primary`
- `--hl-primary-hover`
- `--hl-primary-soft`
- `--hl-success`
- `--hl-warning`
- `--hl-danger`
- `--hl-info`

Prefer helper classes:
- `.hl-calm-os`
- `.hl-calm-card`
- `.hl-calm-surface`
- `.hl-calm-section`
- `.hl-calm-muted`
- `.hl-calm-border`
- `.hl-calm-focus`
- `.hl-calm-bottom-safe`

Avoid in new work:
- hardcoded dark cards;
- `bg-slate-*` as main surface;
- `bg-zinc-*` as main surface;
- `bg-black`;
- `text-white` on normal app surfaces;
- `text-slate-100/200/300` on light pages;
- `border-white/*`;
- heavy `backdrop-blur`;
- low-contrast labels/placeholders;
- placeholder-only form fields;
- `div onClick` for clickable cards.

If a screen still uses legacy dark UI, migrate only the touched block unless the task explicitly asks for a full screen migration.

---

## Calm OS Migration Rule

Do not migrate the whole app in one broad diff.

Migration order:
1. auth/login/splash;
2. provider flow;
3. owner dashboard/properties;
4. service orders/proposals/chat;
5. documents/handover/warranties/renovations;
6. settings and admin surfaces.

When touching a legacy dark screen:
- migrate the touched section to Calm OS;
- preserve behavior and API contracts;
- keep loading/error/empty states;
- document remaining legacy areas when relevant.

---

## Frontend Architecture Rules

Preserve:
- Next.js App Router conventions;
- mobile-first layout;
- accessibility;
- loading states;
- empty states;
- error states;
- existing tokens/components;
- role-aware flows;
- property context;
- tenant-aware behavior;
- API contract compatibility;
- responsive behavior;
- premium visual quality;
- HouseLog Calm OS visual direction.

Never:
- invent backend data;
- create UI flows unsupported by the API;
- duplicate components unnecessarily;
- hardcode fake production behavior;
- break existing responsive behavior;
- change the design system globally unless explicitly requested;
- introduce heavy visual effects in provider/mobile flows without need.

When touching UI:
1. preserve functionality;
2. keep API contracts unchanged;
3. migrate touched visual blocks to Calm OS;
4. fix low contrast text;
5. use accessible labels;
6. avoid `div onClick` for clickable cards;
7. use `Link` or `button`;
8. preserve loading/error/empty states;
9. keep copy concise and professional.

---

## Contract Rules

Before changing frontend API usage:
1. Check `../docs/ai-context/04-api-map.md`.
2. Check the API client/helper.
3. Check local types/schemas.
4. Check backend route only if request/response shape changes.
5. Check direct consumers only if contract changes.
6. Preserve SWR cache keys unless the change explicitly requires invalidation.

Never:
- invent API fields;
- assume backend returns data not present in the contract;
- silently ignore API errors;
- change payload names without backend compatibility;
- create frontend-only authorization.

---

## Auth and Storage Rules

- Do not store refresh tokens in `localStorage`.
- Do not reintroduce `hl_refresh`.
- Access token should remain in memory unless architecture changes explicitly.
- Use existing auth/session helpers.
- Do not create new auth storage behavior without backend compatibility.
- Do not persist plaintext credentials.
- Do not expose secrets or credential values in UI state longer than necessary.
- Credential reveal must call the explicit backend reveal endpoint.
- Do not fake authorization in the frontend.
- Do not log tokens, cookies, authorization headers or credential values.

---

## Offline/PWA Rules

When touching offline flows:
- preserve tenant/user isolation in local queues;
- do not mix offline data between tenants;
- do not use `userId` as `tenantId`;
- offline queue keys must include tenant/user context when applicable;
- do not cache credential reveal;
- do not cache signed URLs;
- failed sync must not delete pending data;
- successful sync must not duplicate uploads/actions;
- keep clear pending/sync/error states;
- do not silently discard offline work;
- do not create a second offline queue unless explicitly requested;
- do not change service worker caching broadly unless the task is specifically about PWA caching.

---

## API/Client Rules

- Do not invent API fields.
- Check the API client/helper before changing payloads.
- Check backend contracts only when changing request/response shape.
- Preserve SWR cache keys unless the change explicitly requires invalidation.
- Avoid broad API client refactors.
- Keep error handling consistent with existing client helpers.
- Keep loading, empty and error states when changing data fetching.

---

## Forms and Validation Rules

When touching forms:
- use existing React Hook Form/Zod patterns;
- preserve server-side validation compatibility;
- do not trust client validation as security;
- keep field names aligned with backend contracts;
- show actionable errors;
- avoid uncontrolled/controlled inconsistencies;
- do not use `defaultValue` where controlled `value` is required for editable reset flows;
- keep labels visible and accessible;
- do not rely on placeholders as the only label.

---

## Credential UI Rules

When touching credential screens:
- list views must not display secrets;
- reveal must be explicit;
- do not persist revealed secrets;
- do not log revealed secrets;
- do not expose secrets in test snapshots;
- respect backend reveal policy;
- keep audit reason flow if present;
- provider reveal must include service order context when required by backend contract.

---

## Upload/Document UI Rules

When touching document or upload screens:
- preserve upload error handling;
- do not assume upload success before API confirmation;
- do not expose private URLs directly;
- do not log signed URLs;
- preserve property/document context;
- keep empty/error/loading states;
- do not weaken delete confirmation when touching destructive document actions.

---

## Performance Rules

When touching provider/mobile flows:
- avoid expensive blur/shadow/animation changes;
- do not add heavy charts above the fold unless needed;
- prefer dynamic import for heavy visual components when appropriate;
- avoid unnecessary client components;
- avoid broad memoization unless profiling or obvious repeated rendering justifies it.

---

## Visual Documentation Rule

If a visual change introduces or modifies a reusable Calm OS pattern, update:
- `../docs/design/house-log-calm-os.md`;
- `../docs/ai-context/07-frontend-map.md`;
- `../docs/TECH_DEBT_REGISTER.md` when related to TD-008.

---

## AI Context Update Rule

| Change type | Required file |
|---|---|
| New/changed screen | `07-frontend-map.md` |
| New/changed component pattern | `07-frontend-map.md` |
| New/changed API usage | `04-api-map.md` |
| New/changed auth behavior | `06-security-rules.md` |
| New/changed offline/PWA behavior | `07-frontend-map.md` |
| New/changed tests/scripts | `09-testing-guide.md` |
| New/changed workflow rule | `10-ai-workflow.md` |

---

## Implementation Rules

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

Common frontend validations:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
git diff --check
```

For docs-only changes:

```bash
git diff --check
git status --short
```