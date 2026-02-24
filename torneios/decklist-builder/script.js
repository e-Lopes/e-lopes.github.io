(function decklistBuilderPage() {
    const IMAGE_BASE_URL = 'https://images.digimoncard.io/images/cards/';
    const LEGACY_IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com//card_images/digimon/';
    const LEGACY_IMAGE_CODES = new Set(['BT6-084', 'BT23-077', 'BT7-083', 'ST12-13']);
    const DIGIMON_CARD_API_URL = 'https://digimoncard.io/api-public/search';
    const DIGIMON_GET_ALL_CARDS_API_URL = 'https://digimoncard.io/api-public/getAllCards';
    const DIGISTATS_LOGO_URL = '../../icons/logo.png';
    const TEMPLATE_EDITOR_STATE_KEY = 'digistats.template-editor.state.v1';
    const BLANK_MIDDLE_FALLBACK_BG = '../../icons/backgrounds/EX11.png';
    const DECK_CODE_PATTERN = /^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3}$/;
    const RAW_DECK_CODE_WITH_SUFFIX_PATTERN =
        /((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3})(?:_[A-Z0-9]+)?/i;
    const MAX_COPIES_PER_CARD = 4;
    const MAX_MAIN_DECK_CARDS = 50;
    const MAX_DIGI_EGG_CARDS = 5;
    const CARD_SEARCH_LIMIT = 40;
    const CARD_SEARCH_PAGE_SIZE = 6;
    const CARD_SEARCH_MAX_RESULTS = 240;
    const ALL_CARDS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
    const CARD_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
    const BANNED_CODES = new Set(['BT2-090', 'BT5-109', 'EX5-065']);
    const RESTRICTED_CODES = new Set([
        'BT1-090',
        'BT10-009',
        'BT11-033',
        'BT11-064',
        'BT13-012',
        'BT13-110',
        'BT14-002',
        'BT14-084',
        'BT15-057',
        'BT15-102',
        'BT16-011',
        'BT17-069',
        'BT19-040',
        'BT2-047',
        'BT3-054',
        'BT3-103',
        'BT4-104',
        'BT4-111',
        'BT6-100',
        'BT6-104',
        'BT7-038',
        'BT7-064',
        'BT7-069',
        'BT7-072',
        'BT7-107',
        'BT9-098',
        'BT9-099',
        'EX1-021',
        'EX1-068',
        'EX2-039',
        'EX2-070',
        'EX3-057',
        'EX4-006',
        'EX4-019',
        'EX4-030',
        'EX5-015',
        'EX5-018',
        'EX5-062',
        'P-008',
        'P-025',
        'P-029',
        'P-030',
        'P-123',
        'P-130',
        'ST2-13',
        'ST9-09'
    ]);
    const CHOICE_RESTRICTION_GROUPS = [
        ['BT20-037', 'EX8-037'],
        ['BT20-037', 'BT17-035'],
        ['EX7-064', 'EX2-007']
    ];
    const DECKLISTS_TABLE = 'decklists';
    const DECKLIST_CARDS_TABLE = 'decklist_cards';
    const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || '';
    const headers = window.createSupabaseHeaders
        ? window.createSupabaseHeaders()
        : { 'Content-Type': 'application/json' };

    let entries = [];
    let context = { resultId: '', deck: '', player: '', store: '', date: '', format: '' };
    let cardSearchResults = [];
    let cardSearchPage = 1;
    let cardSearchStatusAutoHideTimer = null;
    let allCardsIndexCache = null;
    let allCardsIndexCacheAt = 0;
    const cardDetailsByCode = new Map();
    let cardHydrationToken = 0;
    let deckErrorAutoHideTimer = null;

    document.addEventListener('DOMContentLoaded', async () => {
        bindActions();
        render([]);
        renderCardSearchResults();
        await applyContextFromQuery();
    });

    function bindActions() {
        const importButton = document.getElementById('btnDecklistBuilderImport');
        const exportButton = document.getElementById('btnDecklistBuilderExport');
        const exportImageButton = document.getElementById('btnDecklistBuilderExportImage');
        const addButton = document.getElementById('btnDecklistBuilderAdd');
        const saveButton = document.getElementById('btnDecklistBuilderSave');
        const sortCardsButton = document.getElementById('btnDecklistBuilderSortCards');
        const manualInput = document.getElementById('decklistBuilderManualCode');
        const importCancelButton = document.getElementById('btnDecklistImportCancel');
        const importConfirmButton = document.getElementById('btnDecklistImportConfirm');
        const importCloseButton = document.getElementById('btnDecklistImportClose');
        const importModal = document.getElementById('decklistImportModal');
        const zoomModal = document.getElementById('deckCardZoomModal');
        const zoomCloseButton = document.getElementById('btnDeckCardZoomClose');
        const zoomImage = document.getElementById('deckCardZoomImage');
        const cardSearchButton = document.getElementById('btnCardSearch');
        const cardSearchResetButton = document.getElementById('btnCardSearchReset');
        const cardSearchNameInput = document.getElementById('cardSearchName');
        const cardSearchCostInput = document.getElementById('cardSearchPlayCost');

        if (importButton) {
            importButton.addEventListener('click', () => openImportModal());
        }
        if (exportButton) {
            exportButton.addEventListener('click', () => exportDecklist());
        }
        if (exportImageButton) {
            exportImageButton.addEventListener('click', () => exportDeckAsImage());
        }
        if (addButton) {
            addButton.addEventListener('click', () => addManualCode());
        }
        if (saveButton) {
            saveButton.addEventListener('click', () => saveDecklist());
        }
        if (sortCardsButton) {
            sortCardsButton.addEventListener('click', () => {
                void sortDeckCards();
            });
        }
        if (importCancelButton) {
            importCancelButton.addEventListener('click', () => closeImportModal());
        }
        if (importCloseButton) {
            importCloseButton.addEventListener('click', () => closeImportModal());
        }
        if (importConfirmButton) {
            importConfirmButton.addEventListener('click', () => importDecklistFromModal());
        }
        if (importModal) {
            importModal.addEventListener('click', (event) => {
                if (event.target === importModal) closeImportModal();
            });
        }
        if (zoomModal) {
            zoomModal.addEventListener('click', (event) => {
                if (event.target === zoomModal) closeCardZoomModal();
            });
        }
        if (zoomCloseButton) {
            zoomCloseButton.addEventListener('click', () => closeCardZoomModal());
        }
        if (zoomImage) {
            zoomImage.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                closeCardZoomModal();
            });
        }
        if (cardSearchButton) {
            cardSearchButton.addEventListener('click', () => {
                void performCardSearch();
            });
        }
        if (cardSearchResetButton) {
            cardSearchResetButton.addEventListener('click', () => {
                resetCardSearch();
            });
        }
        if (cardSearchNameInput) {
            cardSearchNameInput.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void performCardSearch();
            });
        }
        if (cardSearchCostInput) {
            cardSearchCostInput.addEventListener('input', () => {
                const raw = String(cardSearchCostInput.value || '').replace(/\D+/g, '');
                const twoDigits = raw.slice(0, 2);
                if (!twoDigits) {
                    cardSearchCostInput.value = '';
                    return;
                }
                const clamped = Math.max(0, Math.min(20, Number(twoDigits)));
                cardSearchCostInput.value = String(clamped);
            });
        }

        if (manualInput) {
            manualInput.addEventListener('input', () => {
                manualInput.value = manualInput.value.toUpperCase();
            });
            manualInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addManualCode();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeImportModal();
                closeCardZoomModal();
            }
        });

        const searchResultsRoot = document.getElementById('cardSearchResults');
        if (searchResultsRoot) {
            searchResultsRoot.addEventListener('click', (event) => {
                const pageControl = event.target.closest('[data-search-page]');
                if (pageControl) {
                    const direction = String(pageControl.getAttribute('data-search-page') || '');
                    const totalPages = Math.max(
                        1,
                        Math.ceil((Array.isArray(cardSearchResults) ? cardSearchResults.length : 0) / CARD_SEARCH_PAGE_SIZE)
                    );
                    if (direction === 'prev') cardSearchPage = Math.max(1, cardSearchPage - 1);
                    if (direction === 'next') cardSearchPage = Math.min(totalPages, cardSearchPage + 1);
                    renderCardSearchResults();
                    return;
                }
                const card = event.target.closest('.decklist-search-card[data-code]');
                if (!card) return;
                const code = normalizeDeckCode(card.getAttribute('data-code') || '');
                if (!isValidDeckCode(code)) {
                    setCardSearchStatus('Invalid card code returned by search.', 'warn');
                    return;
                }
                const changed = tryUpsertEntry(code, 1, buildEntryMetaFromCard(cardSearchResults.find((item) => normalizeDeckCode(item?.card_code || item?.id || '') === code)));
                if (changed.error) {
                    render([changed.error]);
                    return;
                }
                setSaveStatus('');
                render([]);
                setCardSearchStatus(`${code} added to decklist.`, 'ok');
            });
        }
    }

    async function applyContextFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const deck = params.get('deck') || '';
        const player = params.get('player') || '';
        const store = params.get('store') || '';
        const date = params.get('date') || '';
        const format = params.get('format') || '';
        const resultId = String(params.get('resultId') || params.get('result_id') || '').trim();

        context.resultId = resultId;
        context.deck = deck;
        context.player = player;
        context.store = store;
        context.date = date;
        context.format = format;
        if (!context.resultId) {
            setSaveStatus('Select a result in Full Results to save this decklist.', 'warn');
        }

        renderContextMeta({ deck, player, store, date, format });

        await loadExistingDecklist();
    }

    function renderContextMeta(meta) {
        const metaRoot = document.getElementById('decklistBuilderMeta');
        if (!metaRoot) return;
        const formattedDate = formatContextDate(meta.date);

        const items = [
            { label: 'Deck', value: meta.deck || '-' },
            { label: 'Player', value: meta.player || '-' },
            { label: 'Store', value: meta.store || '-' },
            { label: 'Date', value: formattedDate || '-' },
            { label: 'Format', value: meta.format || '-' }
        ];

        metaRoot.innerHTML = items
            .map(
                (item) =>
                    `<div class="decklist-builder-meta-pill"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>`
            )
            .join('');
    }

    function formatContextDate(rawDate) {
        const value = String(rawDate || '').trim();
        if (!value) return '';
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return value;
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(parsed);
    }

    function openImportModal() {
        const modal = document.getElementById('decklistImportModal');
        const textarea = document.getElementById('decklistImportTextarea');
        if (!modal || !textarea) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => textarea.focus(), 0);
    }

    function closeImportModal() {
        const modal = document.getElementById('decklistImportModal');
        if (!modal || !modal.classList.contains('is-open')) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }

    async function openCardZoomModal(code) {
        const modal = document.getElementById('deckCardZoomModal');
        const image = document.getElementById('deckCardZoomImage');
        const metaTitle = document.getElementById('deckCardZoomMetaTitle');
        const metaBody = document.getElementById('deckCardZoomMetaBody');
        if (!modal || !image) return;
        const normalized = normalizeDeckCode(code || '');
        if (!isValidDeckCode(normalized)) return;
        image.src = getCardZoomImageUrl(normalized);
        image.alt = `Card preview ${normalized}`;
        if (metaTitle) metaTitle.textContent = normalized;
        if (metaBody) metaBody.innerHTML = '<div class="deck-card-zoom-meta-loading">Loading metadata...</div>';
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');

        const details = await ensureCardDetailsForZoom(normalized);
        if (metaTitle) {
            const cardName = String(details?.name || normalized).trim();
            metaTitle.textContent = `${cardName} (${normalized})`;
        }
        if (metaBody) {
            metaBody.innerHTML = buildCardZoomMetadataHtml(normalized, details);
        }
    }

    function closeCardZoomModal() {
        const modal = document.getElementById('deckCardZoomModal');
        const image = document.getElementById('deckCardZoomImage');
        const metaTitle = document.getElementById('deckCardZoomMetaTitle');
        const metaBody = document.getElementById('deckCardZoomMetaBody');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        if (image) image.src = '';
        if (metaTitle) metaTitle.textContent = '';
        if (metaBody) metaBody.innerHTML = '';
    }

    async function ensureCardDetailsForZoom(code) {
        const normalized = normalizeDeckCode(code || '');
        const cached = cardDetailsByCode.get(normalized);
        const cachedPayload =
            cached?.card_payload && typeof cached.card_payload === 'object' ? cached.card_payload : null;
        if (cached && hasRichApiPayload(cachedPayload)) {
            return cached;
        }
        const rows = await fetchCardsFromDigimonApi([normalized]);
        if (!Array.isArray(rows) || rows.length === 0) {
            return cached || { card_code: normalized, name: normalized, card_payload: {} };
        }
        const row = rows[0];
        const nowIso = new Date().toISOString();
        const merged = {
            ...(cached || {}),
            ...row,
            card_code: normalized,
            updated_at: nowIso
        };
        cardDetailsByCode.set(normalized, merged);
        return merged;
    }

    function hasRichApiPayload(payload) {
        if (!payload || typeof payload !== 'object') return false;
        const meaningfulKeys = [
            'id',
            'name',
            'play_cost',
            'evolution_cost',
            'evolution_color',
            'main_effect',
            'source_effect',
            'alt_effect',
            'rarity',
            'series',
            'set_name',
            'tcgplayer_id'
        ];
        return meaningfulKeys.some((key) => {
            const value = payload[key];
            if (value === null || value === undefined) return false;
            if (Array.isArray(value)) return value.length > 0;
            return String(value).trim() !== '';
        });
    }

    function buildCardZoomMetadataHtml(code, details) {
        const payload = details?.card_payload && typeof details.card_payload === 'object' ? details.card_payload : {};
        const firstPresent = (...values) =>
            values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
        const joinUniqueSlash = (...values) => {
            const seen = new Set();
            const parts = [];
            values.forEach((value) => {
                const text = String(value ?? '').trim();
                if (!text) return;
                const key = text.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                parts.push(text);
            });
            return parts.join(' / ');
        };
        const normalizeEffectText = (value) =>
            String(value || '')
                .replace(/Security Effect\s*\[Security\]/gi, '[Security]')
                .trim();
        const normalizedType = normalizeCardType(firstPresent(details?.type, payload?.type));
        const showLevel = normalizedType !== 'tamer' && normalizedType !== 'option';
        const playCostLabel = normalizedType === 'option' ? 'Use Cost' : 'Play Cost';
        const mergedColor = joinUniqueSlash(firstPresent(details?.color, payload?.color), payload?.color2);
        const mergedTrait = joinUniqueSlash(
            firstPresent(payload?.digi_type, payload?.digitype),
            payload?.digi_type2,
            payload?.digi_type3,
            payload?.digi_type4
        );

        const items = [
            { label: 'Card Type', value: firstPresent(details?.type, payload?.type) },
            { label: 'Color', value: mergedColor },
            { label: 'Digivolve Color', value: firstPresent(payload?.evo_color, payload?.digivolve_color, payload?.evocolor, payload?.evolution_color) },
            { label: 'Digivolve Level', value: firstPresent(payload?.evolution_level) },
            { label: 'Digivolve From', value: firstPresent(payload?.digivolve_from, payload?.evolution_from) },
            { label: playCostLabel, value: firstPresent(details?.play_cost, payload?.play_cost, payload?.playcost) },
            { label: 'Digivolve Cost', value: firstPresent(payload?.evo_cost, payload?.evolution_cost, payload?.evocost) },
            { label: 'Level', value: showLevel ? firstPresent(details?.level, payload?.level) : null },
            { label: 'Power', value: firstPresent(payload?.dp, payload?.power) },
            { label: 'Trait', value: mergedTrait },
            { label: 'Form', value: firstPresent(payload?.form) },
            { label: 'Attribute', value: firstPresent(payload?.attribute) },
            { label: 'Stage Level', value: firstPresent(payload?.stage) },
            { label: 'Rarity', value: firstPresent(details?.rarity, payload?.rarity) },
            { label: 'Artist', value: firstPresent(payload?.artist) },
            { label: 'Pack', value: firstPresent(details?.pack, payload?.pack) }
        ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');

        const textBlocks = [
            { label: 'Effect', value: normalizeEffectText(firstPresent(payload?.main_effect, payload?.effect)) },
            { label: 'Inherited Effect', value: normalizeEffectText(firstPresent(payload?.source_effect, payload?.inherited_effect)) },
            { label: 'Security Effect', value: normalizeEffectText(firstPresent(payload?.security_effect)) },
            { label: 'Alt Effect', value: normalizeEffectText(firstPresent(payload?.alt_effect)) },
            { label: 'Source', value: firstPresent(payload?.pack, details?.pack) },
            { label: 'Notes', value: firstPresent(payload?.notes) }
        ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');

        if (items.length === 0 && textBlocks.length === 0) {
            return '<div class="deck-card-zoom-meta-loading">No metadata found.</div>';
        }

        const rowsHtml = `
            <div class="deck-card-zoom-meta-grid">
                ${items
                    .map(
                        (item) => `
                            <div class="deck-card-zoom-meta-cell">
                                <span class="deck-card-zoom-meta-label">${escapeHtml(item.label)}</span>
                                <strong class="deck-card-zoom-meta-value">${escapeHtml(item.value)}</strong>
                            </div>
                        `
                    )
                    .join('')}
            </div>
        `;
        const textHtml = textBlocks
            .map(
                (item) => `
                    <div class="deck-card-zoom-meta-block">
                        <div class="deck-card-zoom-meta-block-title">${escapeHtml(item.label)}</div>
                        <div class="deck-card-zoom-meta-block-text">${escapeHtml(item.value)}</div>
                    </div>
                `
            )
            .join('');

        return `${rowsHtml}${textHtml}`;
    }

    function formatApiRawValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            return value.map((item) => (item === null ? 'null' : String(item))).join('\n');
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return String(value);
            }
        }
        if (value === '') return '""';
        return String(value);
    }

    function importDecklistFromModal() {
        const textarea = document.getElementById('decklistImportTextarea');
        if (!textarea) return;

        const pasted = textarea.value || '';
        const result = parseDecklistText(pasted, { enforceLimits: true });
        entries = result.entries;
        setSaveStatus('');
        render(result.errors);
        closeImportModal();
    }

    async function exportDecklist() {
        const validation = validateAggregatedEntries(entries);
        if (validation.errors.length > 0) {
            render(validation.errors);
            return;
        }
        if (entries.length === 0) {
            render(['No cards to export.']);
            return;
        }

        const decklistText = serializeDecklist(entries);
        try {
            await navigator.clipboard.writeText(decklistText);
            setSaveStatus('Decklist copied to clipboard.', 'ok');
        } catch {
            setSaveStatus('Could not copy automatically.', 'warn');
            window.prompt('Copy this decklist manually:', decklistText);
        }
    }

    async function exportDeckAsImage() {
        if (entries.length === 0) {
            render(['No cards to export as an image.']);
            return;
        }

        const exportImageButton = document.getElementById('btnDecklistBuilderExportImage');
        if (exportImageButton) exportImageButton.disabled = true;
        setSaveStatus('Generating decklist image...', 'info');

        try {
            const canvas = await buildDeckImageCanvas(entries);
            const filename = buildDeckImageFilename();
            const blob = await canvasToBlob(canvas);
            if (!blob) throw new Error('Failed to generate image blob.');

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setSaveStatus('Image exported successfully.', 'ok');
        } catch (error) {
            setSaveStatus('Failed to export image.', 'error');
            render([error?.message || 'Failed to export decklist image.']);
        } finally {
            if (exportImageButton) exportImageButton.disabled = false;
        }
    }

    async function buildDeckImageCanvas(sourceEntries) {
        const width = 1080;
        const height = 1080;
        const frameX = 22;
        const frameY = 16;
        const frameWidth = width - 44;
        const frameHeight = height - 32;
        const safePaddingX = 28;
        const safePaddingY = 18;
        const headerHeight = 170;
        const footerHeight = 220;
        const cardRatio = 88 / 63;
        const availableWidth = frameWidth - safePaddingX * 2;
        const availableHeight = frameHeight - headerHeight - footerHeight - safePaddingY * 2;
        const layout = chooseBestDeckImageGrid({
            count: sourceEntries.length,
            minCols: 4,
            maxCols: 8,
            availableWidth,
            availableHeight,
            cardRatio
        });

        const cardsPerRow = layout.cardsPerRow;
        const rows = layout.rows;
        const cardWidth = layout.cardWidth;
        const cardHeight = layout.cardHeight;
        const gapX = layout.gapX;
        const gapY = layout.gapY;
        const boardWidth = layout.boardWidth;
        const boardHeight = layout.boardHeight;
        const boardAreaX = frameX + safePaddingX;
        const boardAreaY = frameY + headerHeight + safePaddingY + 6;
        const boardX = boardAreaX + Math.max(0, Math.round((availableWidth - boardWidth) / 2));
        const boardY = boardAreaY + Math.max(0, Math.round((availableHeight - boardHeight) / 2));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas.');

        await drawDeckImageBackground(ctx, width, height);

        const deckTitle = context.deck || 'Deck Builder';
        const titleSize = Math.max(38, Math.min(56, Math.round(700 / Math.max(9, deckTitle.length))));
        const headerBoxY = frameY + 10;
        const titleY = headerBoxY + 42;
        const playerY = titleY + 60;
        const storeY = playerY + 48;
        const storeAndDate = buildDeckImageStoreDateLine();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#0f172a';
        ctx.font = `800 ${titleSize}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(deckTitle, width / 2, titleY);

        ctx.fillStyle = '#253248';
        ctx.font = '700 28px "Segoe UI", Arial, sans-serif';
        ctx.fillText(context.player || '-', width / 2, playerY);

        ctx.fillStyle = '#445470';
        ctx.font = '700 28px "Segoe UI", Arial, sans-serif';
        ctx.fillText(storeAndDate, width / 2, storeY);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        const imagePromises = sourceEntries.map((entry) => loadCardImage(entry.code));
        const [images, brandLogo] = await Promise.all([
            Promise.all(imagePromises),
            loadBrandLogoImage()
        ]);

        sourceEntries.forEach((entry, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            const x = boardX + col * (cardWidth + gapX);
            const y = boardY + row * (cardHeight + gapY);
            const image = images[index];

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#c9d2ff';
            ctx.lineWidth = 2;
            roundRect(ctx, x - 2, y - 2, cardWidth + 4, cardHeight + 4, 8);
            ctx.fill();
            ctx.stroke();

            if (image) {
                ctx.drawImage(image, x, y, cardWidth, cardHeight);
            } else {
                ctx.fillStyle = '#e6ebff';
                ctx.fillRect(x, y, cardWidth, cardHeight);
                ctx.fillStyle = '#31437f';
                ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(entry.code, x + cardWidth / 2, y + cardHeight / 2);
            }

            const badgeSize = Math.max(26, Math.min(40, Math.round(cardWidth * 0.28)));
            const badgeX = x + cardWidth - Math.round(cardWidth * 0.04) - badgeSize;
            const badgeY = y + Math.round(cardHeight * 0.12);
            const badgeRadius = badgeSize / 2;
            const centerX = badgeX + badgeRadius;
            const centerY = badgeY + badgeRadius;

            ctx.fillStyle = 'rgba(26, 31, 58, 0.9)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${Math.max(16, Math.round(badgeSize * 0.58))}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(entry.count), centerX, centerY + 1);
            ctx.textBaseline = 'alphabetic';
        });

        const footerY = frameY + frameHeight - footerHeight + 8;
        const footerX = frameX + 18;
        const footerWidth = frameWidth - 36;
        const createdText = 'Created with DigiStats';
        const logoSize = brandLogo ? 192 : 0;
        const logoX = footerX + footerWidth - logoSize - 4;
        const logoY = footerY + Math.round((footerHeight - logoSize) / 2) - 10;
        const textLeftX = footerX + 8;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#1f2f59';
        ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
        ctx.fillText(createdText, textLeftX, footerY + footerHeight - 26);

        if (brandLogo) {
            ctx.drawImage(brandLogo, logoX, logoY, logoSize, logoSize);
        }

        return canvas;
    }

    function chooseBestDeckImageGrid(options) {
        const count = Math.max(1, Number(options?.count) || 1);
        const minCols = Math.max(1, Number(options?.minCols) || 4);
        const maxCols = Math.max(minCols, Number(options?.maxCols) || 8);
        const availableWidth = Math.max(1, Number(options?.availableWidth) || 1);
        const availableHeight = Math.max(1, Number(options?.availableHeight) || 1);
        const cardRatio = Math.max(1, Number(options?.cardRatio) || 1.39);
        let best = null;

        for (let cols = minCols; cols <= maxCols; cols += 1) {
            const rows = Math.max(1, Math.ceil(count / cols));
            const gapX = Math.max(10, Math.min(20, Math.round(availableWidth * 0.016)));
            const gapY = Math.max(12, Math.min(22, Math.round(gapX * 1.12)));
            const byWidth = (availableWidth - (cols - 1) * gapX) / cols;
            const byHeight = ((availableHeight - (rows - 1) * gapY) / rows) / cardRatio;
            const cardWidth = Math.floor(Math.min(byWidth, byHeight));
            if (cardWidth < 60) continue;

            const cardHeight = Math.round(cardWidth * cardRatio);
            const boardWidth = cols * cardWidth + (cols - 1) * gapX;
            const boardHeight = rows * cardHeight + (rows - 1) * gapY;
            const areaScore = boardWidth * boardHeight;
            const candidate = {
                cardsPerRow: cols,
                rows,
                cardWidth,
                cardHeight,
                gapX,
                gapY,
                boardWidth,
                boardHeight,
                areaScore
            };

            if (!best) {
                best = candidate;
                continue;
            }

            if (candidate.areaScore > best.areaScore) {
                best = candidate;
                continue;
            }

            if (candidate.areaScore === best.areaScore && candidate.cardWidth > best.cardWidth) {
                best = candidate;
            }
        }

        if (best) return best;

        const fallbackCardWidth = 120;
        const fallbackCardHeight = Math.round(fallbackCardWidth * cardRatio);
        const fallbackCols = Math.min(maxCols, Math.max(minCols, 7));
        const fallbackRows = Math.max(1, Math.ceil(count / fallbackCols));
        const fallbackGapX = 16;
        const fallbackGapY = 18;
        return {
            cardsPerRow: fallbackCols,
            rows: fallbackRows,
            cardWidth: fallbackCardWidth,
            cardHeight: fallbackCardHeight,
            gapX: fallbackGapX,
            gapY: fallbackGapY,
            boardWidth: fallbackCols * fallbackCardWidth + (fallbackCols - 1) * fallbackGapX,
            boardHeight: fallbackRows * fallbackCardHeight + (fallbackRows - 1) * fallbackGapY,
            areaScore: 0
        };
    }

    async function drawDeckImageBackground(ctx, width, height) {
        const backgroundPath = getBlankMiddleTemplateBackgroundPath();
        const backgroundImage = await loadBackgroundImage(backgroundPath);
        if (backgroundImage) {
            drawImageCover(ctx, backgroundImage, 0, 0, width, height);
        } else {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        roundRect(ctx, 22, 16, width - 44, height - 32, 22);
        ctx.fill();

        ctx.strokeStyle = 'rgba(160, 170, 205, 0.32)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    function buildDeckImageStoreDateLine() {
        const formattedDate = context.date ? formatContextDateForImage(context.date) : '';
        const store = String(context.store || '').trim();
        const format = String(context.format || '').trim();
        if (store && formattedDate && format) return `${store}, ${formattedDate} - ${format}`;
        if (store && formattedDate) return `${store}, ${formattedDate}`;
        if (store && format) return `${store} - ${format}`;
        if (formattedDate && format) return `${formattedDate} - ${format}`;
        if (store) return store;
        if (formattedDate) return formattedDate;
        if (format) return format;
        return '-';
    }

    function formatContextDateForImage(rawDate) {
        const value = String(rawDate || '').trim();
        if (!value) return '';
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return value;
        return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }).format(parsed);
    }

    async function loadCardImage(code) {
        const normalized = normalizeDeckCode(code || '');
        const candidates = getExportCardImageUrls(normalized);
        for (let i = 0; i < candidates.length; i += 1) {
            const image = await loadImageWithCors(candidates[i]);
            if (image) return image;
        }
        return null;
    }

    function getExportCardImageUrls(code) {
        const normalized = normalizeDeckCode(code || '');
        if (!normalized) return [];
        const legacyUrl = `${LEGACY_IMAGE_BASE_URL}${normalized}.webp`;
        const primaryUrl = `${IMAGE_BASE_URL}${normalized}.webp`;
        return [legacyUrl, primaryUrl];
    }

    async function loadImageWithCors(url) {
        const safeUrl = String(url || '').trim();
        if (!safeUrl) return null;
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = safeUrl;
        });
    }

    function getCardImageUrl(rawCode) {
        const code = normalizeDeckCode(rawCode || '');
        if (LEGACY_IMAGE_CODES.has(code)) {
            return `${LEGACY_IMAGE_BASE_URL}${code}.webp`;
        }
        return `${IMAGE_BASE_URL}${code}.webp`;
    }

    function getCardZoomImageUrl(rawCode) {
        const code = normalizeDeckCode(rawCode || '');
        return `${LEGACY_IMAGE_BASE_URL}${code}.webp`;
    }

    async function loadBrandLogoImage() {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = DIGISTATS_LOGO_URL;
        });
    }

    async function loadBackgroundImage(path) {
        const safePath = String(path || '').trim() || BLANK_MIDDLE_FALLBACK_BG;
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = safePath;
        });
    }

    function drawImageCover(ctx, image, dx, dy, dWidth, dHeight) {
        if (!ctx || !image) return;
        const sw = image.width || 1;
        const sh = image.height || 1;
        const srcRatio = sw / sh;
        const dstRatio = dWidth / dHeight;
        let sx = 0;
        let sy = 0;
        let sWidth = sw;
        let sHeight = sh;

        if (srcRatio > dstRatio) {
            sWidth = sh * dstRatio;
            sx = (sw - sWidth) / 2;
        } else {
            sHeight = sw / dstRatio;
            sy = (sh - sHeight) / 2;
        }

        ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
    }

    function getBlankMiddleTemplateBackgroundPath() {
        try {
            const raw = localStorage.getItem(TEMPLATE_EDITOR_STATE_KEY);
            if (!raw) return BLANK_MIDDLE_FALLBACK_BG;
            const state = JSON.parse(raw);
            const isBlankMiddle = String(state?.selectedPostType || '') === 'blank_middle';
            const selectedPath = String(state?.selectedBackgroundPath || '').trim();
            if (isBlankMiddle && selectedPath) return selectedPath;
            return BLANK_MIDDLE_FALLBACK_BG;
        } catch {
            return BLANK_MIDDLE_FALLBACK_BG;
        }
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    }

    function buildDeckImageFilename() {
        const baseName = String(context.deck || 'decklist')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40);
        const dateSuffix = new Date().toISOString().slice(0, 10);
        return `${baseName || 'decklist'}-${dateSuffix}.png`;
    }

    function getCardSearchFilters() {
        const rawPlayCost = String(document.getElementById('cardSearchPlayCost')?.value || '').trim();
        let normalizedPlayCost = '';
        if (rawPlayCost) {
            const numericCost = Number(rawPlayCost);
            if (Number.isFinite(numericCost)) {
                const clamped = Math.max(0, Math.min(20, Math.trunc(numericCost)));
                normalizedPlayCost = String(clamped);
            }
        }
        const playCostInput = document.getElementById('cardSearchPlayCost');
        if (playCostInput && rawPlayCost !== normalizedPlayCost && normalizedPlayCost) {
            playCostInput.value = normalizedPlayCost;
        }
        return {
            n: String(document.getElementById('cardSearchName')?.value || '').trim(),
            color: String(document.getElementById('cardSearchColor')?.value || '').trim(),
            type: String(document.getElementById('cardSearchType')?.value || '').trim(),
            level: String(document.getElementById('cardSearchLevel')?.value || '').trim(),
            playcost: normalizedPlayCost,
            card: String(document.getElementById('cardSearchCode')?.value || '').trim().toUpperCase()
        };
    }

    function hasAnySearchFilter(filters) {
        return Boolean(
            filters &&
                (filters.n ||
                    filters.color ||
                    filters.type ||
                    filters.level ||
                    filters.playcost ||
                    filters.card)
        );
    }

    async function fetchCardSearchRows(filters) {
        const allRows = [];
        let offset = 0;
        let previousSignature = '';

        while (allRows.length < CARD_SEARCH_MAX_RESULTS) {
            const params = new URLSearchParams();
            if (filters.n) params.set('n', filters.n);
            if (filters.color) params.set('color', filters.color);
            if (filters.type) params.set('type', filters.type);
            if (filters.level) params.set('level', filters.level);
            if (filters.playcost) params.set('playcost', filters.playcost);
            if (filters.card) params.set('card', filters.card);
            params.set('sort', 'new');
            params.set('sortdirection', 'desc');
            params.set('limit', String(CARD_SEARCH_LIMIT));
            params.set('offset', String(offset));

            const response = await fetch(`${DIGIMON_CARD_API_URL}?${params.toString()}`);
            let payload = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok) {
                const apiError = String(payload?.error || `Search failed (${response.status}).`);
                throw new Error(apiError);
            }

            const rows = Array.isArray(payload) ? payload : [];
            if (rows.length === 0) break;

            allRows.push(...rows);

            const currentSignature = rows
                .slice(0, 5)
                .map((row) => normalizeDeckCode(row?.id || row?.card || ''))
                .join('|');
            if (currentSignature && currentSignature === previousSignature) {
                break;
            }
            previousSignature = currentSignature;

            if (rows.length < CARD_SEARCH_LIMIT) break;
            offset += rows.length;
        }

        return allRows.slice(0, CARD_SEARCH_MAX_RESULTS);
    }

    function getSetPrefixCardFilter(filters) {
        const raw = String(filters?.card || '')
            .trim()
            .toUpperCase();
        if (!raw || raw.includes(',')) return '';
        if (!/^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)$/.test(raw)) return '';
        return raw;
    }

    async function fetchAllCardsIndex() {
        const now = Date.now();
        if (
            Array.isArray(allCardsIndexCache) &&
            allCardsIndexCache.length > 0 &&
            now - allCardsIndexCacheAt < ALL_CARDS_CACHE_TTL_MS
        ) {
            return allCardsIndexCache;
        }

        const params = new URLSearchParams({
            series: 'Digimon Card Game',
            sort: 'card_number',
            sortdirection: 'asc'
        });
        const response = await fetch(`${DIGIMON_GET_ALL_CARDS_API_URL}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Failed to load all cards index (${response.status}).`);
        }
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : [];
        allCardsIndexCache = rows;
        allCardsIndexCacheAt = now;
        return rows;
    }

    function applyLocalCardSearchFilters(rows, filters) {
        const source = Array.isArray(rows) ? rows : [];
        const normalizedName = String(filters?.n || '')
            .trim()
            .toLowerCase();
        const normalizedColor = String(filters?.color || '')
            .trim()
            .toLowerCase();
        const normalizedType = String(filters?.type || '')
            .trim()
            .toLowerCase();
        const normalizedLevel = String(filters?.level || '').trim();
        const normalizedPlayCost = String(filters?.playcost || '').trim();

        return source.filter((row) => {
            const cardName = String(row?.name || '').trim().toLowerCase();
            const cardColor = String(row?.color || '').trim().toLowerCase();
            const cardType = String(row?.type || '').trim().toLowerCase();
            const rowLevel = String(row?.level ?? row?.card_payload?.level ?? '').trim();
            const rowPlayCost = String(row?.play_cost ?? row?.card_payload?.play_cost ?? row?.card_payload?.playcost ?? '').trim();

            if (normalizedName && !cardName.includes(normalizedName)) return false;
            if (normalizedColor && !cardColor.includes(normalizedColor)) return false;
            if (normalizedType && cardType !== normalizedType) return false;
            if (normalizedLevel && rowLevel !== normalizedLevel) return false;
            if (normalizedPlayCost && rowPlayCost !== normalizedPlayCost) return false;
            return true;
        });
    }

    async function fetchCardSearchRowsBySetPrefix(filters, setPrefix) {
        const indexRows = await fetchAllCardsIndex();
        const prefix = `${String(setPrefix || '').toUpperCase()}-`;
        const codes = [];
        const usedCodes = new Set();

        (Array.isArray(indexRows) ? indexRows : []).forEach((row) => {
            const rawCode = String(row?.cardnumber || row?.card_number || row?.id || '').trim();
            const code = normalizeDeckCode(rawCode);
            if (!code || !code.startsWith(prefix)) return;
            if (usedCodes.has(code)) return;
            usedCodes.add(code);
            codes.push(code);
        });

        if (codes.length === 0) return [];
        const detailedRows = await fetchCardsFromDigimonApi(codes);
        return applyLocalCardSearchFilters(detailedRows, filters);
    }

    async function performCardSearch() {
        const filters = getCardSearchFilters();
        if (!hasAnySearchFilter(filters)) {
            setCardSearchStatus('Provide at least one filter before searching.', 'warn');
            cardSearchResults = [];
            renderCardSearchResults();
            return;
        }

        const searchButton = document.getElementById('btnCardSearch');
        if (searchButton) searchButton.disabled = true;
        setCardSearchStatus('Searching cards...', 'info');

        try {
            const setPrefixFilter = getSetPrefixCardFilter(filters);
            let rows = [];
            if (setPrefixFilter) {
                try {
                    rows = await fetchCardSearchRowsBySetPrefix(filters, setPrefixFilter);
                } catch {
                    rows = [];
                }
            }
            if (!Array.isArray(rows) || rows.length === 0) {
                rows = await fetchCardSearchRows(filters);
            }
            const normalized = [];
            const usedCodes = new Set();
            const nowIso = new Date().toISOString();

            const codePrefix = String(filters.card || '').trim().toUpperCase();

            rows.forEach((row) => {
                const code = normalizeDeckCode(row?.id || row?.card || '');
                if (!isValidDeckCode(code)) return;
                if (codePrefix && !code.startsWith(codePrefix)) return;
                if (usedCodes.has(code)) return;
                usedCodes.add(code);
                const mapped = {
                    card_code: code,
                    id: row?.id || code,
                    name: row?.name || code,
                    pack: row?.pack || '',
                    color: row?.color || '',
                    type: row?.type || '',
                    level: row?.level ?? '',
                    play_cost: row?.play_cost ?? null,
                    rarity: row?.rarity || '',
                    card_payload: row || {}
                };
                normalized.push(mapped);
                cardDetailsByCode.set(code, { ...mapped, updated_at: nowIso });
            });

            cardSearchResults = normalized;
            cardSearchPage = 1;
            renderCardSearchResults();
            if (cardSearchResults.length === 0) {
                setCardSearchStatus('No cards found for the current filters.', 'warn');
            } else {
                setCardSearchStatus(`${cardSearchResults.length} cards found. Click a card to include in the deck.`, 'ok');
            }
        } catch (error) {
            cardSearchResults = [];
            cardSearchPage = 1;
            renderCardSearchResults();
            const rawMessage = String(error?.message || '').trim();
            const isFetchFailure = /failed to fetch/i.test(rawMessage);
            if (isFetchFailure) {
                setCardSearchStatus('No results found for this filter.', 'warn', { autoClearMs: 3000 });
            } else {
                setCardSearchStatus(rawMessage || 'Error while searching cards.', 'error');
            }
        } finally {
            if (searchButton) searchButton.disabled = false;
        }
    }

    function resetCardSearch() {
        const controls = [
            'cardSearchName',
            'cardSearchColor',
            'cardSearchType',
            'cardSearchLevel',
            'cardSearchPlayCost',
            'cardSearchCode'
        ];
        controls.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.value = '';
        });
        cardSearchResults = [];
        cardSearchPage = 1;
        renderCardSearchResults();
        setCardSearchStatus('');
    }

    async function sortDeckCards() {
        if (!Array.isArray(entries) || entries.length <= 1) {
            setSaveStatus('Not enough cards to sort.', 'warn');
            return;
        }

        const button = document.getElementById('btnDecklistBuilderSortCards');
        if (button) button.disabled = true;
        setSaveStatus('Sorting cards...', 'info');

        try {
            await hydrateCardMetadata(entries, { allowRerender: false });
            const previousOrder = entries.map((entry) => entry.code).join('|');
            const sorted = [...entries].sort(compareDeckEntries);
            const nextOrder = sorted.map((entry) => entry.code).join('|');
            if (previousOrder === nextOrder) {
                setSaveStatus('Decklist is already sorted.', 'ok');
                return;
            }
            entries = sorted;
            render([]);
            setSaveStatus('Cards sorted successfully.', 'ok');
        } catch (error) {
            setSaveStatus(error?.message || 'Failed to sort cards.', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    function buildEntryMetaFromCard(card) {
        if (!card || typeof card !== 'object') return null;
        const type = normalizeCardType(card?.type || card?.card_payload?.type);
        const levelRaw = card?.level ?? card?.card_payload?.level;
        const level = Number(levelRaw);
        return {
            cardType: mapTypeToDbLabel(type),
            cardLevel: Number.isFinite(level) ? Math.trunc(level) : null,
            isDigiEgg: type === 'digi-egg'
        };
    }

    function renderCardSearchResults() {
        const root = document.getElementById('cardSearchResults');
        if (!root) return;
        if (!Array.isArray(cardSearchResults) || cardSearchResults.length === 0) {
            root.innerHTML = '<div class="decklist-search-empty">No search results yet.</div>';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(cardSearchResults.length / CARD_SEARCH_PAGE_SIZE));
        cardSearchPage = Math.max(1, Math.min(totalPages, cardSearchPage));
        const startIndex = (cardSearchPage - 1) * CARD_SEARCH_PAGE_SIZE;
        const endIndex = startIndex + CARD_SEARCH_PAGE_SIZE;
        const pageItems = cardSearchResults.slice(startIndex, endIndex);

        const pagerHtml =
            totalPages > 1
                ? `
                    <div class="decklist-search-pagination" aria-label="Search results pagination">
                        <button type="button" class="decklist-search-page-btn" data-search-page="prev" ${
                            cardSearchPage <= 1 ? 'disabled' : ''
                        } aria-label="Previous page">&lt;</button>
                        <span class="decklist-search-page-indicator">${cardSearchPage}/${totalPages}</span>
                        <button type="button" class="decklist-search-page-btn" data-search-page="next" ${
                            cardSearchPage >= totalPages ? 'disabled' : ''
                        } aria-label="Next page">&gt;</button>
                    </div>
                `
                : '';

        root.innerHTML = `
            ${pagerHtml}
            <div class="decklist-search-results-grid">
                ${pageItems
            .map((card) => {
                const code = normalizeDeckCode(card.card_code || card.id || '');
                const restrictionBadge = getCardRestrictionBadge(code);
                const badgeCountSlotClass = restrictionBadge?.type === 'restricted' ? 'is-in-count-slot' : '';
                const restrictionBadgeHtml = restrictionBadge
                    ? `<div class="decklist-card-restriction-badge is-in-search ${badgeCountSlotClass} is-${escapeHtml(restrictionBadge.type)}" title="${escapeHtml(restrictionBadge.title)}">${escapeHtml(restrictionBadge.label)}</div>`
                    : '';

                return `
                    <article class="decklist-search-card" data-code="${escapeHtml(code)}">
                        <img src="${getCardImageUrl(code)}" alt="${escapeHtml(card.name || code)}" />
                        ${restrictionBadgeHtml}
                        <div class="decklist-search-card-code">${escapeHtml(code)}</div>
                    </article>
                `;
            })
            .join('')}
            </div>
        `;

        root.querySelectorAll('.decklist-search-card img').forEach((img) => {
            img.addEventListener(
                'error',
                () => {
                    const code = img.closest('.decklist-search-card')?.dataset.code || 'CODE';
                    img.src = `https://via.placeholder.com/220x308/667eea/ffffff?text=${encodeURIComponent(code)}`;
                },
                { once: true }
            );
        });

        root.querySelectorAll('.decklist-search-card[data-code]').forEach((card) => {
            card.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const code = String(card.getAttribute('data-code') || '');
                void openCardZoomModal(code);
            });
        });
    }

    function setCardSearchStatus(message, type = '', options = {}) {
        const node = document.getElementById('cardSearchStatus');
        if (!node) return;
        if (cardSearchStatusAutoHideTimer) {
            clearTimeout(cardSearchStatusAutoHideTimer);
            cardSearchStatusAutoHideTimer = null;
        }
        node.textContent = message;
        node.className = 'decklist-search-status';
        if (type) node.classList.add(`is-${type}`);
        const autoClearMs = Math.max(0, Number(options?.autoClearMs) || 0);
        if (autoClearMs > 0 && message) {
            cardSearchStatusAutoHideTimer = setTimeout(() => {
                node.textContent = '';
                node.className = 'decklist-search-status';
                cardSearchStatusAutoHideTimer = null;
            }, autoClearMs);
        }
    }

    function addManualCode() {
        const codeInput = document.getElementById('decklistBuilderManualCode');
        if (!codeInput) return;

        const code = normalizeDeckCode(codeInput.value);
        if (!isValidDeckCode(code)) {
            render([`Invalid code: ${codeInput.value || '(empty)'}`]);
            return;
        }

        const upsert = tryUpsertEntry(code, 1);
        if (upsert.error) {
            render([upsert.error]);
            return;
        }

        codeInput.value = '';
        setSaveStatus('');
        render([]);
    }

    function changeCardQuantity(code, delta) {
        const normalizedCode = normalizeDeckCode(code);
        if (!isValidDeckCode(normalizedCode)) return { error: 'Invalid card code.' };

        const existing = entries.find((item) => item.code === normalizedCode);
        if (!existing) return { error: `Card ${normalizedCode} not found.` };

        if (delta > 0) {
            return tryUpsertEntry(normalizedCode, 1);
        }

        if (existing.count <= 1) {
            entries = entries.filter((item) => item.code !== normalizedCode);
            return { error: '' };
        }

        existing.count -= 1;
        return { error: '' };
    }

    function isValidDeckCode(code) {
        return DECK_CODE_PATTERN.test(String(code || ''));
    }

    function normalizeDeckCode(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/^["'\[\(]+/, '')
            .replace(/["'\]\),;:.]+$/, '')
            .replace(/_.+$/, '');
    }

    function tryUpsertEntry(code, qty, meta = null) {
        if (BANNED_CODES.has(code)) {
            return { error: `${code} is banned and cannot be added.` };
        }
        const existing = entries.find((item) => item.code === code);
        const currentQty = Number(existing?.count) || 0;
        if (currentQty + qty > MAX_COPIES_PER_CARD) {
            return { error: `Max ${MAX_COPIES_PER_CARD} copies for ${code}.` };
        }
        if (RESTRICTED_CODES.has(code) && currentQty + qty > 1) {
            return { error: `${code} is restricted to 1 copy.` };
        }

        const nextEntries = entries.map((item) => ({ ...item }));
        const existingIndex = nextEntries.findIndex((item) => item.code === code);
        if (existingIndex >= 0) {
            nextEntries[existingIndex].count += qty;
        } else {
            nextEntries.push(meta ? { code, count: qty, meta } : { code, count: qty });
        }

        const counts = getDeckCounts(nextEntries);
        const candidateBucket = getEntryDeckBucket({ code, count: 1 });
        if (candidateBucket === 'egg' && counts.digiEgg > MAX_DIGI_EGG_CARDS) {
            return { error: `Digi-Egg limit reached (${MAX_DIGI_EGG_CARDS}).` };
        }
        if (candidateBucket !== 'egg' && counts.mainDeck > MAX_MAIN_DECK_CARDS) {
            return { error: `Main deck limit reached (${MAX_MAIN_DECK_CARDS}).` };
        }
        const restrictionErrors = validateRestrictionRules(nextEntries);
        if (restrictionErrors.length > 0) {
            return { error: restrictionErrors[0] };
        }

        if (existing) {
            existing.count += qty;
            if (meta && (!existing.meta || typeof existing.meta !== 'object')) {
                existing.meta = meta;
            }
            return { error: '' };
        }

        entries.push(meta ? { code, count: qty, meta } : { code, count: qty });
        return { error: '' };
    }

    function parseDecklistText(rawText, options = {}) {
        const enforceLimits = options?.enforceLimits !== false;
        const text = String(rawText || '').trim();
        if (!text) return { entries: [], errors: [] };

        const jsonParsed = tryParseJsonArray(text);
        if (jsonParsed.length > 0) {
            const validated = validateAggregatedEntries(aggregateCodes(jsonParsed));
            return {
                entries: enforceLimits ? enforceDeckLimits(validated.entries) : validated.entries,
                errors: validated.errors
            };
        }

        const lineParsed = parseByLines(text);
        if (lineParsed.entries.length > 0) {
            const validated = validateAggregatedEntries(lineParsed.entries, lineParsed.errors);
            return {
                entries: enforceLimits ? enforceDeckLimits(validated.entries) : validated.entries,
                errors: validated.errors
            };
        }

        const repeated = parseRepeatedCodes(text);
        if (repeated.length > 0) {
            const validated = validateAggregatedEntries(aggregateCodes(repeated));
            return {
                entries: enforceLimits ? enforceDeckLimits(validated.entries) : validated.entries,
                errors: validated.errors
            };
        }

        return { entries: [], errors: ['No valid deck codes found in the provided text.'] };
    }

    function tryParseJsonArray(text) {
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((item) => normalizeDeckCode(item))
                .filter((code) => isValidDeckCode(code));
        } catch {
            return [];
        }
    }

    function parseByLines(text) {
        const lines = text.split(/\r?\n/);
        const temp = [];
        const errors = [];

        lines.forEach((line, index) => {
            const raw = String(line || '').trim();
            if (!raw) return;
            if (/^decklist$/i.test(raw)) return;
            if (/^\/\/\s*/.test(raw)) return;

            const patternA = raw.match(
                /^(\d{1,2})\s+.*?((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*$/i
            );
            if (patternA) {
                const qty = Number(patternA[1]);
                const code = normalizeDeckCode(patternA[2]);
                if (isValidDeckCode(code)) temp.push({ code, count: qty });
                else errors.push(`Line ${index + 1}: invalid code "${patternA[2]}"`);
                return;
            }

            const patternB = raw.match(
                /^(\d{1,2})\s*\(\s*((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*\)\s*$/i
            );
            if (patternB) {
                const qty = Number(patternB[1]);
                const code = normalizeDeckCode(patternB[2]);
                if (isValidDeckCode(code)) temp.push({ code, count: qty });
                else errors.push(`Line ${index + 1}: invalid code "${patternB[2]}"`);
                return;
            }

            const single = raw.match(
                /^((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)$/i
            );
            if (single) {
                const code = normalizeDeckCode(single[1]);
                if (isValidDeckCode(code)) temp.push({ code, count: 1 });
            }
        });

        return { entries: aggregateEntries(temp), errors };
    }

    function parseRepeatedCodes(text) {
        return [...text.matchAll(new RegExp(RAW_DECK_CODE_WITH_SUFFIX_PATTERN.source, 'gi'))]
            .map((match) => normalizeDeckCode(match[1]))
            .filter((code) => isValidDeckCode(code));
    }

    function aggregateCodes(codes) {
        return aggregateEntries(codes.map((code) => ({ code, count: 1 })));
    }

    function aggregateEntries(source) {
        const map = new Map();
        source.forEach((item) => {
            const code = normalizeDeckCode(item.code);
            const count = Number(item.count) || 1;
            if (!isValidDeckCode(code)) return;
            if (!map.has(code)) map.set(code, { code, count: 0 });
            map.get(code).count += count;
        });
        return Array.from(map.values());
    }

    function validateAggregatedEntries(sourceEntries, baseErrors = []) {
        const errors = [...(baseErrors || [])];
        errors.push(...validateRestrictionRules(sourceEntries));
        return { entries: sourceEntries, errors };
    }

    function validateRestrictionRules(sourceEntries) {
        const errors = [];
        const countsByCode = new Map();
        (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((item) => {
            const code = normalizeDeckCode(item?.code || '');
            if (!isValidDeckCode(code)) return;
            const qty = Math.max(0, Number(item?.count) || 0);
            countsByCode.set(code, (countsByCode.get(code) || 0) + qty);
        });

        countsByCode.forEach((qty, code) => {
            if (qty <= 0) return;
            if (BANNED_CODES.has(code)) {
                errors.push(`${code} is banned and invalidates the deck.`);
            }
            if (RESTRICTED_CODES.has(code) && qty > 1) {
                errors.push(`${code} is restricted to 1 copy (current: ${qty}).`);
            }
        });

        CHOICE_RESTRICTION_GROUPS.forEach((group) => {
            if (!Array.isArray(group) || group.length < 2) return;
            const present = group.filter((code) => (countsByCode.get(code) || 0) > 0);
            if (present.length >= 2) {
                errors.push(`Choice restriction violated: ${group.join(' / ')} cannot be used together.`);
            }
        });

        return errors;
    }

    function getCardRestrictionBadge(code) {
        const normalized = normalizeDeckCode(code || '');
        if (!isValidDeckCode(normalized)) return null;
        if (BANNED_CODES.has(normalized)) {
            return { label: 'X', type: 'banned', title: 'Banned card' };
        }
        if (RESTRICTED_CODES.has(normalized)) {
            return { label: '1', type: 'restricted', title: 'Restricted to 1 copy' };
        }
        const inChoiceRestriction = CHOICE_RESTRICTION_GROUPS.some((group) => group.includes(normalized));
        if (inChoiceRestriction) {
            return { label: 'C', type: 'choice', title: 'Choice Restriction' };
        }
        return null;
    }

    function enforceDeckLimits(sourceEntries) {
        const limited = [];
        let runningMainDeck = 0;
        let runningDigiEgg = 0;
        sourceEntries.forEach((item) => {
            const normalizedQty = Math.max(0, Math.min(MAX_COPIES_PER_CARD, Number(item.count) || 0));
            if (normalizedQty <= 0) return;
            const bucket = getEntryDeckBucket(item);
            const remaining = bucket === 'egg' ? MAX_DIGI_EGG_CARDS - runningDigiEgg : MAX_MAIN_DECK_CARDS - runningMainDeck;
            const allowedQty = Math.min(normalizedQty, Math.max(0, remaining));
            if (allowedQty <= 0) return;
            limited.push({ code: item.code, count: allowedQty });
            if (bucket === 'egg') runningDigiEgg += allowedQty;
            else runningMainDeck += allowedQty;
        });
        return limited;
    }

    function getTotalCards(sourceEntries) {
        return sourceEntries.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
    }

    function getDeckCounts(sourceEntries) {
        let digiEgg = 0;
        let mainDeck = 0;
        (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((item) => {
            const qty = Number(item?.count) || 0;
            if (qty <= 0) return;
            if (getEntryDeckBucket(item) === 'egg') digiEgg += qty;
            else mainDeck += qty;
        });
        return { digiEgg, mainDeck, total: digiEgg + mainDeck };
    }

    async function loadExistingDecklist() {
        if (!context.resultId || !SUPABASE_URL) return false;
        const structured = await fetchDecklistFromStructured(context.resultId);
        if (structured) {
            entries = structured.entries;
            seedEntriesMetadataInMemory(entries);
            await hydrateCardMetadata(entries, { allowRerender: false });
            render([]);
            return true;
        }

        const fetched = await fetchDecklistFromLegacyColumn(context.resultId);
        if (!fetched || !fetched.decklistText) return false;

        const parsed = parseDecklistText(fetched.decklistText, { enforceLimits: false });
        entries = parsed.entries;
        await hydrateCardMetadata(entries, { allowRerender: false });
        render(parsed.errors);
        return true;
    }

    async function fetchDecklistFromStructured(resultId) {
        try {
            const decklistRes = await fetch(
                `${SUPABASE_URL}/rest/v1/${DECKLISTS_TABLE}?tournament_result_id=eq.${encodeURIComponent(resultId)}&select=id&limit=1`,
                { headers }
            );
            if (!decklistRes.ok) return null;
            const decklists = await decklistRes.json();
            const decklistId = Number(decklists?.[0]?.id);
            if (!Number.isFinite(decklistId) || decklistId <= 0) return null;

            const baseQuery = `${SUPABASE_URL}/rest/v1/${DECKLIST_CARDS_TABLE}?decklist_id=eq.${decklistId}&select=position,card_code,qty,card_type,card_level,is_digi_egg&order=position.asc`;
            const cardsRes = await fetch(baseQuery, { headers });
            if (!cardsRes.ok) return null;
            const rows = await cardsRes.json();

            const nowIso = new Date().toISOString();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const code = normalizeDeckCode(row?.card_code || '');
                if (!isValidDeckCode(code)) return;
                cardDetailsByCode.set(code, {
                    ...(cardDetailsByCode.get(code) || {}),
                    card_code: code,
                    id: code,
                    name: row?.name || code,
                    pack: row?.pack || '',
                    color: row?.color || '',
                    type: row?.card_type || '',
                    level: normalizeCardLevel(row?.card_level),
                    card_payload: row?.card_payload || {},
                    is_digi_egg: normalizeBoolean(row?.is_digi_egg),
                    updated_at: nowIso
                });
            });

            const parsedEntries = (Array.isArray(rows) ? rows : [])
                .map((row) => ({
                    code: normalizeDeckCode(row?.card_code || ''),
                    count: Math.max(1, Math.min(MAX_COPIES_PER_CARD, Number(row?.qty) || 1)),
                    meta: {
                        cardType: String(row?.card_type || '').trim(),
                        cardLevel: normalizeCardLevel(row?.card_level),
                        isDigiEgg: normalizeBoolean(row?.is_digi_egg)
                    }
                }))
                .filter((item) => isValidDeckCode(item.code));
            return { entries: parsedEntries };
        } catch {
            return null;
        }
    }

    async function fetchDecklistFromLegacyColumn(resultId) {
        const columns = ['decklist', 'decklist_link'];
        for (const columnName of columns) {
            try {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(resultId)}&select=id,${columnName}`,
                    { headers }
                );
                if (!res.ok) continue;
                const rows = await res.json();
                const rawText = String(rows?.[0]?.[columnName] || '').trim();
                return { columnName, decklistText: rawText };
            } catch {
                continue;
            }
        }
        return null;
    }

    async function saveDecklist() {
        if (!context.resultId) {
            render(['This record has no result_id to save.']);
            return;
        }
        if (!SUPABASE_URL) {
            render(['Supabase is not configured for decklist saving.']);
            return;
        }

        const validation = validateAggregatedEntries(entries);
        if (validation.errors.length > 0) {
            render(validation.errors);
            return;
        }

        const saveButton = document.getElementById('btnDecklistBuilderSave');
        if (saveButton) saveButton.disabled = true;
        setSaveStatus('Saving decklist...', 'info');

        try {
            const decklistText = serializeDecklist(entries);
            const saved = await saveDecklistStructured(context.resultId, entries);
            if (!saved) {
                throw new Error('Failed to save normalized decklist.');
            }
            await patchDecklistLegacy(context.resultId, decklistText);
            render([]);
            setSaveStatus('Decklist saved successfully.', 'ok');
        } catch (error) {
            setSaveStatus('Failed to save decklist.', 'error');
            render([error?.message || 'Failed to save decklist.']);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    async function saveDecklistStructured(resultId, sourceEntries) {
        try {
            const decklistId = await ensureDecklistRow(resultId);
            if (!decklistId) return false;

            const deleteRes = await fetch(
                `${SUPABASE_URL}/rest/v1/${DECKLIST_CARDS_TABLE}?decklist_id=eq.${decklistId}`,
                {
                    method: 'DELETE',
                    headers
                }
            );
            if (!deleteRes.ok) return false;

            const rows = (Array.isArray(sourceEntries) ? sourceEntries : []).map((entry, index) => {
                const metadata = getDecklistCardMetadata(entry);
                return {
                    decklist_id: decklistId,
                    position: index + 1,
                    card_code: normalizeDeckCode(entry.code),
                    qty: Math.max(1, Math.min(MAX_COPIES_PER_CARD, Number(entry.count) || 1)),
                    card_type: metadata.cardType,
                    card_level: metadata.cardLevel,
                    is_digi_egg: metadata.isDigiEgg
                };
            });
            if (rows.length === 0) return true;

            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/${DECKLIST_CARDS_TABLE}`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(rows)
            });
            return insertRes.ok;
        } catch {
            return false;
        }
    }

    async function ensureDecklistRow(resultId) {
        const existingRes = await fetch(
            `${SUPABASE_URL}/rest/v1/${DECKLISTS_TABLE}?tournament_result_id=eq.${encodeURIComponent(resultId)}&select=id&limit=1`,
            { headers }
        );
        if (!existingRes.ok) return null;
        const existingRows = await existingRes.json();
        const existingId = Number(existingRows?.[0]?.id);
        if (Number.isFinite(existingId) && existingId > 0) return existingId;

        const createRes = await fetch(`${SUPABASE_URL}/rest/v1/${DECKLISTS_TABLE}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ tournament_result_id: resultId, source: 'builder' })
        });
        if (!createRes.ok) return null;
        const created = await createRes.json();
        const createdId = Number(created?.[0]?.id);
        return Number.isFinite(createdId) && createdId > 0 ? createdId : null;
    }

    function extractLevelFromGroupKey(groupKey) {
        const raw = String(groupKey || '');
        const match = raw.match(/^digimon-lv-(\d+)$/);
        if (!match) return null;
        const level = Number(match[1]);
        return Number.isFinite(level) ? level : null;
    }

    function normalizeBoolean(value) {
        if (value === true || value === false) return value;
        const normalized = String(value || '')
            .trim()
            .toLowerCase();
        if (!normalized) return false;
        return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes';
    }

    function normalizeCardLevel(value) {
        const level = Number(value);
        return Number.isFinite(level) ? level : null;
    }

    function getEntryMetadata(entry) {
        const meta = entry?.meta;
        if (!meta || typeof meta !== 'object') return {};
        return meta;
    }

    function resolveEntryTypeAndLevel(entry) {
        const code = normalizeDeckCode(entry?.code || '');
        const entryMeta = getEntryMetadata(entry);
        const details = cardDetailsByCode.get(code) || {};
        const payload = details?.card_payload || {};
        const isDigiEgg =
            normalizeBoolean(entryMeta?.isDigiEgg) ||
            normalizeBoolean(details?.is_digi_egg) ||
            normalizeBoolean(payload?.is_digi_egg);
        const normalizedType = normalizeCardType(
            entryMeta?.cardType || details?.type || payload?.type
        );
        const type = isDigiEgg ? 'digi-egg' : normalizedType;
        const level = normalizeCardLevel(entryMeta?.cardLevel ?? details?.level ?? payload?.level);
        return { type, level, isDigiEgg };
    }

    function mapTypeToDbLabel(type) {
        if (type === 'digi-egg') return 'Digi-Egg';
        if (type === 'digimon') return 'Digimon';
        if (type === 'tamer') return 'Tamer';
        if (type === 'option') return 'Option';
        return null;
    }

    function getDecklistCardMetadata(entry) {
        const resolved = resolveEntryTypeAndLevel(entry);
        return {
            cardType: mapTypeToDbLabel(resolved.type),
            cardLevel: Number.isFinite(resolved.level) ? resolved.level : null,
            isDigiEgg: resolved.type === 'digi-egg'
        };
    }

    function seedEntriesMetadataInMemory(sourceEntries) {
        (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((entry) => {
            const code = normalizeDeckCode(entry?.code || '');
            if (!isValidDeckCode(code)) return;
            const resolved = resolveEntryTypeAndLevel(entry);
            if (!resolved.type && !Number.isFinite(resolved.level)) return;

            const current = cardDetailsByCode.get(code) || {};
            const currentPayload =
                current?.card_payload && typeof current.card_payload === 'object' ? current.card_payload : {};
            const nextPayload = { ...currentPayload };
            if (resolved.type) nextPayload.type = mapTypeToDbLabel(resolved.type) || resolved.type;
            if (Number.isFinite(resolved.level)) nextPayload.level = resolved.level;
            if (resolved.type === 'digi-egg') nextPayload.is_digi_egg = true;
            const nowIso = new Date().toISOString();

            cardDetailsByCode.set(code, {
                ...current,
                card_code: code,
                id: current?.id || code,
                name: current?.name || code,
                type: mapTypeToDbLabel(resolved.type) || current?.type || '',
                level: Number.isFinite(resolved.level) ? resolved.level : current?.level ?? '',
                card_payload: nextPayload,
                updated_at: nowIso
            });
        });
    }

    async function patchDecklistLegacy(resultId, decklistText) {
        const candidates = ['decklist', 'decklist_link'];
        for (const columnName of candidates) {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(resultId)}`,
                {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ [columnName]: decklistText })
                }
            );
            if (res.ok) return true;
        }
        return true;
    }

    function serializeDecklist(sourceEntries) {
        return sourceEntries
            .map((item) => `${item.count} ${item.code}`)
            .join('\n');
    }

    function setSaveStatus(message, type = '') {
        const status = document.getElementById('decklistBuilderSaveStatus');
        if (!status) return;
        status.textContent = message;
        status.className = 'decklist-builder-save-status';
        if (type) status.classList.add(`is-${type}`);
    }

    function render(errors) {
        const board = document.getElementById('decklistBuilderBoard');
        const stats = document.getElementById('decklistBuilderStats');
        const breakdown = document.getElementById('decklistBuilderBreakdown');
        const errorBox = document.getElementById('decklistBuilderErrors');
        if (!board || !stats || !errorBox) return;

        const counts = getDeckCounts(entries);
        stats.textContent = `Card count: ${counts.total} (${counts.mainDeck}+${counts.digiEgg}) cards`;
        if (breakdown) {
            breakdown.innerHTML = buildDeckGroupBreakdownHtml(entries);
        }

        if (errors.length > 0) {
            renderDeckErrors(errorBox, errors);
        } else {
            clearDeckErrors(errorBox);
        }

        if (entries.length === 0) {
            board.innerHTML = '<div class="decklist-builder-empty">No cards yet.</div>';
            return;
        }

        board.innerHTML = entries
            .map(
                (entry) => {
                    const restrictionBadge = getCardRestrictionBadge(entry.code);
                    const hideCountBecauseRestrictedSingle =
                        restrictionBadge?.type === 'restricted' && Number(entry.count) === 1;
                    const badgeDeckPositionClass = hideCountBecauseRestrictedSingle
                        ? 'is-in-deck is-in-count-slot'
                        : 'is-in-deck';
                    const restrictionBadgeHtml = restrictionBadge
                        ? `<div class="decklist-card-restriction-badge ${badgeDeckPositionClass} is-${escapeHtml(restrictionBadge.type)}" title="${escapeHtml(restrictionBadge.title)}">${escapeHtml(restrictionBadge.label)}</div>`
                        : '';
                    const countHtml = hideCountBecauseRestrictedSingle
                        ? ''
                        : `<div class="decklist-builder-count">${entry.count}</div>`;
                    return `
                <article class="decklist-builder-card" data-code="${escapeHtml(entry.code)}">
                    ${countHtml}
                    <img src="${getCardImageUrl(entry.code)}" alt="${escapeHtml(entry.code)}" />
                    ${restrictionBadgeHtml}
                    <div class="decklist-builder-hover-controls">
                        <button type="button" class="decklist-builder-stepper-btn is-increase" data-action="increase" data-code="${escapeHtml(entry.code)}" aria-label="Increase ${escapeHtml(entry.code)}">+</button>
                        <button type="button" class="decklist-builder-stepper-btn is-decrease" data-action="decrease" data-code="${escapeHtml(entry.code)}" aria-label="Decrease ${escapeHtml(entry.code)}">-</button>
                    </div>
                </article>
            `;
                }
            )
            .join('');

        board.querySelectorAll('.decklist-builder-card img').forEach((img) => {
            img.addEventListener(
                'error',
                () => {
                    const code = img.closest('.decklist-builder-card')?.dataset.code || 'CODE';
                    img.src = `https://via.placeholder.com/220x308/667eea/ffffff?text=${encodeURIComponent(code)}`;
                },
                { once: true }
            );
        });

        board.querySelectorAll('.decklist-builder-stepper-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const code = button.getAttribute('data-code') || '';
                const action = button.getAttribute('data-action') || '';
                const delta = action === 'decrease' ? -1 : 1;
                const changed = changeCardQuantity(code, delta);
                if (changed.error) {
                    render([changed.error]);
                    return;
                }
                setSaveStatus('');
                render([]);
            });
        });

        board.querySelectorAll('.decklist-builder-card[data-code]').forEach((card) => {
            card.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const code = String(card.getAttribute('data-code') || '');
                void openCardZoomModal(code);
            });
        });

        void hydrateCardMetadata(entries);
    }

    function renderDeckErrors(errorBox, errors) {
        if (!errorBox) return;
        if (deckErrorAutoHideTimer) {
            clearTimeout(deckErrorAutoHideTimer);
            deckErrorAutoHideTimer = null;
        }
        const message = (Array.isArray(errors) ? errors : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join(' | ');
        if (!message) {
            clearDeckErrors(errorBox);
            return;
        }
        errorBox.style.display = 'flex';
        errorBox.innerHTML = `
            <span class="decklist-builder-errors-text">${escapeHtml(message)}</span>
            <button type="button" class="decklist-builder-errors-close" aria-label="Dismiss error">&times;</button>
        `;
        const closeButton = errorBox.querySelector('.decklist-builder-errors-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => clearDeckErrors(errorBox));
        }
        deckErrorAutoHideTimer = setTimeout(() => {
            clearDeckErrors(errorBox);
        }, 6000);
    }

    function clearDeckErrors(errorBox) {
        const target = errorBox || document.getElementById('decklistBuilderErrors');
        if (!target) return;
        if (deckErrorAutoHideTimer) {
            clearTimeout(deckErrorAutoHideTimer);
            deckErrorAutoHideTimer = null;
        }
        target.style.display = 'none';
        target.textContent = '';
    }

    function getCardTitle(code) {
        const cached = cardDetailsByCode.get(String(code || '').toUpperCase());
        if (!cached) return 'Loading card data...';
        return cached.name || String(code || '').toUpperCase();
    }

    function getEntryGroupInfo(entry) {
        const resolved = resolveEntryTypeAndLevel(entry);
        const type = resolved.type;
        const level = resolved.level;

        if (type === 'digi-egg') return { key: 'digi-egg', label: 'Digi-Egg' };
        if (type === 'digimon') {
            if (Number.isFinite(level) && level >= 0) return { key: `digimon-lv-${level}`, label: `Digimon Lv${level}` };
            return { key: 'digimon', label: 'Digimon' };
        }
        if (type === 'tamer') return { key: 'tamer', label: 'Tamers' };
        if (type === 'option') return { key: 'option', label: 'Options' };
        return { key: 'other', label: 'Other' };
    }

    function getEntryDeckBucket(entry) {
        const info = getEntryGroupInfo(entry);
        return info.key === 'digi-egg' ? 'egg' : 'main';
    }

    function summarizeDeckGroups(sourceEntries) {
        const map = new Map();
        (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((entry, index) => {
            const info = getEntryGroupInfo(entry);
            const current = map.get(info.key) || { key: info.key, label: info.label, count: 0, firstIndex: index };
            current.count += Number(entry?.count) || 0;
            if (index < current.firstIndex) current.firstIndex = index;
            map.set(info.key, current);
        });
        return map;
    }

    function getDeckBreakdownMetrics(sourceEntries) {
        const metrics = {
            digiEgg: 0,
            digimon: 0,
            tamer: 0,
            option: 0,
            lv2: 0,
            lv3: 0,
            lv4: 0,
            lv5: 0,
            lv6: 0,
            lv7p: 0
        };

        (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((entry) => {
            const qty = Number(entry?.count) || 0;
            if (qty <= 0) return;
            const info = getEntryGroupInfo(entry);

            if (info.key === 'digi-egg') {
                metrics.digiEgg += qty;
                return;
            }
            if (info.key === 'tamer') {
                metrics.tamer += qty;
                return;
            }
            if (info.key === 'option') {
                metrics.option += qty;
                return;
            }
            if (info.key.startsWith('digimon')) {
                metrics.digimon += qty;
                const level = extractLevelFromGroupKey(info.key);
                if (level === 2) metrics.lv2 += qty;
                else if (level === 3) metrics.lv3 += qty;
                else if (level === 4) metrics.lv4 += qty;
                else if (level === 5) metrics.lv5 += qty;
                else if (level === 6) metrics.lv6 += qty;
                else if (Number.isFinite(level) && level >= 7) metrics.lv7p += qty;
            }
        });

        metrics.lv2 = metrics.digiEgg;
        return metrics;
    }

    function buildBreakdownBarItem(item, maxValue) {
        const value = Number(item?.value) || 0;
        const ratio = maxValue > 0 ? value / maxValue : 0;
        const height = Math.max(8, Math.round(8 + ratio * 30));
        return `
            <div class="decklist-builder-breakdown-bar" data-key="${escapeHtmlAttribute(item.key)}" title="${escapeHtml(item.label)}: ${value}">
                <div class="decklist-builder-breakdown-bar-fill" style="height:${height}px"></div>
                <div class="decklist-builder-breakdown-bar-value">${value}</div>
                <div class="decklist-builder-breakdown-bar-label">${escapeHtml(item.label)}</div>
            </div>
        `;
    }

    function buildDeckGroupBreakdownHtml(sourceEntries) {
        const m = getDeckBreakdownMetrics(sourceEntries);
        const typeItems = [
            { key: 'digi-egg', label: 'DigiEgg', value: m.digiEgg },
            { key: 'digimon', label: 'Digimon', value: m.digimon },
            { key: 'tamer', label: 'Tamer', value: m.tamer },
            { key: 'option', label: 'Option', value: m.option }
        ];
        const levelItems = [
            { key: 'lv2', label: 'Lv2', value: m.lv2 },
            { key: 'lv3', label: 'Lv3', value: m.lv3 },
            { key: 'lv4', label: 'Lv4', value: m.lv4 },
            { key: 'lv5', label: 'Lv5', value: m.lv5 },
            { key: 'lv6', label: 'Lv6', value: m.lv6 },
            { key: 'lv7p', label: 'Lv7', value: m.lv7p }
        ];
        const maxValue = Math.max(
            1,
            ...typeItems.map((item) => item.value),
            ...levelItems.map((item) => item.value)
        );
        return `
            <div class="decklist-builder-breakdown-chart">
                <div class="decklist-builder-breakdown-group">
                    ${typeItems.map((item) => buildBreakdownBarItem(item, maxValue)).join('')}
                </div>
                <div class="decklist-builder-breakdown-divider" aria-hidden="true"></div>
                <div class="decklist-builder-breakdown-group">
                    ${levelItems.map((item) => buildBreakdownBarItem(item, maxValue)).join('')}
                </div>
            </div>
        `;
    }

    function isCacheFresh(item) {
        if (!item) return false;
        const timestamp = Date.parse(String(item.updated_at || ''));
        if (Number.isNaN(timestamp)) return false;
        return Date.now() - timestamp <= CARD_CACHE_TTL_MS;
    }

    function refreshRenderedCardTitles() {
        const board = document.getElementById('decklistBuilderBoard');
        if (!board) return;
        board.querySelectorAll('.decklist-builder-card[data-code] img').forEach((img) => {
            const code = String(img.closest('.decklist-builder-card')?.getAttribute('data-code') || '').toUpperCase();
            const title = getCardTitle(code);
            if (title && title !== 'Loading card data...') {
                img.alt = `${title} (${code})`;
            }
        });
    }

    async function hydrateCardMetadata(sourceEntries, options = {}) {
        const allowRerender = options?.allowRerender !== false;
        const token = ++cardHydrationToken;
        const initialBreakdownSignature = buildDeckGroupBreakdownHtml(entries);
        const uniqueCodes = Array.from(
            new Set(
                sourceEntries
                    .map((item) => normalizeDeckCode(item.code))
                    .filter((code) => isValidDeckCode(code))
            )
        );
        if (uniqueCodes.length === 0) return;

        refreshRenderedCardTitles();

        const staleOrMissing = uniqueCodes.filter((code) => !isCacheFresh(cardDetailsByCode.get(code)));
        if (staleOrMissing.length === 0) return;

        const apiRows = await fetchCardsFromDigimonApi(staleOrMissing);
        if (token !== cardHydrationToken) return;

        if (apiRows.length > 0) {
            const nowIso = new Date().toISOString();
            apiRows.forEach((row) => {
                cardDetailsByCode.set(row.card_code, { ...row, updated_at: nowIso });
            });
            refreshRenderedCardTitles();
            if (allowRerender && buildDeckGroupBreakdownHtml(entries) !== initialBreakdownSignature) {
                render([]);
                return;
            }
        }
    }

    function compareDeckEntries(leftEntry, rightEntry) {
        const left = getEntrySortDescriptor(leftEntry);
        const right = getEntrySortDescriptor(rightEntry);
        if (left.group !== right.group) return left.group - right.group;
        if (left.level !== right.level) return left.level - right.level;
        if ((left.group === 1 || left.group === 2) && left.name !== right.name) {
            return left.name.localeCompare(right.name);
        }
        const setCompare = compareSetSort(left.setSort, right.setSort);
        if (setCompare !== 0) return setCompare;
        if (left.serial !== right.serial) return left.serial - right.serial;
        if (left.name !== right.name) return left.name.localeCompare(right.name);
        return left.code.localeCompare(right.code);
    }

    function getEntrySortDescriptor(entry) {
        const code = normalizeDeckCode(entry?.code || '');
        const details = cardDetailsByCode.get(code) || null;
        const resolved = resolveEntryTypeAndLevel(entry);
        const type = resolved.type;
        const rawLevel = resolved.level;
        const digimonLevelSort = getDigimonLevelSort(rawLevel);
        let group = 4;

        if (type === 'digi-egg') {
            group = 0;
        } else if (type === 'digimon') {
            group = 1;
        } else if (type === 'tamer') {
            group = 2;
        } else if (type === 'option') {
            group = 3;
        }

        return {
            group,
            level: group === 1 ? digimonLevelSort : 0,
            setSort: parseCardSetSort(code),
            serial: parseCardSerialNumber(code),
            name: String(details?.name || '').trim().toLowerCase(),
            code
        };
    }

    function normalizeCardType(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/_/g, '-')
            .replace(/\s+/g, '-');
        if (normalized === 'digi-egg' || normalized === 'digitama') return 'digi-egg';
        if (normalized === 'digimon') return 'digimon';
        if (normalized === 'tamer') return 'tamer';
        if (normalized === 'option') return 'option';
        return '';
    }

    function getDigimonLevelSort(rawLevel) {
        const level = Number(rawLevel);
        if (!Number.isFinite(level)) return 99;
        const explicitOrder = {
            3: 0,
            4: 1,
            5: 2,
            6: 3,
            7: 4
        };
        if (Object.prototype.hasOwnProperty.call(explicitOrder, level)) {
            return explicitOrder[level];
        }
        return 50 + Math.max(0, Math.trunc(level));
    }

    function parseCardSetSort(code) {
        const normalized = String(code || '').trim().toUpperCase();
        const prefix = normalized.split('-')[0] || '';
        const match = prefix.match(/^([A-Z]+)(\d+)?$/);
        if (!match) {
            return { raw: prefix, family: prefix, familyRank: -1, setNumber: -1 };
        }
        const family = match[1] || prefix;
        const number = Number(match[2] || '');
        const familyRankMap = {
            BT: 5,
            EX: 4,
            ST: 3,
            P: 2,
            LM: 1
        };
        return {
            raw: prefix,
            family,
            familyRank: familyRankMap[family] ?? 0,
            setNumber: Number.isFinite(number) ? number : -1
        };
    }

    function compareSetSort(left, right) {
        if ((left?.familyRank ?? 0) !== (right?.familyRank ?? 0)) {
            return (right?.familyRank ?? 0) - (left?.familyRank ?? 0);
        }
        if ((left?.family || '') !== (right?.family || '')) {
            return String(right?.family || '').localeCompare(String(left?.family || ''));
        }
        if ((left?.setNumber ?? -1) !== (right?.setNumber ?? -1)) {
            return (right?.setNumber ?? -1) - (left?.setNumber ?? -1);
        }
        return String(right?.raw || '').localeCompare(String(left?.raw || ''));
    }

    function parseCardSerialNumber(code) {
        const normalized = String(code || '').trim().toUpperCase();
        const match = normalized.match(/-(\d{1,4})$/);
        if (!match) return 9999;
        const value = Number(match[1]);
        return Number.isFinite(value) ? value : 9999;
    }

    async function fetchCardsFromDigimonApi(codes) {
        const chunks = chunkArray(codes, 20);
        const result = [];
        const usedCodes = new Set();
        for (const chunk of chunks) {
            try {
                const query = new URLSearchParams({ card: chunk.join(','), limit: String(chunk.length) });
                const res = await fetch(`${DIGIMON_CARD_API_URL}?${query.toString()}`);
                if (!res.ok) continue;
                const rows = await res.json();
                if (!Array.isArray(rows)) continue;
                rows.forEach((row) => {
                    const code = normalizeDeckCode(row?.id || row?.card || '');
                    if (!code) return;
                    if (usedCodes.has(code)) return;
                    usedCodes.add(code);
                    result.push({
                        card_code: code,
                        id: row?.id || code,
                        name: row?.name || code,
                        pack: row?.pack || '',
                        color: row?.color || '',
                        type: row?.type || '',
                        card_payload: row || {}
                    });
                });
            } catch {
                continue;
            }
        }
        return result;
    }

    function chunkArray(items, size) {
        const source = Array.isArray(items) ? items : [];
        const result = [];
        for (let i = 0; i < source.length; i += size) {
            result.push(source.slice(i, i + size));
        }
        return result;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[char] || char;
        });
    }

    function escapeHtmlAttribute(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }
})();
