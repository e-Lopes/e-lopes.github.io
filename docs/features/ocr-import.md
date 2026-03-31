# Feature: OCR Import (Bandai TCG+)

**Used in:** New Tournament modal (`torneios/list-tournaments/script.js`)

---

## What it does

The "New Tournament" modal supports uploading a screenshot from the Bandai TCG+ app. The image is sent to an OCR API that extracts player results, store name, and tournament date automatically.

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
| `players[]` | Array of player result objects to populate the results table |
| `store_name` | Pre-selects the store dropdown |
| `tournament_date` or `tournament_datetime` | Pre-fills the date field |

---

## Known Limitations

- OCR accuracy depends on image quality and Bandai TCG+ screenshot format
- Store name matching is fuzzy — if the extracted name doesn't match a known store, the dropdown is left at the default
- Player name matching against the DB is done client-side (best-effort fuzzy match)
- No retry mechanism if the OCR API is unavailable (Hugging Face Spaces may cold-start)

---

## Error Handling Debt

The OCR pipeline currently has minimal validation:
- API errors show a generic alert
- Partial results (e.g., missing date) silently fall back to empty fields
- No timeout handling for slow cold-starts

Improving this is tracked in `roadmap.md`.
