# Feature: OCR Import (Bandai TCG+)

**Used in:** New Tournament modal (`torneios/list-tournaments/script.js`)

---

## What it does

The New/Edit Tournament modals optionally accept one or more Bandai TCG+ screenshots. On desktop, multiple images can be selected or dragged together into the upload field. The images are processed sequentially and their rows are combined to extract players, Bandai IDs, match points, store and date. A tournament can still be created completely manually.

## Swagger Link: https://e-lopes-digimon-ocr-api.hf.space/docs#/
---

## API

```
POST https://e-lopes-digimon-ocr-api.hf.space/process
Content-Type: multipart/form-data
Body: { file: <image file> }
```

**Response fields used:**

| Field | Usage |
|---|---|
| `players[]` | Player results, including optional `points`, used to populate the results table |
| `store_name` | Pre-selects the store dropdown |
| `tournament_date` or `tournament_datetime` | Pre-fills the date field |

---

## Known Limitations

- OCR accuracy depends on image quality and Bandai TCG+ screenshot format
- Store name matching is fuzzy — if the extracted name doesn't match a known store, the dropdown is left at the default
- Player name matching against the DB is done client-side (best-effort fuzzy match)
- No retry mechanism if the OCR API is unavailable (Hugging Face Spaces may cold-start)

## Player resolution

- Bandai ID is preferred when present in the OCR result.
- Exact and normalized names are used as fallbacks.
- Existing inactive players are included in the lookup.
- If an existing player has no `bandai_id` and the screenshot provides it, the record is updated and reactivated instead of creating a duplicate.
- Only genuinely unresolved players are presented for confirmation and registration.
- Confirmation and error dialogs are rendered above the tournament modal so the flow remains interactive.

## Persistence

- `tournament_results.match_points` stores Bandai match points (`NULL` when unknown and `0` when the player scored zero).
- Successfully processed source images must be archived before the modal completes the save.
- Storage bucket: `tournament-ocr-sources` (public).
- Metadata table: `tournament_ocr_files`; manual tournaments have no rows in this table.
- New OCR files uploaded during an edit are appended to the existing evidence history.

---

## Error Handling Debt

The OCR pipeline currently has minimal validation:
- API errors show a generic alert
- Partial results (e.g., missing date) silently fall back to empty fields
- No timeout handling for slow cold-starts

Improving this is tracked in `roadmap.md`.
