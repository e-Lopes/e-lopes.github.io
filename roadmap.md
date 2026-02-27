# DigiStats Roadmap (Project State)

## Current Score

**8.1 / 10**

## Why this score

- Strong progress in core flow: tournament CRUD, calendar/list view, OCR-assisted import, and Supabase integration.
- UI quality has improved (dark theme, modals, dashboard consistency), but there is still style debt and duplicated legacy paths.
- Documentation is now better, but technical debt remains in structure and legacy modules.
- Test coverage and release hardening are still below ideal for long-term stability.

## Priority Improvements

## 1) Consolidate legacy flows

- Keep `tournaments/` aliases (redirect compatibility), but formally deprecate old standalone routes.
- Decide fate of legacy files (`script.js` root, old tournament pages) and remove/archive after confirmation.
- Target: reduce confusion and maintenance cost.

## 2) CSS and design system cleanup

- Continue splitting large `styles.css` into modular files with clear ownership.
- Replace ad-hoc colors with shared tokens (light/dark), reduce `!important` usage, and enforce component-level theming.
- Target: avoid regressions like “dark style leaking into light mode”.

## 3) OCR pipeline hardening

- Finalize API contract for `/process` (players + store + date), version it, and add validation errors with explicit codes.
- Improve frontend OCR status messaging for store/date mismatch cases.
- Add fallback parsing for ambiguous date formats and multi-print conflicts.

## 4) Data model evolution

- Add and backfill store alias column (`bandai_nick`) and keep matching strategy documented.
- Add minimal migration checklist for players/stores OCR matching fields.

## 5) Testing and quality gates

- Add integration tests for create modal flow (manual + OCR import paths).
- Add smoke tests for theme toggle and modal rendering.
- Make lint + tests mandatory before release/deploy.

## 6) Operational readiness

- Add release checklist (cache busting/PWA, schema changes, rollback notes).
- Add monitoring/logging basics for OCR API (request failures, parsing quality).

## Suggested Next Milestones

1. **M1 (short term):** finalize OCR store/date end-to-end, migrate aliases in DB, polish modal UX.
2. **M2 (mid term):** remove/deprecate legacy flows, modularize CSS and stabilize theme behavior.
3. **M3 (ongoing):** raise automated test coverage and release reliability.
