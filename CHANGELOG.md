# Changelog

## 2026-07-25

### Cadastro de torneios e OCR
- Prints processados pelo OCR agora podem ser arquivados e vinculados ao torneio; torneios manuais continuam sem anexos.
- Resultados aceitam `match_points` opcional, preservando a diferenca entre `NULL` e zero pontos.
- Players e decks digitados que ainda nao existem podem ser cadastrados sem abandonar o modal do torneio.
- New/Edit Tournament receberam layout operacional para mobile e nao fecham mais por clique no backdrop.
- Comprovantes e pontos aparecem nos detalhes publicos quando estiverem disponiveis.
- A administracao de lojas agora inclui uma agenda semanal que sugere automaticamente a loja pela data do novo torneio.
- Novos torneios iniciam como `Semanal`; a loja sugerida, o nome e os demais campos continuam editaveis.
- A interface usa "Print Bandai" em vez do termo tecnico OCR, e o link do Instagram fica recolhido por padrao.

### Feedback do site
- A barra lateral ganhou links discretos para reportar bugs e enviar sugestoes.
- O formulario registra mensagens em uma tabela privada e usa uma Edge Function para enviar e-mail via Resend.
- O destinatario e as credenciais de e-mail ficam em secrets do Supabase, nunca no frontend.
- O link externo e o tooltip do GitHub foram removidos do logo do DigiStats.

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
