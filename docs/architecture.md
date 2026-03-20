# DigiStats — Architecture Overview

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML + CSS + Vanilla JavaScript (no framework) |
| Backend | Supabase (PostgreSQL + PostgREST REST API) |
| Auth | Supabase anon key + RLS policies |
| PWA | `sw.js` (service worker) + `manifest.json` |

---

## Page Map

```
/                          → index.html              (main dashboard + tournament list)
/decks/                    → decks/index.html         (deck management)
/players/                  → players/index.html       (player management)
/torneios/list-tournaments/→ torneios/list-tournaments/index.html (tournament list)
/torneios/edit-tournament/ → modal loaded inline (no dedicated page)
/torneios/create-tournament/ → torneios/create-tournament/index.html
/torneios/decklist-builder/→ torneios/decklist-builder/index.html
/post-preview/             → post-preview/index.html (Instagram post generator)
```

---

## Module Responsibilities

### `torneios/list-tournaments/script.js`
Core dashboard. Loads and renders the tournament list, manages the create/edit tournament modal flows, handles OCR import, and manages store/player/deck associations.

### `torneios/edit-tournament/modal.js`
Inline modal for editing an existing tournament's metadata (store, date, format, rounds). Injected into `index.html`.

### `torneios/decklist-builder/script.js`
Decklist editor. Loads an existing decklist from DB via `resultId` URL param, supports manual card entry and search, validates deck limits, sorts cards by type/level/set, and saves to `decklists` + `decklist_cards` tables.

### `decks/page.js`
Deck browser. Lists decks with monthly ranking metrics from `v_deck_rank`. Supports list/compact/grid views, search, format/month filters, and the deck history panel (all tournament results for a deck with their decklists).

### `players/script.js`
Player browser. Lists players with pagination, supports expand-to-see-history per player (tournament results + decklist cards).

### `torneios/list-tournaments/calendar-view/calendar.js`
Calendar visualization of tournament dates. Injected into the list-tournaments page.

---

## Configuration Layer (`config/`)

| File | Purpose |
|---|---|
| `supabase.js` | Injects `window.APP_CONFIG` (URL + anon key), exposes `window.createSupabaseHeaders()` |
| `api-client.js` | Exposes `window.supabaseApi` — shared fetch helper with error handling |
| `ui-state.js` | Shared UI helpers (theme toggle, sidebar state) |
| `app-version.js` | Version constant used for cache busting |
| `validation.js` | Input validation utilities (`window.validation`) |
| `register-sw.js` | Registers the service worker |

All config files are loaded via `<script>` tags before the page script, populating `window.*` globals.

---

## Data Fetching Pattern

All data fetching uses PostgREST (Supabase REST API) directly from the browser. There is no backend server.

```js
// Standard fetch pattern
const res = await fetch(`${SUPABASE_URL}/rest/v1/table_name?select=*&filter=value`, {
    headers: window.createSupabaseHeaders()  // apikey + Authorization
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
```

**PostgREST key features used:**
- `?select=col1,col2,relation(col)` — column selection + embedded relations
- `?column=eq.value` — equality filter
- `?column=not.is.null` — null check
- `relation!inner(col)` — inner join (only rows with related data)
- `?order=col.desc` — ordering
- `&limit=N` — pagination
- `Prefer: return=representation` header — get inserted row back

---

## Event Handling Pattern

All pages use **event delegation** — a single click listener on a container element, routing actions via `data-action` attributes:

```js
container.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="some-action"]');
    if (btn) {
        handleSomeAction(btn.dataset.someId);
        return;
    }
    // next action...
});
```

This avoids rebinding listeners on every re-render.

---

## Render Cycle

Pages follow a **full re-render on state change** pattern:

```
state change (filter, sort, expand, search)
    → renderList() / renderDecksList() / renderPaginatedList()
        → filterData() → sortData() → paginate()
            → build HTML string → container.innerHTML = ...
                → bind image fallbacks (for card images)
```

State is kept in module-scoped `let` variables. No framework, no reactive system.

---

## CSS Organization

```
styles.css                  ← global styles (large, split ongoing)
styles/components/
    utilities.css           ← u-* utility classes
    states.css              ← loading, error, empty states
styles/pages/
    players.css             ← player page + player-history-* classes
                              (also used by decks/page.js for deck history)
```

See `docs/css-guide.md` for conventions and how to extend.

---

## Service Worker (`sw.js`)

Strategy:
- **Navigation requests** → Network First (fallback: `offline.html`)
- **Scripts/Styles** → Network First (cache on success)
- **Images/Fonts/Manifest** → Cache First (fetch if not cached)
- **Other GET** → Network First

Cache is versioned (`CACHE_VERSION = 'vN'`). On activate, old cache versions are purged.

---

## Security Model

- Supabase anon key is public (in browser). Security is enforced by **Row Level Security (RLS)** in PostgreSQL.
- All write operations require RLS policies to allow the anon role.
- See `docs/security-rls.md` for the RLS checklist.
- XSS: all user-supplied strings are escaped with `escapeHtml()` / `escapeHtmlAttribute()` before insertion into innerHTML.
