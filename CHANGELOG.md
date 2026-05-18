# Changelog

## 2026-05-18

### Card image pipeline — Supabase Storage bucket
- Criado bucket `deck-images` no Supabase Storage (público)
- Create/Edit Deck agora faz upload da imagem para o bucket ao salvar
- `deck_images.image_url` passa a apontar para o Storage (CORS garantido para canvas)
- Fallback browser-side para egmanevents quando Edge Function não está disponível

### Edge Function: `upload-card-image`
- Criada `supabase/functions/upload-card-image/index.ts`
- Roda server-side (sem CORS), tenta: Fandom `-Sample.png` → digimoncard.io → egmanevents
- Rejeita imagens brancas/placeholder (< 5KB)
- Chamada pelos modals e pelo sync admin para migrar deck_images para o Storage

### Post Preview melhorias
- `loadDeckCardImage`: prioridade Storage → Fandom → digimoncard.io → egmanevents
- Deck Distribution usa mesma cadeia de prioridade
- `isDeckCardImageBlank`: detecta imagens brancas via pixel sampling no canvas
- Cache-bust `?t=Date.now()` na URL do bucket evita 404 cacheado
- Avatar do deck extrai o código da `image_url` e usa `loadDeckCardImage`

### Admin — Sync Cards (Sync & Export)
- Substituiu os botões separados (Data Repair / Download Cards / Export Catalog) por um único botão
- Step 3: `fixCardTypesFromPayload` — corrige `card_type` nulo a partir do `card_payload` sem chamar a API
- Step 8: `syncDeckImages` — migra todos os `deck_images` CDN → Storage via Edge Function
- Early return removido: sempre executa export e sync de imagens mesmo com catálogo completo
- Seções antigas ocultadas via JS (sem editar Webflow)

### Novo tipo de carta: Dual
- Adicionado `card_type = 'Dual'` em `deriveCardMeta` / `deriveMeta` (admin, sync-all, sync-card-metadata)
- `normalizeCardType` no deckbuilder retorna `'dual'`
- `getEntryGroupInfo` no deckbuilder: grupo `{ key: 'dual', label: 'Dual' }`
- `card_level` normalizado para `0` para Option, Tamer e Dual (era null inconsistente)
- Chip "Dual" injetado no filtro de tipo do deckbuilder via JS

### Deckbuilder — busca por set
- Busca com apenas o filtro de set (ex: `BT25`) agora retorna todas as cartas
- `fetchAllCardsBySetFromApi`: usa `getAllCards` para listar os códigos, batch-fetch dos detalhes
- `applyLocalCardSearchFilters`: passa a filtrar também por `cardPrefix`
- `fetchCardSearchRows`: `sortdirection=desc` quando filtro de set ativo (sets novos primeiro)

### Imagens CDN — prioridade digimoncard.io
- `IMAGE_BASE_URL` em `decks/page.js`, `create-deck/modal.js`, `edit-deck/modal.js` → `images.digimoncard.io`
- `LEGACY_IMAGE_BASE_URL` mantido como fallback (egmanevents)
- Candidatos de imagem em `decks/page.js` incluem egmanevents como fallback explícito
- Preview dos modals: Fandom → digimoncard.io → egmanevents em cascata

### Modals Create/Edit Deck
- Não fecham mais ao clicar fora (removido listener de click no overlay)
- `FANDOM_BASE_URL` adicionado para preview e upload
- `fetchCardImageBlob`: fetch→blob→canvas WebP com blank check integrado

### Automação semanal (GitHub Actions)
- `.github/workflows/weekly-sync.yml`: toda segunda 04:00 UTC
- `npm run cards:sync-all` adicionado ao `package.json`
- `scripts/sync-all.js`: pipeline completo em 6 steps (getAllCards → metadata → upsert → catalog → deck images)
- Supabase secrets: `SUPABASE_URL` + `SUPABASE_KEY` (service role)

### Regex de código de carta — padronização
- Padrão unificado em todos os arquivos:
  `/^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3}$/`
- Arquivos atualizados: `admin/script.js` (SYNC_VALID_CODE_RE), `decks/page.js`,
  `decks/create-deck/modal.js`, `decks/edit-deck/modal.js`
- Deckbuilder já estava correto
