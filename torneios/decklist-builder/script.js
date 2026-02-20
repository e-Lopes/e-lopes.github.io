(function decklistBuilderPage() {
    const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
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
    let context = { resultId: '' };

    document.addEventListener('DOMContentLoaded', async () => {
        bindActions();
        render([]);
        await applyContextFromQuery();
    });

    function bindActions() {
        const importButton = document.getElementById('btnDecklistBuilderImport');
        const exportButton = document.getElementById('btnDecklistBuilderExport');
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
        const resultId = String(params.get('resultId') || params.get('result_id') || '').trim();

        context.resultId = resultId;
        if (!context.resultId) {
            setSaveStatus('Selecione um resultado na tela Full Results para salvar no banco.', 'warn');
        }

        renderContextMeta({ deck, player, store, date });

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
            { label: 'Date', value: formattedDate || '-' }
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
