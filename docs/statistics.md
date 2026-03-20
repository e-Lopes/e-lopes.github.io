# DigiStats — Statistics Module

## Overview

The statistics module is the analytical core of DigiStats. It provides tournament performance data for decks, players, cards, colors, and stores through 7 distinct views, all accessible from the Statistics tab in the main dashboard.

---

## Current Views

### 1. Deck Performance (`v_deck_stats`)
**Default view.** Rankings aggregated across all tournaments.

| Column | Description |
|--------|-------------|
| entries | Total appearances in tournaments |
| titles | 1st place finishes |
| top4_total | Total top 4 finishes |
| title_rate_percent | % of entries that resulted in a title |
| top4_rate_percent | % of entries that resulted in top 4 |
| avg_placement | Average finishing position |
| best_finish / worst_finish | Best and worst recorded placements |
| ranking_points | Weighted score: 1st=15, 2nd=10, 3rd=7, 4th=5 |
| performance_rank | Overall rank by ranking_points |

### 2. Meta Share (`v_meta_by_month`)
Metagame composition grouped by month and format. Shows how much of the field each deck represents and how it performs within that slice.

Filters: format, month.

### 3. Color Meta (`v_deck_color_stats`)
Aggregates deck performance by color (R/U/B/W/G/Y/P). Shows usage %, titles, top4s, and the best-performing deck of each color.

> **Note:** This view is built entirely client-side by aggregating raw tournament_results. It is the only view without a backing SQL view — see improvement notes below.

Filters: format, month.

### 4. Top Cards (`v_top_cards_by_month`)
Cards appearing in top 4 decklists, ranked by total copy count. Tracks how many copies appeared in 1st, 2nd, 3rd, and 4th place decks.

- Paginated (10 cards per page)
- Staple toggle: mark/unmark a card as a format staple
- Card names resolved from `decklist_card_metadata`, with API fallback

> **Important:** Columns `champion`, `top2`, `top3`, `top4` represent **copy counts** (total copies across all qualifying decklists), not the number of decklists containing the card. This distinction matters when interpreting high-copy cards like energy/option cards.

Filters: month, date, staple status.

### 5. Player Ranking (`v_player_ranking` + `v_monthly_ranking`)
All-time and monthly player rankings. Monthly view has an inline selector to navigate between months without changing the page filter.

| Column | Description |
|--------|-------------|
| titles | Total 1st place finishes |
| top4_total | Total top 4 appearances |
| entries | Events entered |
| ranking_points | Same scoring as deck stats |
| unique_decks_used | How many different decks the player has used |
| avg_placement | Average finishing position |

### 6. Store Champions (`v_store_champions`)
Top performers ranked per store. Shows which players dominate each store's scene and their share of that store's titles.

- Collapsible store cards on mobile
- Player search filter (client-side)

### 7. Deck Representation (`v_deck_representation`)
Similar to Deck Performance but focuses on breadth: how many unique players and tournaments a deck has appeared in, as a proxy for its "reach" in the meta.

---

## Scoring System

All ranking_points calculations use the same formula:

| Placement | Points |
|-----------|--------|
| 1st | 15 |
| 2nd | 10 |
| 3rd | 7 |
| 4th | 5 |
| Outside top 4 | 0 |

A separate `v_deck_rank` view applies a tournament size multiplier to weight points:
- ≤ 8 players: 1.0×
- 9–16 players: 1.2×
- ≥ 17 players with 5+ rounds: 1.5×

---

## Filters

| Filter | Available In |
|--------|-------------|
| Store | All views |
| Format | Meta by month, Color meta |
| Month | Meta by month, Top cards |
| Tournament date | Top cards |
| Staple status | Top cards only |
| Player search | Store champions only |
| Month selector (inline) | Player ranking |

---

## Technical Notes

- All views use Supabase REST (`/rest/v1/{viewName}?select=*`)
- All SQL views use `SECURITY INVOKER` to respect RLS
- Column order, visibility, and help tooltips are defined in `STATISTICS_VIEW_COLUMN_ORDER` and `STATISTICS_COLUMN_HELP_PTBR` in `list-tournaments/script.js`
- Column widths are persisted in `localStorage` (`dashboardStatisticsColumnWidths`)
- Last selected view is also persisted (`dashboardStatisticsView`)

---

## Known Limitations & Improvement Areas

### Data quality
- `card_level` was not being saved correctly for older decklists (fixed March 2026). Legacy rows may still have `card_level = null`, affecting Top Cards grouping.
- Top Cards requires Top 4 decklists to have been registered via the deckbuilder — unregistered decklists are invisible to this view.

### Architecture
- `v_deck_color_stats` is the only view built entirely client-side. Every load aggregates raw tournament_results. Converting to a SQL view would improve performance and allow server-side filtering.
- Card name lookups in Top Cards fall back to the public Digimon API, which can be slow and rate-limited.

### Missing visualizations
- No charts or graphs — all data is tabular only.
- No visual representation of meta trends over time.

---

## Improvement Ideas (see roadmap for prioritization)

See `roadmap.md` for the full list with priorities. Short version:

1. **Pie/bar charts for meta share** — visualize which decks dominate a format at a glance
2. **Deck trend line** — show a deck's meta share month-over-month
3. **Top cards per deck** — "what does a typical [Deck X] play?"
4. **Head-to-head (future)** — requires match-level data not currently collected
5. **Format health score** — single number reflecting meta diversity
6. **Convert color stats to SQL view** — performance improvement
