# Rebuild Guide (DigiStats Dashboard)

This guide proposes a structured rebuild path to turn the project into a
stable, scalable product while preserving the existing domain strengths.

---

## Phase 0 — Foundations (1–2 weeks)
Goal: Build a clean base before adding new features.

Checklist:
- Organize frontend by domain: `tournaments`, `players`, `decks`, `decklists`, `cards`, `stores`
- Create shared core modules: `api`, `state`, `validation`, `date`, `format`, `errors`
- Define a minimal UI kit: buttons, inputs, modal, toast, loader, empty state
- Pick a single UI language standard (PT or EN) and document it
- Document the directory conventions and the main page routing map

Deliverables:
- `core/` or `shared/` folder with utilities
- `ui/` folder with base components
- Consistent empty/loading/error states across main screens

---

## Phase 1 — Serious MVP (2–4 weeks)
Goal: Make critical flows reliable and polished.

Checklist:
- Tournament CRUD and calendar view are stable and consistent
- Decklist normalization and saving are robust
- OCR flow requires user review/confirmation before save
- Full error handling with actionable messages
- Basic telemetry/logging for failures (even if console only at first)

Critical flows to validate:
- Create tournament -> add results -> save
- Build decklist -> sort -> save -> reload
- OCR import -> review -> confirm

---

## Phase 2 — Scale and Maintainability (4–8 weeks)
Goal: Reduce tech debt and improve long-term maintainability.

Checklist:
- Automated tests for the critical flows (at least smoke tests)
- Centralized data access layer (repository pattern)
- Remove or migrate legacy routes carefully (keep redirects)
- Consolidate CSS into tokens + components + pages
- Ensure metadata cache for cards is reliable and consistent

---

## Phase 3 — Product Maturity (Ongoing)
Goal: Make it a dependable product with release discipline.

Checklist:
- Release checklist (PWA cache busting, schema changes, rollback)
- Versioning and release notes
- Public-facing documentation
- Real monitoring/analytics for usage + errors
- Onboarding flow for new users

---

# Design Patterns That Fit This Project

## 1) Domain-Driven UI
Organize front-end logic and UI by domain (tournaments, decklists, players).
Avoid generic file dumping. Each domain should own its data, UI, and actions.

## 2) Repository Pattern (Data Layer)
Wrap Supabase access into dedicated repositories:
- `TournamentsRepo.create()`, `DecklistsRepo.save()`, etc.
This keeps fetch logic consistent and testable.

## 3) Adapter Pattern (External APIs)
Normalize OCR and card API responses:
- `normalizeOcrResponse(raw)`
- `normalizeCardApiResponse(raw)`
This protects your UI from API quirks.

## 4) State Machine (Flows with steps)
For OCR/import flows, use simple state machines:
`idle -> uploading -> parsing -> review -> confirmed -> saved`
Prevents UI bugs and inconsistent states.

## 5) Schema Validation (DTOs)
Validate data before saving:
- Use lightweight schema validation (or Zod if you adopt a framework)
- Mirror DB constraints in frontend validation

## 6) Centralized Error Handling
All errors should pass through a single handler:
- Consistent toast/modal display
- Optional logging hook

---

# Practical Principles (Non-Negotiables)

1. **Single Source of Truth** for decklist data and metadata
2. **Instant feedback** (loading/success/error) for every user action
3. **DB constraints mirrored in UI** to avoid 400s at save time
4. **Stable card metadata cache** (avoid live API for everything)
5. **Tests for critical flows** before new features

---

# Suggested Next Steps (Immediate)
1. Identify the 2–3 most critical user workflows.
2. Refactor those flows into domain modules + repositories.
3. Add minimum UI kit (modals, toasts, loaders) and use it everywhere.
4. Add at least 2 smoke tests covering “create tournament” and “save decklist”.

