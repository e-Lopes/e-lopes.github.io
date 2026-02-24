{
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders({ Prefer: 'return=minimal' })
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
	      };
const CARD_IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
let allPlayers = [];
let filteredPlayers = [];
let editingPlayerId = null;
let currentPage = 1;
const PAGE_SIZE_STORAGE_KEY = 'playersPageSize';
const PAGE_SIZE_OPTIONS = [5, 10, 15, 30, 50, 100];
let itemsPerPage = getInitialPageSize();
let playersPageInitialized = false;
let expandedPlayerId = null;
let expandedHistoryEntryKey = null;
const playerHistoryCache = new Map();

function initPlayersPage() {
    if (playersPageInitialized) return;
    if (!document.getElementById('playersList')) return;

    playersPageInitialized = true;
    loadPlayers();
    setupEventListeners();
}

window.initPlayersPage = initPlayersPage;
window.resetPlayersPage = function resetPlayersPage() {
    playersPageInitialized = false;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayersPage);
} else {
    initPlayersPage();
}

function getInitialPageSize() {
    const saved = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10;
}
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setupEventListeners() {
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) {
        pageSizeSelect.value = String(itemsPerPage);
        pageSizeSelect.addEventListener('change', (e) => {
            const selected = Number(e.target.value);
            if (PAGE_SIZE_OPTIONS.includes(selected)) {
                itemsPerPage = selected;
                localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
                currentPage = 1;
                renderPaginatedList();
            }
        });
    }
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        setSubmitButtonLabel('Add');
        submitBtn.addEventListener('click', handleSubmit);
    }

    const playerNameInput = document.getElementById('playerName');
    if (playerNameInput) {
        playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        filteredPlayers = allPlayers.filter((p) => p.name.toLowerCase().includes(term));
        currentPage = 1;
        renderPaginatedList();
    });

    const playersList = document.getElementById('playersList');
    if (playersList) {
        playersList.addEventListener('click', (event) => {
            const toggleButton = event.target.closest('[data-action="toggle-player-history"]');
            if (toggleButton) {
                togglePlayerHistory(toggleButton.dataset.playerId);
                return;
            }
            const toggleHistoryEntry = event.target.closest('[data-action="toggle-history-entry"]');
            if (toggleHistoryEntry) {
                togglePlayerHistoryEntry(toggleHistoryEntry.dataset.entryKey);
                return;
            }

            const editButton = event.target.closest('[data-action="edit-player"]');
            if (editButton) {
                editPlayer(editButton.dataset.playerId, editButton.dataset.playerName || '');
                return;
            }

            const deleteButton = event.target.closest('[data-action="delete-player"]');
            if (deleteButton) {
                deletePlayer(deleteButton.dataset.playerId, deleteButton.dataset.playerName || '');
            }
        });

        playersList.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const toggleButton = event.target.closest('[data-action="toggle-player-history"]');
            if (toggleButton) {
                event.preventDefault();
                togglePlayerHistory(toggleButton.dataset.playerId);
                return;
            }
            const toggleHistoryEntry = event.target.closest('[data-action="toggle-history-entry"]');
            if (toggleHistoryEntry) {
                event.preventDefault();
                togglePlayerHistoryEntry(toggleHistoryEntry.dataset.entryKey);
            }
        });
    }

}

function setSubmitButtonLabel(label) {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;
    submitBtn.innerHTML = `
        <svg class="btn-create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M12 5v14M5 12h14"></path>
        </svg>
        <span>${label}</span>
    `;
}

async function loadPlayers() {
    const list = document.getElementById('playersList');
    const loadingNode = list ? list.querySelector('.loading') : null;
    if (window.uiState) {
        window.uiState.setLoading(list, loadingNode, true);
    }

    try {
        const res = window.supabaseApi
            ? await window.supabaseApi.get('/rest/v1/players?select=*&order=name.asc')
            : await fetch(`${SUPABASE_URL}/rest/v1/players?select=*&order=name.asc`, { headers });

        if (!res.ok) {
            throw new Error(`Failed to load players (${res.status})`);
        }

        allPlayers = await res.json();
        filteredPlayers = allPlayers;
        document.getElementById('totalPlayersCount').textContent = allPlayers.length;
        renderPaginatedList();
    } catch (error) {
        console.error(error);
        showToast('Error loading players', 'error');
    } finally {
        if (window.uiState) {
            window.uiState.setLoading(list, loadingNode, false);
        }
    }
}

function renderPaginatedList() {
    const list = document.getElementById('playersList');
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filteredPlayers.slice(start, start + itemsPerPage);
    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage) || 1;

    list.innerHTML = '';

    if (filteredPlayers.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        renderPagination(0);
        return;
    }

    document.getElementById('emptyState').style.display = 'none';
    const rowsHtml = paginatedItems
        .map((p) => {
            const isExpanded = String(expandedPlayerId || '') === String(p.id);
            const historyRows = playerHistoryCache.get(String(p.id));
            return `
                <tr class="players-table-row ${isExpanded ? 'is-expanded' : ''}">
                    <td class="players-cell-name">
                        <button
                            class="player-main-toggle"
                            type="button"
                            data-action="toggle-player-history"
                            data-player-id="${p.id}"
                            aria-expanded="${isExpanded ? 'true' : 'false'}"
                        >
                            <span class="player-main-name"><strong>${escapeHtml(p.name)}</strong></span>
                            <span class="player-main-hint">${isExpanded ? 'Hide history' : 'Show history'}</span>
                        </button>
                    </td>
                    <td class="players-cell-actions">
                        <div class="player-actions">
                            <button class="btn-action btn-icon-only" type="button" title="Edit player" aria-label="Edit player" data-action="edit-player" data-player-id="${p.id}" data-player-name="${escapeHtmlAttribute(p.name)}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                            </button>
                            <button class="btn-action btn-danger btn-icon-only" type="button" title="Delete player" aria-label="Delete player" data-action="delete-player" data-player-id="${p.id}" data-player-name="${escapeHtmlAttribute(p.name)}">
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
                <tr class="players-details-row ${isExpanded ? '' : 'u-hidden'}" data-player-history-row="${p.id}">
                    <td colspan="2">
                        <div class="player-history" data-player-history="${p.id}">
                            ${isExpanded ? renderPlayerHistory(historyRows, p.id) : ''}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    list.innerHTML = `
        <table class="players-table" aria-label="Players table">
            <thead>
                <tr>
                    <th>Player</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;

    bindDecklistImageFallbacks(list);
    renderPagination(totalPages);
}

function togglePlayerHistory(playerId) {
    const id = String(playerId || '').trim();
    if (!id) return;
    const nextExpandedPlayerId = expandedPlayerId === id ? null : id;
    if (nextExpandedPlayerId !== expandedPlayerId) {
        expandedHistoryEntryKey = null;
    }
    expandedPlayerId = nextExpandedPlayerId;
    renderPaginatedList();

    if (expandedPlayerId && !playerHistoryCache.has(expandedPlayerId)) {
        loadPlayerHistory(expandedPlayerId);
    }
}

function togglePlayerHistoryEntry(entryKey) {
    const key = String(entryKey || '').trim();
    if (!key) return;
    expandedHistoryEntryKey = expandedHistoryEntryKey === key ? null : key;
    renderPaginatedList();
}

async function loadPlayerHistory(playerId) {
    const id = String(playerId || '').trim();
    if (!id || playerHistoryCache.has(id)) return;

    try {
        const decklistColumn = await resolvePlayerHistoryDecklistColumn(id);
        const endpoint =
            `/rest/v1/tournament_results?player_id=eq.${encodeURIComponent(id)}` +
            `&select=id,placement,tournament_date,${decklistColumn},store:stores(name),deck:decks(name)&order=tournament_date.desc,placement.asc&limit=200`;
        const res = window.supabaseApi
            ? await window.supabaseApi.get(endpoint)
            : await fetch(`${SUPABASE_URL}${endpoint}`, { headers });
        if (!res.ok) throw new Error(`Failed to load player history (${res.status})`);

        const rows = await res.json();
        playerHistoryCache.set(
            id,
            (Array.isArray(rows) ? rows : []).map((row) => ({
                id: String(row?.id || '').trim(),
                placement: Number(row?.placement) || 0,
                tournamentDate: String(row?.tournament_date || ''),
                storeName: String(row?.store?.name || ''),
                deckName: String(row?.deck?.name || '-'),
                decklist: String(row?.[decklistColumn] || '').trim()
            }))
        );
    } catch (error) {
        console.error(error);
        playerHistoryCache.set(id, []);
        showToast('Error loading player history', 'error');
    }

    if (expandedPlayerId === id) {
        renderPaginatedList();
    }
}

async function resolvePlayerHistoryDecklistColumn(playerId) {
    const id = String(playerId || '').trim();
    const candidates = ['decklist', 'decklist_link'];
    for (const columnName of candidates) {
        const probeEndpoint =
            `/rest/v1/tournament_results?player_id=eq.${encodeURIComponent(id)}` +
            `&select=id,${columnName}&limit=1`;
        try {
            const res = window.supabaseApi
                ? await window.supabaseApi.get(probeEndpoint)
                : await fetch(`${SUPABASE_URL}${probeEndpoint}`, { headers });
            if (res.ok) return columnName;
        } catch {
            continue;
        }
    }
    return 'decklist';
}

function renderPlayerHistory(historyRows, playerId) {
    if (!Array.isArray(historyRows)) {
        return '<div class="player-history-loading">Loading history...</div>';
    }
    if (historyRows.length === 0) {
        return '<div class="player-history-empty">No history found.</div>';
    }

    return historyRows
        .map((item, index) => {
            const placement = Number(item.placement) || 0;
            const placementClass =
                placement === 1
                    ? 'first-place'
                    : placement === 2
                      ? 'second-place'
                      : placement === 3
                        ? 'third-place'
                        : placement === 4
                          ? 'fourth-place'
                          : 'other-place';

            const storeName = item.storeName || 'Store';
            const entryKey = `${playerId || 'player'}:${item.id || index}`;
            const isEntryExpanded = expandedHistoryEntryKey === entryKey;
            const rawDecklist = String(item.decklist || '').trim();
            const parsedDecklistEntries = parseDecklistEntries(rawDecklist);
            return `
                <div class="player-history-entry ${isEntryExpanded ? 'is-open' : ''}">
                    <div
                        class="player-history-item ${placementClass}"
                        role="button"
                        tabindex="0"
                        data-action="toggle-history-entry"
                        data-entry-key="${escapeHtmlAttribute(entryKey)}"
                        aria-expanded="${isEntryExpanded ? 'true' : 'false'}"
                    >
                        <img
                            src="${resolveStoreIcon(storeName)}"
                            alt="${escapeHtmlAttribute(storeName)}"
                            class="player-history-store-logo"
                            loading="lazy"
                        />
                        <span class="results-mini-rank">${formatOrdinal(placement)}</span>
                        <div class="player-history-main">
                            <strong>${escapeHtml(item.deckName || '-')}</strong>
                            <span>${escapeHtml(storeName)} - ${formatDate(item.tournamentDate)}</span>
                        </div>
                    </div>
                    ${
                        isEntryExpanded
                            ? `<div class="player-history-decklist-panel">
                                ${
                                    parsedDecklistEntries.length > 0
                                        ? `<div class="player-history-decklist-grid">
                                            ${renderDecklistCards(parsedDecklistEntries)}
                                        </div>`
                                        : '<div class="player-history-decklist-empty">No Decklist Registered</div>'
                                }
                            </div>`
                            : ''
                    }
                </div>
            `;
        })
        .join('');
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('playersPagination');
    if (!pagination) return;
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    if (currentPage > totalPages) currentPage = totalPages;

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'btn-pagination btn-pagination-prev';
    prevButton.textContent = '\u25C0';
    prevButton.setAttribute('aria-label', 'Previous page');
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderPaginatedList();
    });
    pagination.appendChild(prevButton);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-pagination-number';
        btn.textContent = String(i);
        if (i === currentPage) {
            btn.disabled = true;
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            currentPage = i;
            renderPaginatedList();
        });
        pagination.appendChild(btn);
    }

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'btn-pagination btn-pagination-next';
    nextButton.textContent = '\u25B6';
    nextButton.setAttribute('aria-label', 'Next page');
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderPaginatedList();
    });
    pagination.appendChild(nextButton);
}

async function handleSubmit() {
    const nameInput = document.getElementById('playerName');
    const name = String(nameInput?.value || '').trim();
    if (!name) return;

    const isValidName = window.validation
        ? window.validation.isNonEmptyText(name, 2)
        : name.length >= 2;
    if (!isValidName) {
        showToast('Name must have at least 2 characters.', 'error');
        return;
    }

    const isEditing = Boolean(editingPlayerId);
    const url = isEditing
        ? `${SUPABASE_URL}/rest/v1/players?id=eq.${editingPlayerId}`
        : `${SUPABASE_URL}/rest/v1/players`;
    const method = isEditing ? 'PATCH' : 'POST';

    const res = window.supabaseApi
        ? await window.supabaseApi.request(url.replace(SUPABASE_URL, ''), {
              method,
              headers,
              body: JSON.stringify({ name })
          })
        : await fetch(url, { method, headers, body: JSON.stringify({ name }) });

    if (res.ok) {
        showToast(isEditing ? 'Player updated!' : 'Player added!');
        cancelEdit();
        loadPlayers();
        return;
    }

    showToast(isEditing ? 'Error updating player' : 'Error adding player', 'error');
}

function editPlayer(id, name) {
    editingPlayerId = id;
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        nameInput.value = String(name || '');
        nameInput.focus();
    }

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) setSubmitButtonLabel('Edit');
}

function cancelEdit() {
    editingPlayerId = null;
    const nameInput = document.getElementById('playerName');
    if (nameInput) nameInput.value = '';

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) setSubmitButtonLabel('Add');
}

async function deletePlayer(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = window.supabaseApi
        ? await window.supabaseApi.del(`/rest/v1/players?id=eq.${id}`)
        : await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${id}`, { method: 'DELETE', headers });
    if (res.ok) {
        showToast('Removed!');
        loadPlayers();
    }
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateString) {
    const text = String(dateString || '').trim();
    if (!text) return '-';
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
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

function getAssetPrefix() {
    const path = String(window.location.pathname || '').toLowerCase();
    return path.includes('/players/') ? '../' : '';
}

function normalizeStoreName(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function resolveStoreIcon(storeName) {
    const base = `${getAssetPrefix()}icons/stores/`;
    const normalized = normalizeStoreName(storeName);
    if (normalized.includes('gladiator')) return `${base}Gladiators.png`;
    if (normalized.includes('meruru')) return `${base}Meruru.svg`;
    if (normalized.includes('taverna')) return `${base}Taverna.png`;
    if (normalized.includes('tcgbr') || normalized.includes('tcg br')) return `${base}TCGBR.png`;
    return `${base}images.png`;
}

function parseDecklistEntries(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return [];

    const byLines = parseDecklistByLines(text);
    if (byLines.length > 0) return byLines;

    const repeated = parseDecklistRepeatedCodes(text);
    return repeated.length > 0 ? aggregateDecklistCodes(repeated) : [];
}

function parseDecklistByLines(text) {
    const lines = text.split(/\r?\n/);
    const temp = [];

    lines.forEach((line) => {
        const raw = String(line || '').trim();
        if (!raw) return;
        if (/^decklist$/i.test(raw)) return;
        if (/^\/\/\s*/.test(raw)) return;

        const withQty = raw.match(
            /^(\d{1,2})\s+.*?((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*$/i
        );
        if (withQty) {
            const qty = Number(withQty[1]);
            const code = normalizeDeckCode(withQty[2]);
            if (isValidDeckCode(code)) temp.push({ code, count: qty });
            return;
        }

        const qtyInParens = raw.match(
            /^(\d{1,2})\s*\(\s*((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)\s*\)\s*$/i
        );
        if (qtyInParens) {
            const qty = Number(qtyInParens[1]);
            const code = normalizeDeckCode(qtyInParens[2]);
            if (isValidDeckCode(code)) temp.push({ code, count: qty });
            return;
        }

        const singleCode = raw.match(/^((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)$/i);
        if (singleCode) {
            const code = normalizeDeckCode(singleCode[1]);
            if (isValidDeckCode(code)) temp.push({ code, count: 1 });
        }
    });

    return aggregateDecklistEntries(temp);
}

function parseDecklistRepeatedCodes(text) {
    const matches = text.matchAll(/((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?)/gi);
    return Array.from(matches)
        .map((match) => normalizeDeckCode(match[1]))
        .filter((code) => isValidDeckCode(code));
}

function aggregateDecklistCodes(codes) {
    return aggregateDecklistEntries(codes.map((code) => ({ code, count: 1 })));
}

function aggregateDecklistEntries(entries) {
    const map = new Map();
    entries.forEach((item) => {
        const code = normalizeDeckCode(item?.code || '');
        const count = Math.max(1, Number(item?.count) || 1);
        if (!isValidDeckCode(code)) return;
        if (!map.has(code)) map.set(code, { code, count: 0 });
        map.get(code).count += count;
    });
    return Array.from(map.values());
}

function normalizeDeckCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/_/g, '_');
}

function isValidDeckCode(code) {
    return /^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|LM|P)-\d{1,3}(?:_[A-Z0-9]+)?$/i.test(String(code || ''));
}

function renderDecklistCards(entries) {
    return entries
        .map(
            (entry) => {
                const imageCandidates = buildDeckCardImageCandidates(entry.code);
                const primarySrc = imageCandidates[0] || '';
                return `
                <article class="player-history-deck-card" data-code="${escapeHtmlAttribute(entry.code)}">
                    <span class="player-history-deck-card-count">${Number(entry.count) || 1}</span>
                    <img
                        src="${escapeHtmlAttribute(primarySrc)}"
                        alt="${escapeHtmlAttribute(entry.code)}"
                        loading="lazy"
                        data-image-candidates="${escapeHtmlAttribute(imageCandidates.join('|'))}"
                        data-image-candidate-index="0"
                    />
                </article>
            `;
            }
        )
        .join('');
}

function buildDeckCardImageCandidates(code) {
    const normalized = normalizeDeckCode(code);
    const baseCode = normalized.split('_')[0];
    const candidates = [
        `${CARD_IMAGE_BASE_URL}${baseCode}.webp`,
        `${CARD_IMAGE_BASE_URL}${baseCode}.png`,
        `https://card-list.prodigi.dev/images/cards/${baseCode}.webp`,
        `https://card-list.prodigi.dev/images/cards/${baseCode}.png`
    ];
    return Array.from(new Set(candidates));
}

function bindDecklistImageFallbacks(scopeRoot) {
    const root = scopeRoot || document;
    root.querySelectorAll('.player-history-deck-card img[data-image-candidates]').forEach((img) => {
        if (img.dataset.fallbackBound === 'true') return;
        img.dataset.fallbackBound = 'true';
        img.addEventListener('error', () => {
            const candidates = String(img.dataset.imageCandidates || '')
                .split('|')
                .map((item) => item.trim())
                .filter(Boolean);
            const currentIndex = Number(img.dataset.imageCandidateIndex || '0');
            const nextIndex = currentIndex + 1;
            if (nextIndex >= candidates.length) return;
            img.dataset.imageCandidateIndex = String(nextIndex);
            img.src = candidates[nextIndex];
        });
    });
}
}
