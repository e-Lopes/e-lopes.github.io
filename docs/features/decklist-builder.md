# Feature: Decklist Builder

**File:** `torneios/decklist-builder/script.js`
**Page:** `/torneios/decklist-builder/`

---

## What it does

A card-by-card decklist editor tied to a specific tournament result. Loads an existing decklist, lets the user add/remove cards, validates deck limits, auto-sorts, and saves back to Supabase.

---

## URL Parameters

The builder is always opened with context params:

| Param | Source | Purpose |
|---|---|---|
| `resultId` | tournament_results.id | Primary key — used to load/save the decklist |
| `deck` | deck name | Shown in metadata header |
| `player` | player name | Shown in metadata header |
| `store` | store name | Shown in metadata header |
| `date` | tournament date | Shown in metadata header |
| `format` | format string | Shown in metadata header |

Without `resultId`, the builder works as a scratchpad but cannot save.

---

## Save Flow

```
1. Upsert decklists row (tournament_result_id = resultId)
2. Delete existing decklist_cards for that decklist_id
3. Upsert decklist_card_metadata for all card codes
4. Insert decklist_cards (position, card_code, qty)
5. Patch tournament_results.decklist (legacy text column)
```

---

## Card Metadata Pipeline

When a card is added:
1. Query `decklist_card_metadata` (DB cache) by `card_code`
2. If missing or level is null → query `https://digimoncard.io/api-public/search`
3. If API also has no data → card sorts as level 99 (end of Digimon group)

**Known limitation:** The Digimon Card API does not cover all expansions. New sets (EX11+) must be manually inserted into `decklist_card_metadata`. Use:
```bash
npm run cards:sync-metadata
```

---

## Sort Order

Cards are sorted by a stable comparator:

1. **Group:** digi-egg → digimon → tamer → option
2. **Level (Digimon only):** 2, 3, 4, 5, 6, 7+
3. **Set family rank:** BT > EX > ST > P > LM (then alphabetical within family)
4. **Serial number:** ascending within set
5. **Name/code:** tiebreaker

---

## Deck Limits

Enforced both client-side and by a DB trigger (`validate_decklist_limits`):

| Zone | Limit |
|---|---|
| Digi-egg deck | ≤ 5 cards |
| Main deck | ≤ 50 cards |
| Total | ≤ 55 cards |

**Known limitation:** The DB trigger uses `INNER JOIN decklist_card_metadata`, so cards without a metadata row are not counted toward limits.
