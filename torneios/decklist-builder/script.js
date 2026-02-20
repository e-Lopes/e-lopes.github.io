(function decklistBuilderPage() {
    const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
    const DIGISTATS_LOGO_URL = '../../icons/logo.png';
    const TEMPLATE_EDITOR_STATE_KEY = 'digistats.template-editor.state.v1';
    const BLANK_MIDDLE_FALLBACK_BG = '../../icons/backgrounds/EX11.png';
    const DECK_CODE_PATTERN = /^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|P)-\d{1,3}$/;
    const RAW_DECK_CODE_WITH_SUFFIX_PATTERN =
        /((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|P)-\d{1,3})(?:_[A-Z0-9]+)?/i;
    const MAX_COPIES_PER_CARD = 4;
    const MAX_TOTAL_CARDS = 55;
    const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || '';
    const headers = window.createSupabaseHeaders
        ? window.createSupabaseHeaders()
        : { 'Content-Type': 'application/json' };

    let entries = [];
    let context = { resultId: '', deck: '', player: '', store: '', date: '', format: '' };

    document.addEventListener('DOMContentLoaded', async () => {
        bindActions();
        render([]);
        await applyContextFromQuery();
    });

    function bindActions() {
        const importButton = document.getElementById('btnDecklistBuilderImport');
        const exportButton = document.getElementById('btnDecklistBuilderExport');
        const exportImageButton = document.getElementById('btnDecklistBuilderExportImage');
        const addButton = document.getElementById('btnDecklistBuilderAdd');
        const saveButton = document.getElementById('btnDecklistBuilderSave');
        const manualInput = document.getElementById('decklistBuilderManualCode');
        const importCancelButton = document.getElementById('btnDecklistImportCancel');
        const importConfirmButton = document.getElementById('btnDecklistImportConfirm');
        const importCloseButton = document.getElementById('btnDecklistImportClose');
        const importModal = document.getElementById('decklistImportModal');

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
            if (event.key === 'Escape') closeImportModal();
        });
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
            setSaveStatus('Selecione um resultado na tela Full Results para salvar no banco.', 'warn');
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
            { label: 'Data', value: formattedDate || '-' },
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

    function importDecklistFromModal() {
        const textarea = document.getElementById('decklistImportTextarea');
        if (!textarea) return;

        const pasted = textarea.value || '';
        const result = parseDecklistText(pasted);
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
            render(['Nao ha cartas para exportar.']);
            return;
        }

        const decklistText = serializeDecklist(entries);
        try {
            await navigator.clipboard.writeText(decklistText);
            setSaveStatus('Decklist copiada para a area de transferencia.', 'ok');
        } catch {
            setSaveStatus('Nao foi possivel copiar automaticamente.', 'warn');
            window.prompt('Copie manualmente a decklist abaixo:', decklistText);
        }
    }

    async function exportDeckAsImage() {
        if (entries.length === 0) {
            render(['Nao ha cartas para exportar como imagem.']);
            return;
        }

        const exportImageButton = document.getElementById('btnDecklistBuilderExportImage');
        if (exportImageButton) exportImageButton.disabled = true;
        setSaveStatus('Gerando imagem da decklist...', 'info');

        try {
            const canvas = await buildDeckImageCanvas(entries);
            const filename = buildDeckImageFilename();
            const blob = await canvasToBlob(canvas);
            if (!blob) throw new Error('Falha ao gerar blob da imagem.');

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setSaveStatus('Imagem exportada com sucesso.', 'ok');
        } catch (error) {
            setSaveStatus('Erro ao exportar imagem.', 'error');
            render([error?.message || 'Falha ao exportar imagem da decklist.']);
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
        if (!ctx) throw new Error('Nao foi possivel criar o canvas.');

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
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = `${IMAGE_BASE_URL}${code}.webp`;
        });
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
        if (!isValidDeckCode(normalizedCode)) return { error: 'Codigo de carta invalido.' };

        const existing = entries.find((item) => item.code === normalizedCode);
        if (!existing) return { error: `Carta ${normalizedCode} nao encontrada.` };

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

    function tryUpsertEntry(code, qty) {
        const existing = entries.find((item) => item.code === code);
        const currentQty = Number(existing?.count) || 0;
        if (currentQty + qty > MAX_COPIES_PER_CARD) {
            return { error: '' };
        }

        const totalCards = getTotalCards(entries);
        if (totalCards + qty > MAX_TOTAL_CARDS) {
            return { error: '' };
        }

        if (existing) {
            existing.count += qty;
            return { error: '' };
        }

        entries.push({ code, count: qty });
        return { error: '' };
    }

    function parseDecklistText(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return { entries: [], errors: [] };

        const jsonParsed = tryParseJsonArray(text);
        if (jsonParsed.length > 0) {
            const validated = validateAggregatedEntries(aggregateCodes(jsonParsed));
            return { entries: enforceDeckLimits(validated.entries), errors: validated.errors };
        }

        const lineParsed = parseByLines(text);
        if (lineParsed.entries.length > 0) {
            const validated = validateAggregatedEntries(lineParsed.entries, lineParsed.errors);
            return { entries: enforceDeckLimits(validated.entries), errors: validated.errors };
        }

        const repeated = parseRepeatedCodes(text);
        if (repeated.length > 0) {
            const validated = validateAggregatedEntries(aggregateCodes(repeated));
            return { entries: enforceDeckLimits(validated.entries), errors: validated.errors };
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
                /^(\d{1,2})\s+.*?((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*$/i
            );
            if (patternA) {
                const qty = Number(patternA[1]);
                const code = normalizeDeckCode(patternA[2]);
                if (isValidDeckCode(code)) temp.push({ code, count: qty });
                else errors.push(`Line ${index + 1}: invalid code "${patternA[2]}"`);
                return;
            }

            const patternB = raw.match(
                /^(\d{1,2})\s*\(\s*((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*\)\s*$/i
            );
            if (patternB) {
                const qty = Number(patternB[1]);
                const code = normalizeDeckCode(patternB[2]);
                if (isValidDeckCode(code)) temp.push({ code, count: qty });
                else errors.push(`Line ${index + 1}: invalid code "${patternB[2]}"`);
                return;
            }

            const single = raw.match(
                /^((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|P)-\d{1,3}(?:_[A-Z0-9]+)?)$/i
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
        return { entries: sourceEntries, errors };
    }

    function enforceDeckLimits(sourceEntries) {
        const limited = [];
        let runningTotal = 0;
        sourceEntries.forEach((item) => {
            if (runningTotal >= MAX_TOTAL_CARDS) return;
            const normalizedQty = Math.max(0, Math.min(MAX_COPIES_PER_CARD, Number(item.count) || 0));
            if (normalizedQty <= 0) return;
            const allowedQty = Math.min(normalizedQty, MAX_TOTAL_CARDS - runningTotal);
            if (allowedQty <= 0) return;
            limited.push({ code: item.code, count: allowedQty });
            runningTotal += allowedQty;
        });
        return limited;
    }

    function getTotalCards(sourceEntries) {
        return sourceEntries.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
    }

    async function loadExistingDecklist() {
        if (!context.resultId || !SUPABASE_URL) return false;
        const fetched = await fetchDecklistFromResult(context.resultId);
        if (!fetched || !fetched.decklistText) return false;

        const parsed = parseDecklistText(fetched.decklistText);
        entries = parsed.entries;
        render(parsed.errors);
        return true;
    }

    async function fetchDecklistFromResult(resultId) {
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
            render(['Este registro nao tem result_id para salvar.']);
            return;
        }
        if (!SUPABASE_URL) {
            render(['Supabase nao configurado para salvar decklist.']);
            return;
        }

        const validation = validateAggregatedEntries(entries);
        if (validation.errors.length > 0) {
            render(validation.errors);
            return;
        }

        const saveButton = document.getElementById('btnDecklistBuilderSave');
        if (saveButton) saveButton.disabled = true;
        setSaveStatus('Salvando decklist...', 'info');

        try {
            const decklistText = serializeDecklist(entries);
            const saved = await patchDecklist(context.resultId, decklistText);
            if (!saved) {
                throw new Error('Falha ao salvar decklist nas colunas decklist/decklist_link.');
            }
            setSaveStatus('Decklist salva com sucesso.', 'ok');
        } catch (error) {
            setSaveStatus('Erro ao salvar decklist.', 'error');
            render([error?.message || 'Falha ao salvar decklist.']);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    async function patchDecklist(resultId, decklistText) {
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
        return false;
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
        const errorBox = document.getElementById('decklistBuilderErrors');
        if (!board || !stats || !errorBox) return;

        const totalCards = getTotalCards(entries);
        stats.textContent = `Card count: ${totalCards} cards`;

        if (errors.length > 0) {
            errorBox.style.display = 'block';
            errorBox.textContent = errors.join(' | ');
        } else {
            errorBox.style.display = 'none';
            errorBox.textContent = '';
        }

        if (entries.length === 0) {
            board.innerHTML = '<div class="decklist-builder-empty">No cards yet.</div>';
            return;
        }

        board.innerHTML = entries
            .map(
                (entry) => `
                <article class="decklist-builder-card" data-code="${escapeHtml(entry.code)}">
                    <div class="decklist-builder-count">${entry.count}</div>
                    <img src="${IMAGE_BASE_URL}${entry.code}.webp" alt="${escapeHtml(entry.code)}" />
                    <div class="decklist-builder-code-controls">
                        <button type="button" class="decklist-builder-stepper-btn" data-action="decrease" data-code="${escapeHtml(entry.code)}" aria-label="Decrease ${escapeHtml(entry.code)}">-</button>
                        <div class="decklist-builder-code">${entry.code}</div>
                        <button type="button" class="decklist-builder-stepper-btn" data-action="increase" data-code="${escapeHtml(entry.code)}" aria-label="Increase ${escapeHtml(entry.code)}">+</button>
                    </div>
                </article>
            `
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
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[char] || char;
        });
    }
})();
