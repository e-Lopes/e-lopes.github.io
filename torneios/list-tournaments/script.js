const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
      };
const TOURNAMENT_NAME_OPTIONS = [
    'Semanal',
    'Mensal',
    'Quinzenal',
    'Pre-Release',
    'Top 8',
    'Win-A-Box',
    'Evo Cup',
    'Regulation Battle',
    'For Fun'
];

const SORT_STORAGE_KEY = 'tournamentsSort';
const PER_PAGE_STORAGE_KEY = 'tournamentsPerPage';
const VIEW_STORAGE_KEY = 'tournamentsViewMode';
const DEFAULT_SORT = { field: 'tournament_date', direction: 'desc' };
const SORTABLE_FIELDS = ['tournament_date', 'total_players'];
const SORT_DIRECTIONS = ['asc', 'desc'];
const MONTH_NAMES_PT = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

let tournaments = [];
let filteredTournaments = [];
let currentSort = getSavedSort();
let currentPage = 1;
const PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 100];
const DEFAULT_PER_PAGE = 25;
let perPage = DEFAULT_PER_PAGE;
let createPlayers = [];
let createDecks = [];
let createResults = [];
let selectedTournamentId = null;
let currentViewMode = getSavedViewMode();
let calendarMonthKey = '';

// ============================================================
// FORMAT DATE FUNCTION
// ============================================================
function getSavedSort() {
    try {
        const raw = localStorage.getItem(SORT_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SORT };

        const parsed = JSON.parse(raw);
        const field = SORTABLE_FIELDS.includes(parsed?.field) ? parsed.field : DEFAULT_SORT.field;
        const direction = SORT_DIRECTIONS.includes(parsed?.direction)
            ? parsed.direction
            : DEFAULT_SORT.direction;

        return { field, direction };
    } catch (error) {
        return { ...DEFAULT_SORT };
    }
}

function saveSortPreference() {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(currentSort));
}

function getSavedPerPage() {
    try {
        const value = Number(localStorage.getItem(PER_PAGE_STORAGE_KEY));
        return PER_PAGE_OPTIONS.includes(value) ? value : DEFAULT_PER_PAGE;
    } catch (error) {
        return DEFAULT_PER_PAGE;
    }
}

function savePerPagePreference() {
    localStorage.setItem(PER_PAGE_STORAGE_KEY, String(perPage));
}

function getSavedViewMode() {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'calendar' ? 'calendar' : 'list';
}

function saveViewMode() {
    localStorage.setItem(VIEW_STORAGE_KEY, currentViewMode);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
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
    return window.location.pathname.includes('/torneios/list-tournaments/') ? '../../' : '';
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

// ============================================================
// INIT - DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupPerPageSelector();
    setupViewToggle();
    bindStaticActions();
    await loadTournaments();
    setupFilters();
    setupSorting();
    applyFilters();

    // Event listeners for create modal
    document
        .getElementById('btnCreateTournament')
        .addEventListener('click', openCreateTournamentModal);

    // Close create modal when clicking outside
    document.getElementById('createModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('createModal')) {
            closeCreateModal();
        }
    });

    // Close edit modal when clicking outside
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('editModal')) {
            closeEditModal();
        }
    });

    // Submit create form
    document
        .getElementById('createTournamentForm')
        .addEventListener('submit', createTournamentFormSubmit);
    document.getElementById('btnAddResultRow').addEventListener('click', addCreateResultRow);
    document
        .getElementById('createTotalPlayers')
        .addEventListener('input', syncCreateResultsByTotal);

    // Submit edit form
    document
        .getElementById('editTournamentForm')
        .addEventListener('submit', editTournamentFormSubmit);
});

function bindStaticActions() {
    const btnCreateCancel = document.getElementById('btnCreateCancel');
    const btnEditCancel = document.getElementById('btnEditCancel');

    if (btnCreateCancel) {
        btnCreateCancel.addEventListener('click', closeCreateModal);
    }
    if (btnEditCancel) {
        btnEditCancel.addEventListener('click', closeEditModal);
    }
}

// ============================================================
// CARREGAMENTO DE TORNEIOS
// ============================================================
async function loadTournaments() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament?select=id,store_id,tournament_date,store:stores(name),tournament_name,total_players,instagram_link&order=tournament_date.desc`,
            { headers }
        );
        if (!res.ok) throw new Error('Erro ao carregar torneios.');
        tournaments = await res.json();
        populateFilterOptions();
    } catch (err) {
        console.error(err);
        alert('Falha ao carregar dados.');
    }
}

function setupFilters() {
    const filterStore = document.getElementById('filterStore');
    const filterTournamentName = document.getElementById('filterTournamentName');
    const filterInstagram = document.getElementById('filterInstagram');
    const filterMonthYear = document.getElementById('filterMonthYear');
    const btnClearFilters = document.getElementById('btnClearFilters');

    if (filterStore) filterStore.addEventListener('change', applyFilters);
    if (filterTournamentName) filterTournamentName.addEventListener('change', applyFilters);
    if (filterInstagram) filterInstagram.addEventListener('change', applyFilters);
    if (filterMonthYear) {
        filterMonthYear.addEventListener('change', () => {
            calendarMonthKey = filterMonthYear.value || '';
            applyFilters();
        });
    }
    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            if (filterStore) filterStore.value = '';
            if (filterTournamentName) filterTournamentName.value = '';
            if (filterInstagram) filterInstagram.value = '';
            if (filterMonthYear) filterMonthYear.value = '';
            calendarMonthKey = '';
            applyFilters();
        });
    }
}

function populateFilterOptions() {
    const filterStore = document.getElementById('filterStore');
    const filterTournamentName = document.getElementById('filterTournamentName');
    const filterMonthYear = document.getElementById('filterMonthYear');
    if (!filterStore || !filterTournamentName) return;

    const selectedStore = filterStore.value;
    const selectedName = filterTournamentName.value;
    const selectedMonthYear = filterMonthYear?.value || '';

    const storesMap = new Map();
    tournaments.forEach((t) => {
        if (t.store_id && t.store?.name) storesMap.set(String(t.store_id), t.store.name);
    });
    const stores = Array.from(storesMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    filterStore.innerHTML =
        `<option value="">All stores</option>` +
        stores.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
    if (selectedStore && storesMap.has(String(selectedStore)))
        filterStore.value = String(selectedStore);

    filterTournamentName.innerHTML =
        `<option value="">All names</option>` +
        TOURNAMENT_NAME_OPTIONS.map((name) => `<option value="${name}">${name}</option>`).join('');
    if (selectedName && TOURNAMENT_NAME_OPTIONS.includes(selectedName))
        filterTournamentName.value = selectedName;

    if (filterMonthYear) {
        const monthKeys = Array.from(
            new Set(tournaments.map((t) => getMonthYearKey(t.tournament_date)).filter(Boolean))
        ).sort((a, b) => b.localeCompare(a));

        filterMonthYear.innerHTML =
            `<option value="">All months</option>` +
            monthKeys
                .map((key) => `<option value="${key}">${formatMonthYearLabel(key)}</option>`)
                .join('');
        if (selectedMonthYear && monthKeys.includes(selectedMonthYear))
            filterMonthYear.value = selectedMonthYear;
    }
}

function getFilteredTournaments() {
    const filterStore = document.getElementById('filterStore')?.value || '';
    const filterTournamentName = document.getElementById('filterTournamentName')?.value || '';
    const filterInstagram = document.getElementById('filterInstagram')?.value || '';
    const filterMonthYear = document.getElementById('filterMonthYear')?.value || '';

    return tournaments.filter((t) => {
        const byStore = !filterStore || String(t.store_id) === String(filterStore);
        const byName = !filterTournamentName || (t.tournament_name || '') === filterTournamentName;
        const hasInstagramLink = Boolean((t.instagram_link || '').trim());
        const byInstagram =
            !filterInstagram ||
            (filterInstagram === 'with_link' && hasInstagramLink) ||
            (filterInstagram === 'without_link' && !hasInstagramLink);
        const byMonthYear =
            !filterMonthYear || getMonthYearKey(t.tournament_date) === filterMonthYear;
        return byStore && byName && byInstagram && byMonthYear;
    });
}

function getMonthYearKey(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.split('-');
    if (parts.length < 2) return '';
    const year = parts[0];
    const month = parts[1];
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return '';
    return `${year}-${month}`;
}

function formatMonthYearLabel(monthKey) {
    const parts = String(monthKey).split('-');
    if (parts.length !== 2) return monthKey;
    const year = parts[0];
    const monthIndex = Number(parts[1]) - 1;
    const monthName = MONTH_NAMES_PT[monthIndex] || parts[1];
    return `${monthName} ${year}`;
}

function applyFilters() {
    filteredTournaments = sortTournaments(getFilteredTournaments());
    currentPage = 1;

    if (
        selectedTournamentId &&
        !filteredTournaments.some((t) => String(t.id) === String(selectedTournamentId))
    ) {
        selectedTournamentId = null;
        clearTournamentDetails();
    }

    renderCurrentView();
}

function setupViewToggle() {
    const button = document.getElementById('btnToggleView');
    if (!button) return;
    button.addEventListener('click', () => {
        currentViewMode = currentViewMode === 'list' ? 'calendar' : 'list';
        saveViewMode();
        if (currentViewMode === 'calendar') ensureCalendarMonthKey();
        renderCurrentView();
    });
}

function getAvailableCalendarMonthKeys() {
    return Array.from(
        new Set(
            (filteredTournaments || [])
                .map((t) => getMonthYearKey(t.tournament_date))
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));
}

function ensureCalendarMonthKey() {
    const available = getAvailableCalendarMonthKeys();
    if (!available.length) {
        calendarMonthKey = '';
        return;
    }

    const selected = document.getElementById('filterMonthYear')?.value || '';
    if (selected && available.includes(selected)) {
        calendarMonthKey = selected;
        return;
    }

    if (calendarMonthKey && available.includes(calendarMonthKey)) return;

    calendarMonthKey = available[available.length - 1];
}

function moveCalendarMonth(step) {
    const available = getAvailableCalendarMonthKeys();
    if (!available.length) return;
    const currentIndex = available.indexOf(calendarMonthKey);
    if (currentIndex < 0) {
        calendarMonthKey = available[available.length - 1];
        renderCalendarView();
        return;
    }
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= available.length) return;
    calendarMonthKey = available[nextIndex];
    renderCalendarView();
}

function moveCalendarYear(step) {
    const available = getAvailableCalendarMonthKeys();
    if (!available.length || !calendarMonthKey) return;

    const [yearStr, monthStr] = calendarMonthKey.split('-');
    const currentYear = Number(yearStr);
    const currentMonth = Number(monthStr);
    if (!Number.isInteger(currentYear) || !Number.isInteger(currentMonth)) return;

    const targetYears = Array.from(new Set(available.map((key) => Number(key.split('-')[0]))))
        .filter((year) => Number.isInteger(year))
        .sort((a, b) => a - b);

    const targetYear =
        step < 0
            ? [...targetYears].reverse().find((year) => year < currentYear)
            : targetYears.find((year) => year > currentYear);
    if (!targetYear) return;

    const monthsInYear = available
        .filter((key) => Number(key.split('-')[0]) === targetYear)
        .map((key) => ({ key, month: Number(key.split('-')[1]) }))
        .sort((a, b) => a.month - b.month);
    if (!monthsInYear.length) return;

    let best = monthsInYear[0];
    let bestDistance = Math.abs(best.month - currentMonth);
    for (const item of monthsInYear) {
        const dist = Math.abs(item.month - currentMonth);
        if (dist < bestDistance) {
            best = item;
            bestDistance = dist;
        }
    }

    calendarMonthKey = best.key;
    renderCalendarView();
}

function renderCurrentView() {
    const listContainer = document.getElementById('listViewContainer');
    const calendarContainer = document.getElementById('calendarViewContainer');
    const calendarDetails = document.getElementById('calendarTournamentDetails');
    const toggleButton = document.getElementById('btnToggleView');
    const perPageField = document.querySelector('.per-page-filter');

    if (currentViewMode === 'calendar') {
        if (listContainer) listContainer.classList.add('is-hidden');
        if (calendarContainer) calendarContainer.classList.remove('is-hidden');
        if (calendarDetails) calendarDetails.classList.remove('is-hidden');
        if (toggleButton) toggleButton.classList.add('is-calendar-active');
        updateToggleViewButton();
        if (perPageField) perPageField.classList.add('is-hidden');
        ensureCalendarMonthKey();
        renderCalendarView();
        return;
    }

    if (listContainer) listContainer.classList.remove('is-hidden');
    if (calendarContainer) calendarContainer.classList.add('is-hidden');
    if (calendarDetails) {
        calendarDetails.classList.add('is-hidden');
        calendarDetails.innerHTML = '';
    }
    if (toggleButton) toggleButton.classList.remove('is-calendar-active');
    updateToggleViewButton();
    if (perPageField) perPageField.classList.remove('is-hidden');
    renderTable();
    renderPagination();
}

function updateToggleViewButton() {
    const button = document.getElementById('btnToggleView');
    if (!button) return;

    if (currentViewMode === 'calendar') {
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M3 12h18"/>
                <path d="M3 18h18"/>
            </svg>
        `;
        button.title = 'Switch to list';
        button.setAttribute('aria-label', 'Switch to list');
        return;
    }

    button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M8 2v4M16 2v4M3 10h18"/>
        </svg>
    `;
    button.title = 'Switch to calendar';
    button.setAttribute('aria-label', 'Switch to calendar');
}

function renderCalendarView() {
    const container = document.getElementById('calendarViewContainer');
    if (!container || !window.TournamentCalendarView) return;
    ensureCalendarMonthKey();
    const available = getAvailableCalendarMonthKeys();
    const currentIndex = available.indexOf(calendarMonthKey);
    const currentYear = Number((calendarMonthKey || '').split('-')[0]);
    const years = Array.from(new Set(available.map((key) => Number(key.split('-')[0]))))
        .filter((year) => Number.isInteger(year))
        .sort((a, b) => a - b);
    const hasPrevYear = years.some((year) => year < currentYear);
    const hasNextYear = years.some((year) => year > currentYear);

    window.TournamentCalendarView.render(container, {
        monthKey: calendarMonthKey,
        tournaments: filteredTournaments,
        monthNames: MONTH_NAMES_PT,
        hasPrevMonth: currentIndex > 0,
        hasNextMonth: currentIndex >= 0 && currentIndex < available.length - 1,
        hasPrevYear,
        hasNextYear,
        onPrev: () => moveCalendarMonth(-1),
        onNext: () => moveCalendarMonth(1),
        onPrevYear: () => moveCalendarYear(-1),
        onNextYear: () => moveCalendarYear(1),
        onSelectEvent: (eventData) => openCalendarTournamentDetails(eventData),
        onSelectDay: (dateString) => openCreateTournamentModal(dateString)
    });
}

function openCalendarTournamentDetails(eventData) {
    const container = document.getElementById('calendarTournamentDetails');
    if (!container || !eventData) return;

    container.classList.remove('is-hidden');
    container.innerHTML = `<div class="details-block">Loading details...</div>`;

    const tournament = {
        id: eventData.id || '',
        store_id: eventData.storeId || '',
        tournament_date: eventData.tournamentDate || '',
        tournament_name: eventData.tournamentName || 'Tournament',
        total_players: eventData.totalPlayers || '',
        store: { name: eventData.storeName || 'Store' }
    };
    renderTournamentDetails(tournament, container);
}

function setupPerPageSelector() {
    const perPageSelect = document.getElementById('perPageSelect');
    if (!perPageSelect) return;

    perPage = getSavedPerPage();
    perPageSelect.innerHTML = PER_PAGE_OPTIONS.map(
        (value) => `<option value="${value}">${value}</option>`
    ).join('');
    perPageSelect.value = String(perPage);

    perPageSelect.addEventListener('change', () => {
        const nextValue = Number(perPageSelect.value);
        perPage = PER_PAGE_OPTIONS.includes(nextValue) ? nextValue : DEFAULT_PER_PAGE;
        savePerPagePreference();
        currentPage = 1;
        renderTable();
        renderPagination();
    });
}

function setupSorting() {
    const sortButtons = document.querySelectorAll('.sort-button[data-sort-field]');
    sortButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.sortField;
            if (!field) return;
            toggleSort(field);
        });
    });
    updateSortIndicators();
}

function toggleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = field === 'tournament_date' ? 'desc' : 'asc';
    }
    saveSortPreference();
    updateSortIndicators();
    applyFilters();
}

function sortTournaments(list) {
    const sorted = [...list];
    const direction = currentSort.direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        if (currentSort.field === 'tournament_date') {
            const aTime = Date.parse(a.tournament_date || '') || 0;
            const bTime = Date.parse(b.tournament_date || '') || 0;
            return (aTime - bTime) * direction;
        }

        if (currentSort.field === 'total_players') {
            const aPlayers = Number(a.total_players) || 0;
            const bPlayers = Number(b.total_players) || 0;
            return (aPlayers - bPlayers) * direction;
        }

        return 0;
    });

    return sorted;
}

function updateSortIndicators() {
    const indicators = document.querySelectorAll('[data-sort-indicator]');
    indicators.forEach((el) => {
        const field = el.dataset.sortIndicator;
        if (field === currentSort.field) {
            el.textContent = currentSort.direction === 'asc' ? '\u25B2' : '\u25BC';
            el.classList.add('is-active');
        } else {
            el.textContent = '\u21C5';
            el.classList.remove('is-active');
        }
    });
}

// ============================================================
// RENDER TABLE
// ============================================================
function renderTable() {
    const tbody = document.querySelector('#tournamentsTable tbody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const slice = filteredTournaments.slice(start, end);

    slice.forEach((t) => {
        const tr = document.createElement('tr');
        tr.classList.add('clickable-row');
        if (selectedTournamentId && String(selectedTournamentId) === String(t.id)) {
            tr.classList.add('is-active');
        }
        const instagramLink = t.instagram_link
            ? `<a href="${t.instagram_link}" target="_blank" rel="noopener noreferrer" class="btn-instagram" aria-label="Open Instagram link">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
                    <circle cx="12" cy="12" r="4"></circle>
                    <circle cx="17.5" cy="6.5" r="1.2"></circle>
                </svg>
            </a>`
            : '-';

        const td1 = document.createElement('td');
        td1.setAttribute('data-label', 'Data:');
        td1.classList.add('table-date-cell');
        const formattedDate = formatDate(t.tournament_date);
        const dateValue = document.createElement('span');
        dateValue.className = 'table-date-value';
        dateValue.textContent = formattedDate;
        td1.appendChild(dateValue);

        const td2 = document.createElement('td');
        td2.setAttribute('data-label', 'Loja:');
        td2.classList.add('table-store-cell');
        const storeName = t.store?.name || '-';
        const storeContent = document.createElement('span');
        storeContent.className = 'table-store-content';
        const storeIcon = document.createElement('img');
        storeIcon.className = 'table-store-icon';
        storeIcon.src = resolveStoreIcon(storeName);
        storeIcon.alt = storeName;
        const storeText = document.createElement('span');
        storeText.className = 'table-store-name';
        storeText.textContent = storeName;
        storeContent.appendChild(storeIcon);
        storeContent.appendChild(storeText);
        td2.appendChild(storeContent);

        const td3 = document.createElement('td');
        td3.setAttribute('data-label', 'Nome:');
        td3.classList.add('table-name-cell');
        const tournamentName = t.tournament_name || '-';
        const tournamentNameText = document.createElement('span');
        tournamentNameText.className = 'table-tournament-name';
        tournamentNameText.textContent = tournamentName;
        const mobileStoreTournament = document.createElement('span');
        mobileStoreTournament.className = 'table-mobile-store-tournament';
        mobileStoreTournament.textContent = `${storeName} - ${tournamentName}`;
        td3.appendChild(tournamentNameText);
        td3.appendChild(mobileStoreTournament);

        const td4 = document.createElement('td');
        td4.setAttribute('data-label', 'Players:');
        td4.classList.add('table-players-cell');
        const playersValue = Number.isFinite(Number(t.total_players)) ? String(t.total_players) : '-';
        const playersValueText = document.createElement('span');
        playersValueText.className = 'table-players-value';
        playersValueText.textContent = playersValue;
        const mobilePlayersLine = document.createElement('span');
        mobilePlayersLine.className = 'table-mobile-players-line';
        mobilePlayersLine.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Zm-8 1c-2.33 0-7 1.17-7 3.5V19h5v-2c0-1.16.7-2.18 1.89-3Z"></path></svg><span></span>';
        const mobilePlayersText = mobilePlayersLine.querySelector('span');
        if (mobilePlayersText) mobilePlayersText.textContent = `Players: ${playersValue}`;
        td4.appendChild(playersValueText);
        td4.appendChild(mobilePlayersLine);

        const td5 = document.createElement('td');
        td5.setAttribute('data-label', 'Instagram:');
        td5.innerHTML = instagramLink;

        const td6 = document.createElement('td');
        td6.setAttribute('data-label', 'Acoes:');
        td6.innerHTML = `<button class="btn-edit btn-icon-only" type="button" title="Edit tournament" aria-label="Edit tournament" data-action="edit-tournament" data-tournament-id="${t.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
        </button>`;
        const editTournamentButton = td6.querySelector('[data-action="edit-tournament"]');
        if (editTournamentButton) {
            editTournamentButton.addEventListener('click', (event) => {
                event.stopPropagation();
                editTournament(t.id);
            });
        }

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);
        tr.appendChild(td6);
        tr.addEventListener('click', () => toggleTournamentDetails(t));

        tbody.appendChild(tr);

        if (selectedTournamentId && String(selectedTournamentId) === String(t.id)) {
            const detailsTr = document.createElement('tr');
            detailsTr.className = 'details-row';
            detailsTr.setAttribute('data-details-for', String(t.id));

            const detailsTd = document.createElement('td');
            detailsTd.colSpan = 6;
            detailsTd.className = 'details-row-cell';
            detailsTd.innerHTML = `
                <div class="tournament-inline-details-content" data-details-content-for="${String(t.id)}">
                    <div class="details-block">Loading details...</div>
                </div>
            `;

            detailsTr.appendChild(detailsTd);
            tbody.appendChild(detailsTr);
        }
    });

    if (slice.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;">Nenhum torneio encontrado</td>`;
        tbody.appendChild(tr);
    }
}

// ============================================================
// PAGINATION
// ============================================================
function renderPagination() {
    const totalPages = Math.ceil(filteredTournaments.length / perPage);
    const div = document.getElementById('pagination');
    const nav = document.getElementById('paginationNav');
    div.innerHTML = '';
    if (nav) nav.classList.add('is-hidden');

    if (totalPages <= 1) return;

    if (currentPage > totalPages) currentPage = totalPages;

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'btn-pagination btn-pagination-prev';
    prevButton.textContent = '◀';
    prevButton.setAttribute('aria-label', 'Pagina anterior');
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderTable();
        renderPagination();
    });
    div.appendChild(prevButton);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-pagination-number';
        btn.textContent = i;
        if (i === currentPage) {
            btn.disabled = true;
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
        });
        div.appendChild(btn);
    }

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'btn-pagination btn-pagination-next';
    nextButton.textContent = '▶';
    nextButton.setAttribute('aria-label', 'Proxima pagina');
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderTable();
        renderPagination();
    });
    div.appendChild(nextButton);
}

// ============================================================
// CREATE MODAL
// ============================================================
async function openCreateTournamentModal(defaultDate = '') {
    // Reset form
    document.getElementById('createStoreSelect').value = '';
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(defaultDate)
        ? defaultDate
        : new Date().toISOString().split('T')[0];
    document.getElementById('createTournamentDate').value = safeDate;
    document.getElementById('createTournamentName').value = '';
    document.getElementById('createTotalPlayers').value = '';
    document.getElementById('createInstagramLink').value = '';

    createResults = [];

    // Carrega dados base para o modal
    try {
        await Promise.all([loadStoresToCreate(), loadPlayersToCreate(), loadDecksToCreate()]);
        renderCreateResultsRows();
    } catch (err) {
        // CREATE MODAL
        alert('Falha ao carregar dados de players/decks/lojas.');
        return;
    }

    // Abre o modal
    document.getElementById('createModal').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('active');
    createResults = [];
    renderCreateResultsRows();
}

function syncCreateResultsByTotal() {
    const totalInput = document.getElementById('createTotalPlayers');
    const qty = parseInt(totalInput.value, 10);

    if (!Number.isInteger(qty) || qty < 1) {
        createResults = [];
        renderCreateResultsRows();
        return;
    }

    const next = [];
    for (let i = 0; i < Math.min(qty, 36); i++) {
        next.push(createResults[i] || { player_id: '', deck_id: '' });
    }
    createResults = next;
    renderCreateResultsRows();
}

async function loadStoresToCreate() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, {
            headers
        });
        if (!res.ok) throw new Error('Erro ao carregar lojas');

        const stores = await res.json();
        const select = document.getElementById('createStoreSelect');
        select.innerHTML = '<option value="">Selecione a loja...</option>';
        stores.forEach((s) => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        alert('Falha ao carregar lojas: ' + err.message);
    }
}

async function toggleTournamentDetails(tournament) {
    if (selectedTournamentId && String(selectedTournamentId) === String(tournament.id)) {
        selectedTournamentId = null;
        clearTournamentDetails();
        renderTable();
        return;
    }

    selectedTournamentId = tournament.id;
    renderTable();
    await renderTournamentDetails(tournament);
}

function getDetailsContainer(tournamentId) {
    const targetId = String(tournamentId);
    const containers = document.querySelectorAll('.tournament-inline-details-content');
    for (const el of containers) {
        if (String(el.dataset.detailsContentFor) === targetId) return el;
    }
    return null;
}

function clearTournamentDetails() {
    const containers = document.querySelectorAll('.tournament-inline-details-content');
    containers.forEach((el) => {
        el.innerHTML = '';
    });
}

function buildPieSlicePolygon(startDeg, endDeg, steps = 24) {
    const points = ['50% 50%'];
    for (let i = 0; i <= steps; i++) {
        const angle = startDeg + ((endDeg - startDeg) * i) / steps;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 50 * Math.cos(rad);
        const y = 50 + 50 * Math.sin(rad);
        points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    return `polygon(${points.join(',')})`;
}

function buildDeckPieData(results) {
    const grouped = new Map();
    (results || []).forEach((item) => {
        const key = item.deck || 'Unknown Deck';
        if (!grouped.has(key)) {
            grouped.set(key, {
                deck: key,
                image_url: item.image_url || '',
                count: 0
            });
        }
        grouped.get(key).count += 1;
        if (!grouped.get(key).image_url && item.image_url)
            grouped.get(key).image_url = item.image_url;
    });

    const entries = Array.from(grouped.values()).sort((a, b) => b.count - a.count);
    const total = entries.reduce((acc, item) => acc + item.count, 0) || 1;
    const colors = [
        '#ffd700',
        '#c0c0c0',
        '#cd7f32',
        '#268d7c',
        '#667eea',
        '#764ba2',
        '#2a9d8f',
        '#e76f51',
        '#8ab17d',
        '#3d5a80'
    ];

    let currentAngle = -90;
    return entries.map((entry, index) => {
        const sliceAngle = (entry.count / total) * 360;
        const start = currentAngle;
        const end = currentAngle + sliceAngle;
        currentAngle = end;
        const midDeg = (start + end) / 2;
        const midRad = (midDeg * Math.PI) / 180;

        const fallback = `https://via.placeholder.com/300x300/667eea/ffffff?text=${encodeURIComponent((entry.deck || 'Deck').substring(0, 10))}`;
        const percent = (entry.count / total) * 100;
        // Tuned for better perceived centering inside each slice.
        const initialZoom = Math.max(155, Math.min(320, 155 + percent * 3.2));
        const minZoom = Math.max(120, initialZoom - 55);
        const maxZoom = Math.min(420, initialZoom + 130);

        // Shift image opposite to slice direction so content appears centered in the wedge.
        const initialX = Math.max(34, Math.min(66, 50 - Math.cos(midRad) * 12));
        const initialY = Math.max(4, Math.min(24, 13 - Math.sin(midRad) * 4));
        return {
            deck: entry.deck,
            count: entry.count,
            percent,
            color: colors[index % colors.length],
            image_url: entry.image_url || fallback,
            clipPath: buildPieSlicePolygon(start, end),
            initialZoom,
            minZoom,
            maxZoom,
            initialX,
            initialY
        };
    });
}

function getPieStorageKey(tournamentId) {
    return `pieState:${tournamentId}`;
}

function loadPieState(tournamentId) {
    try {
        const raw = localStorage.getItem(getPieStorageKey(tournamentId));
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

function savePieState(tournamentId, rootElement) {
    if (!tournamentId || !rootElement) return;
    const slices = rootElement.querySelectorAll('.details-pie-slice');
    const state = {};

    slices.forEach((slice) => {
        const deck = slice.dataset.deck || '';
        if (!deck) return;
        state[deck] = {
            x: parseFloat(slice.dataset.x || '50'),
            y: parseFloat(slice.dataset.y || '13'),
            zoom: parseFloat(slice.dataset.zoom || '195')
        };
    });

    try {
        localStorage.setItem(getPieStorageKey(tournamentId), JSON.stringify(state));
    } catch (_) {}
}

function setupInteractivePieSlices(rootElement, tournamentId) {
    if (!rootElement) return;
    const slices = rootElement.querySelectorAll('.details-pie-slice');
    const savedState = loadPieState(tournamentId);
    let topZ = 10;

    slices.forEach((slice) => {
        const deck = slice.dataset.deck || '';
        const saved = deck ? savedState[deck] : null;

        slice.dataset.x = String(saved?.x ?? slice.dataset.x ?? '50');
        slice.dataset.y = String(saved?.y ?? slice.dataset.y ?? '13');
        slice.dataset.zoom = String(saved?.zoom ?? slice.dataset.zoom ?? '195');
        slice.style.backgroundPosition = `${slice.dataset.x}% ${slice.dataset.y}%`;
        slice.style.backgroundSize = `${slice.dataset.zoom}%`;

        slice.onpointerdown = (e) => {
            slice.style.zIndex = String(++topZ);
            slice.setPointerCapture(e.pointerId);

            let lastX = e.clientX;
            let lastY = e.clientY;

            const onMove = (ev) => {
                let posX = parseFloat(slice.dataset.x || '50');
                let posY = parseFloat(slice.dataset.y || '50');
                const dx = ev.clientX - lastX;
                const dy = ev.clientY - lastY;
                lastX = ev.clientX;
                lastY = ev.clientY;

                posX += dx * 0.2;
                posY += dy * 0.2;

                slice.dataset.x = String(posX);
                slice.dataset.y = String(posY);
                slice.style.backgroundPosition = `${posX}% ${posY}%`;
            };

            const onUp = (ev) => {
                try {
                    slice.releasePointerCapture(ev.pointerId);
                } catch (_) {}
                slice.removeEventListener('pointermove', onMove);
                slice.removeEventListener('pointerup', onUp);
                slice.removeEventListener('pointercancel', onUp);
                savePieState(tournamentId, rootElement);
            };

            slice.addEventListener('pointermove', onMove);
            slice.addEventListener('pointerup', onUp);
            slice.addEventListener('pointercancel', onUp);
        };

        slice.onwheel = (e) => {
            e.preventDefault();
            let currentZoom = parseFloat(slice.dataset.zoom || '220');
            const minZoom = parseFloat(slice.dataset.minZoom || '120');
            const maxZoom = parseFloat(slice.dataset.maxZoom || '420');
            currentZoom += e.deltaY < 0 ? 8 : -8;
            if (currentZoom < minZoom) currentZoom = minZoom;
            if (currentZoom > maxZoom) currentZoom = maxZoom;
            slice.dataset.zoom = String(currentZoom);
            slice.style.backgroundSize = `${currentZoom}%`;
            savePieState(tournamentId, rootElement);
        };
    });
}

async function renderTournamentDetails(tournament, targetContainer = null) {
    const tournamentId = String(tournament.id);
    let content = targetContainer || getDetailsContainer(tournamentId);
    if (!content) return;
    content.innerHTML = `<div class="details-block">Loading details...</div>`;

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/v_podium_full?store_id=eq.${encodeURIComponent(tournament.store_id)}&tournament_date=eq.${tournament.tournament_date}&order=placement.asc`,
            { headers }
        );

        if (!res.ok) {
            throw new Error(`Erro ao carregar detalhes (${res.status})`);
        }

        const results = await res.json();
        const topFour = (results || []).filter((r) => Number(r.placement) <= 4);
        const totalPlayers = Number.isFinite(Number(tournament.total_players))
            ? Number(tournament.total_players)
            : results[0]?.total_players || 0;
        const header = `
            <div class="tournament-details-header">
                <strong>${tournament.tournament_name || 'Tournament'}</strong> - ${formatDate(tournament.tournament_date)} - ${tournament.store?.name || 'Store'}
                <div>Total Players: ${totalPlayers}</div>
            </div>
        `;

        const placementClass = (placement) => {
            if (placement === 1) return 'first-place';
            if (placement === 2) return 'second-place';
            if (placement === 3) return 'third-place';
            if (placement === 4) return 'fourth-place';
            return '';
        };

        const fullResultsPlacementClass = (placement) => {
            if (placement === 1) return 'first-place';
            if (placement === 2) return 'second-place';
            if (placement === 3) return 'third-place';
            if (placement === 4) return 'fourth-place';
            return 'other-place';
        };

        const podiumHtml = topFour.length
            ? topFour
                  .map((item) => {
                      const imageUrl =
                          item.image_url ||
                          `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent((item.deck || 'Deck').substring(0, 10))}`;
                      return `
                <div class="details-podium-card ${placementClass(Number(item.placement))}">
                    <div class="details-rank-badge">${formatOrdinal(item.placement)}</div>
                    <div class="details-deck-card-footer">
                        <div class="details-player-name">${item.player || '-'}</div>
                        <div class="details-deck-name">${item.deck || '-'}</div>
                    </div>
                    <div class="details-card-image-wrapper">
                        <img src="${imageUrl}" alt="${item.deck || 'Deck'}" class="details-deck-card-image">
                    </div>
                </div>
            `;
                  })
                  .join('')
            : `<div class="results-mini-item"><div class="results-mini-main">No podium data found.</div></div>`;

        const pieSlices = buildDeckPieData(results);
        const pieHtml = pieSlices.length
            ? pieSlices
                  .map(
                      (slice) => `
                <div class="details-pie-slice"
                     style="clip-path:${slice.clipPath}; background-image:url('${slice.image_url}');"
                     data-deck="${String(slice.deck || '').replace(/"/g, '&quot;')}"
                     data-x="${slice.initialX}" data-y="${slice.initialY}"
                     data-zoom="${slice.initialZoom}" data-min-zoom="${slice.minZoom}" data-max-zoom="${slice.maxZoom}"
                     title="${slice.deck} (${slice.percent.toFixed(1)}%)"></div>
            `
                  )
                  .join('')
            : '';
        const pieLegend = pieSlices.length
            ? pieSlices
                  .map(
                      (slice) => `
                <div class="details-pie-legend-item">
                    <span class="details-pie-legend-color" style="background:${slice.color}"></span>
                    <span class="details-pie-legend-name" title="${slice.deck}">${slice.deck}</span>
                    <strong>${slice.count}</strong>
                </div>
            `
                  )
                  .join('')
            : `<div class="details-pie-legend-item">No deck data</div>`;

        const resultsHtml = (results || []).length
            ? results
                .map(
                    (item) => `
                <div class="results-mini-item ${fullResultsPlacementClass(Number(item.placement))}">
                    <div class="results-mini-rank">${formatOrdinal(item.placement)}</div>
                    <div class="results-mini-main">
                        <strong>${item.deck || '-'}</strong>
                        <span>${item.player || '-'}</span>
                    </div>
                </div>
            `
                  )
                  .join('')
            : `<div class="results-mini-item"><div class="results-mini-main">No results found.</div></div>`;

        if (!targetContainer) {
            if (String(selectedTournamentId) !== tournamentId) return;
            content = getDetailsContainer(tournamentId);
            if (!content) return;
        }

        content.innerHTML = `
            ${header}
            <div class="details-grid">
                <div class="details-block">
                    <h3 class="details-section-title">
                        <svg class="details-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M6 21h12" />
                            <path d="M8 21V10h3v11" />
                            <path d="M13 21V6h3v15" />
                            <path d="M3 21V14h3v7" />
                        </svg>
                        <span>Podium</span>
                    </h3>
                    <div class="details-podium">${podiumHtml}</div>
                </div>
                <div class="details-block details-full-results-block">
                    <h3 class="details-section-title">
                        <svg class="details-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <span>Full Results</span>
                    </h3>
                    <div class="results-mini">${resultsHtml}</div>
                </div>
                <div class="details-block details-pie-block">
                    <h3 class="details-section-title">
                        <svg class="details-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M21.21 15.89A10 10 0 1 1 12 2v10z" />
                            <path d="M12 2a10 10 0 0 1 10 10h-10z" />
                        </svg>
                        <span>Deck Distribution</span>
                    </h3>
                    <div class="details-pie-panel">
                        <div class="details-pie-container">${pieHtml}</div>
                        <div class="details-pie-legend">${pieLegend}</div>
                    </div>
                </div>
            </div>
        `;
        setupInteractivePieSlices(
            content,
            tournament.id || `${tournament.store_id}-${tournament.tournament_date}`
        );
    } catch (err) {
        console.error(err);
        if (!targetContainer) {
            if (String(selectedTournamentId) !== tournamentId) return;
            content = getDetailsContainer(tournamentId);
            if (!content) return;
        }
        content.innerHTML = `<div class="details-block">Falha ao carregar detalhes do torneio.</div>`;
    }
}

async function loadPlayersToCreate() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id,name&order=name.asc`, {
        headers
    });
    if (!res.ok) throw new Error('Erro ao carregar players');
    createPlayers = await res.json();
}

async function loadDecksToCreate() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=id,name&order=name.asc`, {
        headers
    });
    if (!res.ok) throw new Error('Erro ao carregar decks');
    createDecks = await res.json();
}

function addCreateResultRow() {
    if (createResults.length >= 36) {
        alert('O limite maximo e 36 jogadores neste modal.');
        return;
    }

    createResults.push({ player_id: '', deck_id: '' });
    renderCreateResultsRows();
}

function removeCreateResultRow(index) {
    createResults.splice(index, 1);
    renderCreateResultsRows();
}

function updateCreateResultField(index, field, value) {
    if (!createResults[index]) return;
    createResults[index][field] = value;
}

function buildOptions(items, selectedValue, placeholder) {
    const initial = `<option value="">${placeholder}</option>`;
    const options = items.map((item) => {
        const selected = String(item.id) === String(selectedValue) ? 'selected' : '';
        return `<option value="${item.id}" ${selected}>${item.name}</option>`;
    });
    return initial + options.join('');
}

function renderCreateResultsRows() {
    const container = document.getElementById('createResultsRows');
    if (!container) return;

    if (createResults.length === 0) {
        container.innerHTML = '';
        document.getElementById('createTotalPlayers').value = '';
        return;
    }

    container.innerHTML = createResults
        .map(
            (row, index) => `
        <div class="result-row">
            <div class="form-group">
                <label>Placement</label>
                <input type="number" value="${index + 1}" disabled>
            </div>
            <div class="form-group">
                <label>Player<span class="required">*</span></label>
                <select onchange="updateCreateResultField(${index}, 'player_id', this.value)" required>
                    ${buildOptions(createPlayers, row.player_id, 'Selecione o player...')}
                </select>
            </div>
            <div class="form-group">
                <label>Deck<span class="required">*</span></label>
                <select onchange="updateCreateResultField(${index}, 'deck_id', this.value)" required>
                    ${buildOptions(createDecks, row.deck_id, 'Selecione o deck...')}
                </select>
            </div>
            <button type="button" class="btn-remove-result" data-create-remove-index="${index}">Remove</button>
        </div>
    `
        )
        .join('');

    container.querySelectorAll('[data-create-remove-index]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-create-remove-index'));
            removeCreateResultRow(index);
        });
    });

    document.getElementById('createTotalPlayers').value = String(createResults.length);
}

async function createTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#createTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    try {
        const totalPlayers = createResults.length;
        const payload = {
            store_id: document.getElementById('createStoreSelect').value,
            tournament_date: document.getElementById('createTournamentDate').value,
            tournament_name: document.getElementById('createTournamentName').value,
            total_players: totalPlayers,
            instagram_link: document.getElementById('createInstagramLink').value.trim()
        };

        const validTotalPlayers = window.validation
            ? window.validation.isPositiveInteger(payload.total_players, 1, 36)
            : payload.total_players > 0;
        const validInstagram = window.validation
            ? window.validation.isValidOptionalUrl(payload.instagram_link)
            : true;
        const hasInvalidResult = createResults.some((r) => !r.player_id || !r.deck_id);
        if (
            !payload.store_id ||
            !payload.tournament_date ||
            !payload.tournament_name ||
            !validTotalPlayers ||
            !validInstagram ||
            hasInvalidResult
        ) {
            alert('Please fill all required fields correctly.');
            return;
        }

        console.log('Criando torneio:', payload);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament`, {
            method: 'POST',
            headers: {
                ...headers,
                Prefer: 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Erro ao criar:', res.status, errorText);
            throw new Error(`Erro ao cadastrar torneio (${res.status})`);
        }

        const createdTournament = (await res.json())[0];
        if (!createdTournament?.id) {
            throw new Error('Torneio criado sem retornar ID');
        }

        const resultsPayload = createResults.map((row, index) => ({
            tournament_id: createdTournament.id,
            store_id: payload.store_id,
            tournament_date: payload.tournament_date,
            total_players: payload.total_players,
            placement: index + 1,
            deck_id: row.deck_id,
            player_id: row.player_id
        }));

        const resultsRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results`, {
            method: 'POST',
            headers,
            body: JSON.stringify(resultsPayload)
        });

        if (!resultsRes.ok) {
            const resultsError = await resultsRes.text();
            console.error('Erro ao criar results:', resultsRes.status, resultsError);
            if (resultsRes.status === 409) {
                const existingRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${encodeURIComponent(payload.store_id)}&tournament_date=eq.${payload.tournament_date}&select=id,placement,tournament_id&order=placement.asc`,
                    { headers }
                );

                if (!existingRes.ok) {
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`,
                        {
                            method: 'DELETE',
                            headers
                        }
                    );
                    throw new Error(
                        `Erro ao correlacionar tournament_results existentes (${existingRes.status})`
                    );
                }

                const existingRows = await existingRes.json();
                for (const row of existingRows) {
                    if (!row?.id || row.tournament_id) continue;

                    const patchRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(row.id)}`,
                        {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({ tournament_id: createdTournament.id })
                        }
                    );

                    if (!patchRes.ok) {
                        throw new Error(
                            `Falha ao correlacionar tournament_result ${row.id} (${patchRes.status})`
                        );
                    }
                }
            } else {
                await fetch(
                    `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`,
                    {
                        method: 'DELETE',
                        headers
                    }
                );
                throw new Error(`Erro ao cadastrar tournament_results (${resultsRes.status})`);
            }
        }

        await loadTournaments();
        applyFilters();
        closeCreateModal();

        // Reset form
        document.getElementById('createTournamentForm').reset();
    } catch (err) {
        console.error('Erro completo:', err);
        alert('Falha ao cadastrar torneio: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

