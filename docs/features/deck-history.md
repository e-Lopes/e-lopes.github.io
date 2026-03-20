# Feature: Deck History (Decklist Browser)

**File:** `decks/page.js`
**Triggered from:** Deck list page (`/decks/`)

---

## What it does

Each deck row/card in the decks list can be expanded to show all tournament results that used that deck, filtered to only those that have a registered decklist. Each result can be further expanded to show the full card grid.

---

## User Flow

1. User clicks deck name (list view) or "Show decklists" hint (compact/grid view)
2. Panel expands below the deck row showing a loading state
3. Data is fetched from Supabase and cached
4. Results without any decklist are silently filtered out
5. Each result shows: placement badge, player name, store — date
6. Clicking a result row expands the card image grid
7. "Edit in Builder" link opens the decklist builder pre-loaded with that result

---

## State Variables

```js
let expandedDeckId = null;           // which deck is expanded
let expandedDeckHistoryKey = null;   // which result entry is expanded (entryKey = result.id)
const deckHistoryCache = new Map();  // deckId → { loading, results, error }
```

---

## Data Query

```
GET /rest/v1/tournament_results
  ?deck_id=eq.<id>
  &select=id,placement,tournament_date,tournament_id,decklist,
          player:players(id,name),
          store:stores(name),
          decklists(id,decklist_cards(card_code,qty,position))
  &order=tournament_date.desc,placement.asc
  &limit=200
```

- `decklists(...)` is a nested embed — returns the structured decklist if one exists
- `decklist` column is the legacy text decklist (fallback)

---

## Decklist Resolution Priority

1. **Structured** — `decklists[0].decklist_cards` (sorted by `position`)
2. **Legacy text** — `decklist` column parsed by `parseDecklistByLinesForHistory()`
3. **None** — result is filtered out (not shown to user)

---

## Key Functions

| Function | Purpose |
|---|---|
| `toggleDeckHistory(deckId)` | Toggle expand/collapse, trigger load if not cached |
| `loadDeckHistory(deckId)` | Fetch from Supabase, store in `deckHistoryCache` |
| `renderDeckHistoryPanel(deckId, deckName)` | Render the full panel HTML |
| `toggleDeckHistoryEntry(entryKey)` | Toggle individual result expand |
| `renderDeckHistoryCardsHtml(cards)` | Render card image grid with multi-CDN fallback |
| `bindDeckHistoryImageFallbacks(root)` | Attach error handlers to cycle through image CDN candidates |
| `buildDecklistBuilderUrl(params)` | Build the decklist-builder URL with resultId + metadata |
| `parseDecklistByLinesForHistory(text)` | Parse legacy text decklists into card entries |

---

## Card Image Fallback Chain

```js
[
  `https://deckbuilder.egmanevents.com/card_images/digimon/${code}.webp`,
  `https://deckbuilder.egmanevents.com/card_images/digimon/${code}.png`,
  `https://card-list.prodigi.dev/images/cards/${code}.webp`,
  `https://card-list.prodigi.dev/images/cards/${code}.png`,
  // final fallback: placeholder image with card code text
]
```

Candidates are stored in `data-image-candidates` attribute. On `error` event, the next candidate is tried.

---

## CSS Classes Used

All from `styles/pages/players.css` (shared with player history):

| Class | Purpose |
|---|---|
| `.player-history` + `.deck-history-list` | Scrollable result list container |
| `.player-history-entry` | Wrapper for one result (collapsed/expanded) |
| `.player-history-item` | Clickable row with placement color |
| `.player-history-main` | Player name + store/date text |
| `.player-history-decklist-panel` | Card grid wrapper |
| `.player-history-decklist-grid` | CSS grid for card images |
| `.player-history-deck-card` | Individual card article |
| `.player-history-register-btn` | "Edit in Builder" pill button |

Deck-specific overrides in `styles.css`:

| Class | Purpose |
|---|---|
| `.deck-history-tr` | Transparent TR for list view panel row |
| `.deck-history-td` | Zero-padding TD for list view panel cell |
| `.deck-history-panel-compact` | Panel wrapper for compact/grid views |
| `.deck-history-list .player-history-item` | 2-column grid (no store logo column) |
| `.deck-name-toggle` | Button reset for compact/grid name toggle |

---

## "Has Decklists" Filter

At `loadDecks()` time, `loadDeckIdsWithDecklists()` fetches the set of `deck_id` values that have at least one registered decklist:

```
GET /rest/v1/tournament_results?select=deck_id,decklists!inner(id)&limit=5000
GET /rest/v1/tournament_results?select=deck_id&decklist=not.is.null&limit=5000
```

Results are stored in `deckIdsWithDecklists: Set<string>`. When the "Has decklists" checkbox is checked, `filterDecks()` excludes any deck whose ID is not in this set.

---

## Extending This Feature

- **Add player filter**: add a player selector to the panel header, filter `cached.results` by `item.player?.id`
- **Add sort**: add sort buttons to the panel header, sort `cached.results` before rendering
- **Increase limit**: change `&limit=200` in `loadDeckHistory()` — consider adding pagination if datasets grow large
