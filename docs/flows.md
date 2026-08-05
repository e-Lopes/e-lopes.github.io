# Product Flows (Detailed)

This document details the core and secondary user flows for DigiStats Dashboard.
It is intended to guide UX, UI, and engineering implementation.

---

# Flow 1: Create Tournament + Save Results

## Goal
Create a tournament and persist results reliably.

## Screens
- Tournament list + calendar
- New Tournament modal

## Components
- DigiLab tournament URL/ID import
- Multi-image Bandai TCG+ OCR import
- Date picker
- Store selector + quick add
- Format selector
- Results table (placement, player, deck, points)
- Save/Cancel actions

## Steps
1. User opens the dashboard.
2. Clicks "New Tournament".
3. Optionally imports a DigiLab URL/ID or one or more Bandai TCG+ screenshots.
4. Reviews the imported fields or fills them manually (date, store, format).
5. Adds or adjusts results (placement, player, deck, points).
6. Validations run in real time.
7. Clicks Save.
8. UI confirms success and updates list/calendar.

## UI States
- `idle` -> `editing` -> `saving` -> `success | error`

## Validations
- Required: date, store, format
- Unique placements
- Valid player + deck references (or create new)

## Messages
- "Tournament saved successfully."
- "Please fill the required fields."
- "Failed to save. Try again."

---

# Flow 2: Build + Save Normalized Decklist

## Goal
Build a decklist with rules, metadata, and stable ordering.

## Screens
- Decklist Builder page

## Components
- Card search (name, type, color, level)
- Manual input
- Deck list area (with quantities)
- Sort button
- Save button
- Errors/validation panel

## Steps
1. User enters via a tournament result.
2. Adds cards by search or manual code.
3. Validations run (qty limits, eggs, total, restrictions).
4. Sorts by type/level order.
5. Saves decklist.
6. Reopen shows decklist in normalized order.

## UI States
- `idle` -> `editing` -> `validating` -> `saving` -> `success | error`

## Validations
- Eggs <= 5, Main <= 50, Total <= 55
- Restrictions: banned/limited/choice rules
- Qty rules (including unlimited)

## Messages
- "Decklist saved successfully."
- "Invalid decklist: main deck limit exceeded."
- "Failed to save. Try again."

---

# Flow 3: OCR Import + Review + Confirm

## Goal
Import tournament data from screenshots and validate before saving.

## Screens
- OCR modal inside New Tournament

## Components
- Multi-file selection and desktop drag-and-drop
- Progress status
- Preview / review table
- Inline corrections

## Steps
1. User selects or drags one or more screenshots.
2. State: `uploading -> parsing`.
3. OCR results are combined and return players, optional Bandai IDs, points, store and date.
4. Existing players are resolved by Bandai ID or name, including inactive records.
5. If a matched player lacks Bandai ID, the value extracted from the screenshot updates the existing record.
6. Only unresolved players are offered for registration.
7. User reviews, edits, confirms and saves.

## UI States
- `idle` -> `uploading` -> `parsing` -> `review` -> `saving` -> `success | error`

## Validations
- Valid date
- No duplicate placements
- Players matched or created

## Messages
- "OCR completed. Please review."
- "Fix the highlighted issues."
- "Failed to parse. Try again."

---

# Flow 3B: Import from DigiLab

## Goal
Fill or create a tournament from its public DigiLab URL without requiring Admin access.

## Steps
1. User opens **Novo torneio**.
2. Pastes a URL such as `https://digilab.cards/tournament/7187` or a positive DigiLab ID.
3. DigiStats requests a preview for that exact tournament and automatically creates its meta locally when needed.
4. Store, date, format, standings, decks and points are filled when available.
5. User reviews the data and saves the tournament.

The Admin also maintains a Curitiba inventory. A scheduled worker checks it every 15 minutes, processes newly discovered rows in the same cycle, creates only unambiguous new players and imports fully resolved tournaments. The desktop sidebar counts down to the next cycle and refreshes the tournament list after it runs. Conflicts remain available for administrative review.

---

# Flow 4: Post Preview / Post Generator (Critical)

## Goal
Generate publish-ready text and images for the main client.

## Screens
- Post Preview page

## Components
- Tournament selector
- Results selector (top placements)
- Editable fields (title, body, hashtags)
- Live preview
- Export actions (copy, generate image)

## Steps
1. User selects a tournament.
2. Results load and are chosen.
3. System generates a draft.
4. User edits content.
5. Preview updates live.
6. User copies text or downloads image.

## UI States
- `idle` -> `loading` -> `editing` -> `generating` -> `success | error`

## Validations
- Tournament selected
- At least one placement selected
- Required fields not empty

## Messages
- "Text copied."
- "Image generated."
- "Failed to generate."

---

# Flow 5: Players Management

## Goal
Maintain clean player registry to reduce OCR errors.

## Screens
- Players list
- Player create/edit modal

## Components
- Search
- Add player
- Alias list
- Merge duplicates (optional)

## Steps
1. User opens Players page.
2. Searches or creates a player.
3. Adds aliases used by OCR.
4. Saves.

## UI States
- `loading` -> `editing` -> `saving` -> `success | error`

## Validations
- Name required
- Aliases must be unique

## Messages
- "Player saved."
- "Name already exists."

---

# Flow 6: Decks Management

## Goal
Organize decks for reuse and analytics.

## Screens
- Decks list
- Deck create/edit modal

## Components
- Search
- Filters by color/archetype
- Tags

## Steps
1. User opens Decks page.
2. Creates or edits deck.
3. Assigns tags or archetype.
4. Saves.

## UI States
- `loading` -> `editing` -> `saving` -> `success | error`

## Validations
- Name required
- Color valid

## Messages
- "Deck saved."
- "Fill required fields."

---

# Flow 7: Tournament List + Calendar

## Goal
Provide an overview and fast access to tournament data.

## Screens
- List view
- Calendar view

## Components
- Search bar
- Filters (date/store/format)
- View switcher
- Quick actions (edit, view results)

## Steps
1. User opens dashboard.
2. List or calendar loads.
3. User filters or searches.
4. Opens details or edits.

## UI States
- `loading` -> `loaded` -> `empty`

## Validations
- Date range valid

## Messages
- "No tournaments found."

---

# Flow 8: Edit Tournament + Results

## Goal
Update tournament data without breaking related records.

## Screens
- Edit modal

## Components
- Editable fields (name, date, store, format)
- Results grid
- Save button

## Steps
1. User opens Edit from list.
2. Updates fields or results.
3. Validations run.
4. Saves and refreshes list.

## UI States
- `idle` -> `editing` -> `saving` -> `success | error`

## Validations
- Unique placements
- Valid player references

## Messages
- "Changes saved."
- "Failed to update."

---

# Flow 9: Statistics (Lower Priority)

## Goal
Provide insights, dependent on decklist submission volume.

## Screens
- Stats dashboard

## Components
- Filters (month, store, format)
- Charts (meta, top cards, player ranking)
- Data completeness indicator

## Steps
1. User opens Stats.
2. Data loads.
3. User filters.
4. Views charts.

## UI States
- `loading` -> `partial` -> `complete`

## Validations
- Warn when data coverage is low

## Messages
- "Data is incomplete. Encourage decklist submission."
