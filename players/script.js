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
let allPlayers = [];
let filteredPlayers = [];
let editingPlayerId = null;
let currentPage = 1;
const PAGE_SIZE_STORAGE_KEY = 'playersPageSize';
const PAGE_SIZE_OPTIONS = [5, 10, 15, 30, 50, 100];
let itemsPerPage = getInitialPageSize();
let playersPageInitialized = false;

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

    paginatedItems.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `
            <span><strong>${p.name}</strong></span>
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
        `;
        list.appendChild(item);
    });

    renderPagination(totalPages);
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
}
