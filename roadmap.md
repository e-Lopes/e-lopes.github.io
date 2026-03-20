# DigiStats Roadmap (Project State)

## Current Score

**8.9 / 10**

All three previously blocking bugs resolved. Statistics module significantly improved: inline SVG charts (donut + bar), Top Cards coverage indicator, `v_deck_color_stats` SQL view replacing client-side aggregation, and a statistics loading spinner. Dark theme gaps in the statistics section and tournament details area addressed. CSS duplicate rules cleaned up. Score raised from 8.7 — the product now feels more complete and polished as a daily-use tool.

---

## 🟢 BUGS — Resolved (Mar 2026)

- **[FIXED]** Register deck via player menu threw "This record has no result_id to save." — param name mismatch: `players/script.js` was sending `result` but deckbuilder read `resultId`. One-line fix.
- **[FIXED]** `card_level` not saving in `decklist_card_metadata` — `saveDecklist()` was not hydrating card metadata before persisting. Added `await hydrateCardMetadata()` before save. Also enriched upsert to include `name`, `pack`, `color`, `card_payload`.
- **[FIXED]** Cards in deckbuilder search results cropped at third row — `.decklist-search-results` had `overflow: hidden`; changed to `overflow-y: auto`.

---

## Recent Wins (Mar 2026)

**Session 2 (Mar 20, late):**
- **`v_deck_color_stats` SQL view created** — replaced full client-side aggregation (fetching all `tournament_results` + JS grouping on every load) with a proper PostgREST view. Month + format filters now work independently instead of being mutually exclusive. Migration: `database/migrations/20260320_create_v_deck_color_stats.sql`.
- **Inline SVG charts** — donut chart for meta share (top 7 decks + Others), horizontal bar chart for color stats. Zero external dependencies.
- **Top Cards coverage indicator** — empty state explains decklists must be registered via deckbuilder. Non-empty state shows unique card count + months covered.
- **Statistics loading spinner** — animated spinner appears immediately on view switch so the user knows when a slow fetch (e.g., Top Cards card name enrichment) is running.
- **Dark theme Wave 1** — added missing dark overrides for: statistics table (headers, rows, hover, borders), statistics labels/hints/status/data-card, sort button, column resizer, tournament details section. Fixed two CSS bugs: `statistics-table th` border conflict, duplicate `details-player-name`/`details-deck-name` rules.
- **Roadmap expanded** — added P3 items: Admin store registration (+ store-logos bucket), i18n toggle, CSS dark/light review, mobile UX review, light mode brightness.

**Session 1 (Mar 20, earlier):**
- **All 3 bugs fixed:** deck registration, card_level persistence, search results cropped.
- **`cards_cache` removed, `decklist_card_metadata` extended** — added `id`, `name`, `pack`, `color`, `card_payload` columns. All deckbuilder references updated.
- **Retroactive ban list protection** — existing registered decklists no longer silently cap quantities when a card is banned/restricted after registration.
- Admin Panel added: format/meta CRUD with background image upload (Supabase Storage).
- Ban List editor: add/edit/remove restrictions, card code + name search, card preview with name fetched from public API.
- Ban list sourced from DB (`ban_list` table) with `card_name` column.
- Decklist metadata normalized into `decklist_card_metadata`.
- Views updated: `v_decklist_cards_enriched`, `v_top_cards_by_month`.
- Auto-sort & auto-save decklists on load.
- Database snapshots stabilized using Session Pooler connection.

---

## Priority Order

### P1 — Decklist data quality (repair legacy data)

With the save bug fixed, new decklists will have correct `card_level`. But existing rows saved before the fix may still have `card_level = null`.

- Add a one-time repair job/script to re-hydrate missing `card_type` / `card_level` in `decklist_card_metadata` for legacy decklists.
- Add consistency checks to detect rows with missing metadata.
- Verify `validate_decklist_limits` trigger works correctly with the extended table.

### P2 — Statistics improvements

The statistics module is the most valuable section for the end user. It already covers 7 views (decks, meta, colors, top cards, players, stores, representation), but has clear gaps worth addressing.
See full details in `docs/statistics.md`.

**Quick wins (no new data collection needed):**

- **[DONE] Pie/bar chart for meta share** — SVG donut chart on `v_meta_by_month` (top 7 decks + Others). Inline SVG, no external libs.
- **[DONE] Color stats bar chart** — horizontal bar chart for `v_deck_color_stats`, color-coded per color.
- **[DONE] Top Cards coverage indicator** — empty state explains decklists must be registered; non-empty state shows card count + months covered.
- **[DONE] Convert `v_deck_color_stats` to a real SQL view** — migration in `database/migrations/20260320_create_v_deck_color_stats.sql`. Month + format filters now work independently.
- **Deck trend sparkline** — a small month-over-month line for each deck's meta share in the Deck Performance view. Tells the story of a deck rising or falling in the meta.
- **Top cards per deck** — filter Top Cards by deck name to answer "what does a typical [Deck X] play?" Very natural question for a TCG player evaluating a deck.
- **Card image preview in Top Cards** — the card code is shown but no image. A hover/tap preview with the card art would make the table dramatically more useful on mobile.
- **Clarify Top Cards column names** — `champion/top2/top3/top4` are copy counts, not decklist counts. Rename to `copies_1st/copies_2nd/copies_3rd/copies_4th` or add a tooltip explaining the distinction.

**Medium-term (requires minor data model work):**

- **Format health / diversity score** — a single number (e.g. Herfindahl index on meta share) showing how diverse or concentrated the format is. Simple to compute from existing data, immediately useful for format analysis.
- **Player deck profile** — on the player ranking, show which decks the player has used and their stats per deck (titles, top4s). Currently `unique_decks_used` is just a count.
- **Consistency metric for decks** — a deck that makes top4 every other tournament is very different from one that spiked once. Something like "top4 streak" or "events since last top4" would reflect this.
- **Store attendance trends** — tournament player count over time per store. Answers "is the local scene growing?"

**Long-term (requires new data collection):**

- **Head-to-head matchup data** — which decks beat which. Requires storing individual match results (win/loss per round), which is not currently collected. High value for a competitive TCG platform.
- **Deck builder integration with stats** — when building a deck, show "cards most played by top [Deck X] players" inline in the search results.

### P3 — Data model evolution

- Add and backfill `bandai_nick` alias column for store matching.
- Document decklist normalization conventions (position, qty, metadata ownership).
- Minimal migration checklist for players/stores OCR matching fields.

### P3 — Admin: store registration

Currently stores are pre-seeded and cannot be managed through the Admin Panel. Adding store CRUD would allow organizers to register new stores without direct database access.

- Store form: name, city/region, logo URL, contact/Instagram link.
- List view with edit/deactivate support (soft delete via `is_active` flag or equivalent).
- Matches the existing pattern of format/meta CRUD already in the Admin Panel.
- **Storage bucket for store logos** — create a `store-logos` bucket in Supabase Storage (mirrors the `post-backgrounds` bucket used for format/meta images). Admin upload flow: file picker → upload to bucket → store public URL in `stores` table. Set bucket to public read, authenticated write, with RLS policy matching the existing pattern.
- Dependency: `stores` table already exists; confirm all needed columns (`logo_url`, `instagram_link`, `is_active`) are present before starting.

### P3 — i18n: PT-BR / EN-US language toggle

The site is currently Portuguese-only. A significant portion of Digimon TCG players in Brazil also consume English content. A language toggle (similar in UX to the existing dark/light toggle) would broaden reach.

- Add a `lang` setting (PT-BR default) persisted in `localStorage`.
- Create a static string map for all UI labels (button text, column headers, tooltips, section titles).
- Toggle applies at render time — no page reload required.
- Priority: low complexity if done before the codebase grows further. Higher effort after.

### P3 — CSS dark/light theme review

Dark and light modes exist but have known leakage issues (dark styles bleeding into light mode and vice versa).

**Wave 1 (Mar 2026) — targeted fixes applied:**
- Statistics table: header row, alternating rows, hover, cell borders — dark overrides added.
- Statistics label/hint text (`statistics-select-label`, `statistics-formula-hint`, `statistics-status`, `statistics-highlight-label`) — dark overrides added.
- Statistics data card (`statistics-data-card`) — dark background gradient + border added.
- Sort button hover, column resizer handle — dark overrides added.
- Tournament details section — dark background, border, header text, icon color added.
- Loading spinner — dark colors added.
- New statistics chart components (donut, bar, coverage note) — all have dark mode.

**Remaining work:**
- **Light mode brightness** — the light theme is too bright/high contrast. Backgrounds like `#fff` and `#f8fbff` should shift slightly toward warm or neutral off-whites (e.g., `#f7f8fc`, `#f4f5fb`). Card borders can be softened. Goal: reduce eye strain without losing legibility.
- Audit `!important` usage — most compensate for specificity fights, not intentional overrides.
- Establish CSS custom properties as the source of truth for theme colors.
- Known gap: month filter in Meta por Formato only shows months with data for the auto-selected format. If a format (e.g., EX11) started in February, January data from other formats is hidden until the user clears the format filter. Acceptable behavior for now; consider a UX note or "show all months" option.
- Target: zero "wrong theme color" reports after a full light + dark pass on all views.

### P3 — Mobile UI/UX review

The dashboard is usable on mobile but was not designed mobile-first. Several views degrade on small screens.

- Audit every statistics view on 375px and 414px widths.
- Identify tables that overflow horizontally and add horizontal scroll or column hiding.
- Review tap target sizes (buttons, toggles, pagination) — minimum 44×44px.
- Check tournament expansion card layout, player history modal, and deckbuilder search on mobile.
- Produce a prioritized list of regressions vs. polish items before implementing.

### P3 — CSS and design system cleanup

- `styles.css` is over 11k lines — high risk of regressions.
- Split into modular files with clear ownership per section.
- Replace ad-hoc colors with shared tokens; reduce `!important` usage.
- Target: eliminate "dark style leaking into light mode" class of bugs.

### P4 — Consolidate legacy flows

- Formally deprecate old standalone routes (keep `/tournaments/` aliases for redirect compatibility).
- Remove or archive legacy files after confirmation.
- Target: reduce maintenance surface and confusion.

### P5 — Testing and quality gates

- Add smoke tests for critical flows: create tournament, save decklist, ban list enforcement.
- Add regression test for decklist sort order (level + set + serial).
- Enforce lint before release.
- Note: setup cost is high in vanilla JS — focus on integration-level tests of critical paths only.

### P6 — Operational readiness

- Release checklist: cache busting, PWA manifest, schema migration notes.
- Basic monitoring for OCR API (failure rate, parse quality).
- Usage metrics: tournaments created per month, decklists saved.

### P7 — OCR pipeline hardening (low priority)

- OCR is not in the critical path of the product today.
- Only revisit after core flows are stable.
- When revisited: finalize `/process` API contract, add fallback parsing for ambiguous dates, improve frontend status messaging.

---

## Framework Migration

**React + Vite — Future consideration only, not now.**

The project works well in vanilla JS. A full migration would be costly with little immediate gain. Revisit only if the team grows or componentization becomes unmanageable.

---

## Making it a Product (checklist — long term)

1. **Reliability & quality** — critical flow tests, consistent error handling, basic failure monitoring.
2. **Security & data governance** — RLS review by table, front/DB validation parity, backup + migration plan.
3. **Product & UX** — flawless core flows (onboarding, save, edit, export), consistent loading/error/success feedback, fewer active legacy paths.
4. **Technical scalability** — real componentization (even without a framework), modular and reusable code, clear domain separation (tournament / deck / player).
5. **Operations & release** — release checklist, versioning and release notes, basic usage metrics.
6. **Positioning** — clear end-user documentation, product narrative (what it solves, for whom), simple landing page and demo if possible.

---

## Suggested Milestones

1. **M1 (done):** Fix the three open bugs. Core flows unblocked. ✅
2. **M2 (in progress):** Statistics improvements (charts, SQL view, coverage indicator). CSS dark theme Wave 1. ✅ partially done — remaining: legacy data repair job for `card_level`, light mode brightness pass.
3. **M3 (mid term):** Admin store registration, mobile UX review, testing gates, operational readiness basics.
4. **M4 (ongoing):** OCR improvements, product positioning, metrics.
