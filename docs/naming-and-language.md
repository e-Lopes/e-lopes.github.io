# Naming And Language Conventions

## Path And File Naming

- Prefer English names for new folders/files.
- Use `kebab-case` for folders/files.
- Keep PT and EN routes aligned while both are in use.

## Code Naming

- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`

## UI Language

- Current UI is mixed PT/EN.
- New screens should default to English unless a dedicated i18n layer is introduced.
- Keep wording consistent inside each page.

## Migration Rule

When renaming paths, create temporary redirects/aliases first (already done for `tournaments/`).
