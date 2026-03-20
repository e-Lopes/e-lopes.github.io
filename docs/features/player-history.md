# Feature: Player History

**File:** `players/script.js`
**Page:** `/players/`

---

## What it does

Each player row in the players table can be expanded to show their full tournament history. Each result can be expanded to show their decklist card grid, with an "Edit in Builder" link if a decklist exists, or a "Register" button if it doesn't.

---

## State Variables

```js
let expandedPlayerId = null;          // which player is expanded
let expandedHistoryEntryKey = null;   // which result is expanded (key = "playerId:resultId")
const playerHistoryCache = new Map(); // playerId → array of result rows | null (loading)
```

---

## Data Query

The builder uses a two-step approach because the `decklists` table was added later:

1. **Resolve column**: checks if `decklist` or `decklist_link` column exists on `tournament_results`
2. **Fetch history**:
```
GET /rest/v1/tournament_results
  ?player_id=eq.<id>
  &select=id,placement,tournament_date,tournament_id,<decklist_col>,
          store:stores(name),deck:decks(name)
  &order=tournament_date.desc,placement.asc
  &limit=200
```

Note: Player history currently uses the **legacy text decklist** column only (not the structured `decklists` table). The "Edit in Builder" link passes `resultId` so the builder can load the structured version.

---

## Key Functions

| Function | Purpose |
|---|---|
| `togglePlayerHistory(playerId)` | Toggle expand/collapse, trigger load |
| `loadPlayerHistory(playerId)` | Fetch from Supabase, store in cache |
| `renderPlayerHistory(historyRows, playerId, playerName)` | Render entry list HTML |
| `togglePlayerHistoryEntry(entryKey)` | Toggle individual result expand |
| `renderDecklistCards(entries)` | Render card image grid |
| `buildDeckCardImageCandidates(code)` | Multi-CDN fallback URL list |
| `bindDecklistImageFallbacks(root)` | Attach error handlers for image fallback |
| `openHistoryDecklistRegister(button)` | Navigate to decklist builder for registering |

---

## Decklist in Player History

When a result is expanded:
- If `decklist` text column has content → parse and show card grid + "Edit in Builder"
- If empty → show "No Decklist Registered" + "Register" button

The "Register" and "Edit in Builder" buttons both navigate to the decklist builder with `resultId` in the URL, where the structured decklist can be created/edited.

---

## CSS

All styles in `styles/pages/players.css`. Key classes:

| Class | Purpose |
|---|---|
| `.player-main-toggle` | Full-width clickable button for player name row |
| `.player-main-hint` | "Show history / Hide history" text |
| `.player-history` | Scrollable history list (max-height: 470px) |
| `.player-history-item` | Result row with 3-column grid (logo / rank / main) |
| `.player-history-register-btn` | Pill button for Register / Edit in Builder |
