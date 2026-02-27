# Codebase Audit (2026-02-27)

Quick audit focused on unused or legacy files and route consistency.

## Findings

1. `tournaments/` is not junk.
- It is an English alias layer with HTML redirects to `torneios/`.
- Keep it for backward-compatible URLs and external/shared links.

2. Main active tournament UI is in:
- `index.html`
- `torneios/list-tournaments/script.js`
- `torneios/edit-tournament/modal.js`
- `torneios/list-tournaments/calendar-view/calendar.js`

3. Legacy/compatibility candidates (not referenced by current root dashboard flow):
- `script.js` (root): old standalone tournament screen logic.
- `db.js` (root): constants file currently not imported by runtime code.
- `torneios/script.js` and `torneios/create-tournament/*`: older flow, still reachable by direct route.

## Recommendation

- Keep `tournaments/` aliases.
- Do not delete legacy files yet; first decide if old direct routes must remain accessible.
- If cleanup is desired, archive/remove in two steps:
  1. mark legacy routes as deprecated in README;
  2. remove files only after confirming no external links/bookmarks depend on them.
