{
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
      };

let allDecks = [];
let imagesMap = {};
let currentView = 'list';
const VIEW_MODES = ['list', 'compact', 'grid'];
const MOBILE_VIEW_BREAKPOINT = 768;
let currentPage = 1;
const PAGE_SIZE_STORAGE_KEY = 'decksPageSize';
const PAGE_SIZE_OPTIONS = [4, 8, 12, 24, 40, 80];
const DECK_RANK_MONTH_STORAGE_KEY = 'decksRankMonth';
const DECK_RANK_FORMAT_STORAGE_KEY = 'decksRankFormat';
const DECK_TABLE_SORT_STORAGE_KEY = 'decksTableSort';
let pageSize = getInitialPageSize();
let currentSearchTerm = '';
let decksPageInitialized = false;
let decklistMvpEntries = [];
const DECK_CODE_PATTERN = /^[A-Z]{1,3}\d{0,2}-\d{1,3}$/;
let deckRankRows = [];
let deckRankLookup = new Map();
let deckRankMonths = [];
let selectedDeckRankMonth = getInitialDeckRankMonth();
let selectedDeckRankFormat = getInitialDeckRankFormat();
let deckTableSort = getInitialDeckTableSort();

function getDeckNameForDisplay(name) {
    const text = String(name || '');
    if (currentView === 'grid' && window.innerWidth > MOBILE_VIEW_BREAKPOINT) {
        const maxChars = 28;
        if (text.length > maxChars) {
            return `${text.slice(0, maxChars - 1).trimEnd()}…`;
        }
    }
    return text;
}

function initDecksPage() {
    if (decksPageInitialized) return;

    const decksList = document.getElementById('decksList');
    if (!decksList) return;

    decksPageInitialized = true;
    setupViewToggle();
    setupStaticActions();
    setupDeckActions();
    initCreateDeckModal({
        supabaseUrl: SUPABASE_URL,
        headers,
        onCreated: async () => {
            await loadDecks();
        }
    });
    initEditDeckModal({
        supabaseUrl: SUPABASE_URL,
        headers,
        onUpdated: async () => {
            await loadDecks();
        }
    });
    setupDecklistMvp();
    loadDecks();
    setupSearch();
    setupPaginationControls();
}

function setupDecklistMvp() {
    const parseButton = document.getElementById('btnDecklistParse');
    const clearButton = document.getElementById('btnDecklistClear');
    const addManualButton = document.getElementById('btnDecklistAddManual');
    const manualInput = document.getElementById('decklistManualCode');

    if (parseButton) {
        parseButton.addEventListener('click', () => {
            const text = document.getElementById('decklistBulkInput')?.value || '';
            const result = parseDecklistText(text);
            decklistMvpEntries = result.entries;
            renderDecklistMvpBoard(result.errors);
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            decklistMvpEntries = [];
            const bulkInput = document.getElementById('decklistBulkInput');
            if (bulkInput) bulkInput.value = '';
            const manual = document.getElementById('decklistManualCode');
            if (manual) manual.value = '';
            renderDecklistMvpBoard([]);
        });
    }

    if (addManualButton) {
        addManualButton.addEventListener('click', () => {
            addManualDecklistCode();
        });
    }

    if (manualInput) {
        manualInput.addEventListener('input', () => {
            manualInput.value = manualInput.value.toUpperCase();
        });
        manualInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addManualDecklistCode();
            }
        });
    }

    renderDecklistMvpBoard([]);
}

function addManualDecklistCode() {
    const manualInput = document.getElementById('decklistManualCode');
    const qtySelect = document.getElementById('decklistManualQty');
    if (!manualInput || !qtySelect) return;

    const code = normalizeDeckCode(manualInput.value);
    const qty = Math.max(1, Math.min(4, Number(qtySelect.value) || 1));

    if (!isValidDeckCode(code)) {
        renderDecklistMvpBoard([`Invalid code: ${manualInput.value || '(empty)'}`]);
        return;
    }

    upsertDecklistEntry(code, qty);
    manualInput.value = '';
    renderDecklistMvpBoard([]);
}

function isValidDeckCode(code) {
    return DECK_CODE_PATTERN.test(String(code || ''));
}

function normalizeDeckCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/^["'\[\(]+/, '')
        .replace(/["'\]\),;:.]+$/, '');
}

function upsertDecklistEntry(code, qty) {
    const existing = decklistMvpEntries.find((item) => item.code === code);
    if (existing) {
        existing.count += qty;
        return;
    }
    decklistMvpEntries.push({ code, count: qty });
}

function parseDecklistText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return { entries: [], errors: [] };

    const errors = [];

    const jsonParsed = tryParseDecklistJsonArray(text);
    if (jsonParsed.length > 0) {
        return { entries: aggregateDeckCodes(jsonParsed), errors: [] };
    }

    const lineBased = parseDecklistByLines(text);
    if (lineBased.entries.length > 0) {
        return { entries: lineBased.entries, errors: lineBased.errors };
    }

    const repeatedCodes = parseDecklistRepeatedCodes(text);
    if (repeatedCodes.length > 0) {
        return { entries: aggregateDeckCodes(repeatedCodes), errors: [] };
    }

    errors.push('No valid deck codes found in the provided text.');
    return { entries: [], errors };
}

function tryParseDecklistJsonArray(text) {
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

function parseDecklistByLines(text) {
    const lines = text.split(/\r?\n/);
    const entries = [];
    const errors = [];

    lines.forEach((line, idx) => {
        const raw = String(line || '').trim();
        if (!raw) return;
        if (/^\/\/\s*/.test(raw)) return;
        if (/^decklist$/i.test(raw)) return;

        const parenMatch = raw.match(/^(\d{1,2})\s*\(\s*([A-Z0-9-]+)\s*\)\s*$/i);
        if (parenMatch) {
            const qty = Number(parenMatch[1]);
            const code = normalizeDeckCode(parenMatch[2]);
            if (isValidDeckCode(code)) entries.push({ code, count: qty });
            else errors.push(`Line ${idx + 1}: invalid code "${parenMatch[2]}"`);
            return;
        }

        const namedMatch = raw.match(/^(\d{1,2})\s+.*?([A-Z]{1,3}\d{0,2}-\d{1,3})\s*$/i);
        if (namedMatch) {
            const qty = Number(namedMatch[1]);
            const code = normalizeDeckCode(namedMatch[2]);
            if (isValidDeckCode(code)) entries.push({ code, count: qty });
            else errors.push(`Line ${idx + 1}: invalid code "${namedMatch[2]}"`);
            return;
        }

        const loneCodeMatch = raw.match(/^([A-Z]{1,3}\d{0,2}-\d{1,3})$/i);
        if (loneCodeMatch) {
            const code = normalizeDeckCode(loneCodeMatch[1]);
            if (isValidDeckCode(code)) entries.push({ code, count: 1 });
            return;
        }
    });

    return { entries: aggregateDeckEntryCounts(entries), errors };
}

function parseDecklistRepeatedCodes(text) {
    const pattern = /([A-Z]{1,3}\d{0,2}-\d{1,3})/gi;
    const matches = [...text.matchAll(pattern)];
    return matches.map((match) => normalizeDeckCode(match[1])).filter((code) => isValidDeckCode(code));
}

function aggregateDeckCodes(codes) {
    const temp = codes.map((code) => ({ code, count: 1 }));
    return aggregateDeckEntryCounts(temp);
}

function aggregateDeckEntryCounts(entries) {
    const map = new Map();
    entries.forEach((entry) => {
        const code = normalizeDeckCode(entry.code);
        const count = Number(entry.count) || 1;
        if (!isValidDeckCode(code)) return;
        if (!map.has(code)) {
            map.set(code, { code, count: 0 });
        }
        map.get(code).count += count;
    });
    return Array.from(map.values());
}

function renderDecklistMvpBoard(errors = []) {
    const board = document.getElementById('decklistMvpBoard');
    const stats = document.getElementById('decklistMvpStats');
    const errorBox = document.getElementById('decklistMvpErrors');
    if (!board || !stats || !errorBox) return;

    const totalCards = decklistMvpEntries.reduce((acc, item) => acc + item.count, 0);
    stats.textContent = `${totalCards} cards | ${decklistMvpEntries.length} unique`;

    if (errors.length > 0) {
        errorBox.textContent = errors.join(' | ');
        errorBox.style.display = 'block';
    } else {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
    }

    if (decklistMvpEntries.length === 0) {
        board.innerHTML = '<div class="decklist-mvp-empty">No cards yet.</div>';
        return;
    }

    board.innerHTML = decklistMvpEntries
        .map((entry) => {
            const imageUrl = `${IMAGE_BASE_URL}${entry.code}.webp`;
            return `
                <article class="decklist-mvp-card" data-code="${escapeHtmlAttribute(entry.code)}">
                    <div class="decklist-mvp-count">${entry.count}</div>
                    <img src="${imageUrl}" alt="${escapeHtmlAttribute(entry.code)}">
                    <div class="decklist-mvp-code">${entry.code}</div>
                </article>
            `;
        })
        .join('');

    board.querySelectorAll('.decklist-mvp-card img').forEach((img) => {
        img.addEventListener(
            'error',
            () => {
                const code = img.closest('.decklist-mvp-card')?.dataset.code || 'CODE';
                img.src = `https://via.placeholder.com/220x308/667eea/ffffff?text=${encodeURIComponent(code)}`;
            },
            { once: true }
        );
    });
}

window.initDecksPage = initDecksPage;
window.resetDecksPage = function resetDecksPage() {
    decksPageInitialized = false;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDecksPage);
} else {
    initDecksPage();
}

function setupStaticActions() {
    const btnEmptyStateAddDeck = document.getElementById('btnEmptyStateAddDeck');
    const btnNoResultsClearSearch = document.getElementById('btnNoResultsClearSearch');
    const btnOpenCreateDeckModal = document.getElementById('btnOpenCreateDeckModal');

    if (btnEmptyStateAddDeck && btnOpenCreateDeckModal) {
        btnEmptyStateAddDeck.addEventListener('click', () => btnOpenCreateDeckModal.click());
    }

    if (btnNoResultsClearSearch) {
        btnNoResultsClearSearch.addEventListener('click', () => clearSearch());
    }
}

function setupDeckActions() {
    const container = document.getElementById('decksList');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const sortButton = event.target.closest('[data-decks-sort-field]');
        if (sortButton) {
            const field = String(sortButton.dataset.decksSortField || '');
            if (field) {
                toggleDeckTableSort(field);
                currentPage = 1;
                renderDecksList();
            }
            return;
        }

        const editButton = event.target.closest('[data-action="edit-deck"]');
        if (editButton) {
            editDeck(
                editButton.dataset.deckId,
                editButton.dataset.deckName || '',
                editButton.dataset.imageUrl || '',
                editButton.dataset.deckColors || ''
            );
            return;
        }

        const deleteButton = event.target.closest('[data-action="delete-deck"]');
        if (deleteButton) {
            deleteDeck(deleteButton.dataset.deckId, deleteButton.dataset.deckName || '');
        }
    });
}

function getInitialPageSize() {
    const saved = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 8;
}

function getInitialDeckRankMonth() {
    return String(localStorage.getItem(DECK_RANK_MONTH_STORAGE_KEY) || '').trim();
}

function getInitialDeckRankFormat() {
    return String(localStorage.getItem(DECK_RANK_FORMAT_STORAGE_KEY) || '').trim().toLowerCase();
}

function getInitialDeckTableSort() {
    const fallback = { field: 'deck', direction: 'asc' };
    try {
        const raw = localStorage.getItem(DECK_TABLE_SORT_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        const field = String(parsed?.field || '').trim();
        const direction = parsed?.direction === 'desc' ? 'desc' : 'asc';
        if (!field) return fallback;
        return { field, direction };
    } catch {
        return fallback;
    }
}

function saveDeckTableSort() {
    localStorage.setItem(DECK_TABLE_SORT_STORAGE_KEY, JSON.stringify(deckTableSort));
}

function toggleDeckTableSort(field) {
    if (deckTableSort.field === field) {
        deckTableSort.direction = deckTableSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        deckTableSort = { field, direction: field === 'deck' ? 'asc' : 'desc' };
    }
    saveDeckTableSort();
}

function isMobileDeckViewport() {
    return window.matchMedia(`(max-width: ${MOBILE_VIEW_BREAKPOINT}px)`).matches;
}

function getAvailableViewModes() {
    return isMobileDeckViewport() ? ['list'] : ['list', 'compact', 'grid'];
}

function ensureValidViewMode() {
    const available = getAvailableViewModes();
    if (!available.includes(currentView)) {
        currentView = available[0];
        localStorage.setItem('decksViewMode', currentView);
    }
}

function setupViewToggle() {
    const btn = document.getElementById('viewToggleBtn');
    const savedView = localStorage.getItem('decksViewMode');
    if (savedView && VIEW_MODES.includes(savedView)) {
        currentView = savedView;
    }
    ensureValidViewMode();
    applyViewMode();

    if (btn) {
        btn.style.display = '';
        btn.addEventListener('click', () => {
            const available = getAvailableViewModes();
            const currentIndex = available.indexOf(currentView);
            const nextIndex = (currentIndex + 1) % available.length;
            currentView = available[nextIndex];
            localStorage.setItem('decksViewMode', currentView);
            applyViewMode();
            renderDecksList();
        });
    }

    window.addEventListener('resize', () => {
        ensureValidViewMode();
        applyViewMode();
        renderDecksList();
    });
}

function applyViewMode() {
    const container = document.getElementById('decksList');
    const btn = document.getElementById('viewToggleBtn');
    if (!container || !btn) return;

    ensureValidViewMode();

    container.classList.remove('view-list', 'view-compact', 'view-grid');
    if (currentView === 'grid') {
        container.classList.add('view-grid');
    } else if (currentView === 'compact') {
        container.classList.add('view-compact');
    } else {
        container.classList.add('view-list');
    }

    const available = getAvailableViewModes();
    const currentIndex = available.indexOf(currentView);
    const nextMode = available[(currentIndex + 1) % available.length];
    const iconMap = {
        compact: `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="4"></rect>
                        <rect x="3" y="10" width="18" height="4"></rect>
                        <rect x="3" y="16" width="18" height="4"></rect>
                    </svg>
                `,
        list: `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <circle cx="4" cy="6" r="1"></circle>
                        <circle cx="4" cy="12" r="1"></circle>
                        <circle cx="4" cy="18" r="1"></circle>
                    </svg>
                `,
        grid: `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                `
    };
    const labelMap = {
        compact: 'Alternar para tabela',
        list: 'Alternar para lista',
        grid: 'Alternar para quadros'
    };

    btn.innerHTML = iconMap[nextMode];
    btn.title = labelMap[nextMode];
    btn.setAttribute('aria-label', labelMap[nextMode]);
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();
        currentPage = 1;
        renderDecksList();
    });
}

function setupPaginationControls() {
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    const monthSelect = document.getElementById('deckRankMonthSelect');
    const formatSelect = document.getElementById('deckRankFormatSelect');
    if (pageSizeSelect) {
        pageSizeSelect.value = String(pageSize);
        pageSizeSelect.addEventListener('change', () => {
            const selected = parseInt(pageSizeSelect.value, 10);
            pageSize =
                Number.isInteger(selected) && PAGE_SIZE_OPTIONS.includes(selected) ? selected : 8;
            localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
            currentPage = 1;
            renderDecksList();
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            selectedDeckRankMonth = String(monthSelect.value || '');
            localStorage.setItem(DECK_RANK_MONTH_STORAGE_KEY, selectedDeckRankMonth);
            currentPage = 1;
            renderDecksList();
        });
    }

    if (formatSelect) {
        formatSelect.addEventListener('change', () => {
            selectedDeckRankFormat = String(formatSelect.value || '').trim().toLowerCase();
            localStorage.setItem(DECK_RANK_FORMAT_STORAGE_KEY, selectedDeckRankFormat);
            currentPage = 1;
            renderDecksList();
        });
    }
}

function filterDecks(searchTerm) {
    const normalizedSearch = String(searchTerm || '').toLowerCase().trim();
    return allDecks.filter((deck) => {
        const matchesSearch = !normalizedSearch || deck.name.toLowerCase().includes(normalizedSearch);
        if (!matchesSearch) return false;
        if (!selectedDeckRankFormat) return true;
        return getDeckFormatTag(deck) === selectedDeckRankFormat;
    });
}

function renderDecksList() {
    const filtered = filterDecks(currentSearchTerm);
    const merged = filtered.map((deck) => buildDeckTableRow(deck));
    const sorted = sortDeckTableRows(merged);
    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pagedDecks = sorted.slice(start, end);

    if (totalItems === 0) {
        const container = document.getElementById('decksList');
        const emptyState = document.getElementById('emptyState');
        const noResults = document.getElementById('noResults');
        container.style.display = 'none';
        emptyState.style.display = currentSearchTerm ? 'none' : 'block';
        noResults.style.display = currentSearchTerm ? 'block' : 'none';
        renderPagination(0);
        return;
    }

    document.getElementById('noResults').style.display = 'none';
    displayDecks(pagedDecks, imagesMap, Boolean(currentSearchTerm));
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('decksPagination');
    if (!pagination) return;
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    if (currentPage > totalPages) currentPage = totalPages;

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn-pagination btn-pagination-prev';
    prev.textContent = '\u25C0';
    prev.setAttribute('aria-label', 'Previous page');
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderDecksList();
    });
    pagination.appendChild(prev);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-pagination-number';
        btn.textContent = String(p);
        if (p === currentPage) {
            btn.classList.add('active');
            btn.disabled = true;
        }
        btn.addEventListener('click', () => {
            currentPage = p;
            renderDecksList();
        });
        pagination.appendChild(btn);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn-pagination btn-pagination-next';
    next.textContent = '\u25B6';
    next.setAttribute('aria-label', 'Next page');
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => {
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderDecksList();
    });
    pagination.appendChild(next);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentSearchTerm = '';
    currentPage = 1;
    renderDecksList();
}

async function loadDecks() {
    try {
        showLoading(true);

        const decksRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*&order=name.asc`, {
            headers
        });
        if (!decksRes.ok) throw new Error('Error loading decks');

        allDecks = await decksRes.json();
        updateDecksTotal();

        const imagesRes = await fetch(
            `${SUPABASE_URL}/rest/v1/deck_images?select=deck_id,image_url`,
            { headers }
        );

        if (imagesRes.ok) {
            const images = await imagesRes.json();
            images.forEach((img) => {
                imagesMap[img.deck_id] = img.image_url;
            });
        }

        await loadDeckRankRows();
        populateDeckRankFormatSelect();
        populateDeckRankMonthSelect();
        renderDecksList();
        showLoading(false);
    } catch (error) {
        console.error('Error loading decks:', error);
        showError('Error loading decks. Try again.');
        showLoading(false);
    }
}

async function loadDeckRankRows() {
    deckRankRows = [];
    deckRankLookup = new Map();
    deckRankMonths = [];

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/v_deck_rank?select=*&order=month.desc,performance_rank.asc`,
            { headers }
        );
        if (!res.ok) return;
        const rows = await res.json();
        deckRankRows = Array.isArray(rows) ? rows : [];
    } catch {
        deckRankRows = [];
    }

    const monthSet = new Set();
    deckRankRows.forEach((row) => {
        const month = normalizeDeckRankMonthKey(row?.month);
        const deckName = String(row?.deck || '')
            .trim()
            .toLowerCase();
        if (!month || !deckName) return;
        monthSet.add(month);
        deckRankLookup.set(`${month}|${deckName}`, row);
    });

    deckRankMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    if (!selectedDeckRankMonth || !deckRankMonths.includes(selectedDeckRankMonth)) {
        selectedDeckRankMonth = deckRankMonths[0] || '';
        localStorage.setItem(DECK_RANK_MONTH_STORAGE_KEY, selectedDeckRankMonth);
    }
}

function normalizeDeckRankMonthKey(value) {
    if (!value) return '';
    const text = String(value).trim();
    const match = text.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function formatDeckRankMonthLabel(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return monthKey || 'Latest';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

function normalizeDeckRankFormat(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function formatDeckRankFormatLabel(formatKey) {
    const text = String(formatKey || '').trim();
    if (!text) return 'All formats';
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function populateDeckRankMonthSelect() {
    const select = document.getElementById('deckRankMonthSelect');
    if (!select) return;
    select.innerHTML =
        '<option value="">Latest month</option>' +
        deckRankMonths
            .map(
                (month) =>
                    `<option value="${month}">${escapeHtmlAttribute(formatDeckRankMonthLabel(month))}</option>`
            )
            .join('');

    if (selectedDeckRankMonth && deckRankMonths.includes(selectedDeckRankMonth)) {
        select.value = selectedDeckRankMonth;
    } else {
        select.value = '';
    }
}

function populateDeckRankFormatSelect() {
    const select = document.getElementById('deckRankFormatSelect');
    if (!select) return;
    const formatSet = new Set();
    allDecks.forEach((deck) => {
        const format = getDeckFormatTag(deck);
        if (format) formatSet.add(format);
    });
    const formatOptions = Array.from(formatSet).sort((a, b) => a.localeCompare(b));

    select.innerHTML =
        '<option value="">All formats</option>' +
        formatOptions
            .map(
                (format) =>
                    `<option value="${escapeHtmlAttribute(format)}">${escapeHtmlAttribute(formatDeckRankFormatLabel(format))}</option>`
            )
            .join('');
    if (selectedDeckRankFormat && !formatOptions.includes(selectedDeckRankFormat)) {
        selectedDeckRankFormat = '';
        localStorage.setItem(DECK_RANK_FORMAT_STORAGE_KEY, selectedDeckRankFormat);
    }
    select.value = selectedDeckRankFormat || '';
}

function getDeckRankMetrics(deckName) {
    const monthKey = selectedDeckRankMonth || deckRankMonths[0];
    if (!monthKey) return null;
    return (
        deckRankLookup.get(
            `${monthKey}|${String(deckName || '')
                .trim()
                .toLowerCase()}`
        ) || null
    );
}

function getDeckFormatTag(deck) {
    if (!deck) return '';
    const imageUrl = imagesMap[deck.id] || '';
    const codeFromImage = extractCodeFromUrl(imageUrl);
    const imageMatch = String(codeFromImage || '')
        .toUpperCase()
        .match(/^([A-Z]{1,3}\d{1,2})-/);
    if (imageMatch) return imageMatch[1];

    const nameMatch = String(deck.name || '')
        .toUpperCase()
        .match(/\b([A-Z]{1,3}\d{1,2})(?=-|\b)/);
    return nameMatch ? nameMatch[1] : '';
}

function buildDeckTableRow(deck) {
    const stats = getDeckRankMetrics(deck.name);
    return {
        deck,
        stats
    };
}

function getDeckMetricValue(row, field) {
    if (field === 'deck') return String(row?.deck?.name || '').toLowerCase();
    const stats = row?.stats;
    if (!stats) return null;
    const value = stats[field];
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function sortDeckTableRows(rows) {
    const direction = deckTableSort.direction === 'desc' ? -1 : 1;
    const field = deckTableSort.field || 'deck';
    return [...rows].sort((a, b) => {
        const left = getDeckMetricValue(a, field);
        const right = getDeckMetricValue(b, field);
        const leftMissing = left === null || left === undefined || left === '';
        const rightMissing = right === null || right === undefined || right === '';

        if (leftMissing && !rightMissing) return 1;
        if (!leftMissing && rightMissing) return -1;
        if (leftMissing && rightMissing) {
            const aDeck = String(a?.deck?.name || '').toLowerCase();
            const bDeck = String(b?.deck?.name || '').toLowerCase();
            return aDeck.localeCompare(bDeck);
        }

        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
        const aDeck = String(a?.deck?.name || '').toLowerCase();
        const bDeck = String(b?.deck?.name || '').toLowerCase();
        return aDeck.localeCompare(bDeck);
    });
}

function getDeckAssetPrefix() {
    const path = String(window.location.pathname || '').toLowerCase();
    return path.includes('/decks/') ? '../' : '';
}

function formatOrdinal(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const int = Math.trunc(n);
    const abs = Math.abs(int);
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${int}th`;
    const mod10 = abs % 10;
    if (mod10 === 1) return `${int}st`;
    if (mod10 === 2) return `${int}nd`;
    if (mod10 === 3) return `${int}rd`;
    return `${int}th`;
}

function getPlacementBadgeClass(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'decks-rank-default';
    if (n === 1) return 'decks-rank-first';
    if (n === 2) return 'decks-rank-second';
    if (n === 3) return 'decks-rank-third';
    if (n === 4) return 'decks-rank-fourth';
    return 'decks-rank-default';
}

function parseDeckColorsCsv(value) {
    const allowed = ['r', 'u', 'b', 'w', 'g', 'y', 'p'];
    const set = new Set(
        String(value || '')
            .split(',')
            .map((token) => token.trim().toLowerCase())
            .filter((token) => allowed.includes(token))
    );
    return allowed.filter((token) => set.has(token));
}

function renderDeckColorsInline(colorsCsv, variant = 'card') {
    const colors = parseDeckColorsCsv(colorsCsv);
    if (!colors.length) return '';
    const labelMap = {
        r: 'Red',
        u: 'Blue',
        b: 'Black',
        w: 'White',
        g: 'Green',
        y: 'Yellow',
        p: 'Purple'
    };
    return `<div class="deck-colors-row deck-colors-row-${variant}">${colors
        .map(
            (color) =>
                `<span class="deck-color-chip is-${color}" title="${labelMap[color] || color.toUpperCase()}" aria-label="${labelMap[color] || color.toUpperCase()}"></span>`
        )
        .join('')}</div>`;
}

function displayDecks(decks, imagesMap, isFiltered = false) {
    const container = document.getElementById('decksList');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noResults');

    if (!decks || decks.length === 0) {
        if (isFiltered) {
            container.style.display = 'none';
            emptyState.style.display = 'none';
            noResults.style.display = 'block';
        } else {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            noResults.style.display = 'none';
        }
        return;
    }

    container.innerHTML = '';
    container.style.display = 'block';
    emptyState.style.display = 'none';
    noResults.style.display = 'none';
    if (currentView !== 'list') {
        container.innerHTML = '';
        container.style.display = 'grid';
        decks.forEach((row) => {
            const deck = row.deck;
            const imageUrl = imagesMap[deck.id];
            const fallback =
                'https://via.placeholder.com/300x220/667eea/ffffff?text=' +
                encodeURIComponent(deck.name.substring(0, 12));
            const deckCode = extractCodeFromUrl(imageUrl);
            const deckNameDisplay = getDeckNameForDisplay(deck.name);

            const deckCard = document.createElement('div');
            deckCard.className = 'deck-row';
            deckCard.innerHTML = `
                <div class="deck-thumb-wrapper">
                    <img src="${imageUrl || fallback}" alt="${deck.name}" class="deck-thumb-image">
                </div>
                <div class="deck-info">
                    <div class="deck-name-line">
                        <h3 class="deck-name" title="${escapeHtmlAttribute(deck.name)}">${escapeHtmlAttribute(deckNameDisplay)}</h3>
                        ${renderDeckColorsInline(deck.colors, 'card-inline')}
                    </div>
                    ${deckCode ? `<div class="deck-code">${deckCode}</div>` : ''}
                    ${renderDeckColorsInline(deck.colors, 'card-below')}
                </div>
                <div class="deck-actions">
                    <button
                        class="btn-secondary btn-icon"
                        type="button"
                        title="Edit deck"
                        aria-label="Edit deck"
                        data-action="edit-deck"
                        data-deck-id="${deck.id}"
                        data-deck-name="${escapeHtmlAttribute(deck.name)}"
                        data-deck-colors="${escapeHtmlAttribute(deck.colors || '')}"
                        data-image-url="${escapeHtmlAttribute(imageUrl || '')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                        </svg>
                    </button>
                    <button
                        class="btn-secondary btn-danger btn-icon"
                        type="button"
                        title="Delete deck"
                        aria-label="Delete deck"
                        data-action="delete-deck"
                        data-deck-id="${deck.id}"
                        data-deck-name="${escapeHtmlAttribute(deck.name)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M8 6V4h8v2"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;

            const image = deckCard.querySelector('.deck-thumb-image');
            if (image) {
                image.addEventListener(
                    'error',
                    () => {
                        image.src = fallback;
                    },
                    { once: true }
                );
            }

            container.appendChild(deckCard);
        });
        applyViewMode();
        return;
    }

    const indicator = (field) => {
        if (deckTableSort.field !== field) return '\u21C5';
        return deckTableSort.direction === 'asc' ? '\u25B2' : '\u25BC';
    };
    const deckIconSrc = `${getDeckAssetPrefix()}icons/digivice.svg`;
    const sortableHeader = (field, title, iconHtml, label) =>
        `<th><div class="decks-header-content" title="${escapeHtmlAttribute(title)}">${iconHtml}<span>${label}</span><button type="button" class="decks-sort-arrow" data-decks-sort-field="${field}" aria-label="Ordenar por ${escapeHtmlAttribute(label)}">${indicator(field)}</button></div></th>`;
    const metricText = (stats, field, fractionDigits = 0) => {
        if (!stats || stats[field] === null || stats[field] === undefined) return '-';
        const num = Number(stats[field]);
        if (!Number.isFinite(num)) return '-';
        return fractionDigits > 0 ? num.toFixed(fractionDigits) : String(Math.trunc(num));
    };
    const numericSquare = (stats, field, fractionDigits = 0) =>
        `<span class="decks-num-rank-box">${metricText(stats, field, fractionDigits)}</span>`;
    const rankBadge = (stats) => {
        const value = metricText(stats, 'performance_rank');
        const n = Number(value);
        const rankClass = getPlacementBadgeClass(n);
        return `<span class="details-rank-badge decks-rank-badge ${rankClass}">${Number.isFinite(n) ? formatOrdinal(n) : '-'}</span>`;
    };
    const averageBadge = (stats) => {
        const value = metricText(stats, 'avg_placement');
        const n = Number(value);
        const rankClass = getPlacementBadgeClass(n);
        return `<span class="details-rank-badge decks-rank-badge decks-average-badge ${rankClass}">${Number.isFinite(n) ? formatOrdinal(n) : '-'}</span>`;
    };
    const placementBadge = (stats, field) => {
        const value = metricText(stats, field);
        const n = Number(value);
        const rankClass = getPlacementBadgeClass(n);
        return `<span class="details-rank-badge decks-rank-badge ${rankClass}">${Number.isFinite(n) ? formatOrdinal(n) : '-'}</span>`;
    };

    const rowsHtml = decks
        .map((row) => {
            const deck = row.deck;
            const stats = row.stats;
            const imageUrl = imagesMap[deck.id];
            const fallback =
                'https://via.placeholder.com/80x80/667eea/ffffff?text=' +
                encodeURIComponent(deck.name.substring(0, 2));
            return `
                <tr>
                    <td class="decks-col-name">
                        <span class="decks-col-name-wrap">
                            <span class="decks-col-thumb-wrapper">
                                <img
                                    src="${escapeHtmlAttribute(imageUrl || fallback)}"
                                    alt="${escapeHtmlAttribute(deck.name)}"
                                    class="decks-col-thumb-image"
                                    loading="lazy"
                                    onerror="this.onerror=null;this.src='${escapeHtmlAttribute(fallback)}';"
                                />
                            </span>
                            <span class="decks-col-name-text">
                                <strong>${escapeHtmlAttribute(deck.name)}</strong>
                                ${renderDeckColorsInline(deck.colors, 'table')}
                            </span>
                        </span>
                    </td>
                    <td class="decks-num-cell">${numericSquare(stats, 'monthly_appearances')}</td>
                    <td class="decks-num-cell">${numericSquare(stats, 'tournament_appearances')}</td>
                    <td class="decks-num-cell">${numericSquare(stats, 'unique_players')}</td>
                    <td class="decks-num-cell">${numericSquare(stats, 'titles')}</td>
                    <td class="decks-num-cell">${numericSquare(stats, 'top4_total')}</td>
                    <td class="decks-rank-cell">${averageBadge(stats)}</td>
                    <td class="decks-rank-cell">${placementBadge(stats, 'best_finish')}</td>
                    <td class="decks-rank-cell">${placementBadge(stats, 'worst_finish')}</td>
                    <td class="decks-num-cell">${numericSquare(stats, 'ranking_points', 2)}</td>
                    <td class="decks-rank-cell">${rankBadge(stats)}</td>
                    <td class="decks-actions-col">
                        <div class="decks-table-actions">
                            <button
                                class="btn-secondary btn-icon"
                                type="button"
                                title="Edit deck"
                                aria-label="Edit deck"
                                data-action="edit-deck"
                                data-deck-id="${deck.id}"
                                data-deck-name="${escapeHtmlAttribute(deck.name)}"
                                data-deck-colors="${escapeHtmlAttribute(deck.colors || '')}"
                                data-image-url="${escapeHtmlAttribute(imageUrl || '')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                            </button>
                            <button
                                class="btn-secondary btn-danger btn-icon"
                                type="button"
                                title="Delete deck"
                                aria-label="Delete deck"
                                data-action="delete-deck"
                                data-deck-id="${deck.id}"
                                data-deck-name="${escapeHtmlAttribute(deck.name)}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M8 6V4h8v2"/>
                                    <path d="M19 6l-1 14H6L5 6"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="decks-table-wrapper">
            <table class="decks-table">
                <thead>
                    <tr>
                        ${sortableHeader('deck', 'Nome do deck.', `<span class="nav-icon decks-th-nav-icon" aria-hidden="true"><img src="${deckIconSrc}" alt="" class="nav-icon-digivice decks-th-digivice-img" /></span>`, 'Deck')}
                        ${sortableHeader('monthly_appearances', 'Quantidade de aparições no mês selecionado.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>`, 'Monthly')}
                        ${sortableHeader('tournament_appearances', 'Quantidade de torneios distintos em que o deck apareceu no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>`, 'Events')}
                        ${sortableHeader('unique_players', 'Quantidade de jogadores únicos que usaram o deck no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5"/><circle cx="17" cy="10" r="2"/><path d="M15 20c.2-2 1.6-3.5 3.5-4"/></svg>`, 'Players')}
                        ${sortableHeader('titles', 'Quantidade de títulos (Top 1) no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3a5 5 0 0 1-10 0z"/><path d="M5 7H3a3 3 0 0 0 3 3"/><path d="M19 7h2a3 3 0 0 1-3 3"/></svg>`, 'Titles')}
                        ${sortableHeader('top4_total', 'Quantidade de resultados em Top 4 no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V10h3v10"/><path d="M11 20V6h3v14"/><path d="M16 20v-8h3v8"/><path d="M4 20h16"/></svg>`, 'Top4')}
                        ${sortableHeader('avg_placement', 'Posicionamento médio no mês (quanto menor, melhor).', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16"/><path d="M7 15l3-3 3 2 4-5"/></svg>`, 'Average')}
                        ${sortableHeader('best_finish', 'Melhor posicionamento alcançado no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M6 11l6-6 6 6"/></svg>`, 'Best')}
                        ${sortableHeader('worst_finish', 'Pior posicionamento registrado no mês.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>`, 'Worst')}
                        ${sortableHeader('ranking_points', `Pontuação base:\n1º = 4, 2º = 3, 3º = 2, 4º = 1\n\nMultiplicador:\n1-8 jogadores = 100%\n9-16 jogadores = 120%\n17+ com 4 rodadas = 100%\n17+ com 5+ rodadas = 150%`, `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 3 14.9 9 21.5 9.8 16.7 14.2 18 21 12 17.7 6 21 7.3 14.2 2.5 9.8 9.1 9"/></svg>`, 'Points')}
                        ${sortableHeader('performance_rank', 'Posição do deck no ranking mensal.', `<svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8h4v12"/><path d="M10 20V4h4v16"/><path d="M16 20v-7h4v7"/></svg>`, 'Rank')}
                        <th title="Ações de editar e excluir deck." class="decks-actions-head"><svg class="decks-th-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2c-.6 0-1.2.4-1.4 1z"/></svg><span>Actions</span></th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
    applyViewMode();
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function extractCodeFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/([A-Z0-9-]+)\.webp$/);
    return match ? match[1] : null;
}

async function deleteDeck(deckId, deckName) {
    try {
        showLoading(true);

        const tournamentResultsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?deck_id=eq.${deckId}`,
            { headers }
        );

        if (!tournamentResultsRes.ok) {
            throw new Error(`HTTP ${tournamentResultsRes.status}`);
        }

        const tournamentResults = await tournamentResultsRes.json();

        if (tournamentResults && tournamentResults.length > 0) {
            showLoading(false);
            alert(
                `Cannot delete deck "${deckName}" because it has ${tournamentResults.length} tournament result(s) recorded.\n\nPlease delete the tournament results first.`
            );
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete the deck "${deckName}"?\n\nThis action cannot be undone.`
            )
        ) {
            showLoading(false);
            return;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });

        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });

        if (res.ok) {
            currentPage = 1;
            loadDecks();
        } else {
            throw new Error('Error deleting deck');
        }
    } catch (error) {
        console.error('Error deleting deck:', error);
        alert('Error deleting deck. Please try again.');
    } finally {
        showLoading(false);
    }
}

function editDeck(deckId, deckName, imageUrl, deckColors) {
    if (typeof openEditDeckModal === 'function') {
        openEditDeckModal(deckId, deckName || '', imageUrl || '', deckColors || '');
        return;
    }
}

function showLoading(show) {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    alert(message);
}

function updateDecksTotal() {
    const totalEl = document.getElementById('decksTotalCount');
    if (!totalEl) return;
    totalEl.textContent = `Total: ${allDecks.length}`;
}
}
