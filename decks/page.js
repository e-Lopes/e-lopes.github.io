{
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
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
let pageSize = getInitialPageSize();
let currentSearchTerm = '';
let decksPageInitialized = false;

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
    loadDecks();
    setupSearch();
    setupPaginationControls();
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
        const editButton = event.target.closest('[data-action="edit-deck"]');
        if (editButton) {
            editDeck(
                editButton.dataset.deckId,
                editButton.dataset.deckName || '',
                editButton.dataset.imageUrl || ''
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
        btn.addEventListener('click', () => {
            const available = getAvailableViewModes();
            const currentIndex = available.indexOf(currentView);
            const nextIndex = (currentIndex + 1) % available.length;
            currentView = available[nextIndex];
            localStorage.setItem('decksViewMode', currentView);
            applyViewMode();
        });
    }

    window.addEventListener('resize', () => {
        ensureValidViewMode();
        applyViewMode();
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
    if (!pageSizeSelect) return;
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

function filterDecks(searchTerm) {
    if (!searchTerm) return [...allDecks];
    return allDecks.filter((deck) => deck.name.toLowerCase().includes(searchTerm));
}

function renderDecksList() {
    const filtered = filterDecks(currentSearchTerm);
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pagedDecks = filtered.slice(start, end);

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

        renderDecksList();
        showLoading(false);
    } catch (error) {
        console.error('Error loading decks:', error);
        showError('Error loading decks. Try again.');
        showLoading(false);
    }
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
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    noResults.style.display = 'none';

    decks.forEach((deck) => {
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
                        <img src="${imageUrl || fallback}" 
                             alt="${deck.name}" 
                             class="deck-thumb-image">
                    </div>
                    <div class="deck-info">
                        <h3 class="deck-name" title="${escapeHtmlAttribute(deck.name)}">${escapeHtmlAttribute(deckNameDisplay)}</h3>
                        ${deckCode ? `<div class="deck-code">${deckCode}</div>` : ''}
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

function editDeck(deckId, deckName, imageUrl) {
    if (typeof openEditDeckModal === 'function') {
        openEditDeckModal(deckId, deckName || '', imageUrl || '');
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
