# Structure And Naming Plan

## Current Goal

Improve organization without breaking current routes.

## Naming Conventions

- Folders/files: `kebab-case`
- JavaScript variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case` with optional prefixes

## Language Convention

- Prefer English for folder/file names
- Keep UI copy bilingual only when needed by product

## Target Folder Layout (Next Phase)

```text
config/
  supabase.js

docs/
  structure-plan.md

pages/
  dashboard/
  players/
  decks/
  tournaments/

assets/
  icons/
  images/

styles/
  base.css
  components/
  pages/
```

## Migration Steps

1. Keep existing paths working; only add shared config/docs first.
2. Split `styles.css` into `styles/base.css`, `styles/components/*`, `styles/pages/*`.
3. Move inline scripts to page-level `.js` files.
4. Move inline event handlers (`onclick`) to `addEventListener`.
5. Introduce shared API helper (`config/api-client.js`) to reduce repeated fetch patterns.

## Critical Cleanup Candidates

- `styles.css`: split and remove duplicated blocks
- `post-preview/`: dedicated post editor route
- duplicated Supabase constants: now centralized, continue removing leftovers
