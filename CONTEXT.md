# DigiStats Dashboard - Project Context (LLM-Friendly)

## 1) What this project is
DigiStats Dashboard is a frontend-first web app for managing Digimon TCG tournaments.
It is a single-page style dashboard (HTML/CSS/vanilla JS) that talks directly to
Supabase (Postgres + REST) using the public anon key and RLS policies.

Core goals:
- Create and manage tournaments
- Manage players and decks
- Build and save decklists (normalized)
- Show calendar and podium-style visualizations
- Import tournament results via OCR (Bandai TCG+ screenshots)

Repository root: `index.html` is the main entry.

## 2) Stack and runtime
- Frontend: HTML + CSS + vanilla JavaScript
- Backend: Supabase REST (PostgREST)
- PWA: `sw.js`, `manifest.json`
- Tooling: Node 20+, ESLint, Prettier

## 3) Configuration and API access
- Supabase config is injected client-side via `config/supabase.js`
  - `window.APP_CONFIG.SUPABASE_URL`
  - `window.APP_CONFIG.SUPABASE_ANON_KEY`
  - `window.createSupabaseHeaders()` builds `apikey` + `Authorization` headers
- Shared REST helper: `config/api-client.js` exposes `window.supabaseApi`

Security note:
- Uses anon key in the browser; RLS must be strict in Supabase.

## 4) Frontend routes and modules
Active routes (see README):
- `/` -> `index.html` (main dashboard)
- `/torneios/list-tournaments/` -> main tournament list + calendar
- `/torneios/create-tournament/` -> legacy create flow (compat)
- `/players/`, `/decks/` -> modules
- `/post-preview/` -> post editor/preview
- `/tournaments/*` -> redirects to `/torneios/*` (URL compatibility)

Main JS entry points:
- `torneios/list-tournaments/script.js` (core dashboard UI)
- `torneios/edit-tournament/modal.js`
- `torneios/decklist-builder/script.js` (decklist builder)
- `players/script.js`, `decks/script.js`

Legacy candidates still present (kept for compat):
- `script.js` (root)
- `torneios/script.js`
- `torneios/create-tournament/*`

## 5) OCR integration (Bandai TCG+)
New Tournament modal supports OCR:
- Endpoint: `POST https://e-lopes-digimon-ocr-api.hf.space/process`
- Request: `multipart/form-data` with `file`
- Response used by frontend:
  - `players[]` for results
  - `store_name` for store selection
  - `tournament_date` or `tournament_datetime`

## 6) Data model (high level)
Supabase Postgres schema tracked in `database/schema.latest.sql`
and `database/migrations/*`.

Key tables:
- `tournaments`, `tournament_results`
- `players`, `stores`
- `decks`, `deck_images`
- `cards_cache` (card data cache)
- `decklists`
- `decklist_cards` (normalized rows with position + qty)
- `decklist_card_metadata` (normalized card type/level/egg metadata)

Key views:
- `v_decklist_cards_enriched`
- `v_top_cards_by_month`
- `v_deck_representation`
- `v_meta_by_month`

Decklist normalization:
- `decklists` has `tournament_result_id`
- `decklist_cards` stores `decklist_id`, `position`, `card_code`, `qty`
- `decklist_card_metadata` stores `card_code`, `card_type`, `card_level`,
  `is_digi_egg`, `is_staple`

Important constraints:
- `decklist_cards.qty` is checked in DB (currently `1..50` for unlimited cards)
- Triggers validate deck limits (eggs <= 5, main <= 50, total <= 55)

RLS:
- RLS is enabled; explicit policies exist for anon/auth roles.
  See `docs/security-rls.md` and migrations.

## 7) Decklist builder behavior
File: `torneios/decklist-builder/script.js`

Main behaviors:
- Add cards (manual entry or search result click)
- Validate limits and restrictions
- Hydrate card metadata from DB cache first, then Digimon API fallback
- Sort cards by a stable comparator (type -> level -> set -> serial -> name)
- Save:
  - Upserts `decklists`
  - Deletes existing `decklist_cards`
  - Upserts `decklist_card_metadata`
  - Inserts `decklist_cards`
  - Patches legacy text columns in `tournament_results`

Sorting order:
- Group order: `digi-egg` -> `digimon` -> `tamer` -> `option`
- Digimon levels (ascending): `2, 3, 4, 5, 6, 7+`
- Then set code ordering (BT > EX > ST > P > LM), then serial, then name/code

## 8) Card metadata pipeline
Runtime (browser):
- `decklist_card_metadata` is queried first (via Supabase JOIN in `decklist_cards` select)
- If missing or stale, fallback to `https://digimoncard.io/api-public/search`

Known limitation:
- The Digimon Card API does **not** cover all expansions (newer sets may be missing).
- Cards absent from both `decklist_card_metadata` and the API will have `level = null`
  and sort as if level = 99 (end of Digimon group, ordered by serial number).
- Fix: populate `decklist_card_metadata` manually for new expansions using
  `npm run cards:sync-metadata` or direct SQL `INSERT ... ON CONFLICT DO UPDATE`.

Node script:
- `scripts/sync-card-metadata.js`
  - Fetches distinct `card_code` from `decklist_cards`
  - Fetches metadata from `https://digimoncard.io/api-public/search`
  - Upserts `cards_cache`
  - Optional flag `--update-decklist-cards` (legacy) to patch metadata

## 9) Styling and UI
- Global styles in `styles.css` (large file)
- Additional modular CSS under `styles/`
- Dark theme supported, with some legacy CSS debt

## 10) Tooling and scripts
`package.json` scripts:
- `npm run lint` -> ESLint
- `npm run test` -> Node test runner
- `npm run format` -> Prettier
- `npm run db:snapshot` -> export schema/roles
- `npm run cards:sync-metadata` -> sync card metadata

DB snapshot workflow:
- `database/README.md` explains how to export schema and roles

## 11) Documentation map
- `README.md` (overview)
- `roadmap.md` (project state)
- `CONTEXT.md` (this file — LLM/engineer onboarding)
- `docs/architecture.md` (module map, fetch pattern, render cycle, CSS overview)
- `docs/css-guide.md` (CSS conventions, dark theme palette, button classes)
- `docs/features/deck-history.md` (deck decklist browser feature)
- `docs/features/decklist-builder.md` (decklist builder — save flow, sort order, limits)
- `docs/features/player-history.md` (player history panel)
- `docs/features/ocr-import.md` (Bandai TCG+ OCR import)
- `docs/structure-plan.md` (target folder layout)
- `docs/naming-and-language.md` (naming conventions)
- `docs/security-rls.md` (RLS checklist)
- `docs/codebase-audit-2026-02-27.md` (legacy/route audit)

## 12) Conventions
- Folders/files: `kebab-case`
- JS variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`
- English for new files, UI may be PT/EN mixed

## 13) Current risks / debt (summary)
- Legacy routes and files still active (compat), need consolidation
- CSS still monolithic, split ongoing
- OCR pipeline needs more validation/error handling
- Test coverage is light
- `decklist_card_metadata` must be manually populated for expansions not yet indexed
  by the external Digimon Card API (newer sets like EX11+)
- `validate_decklist_limits` DB trigger uses INNER JOIN with `decklist_card_metadata`,
  so cards without a metadata row are not counted toward deck limits

## 14) Recent changes (high signal)
- Decklist metadata split into `decklist_card_metadata`
- Decklist auto-sort and auto-save on load
- Sort order uses metadata (type/level) and set/serial
- Decklist `qty` constraint updated to allow unlimited cards (1..50)
- Sort comparator fixed: `getDigimonLevelSort` now handles Lv2 main deck cards
- Sort comparator fixed: `compareSetSort` corrected to A→Z within same family rank
- `shouldFetchApiMetadata` fixed: used `Number(null) = 0` (finite), now uses
  `normalizeCardLevel` which correctly returns `null` for missing levels
- `hydrateCardMetadata` API fetch path now stores `level` directly from
  `card_payload.level` so subsequent sort calls don't trigger redundant API fetches
- `patchDecklistLegacy` fixed: was silently returning `true` on failure

## 15) Where to start reading code
If you are a new LLM or engineer, start here:
1. `index.html` (app entry)
2. `torneios/list-tournaments/script.js` (main dashboard flow)
3. `torneios/decklist-builder/script.js` (decklist logic)
4. `config/supabase.js` + `config/api-client.js` (Supabase access)
5. `database/schema.latest.sql` (data model)

