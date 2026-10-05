# post-preview

Dedicated route for post preview and export.

Entry points:

- `post-preview/index.html`
- opened from `torneios/list-tournaments/index.html`

The distribution post contains only the deck chart and its legend, without standings. Its legend shows deck names, entries and percentages of recorded results; rounded percentages may not add up to exactly 100%. Remaining decks are grouped as “Outros” when the legend does not fit, keeping all pie slices. Card artwork is framed within each sector's bounds, with per-deck crop adjustments available in the pie editor.

Decklist is offered only after the champion's list has been loaded and parsed. Missing lists, external links without card text and lists belonging only to another placement do not enable that post type. An unavailable saved Decklist selection falls back to Top 4. Empty responses are not cached, allowing another check after the list is added.

Player and deck names in Top 4 posts fit the available text width instead of being cut to a fixed number of characters. Custom template positions remain editable.
