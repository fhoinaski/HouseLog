@AGENTS.md

# CLAUDE.md — HouseLog Frontend

## Required Context

Follow `AGENTS.md` first.

Before visual/frontend work, read:

- `../docs/ai-context/00-index.md`
- `../docs/ai-context/07-frontend-map.md`
- `../docs/design/house-log-calm-os.md`

Do not scan the whole frontend before checking the AI context maps.

---

## Official Visual System

`HouseLog Calm OS` is the current official frontend visual system.

`The Architectural Lens`, `Echelon Slate`, and `DESIGN.md` are legacy/context only and must not override Calm OS.

Use Calm OS for:
- new screens;
- new components;
- visual refactors;
- touched legacy UI blocks.

---

## Calm OS Direction

Prioritize:
- light premium UI;
- warm off-white backgrounds;
- white/elevated surfaces;
- strong readable text;
- semantic `--hl-*` tokens;
- mobile-first usability;
- accessible inputs, labels, buttons and dialogs;
- clear loading, error and empty states.

Avoid by default:
- hardcoded dark cards;
- `bg-slate-*` as main surface;
- `bg-zinc-*` as main surface;
- `bg-black`;
- `text-white` on normal app surfaces;
- `border-white/*`;
- heavy glassmorphism;
- low-contrast labels/placeholders;
- placeholder-only fields;
- `div onClick` for clickable UI.

---

## User-Facing Language

Use Portuguese (pt-BR) for all user-facing texts in the interface.

Keep copy:
- short;
- clear;
- professional;
- calm;
- operational.

---

## Migration Rule

Do not migrate the whole app in one broad diff.

If touching a legacy dark screen:
1. migrate only the touched section to Calm OS;
2. preserve behavior;
3. preserve API contracts;
4. preserve loading/error/empty states;
5. document remaining legacy areas when relevant.

Migration priority:
1. auth/login/splash;
2. provider flow;
3. owner dashboard/properties;
4. service orders/proposals/chat;
5. documents/handover/warranties/renovations;
6. settings and admin surfaces.

---

## Safety Rules

- Do not alter backend from frontend tasks.
- Do not alter API contracts unless explicitly requested.
- Do not persist tokens in localStorage/IndexedDB.
- Do not fake authorization in the frontend.
- Do not expose secrets, signed URLs, cookies, auth headers or credential values.
- Do not use `any`.
- Do not use `ts-ignore`.
- Preserve accessibility and keyboard navigation.
- Preserve loading, error and empty states.

---

## Validation

Prefer:

```bash
npx tsc --noEmit
npm run lint
npm run build
git diff --check
git status --short
```

Run targeted tests when related to the changed files.