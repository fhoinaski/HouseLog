<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## HouseLog Design Mandate: The Architectural Lens

All new UI, refactors, and visual fixes must follow `DESIGN.md` as the canonical source of truth.

### Non-negotiable rules

- Use The Architectural Lens tokens and semantic palette exactly as defined in `DESIGN.md`.
- Apply dark and light mode values from The Architectural Lens without deviations.
- Use Inter as the project-wide UI typeface.
- Keep buttons and inputs aligned with the global standards (12px radius, 52px input height, consistent focus ring).
- Use accent colors sparingly as high-signal indicators.

### Implementation policy

- Reuse existing global tokens from `src/app/globals.css`; do not hardcode ad hoc colors when a semantic token exists.
- For new components, model states (rest/hover/focus/active) with tonal depth first, shadows second.
- If a request conflicts with this system, overwrite conflicting styles and keep The Architectural Lens as default.
- Use `src/components/ui/button.tsx` for primary/secondary actions and `src/components/ui/{input,textarea,select}.tsx` for form controls whenever possible.
- Avoid ad hoc button radii (e.g., mixed rounded-md/rounded-full) in app screens; default action controls should keep the global 12px control radius.

### Language policy

- All product UI copy, labels, placeholders, validation messages, and helper texts must be written in Portuguese (pt-BR).
