# DigiStats — CSS Guide

## File Structure

```
styles.css                  ← global (monolithic, split in progress)
styles/
  components/
    utilities.css           ← u-* utility classes (u-hidden, u-mt-20, etc.)
    states.css              ← .loading, .error, .empty-state
  pages/
    players.css             ← players page + shared history classes
```

### Why `players.css` is loaded on multiple pages

`styles/pages/players.css` defines the `.player-history-*` family of classes that are **reused** across pages:

| Class family | Used in |
|---|---|
| `.player-history-entry`, `.player-history-item` | `players/`, `decks/` |
| `.player-history-decklist-grid`, `.player-history-deck-card` | `players/`, `decks/` |
| `.player-history-register-btn` | `players/`, `decks/` |
| `.player-main-toggle`, `.player-main-hint` | `players/`, `decks/` |

Pages that need these classes must explicitly include the stylesheet:
```html
<link rel="stylesheet" href="../styles/pages/players.css" />
```

Currently included in: `index.html`, `players/index.html`, `decks/index.html`.

---

## Naming Conventions

- **Classes:** `kebab-case` — e.g. `.deck-history-panel`, `.player-main-hint`
- **No BEM strictly** — flat class names with descriptive prefixes by feature
- **Page prefix pattern:** `.decks-*`, `.players-*`, `.torneios-*` for page-scoped styles
- **Component prefix pattern:** `.player-history-*`, `.deck-history-*` for reusable feature components
- **State classes:** `.is-open`, `.is-active`, `.is-expanded`, `.u-hidden`

---

## Dark Theme

Dark theme is driven by `body[data-theme='dark']` set via `ui-state.js`.

Pattern for dark overrides:
```css
/* Light (default) */
.my-component {
    background: #f5f7ff;
    border-color: #dde3f5;
    color: #2e3f72;
}

/* Dark override */
body[data-theme='dark'] .my-component {
    background: #161e2e;
    border-color: #2a3a5a;
    color: #cfdaef;
}
```

Common dark palette values:
| Purpose | Value |
|---|---|
| Page background | `#0f1623` |
| Surface / card | `#161e2e` |
| Border | `#2a3a5a` |
| Text primary | `#e8eeff` |
| Text secondary | `#cfdaef` |
| Text muted | `#6a82b4` |
| Accent blue | `#667eea` |

---

## Button Classes

| Class | Usage |
|---|---|
| `.btn-primary` | Main CTA (Add, Save) |
| `.btn-secondary` | Secondary action |
| `.btn-secondary.btn-icon` | Icon-only secondary button |
| `.btn-secondary.btn-danger` | Destructive secondary action |
| `.btn-pagination` | Pagination prev/next/first/last |
| `.btn-pagination-number` | Numbered page button |
| `.player-history-register-btn` | Pill-shaped action button (Edit in Builder, Register) |

---

## Adding New Page Styles

1. If the styles are **page-specific and not reused**: add to `styles.css` with a page-scoped comment block and class prefix.
2. If the styles are **reused across pages**: add to `styles/pages/players.css` (or create a new file under `styles/pages/`) and include it in all relevant HTML files.
3. **Always add a dark theme override** for any component that sets `background`, `color`, or `border-color`.

---

## Known Debt

- `styles.css` is ~11,000 lines and mixes global resets, page styles, and component styles. Split is ongoing.
- Some dark theme overrides in `styles.css` use `!important` due to specificity conflicts from the monolithic structure.
- Legacy `.player-main-hint` has `background: #162033 !important` in dark mode (from `styles.css`) which is intentional — blends with page background to appear invisible.
