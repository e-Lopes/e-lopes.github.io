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
const DASHBOARD_VIEW_STORAGE_KEY = 'dashboardActiveView';
const STATS_VIEW_STORAGE_KEY = 'dashboardStatisticsView';
const STATS_COLUMN_WIDTHS_STORAGE_KEY = 'dashboardStatisticsColumnWidths';
const POST_PREVIEW_STATE_KEY = 'digistats.post-preview.state.v1';
const OCR_API_BASE_URL = 'https://e-lopes-digimon-ocr-api.hf.space';
const DIGIMON_CARD_API_URL = 'https://digimoncard.io/api-public/search';
const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
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
const DEFAULT_STATISTICS_VIEW = 'v_deck_stats';
const STATISTICS_VIEWS = [
    { value: 'v_deck_representation', label: 'Representação de Decks' },
    { value: 'v_deck_stats', label: 'Estatísticas de Decks' },
    { value: 'v_meta_by_month', label: 'Meta por Formato' },
    { value: 'v_top_cards_by_month', label: 'Top Cards' },
    { value: 'v_player_ranking', label: 'Ranking de Players' },
    { value: 'v_store_champions', label: 'Ranking por Loja' }
];
const STATISTICS_COLUMN_HELP_PTBR = {
    common: {
        deck: 'Nome do deck arquétipo.',
        player: 'Nome do jogador.',
        store: 'Nome da loja onde o torneio aconteceu.',
        month: 'Mês de referência da estatística.',
        appearances: 'Quantidade total de aparições no recorte.',
        entries: 'Total de aparições/resultados registrados.',
        titles: 'Quantidade de títulos (1º lugar).',
        top4_total: 'Quantidade de vezes no Top 4.',
        ranking_points: 'Pontuação acumulada conforme o sistema de pontos da view.',
        avg_placement: 'Média de colocação (quanto menor, melhor).',
        meta_share_percent:
            'Meta Share (%): (aparições do deck no recorte / total de aparições no mesmo recorte) x 100.',
        title_rate_percent: 'Taxa de Títulos (%): (títulos / total de entradas) x 100.',
        top4_rate_percent: 'Taxa Top4 (%): (resultados no Top4 / total de entradas) x 100.',
        format_code: 'Código do formato do torneio (ex.: BT24, EX11).',
        card_code: 'Código da carta (ex.: BT1-001).',
        card_name: 'Nome da carta.',
        card_type: 'Tipo da carta (Digimon, Tamer, Option, etc.).',
        is_staple: 'Indica se a carta é staple.',
        total: 'Quantidade total de decklists Top 4 contendo a carta no mês.',
        champion: 'Quantidade de decklists campeãs (1º lugar) contendo a carta no mês.',
        top2: 'Quantidade de decklists Top 2 contendo a carta no mês.',
        top3: 'Quantidade de decklists Top 3 contendo a carta no mês.',
        top4: 'Quantidade de decklists Top 4 contendo a carta no mês.',
        tournament_date: 'Data do torneio.',
        tournament_name: 'Nome do torneio.',
        placement: 'Colocação final no torneio.',
        total_players: 'Quantidade total de jogadores no torneio.',
        image_url: 'URL da imagem principal do deck.',
        instagram_link: 'Link do post no Instagram do evento.',
        decklist: 'Decklist registrada para o resultado.'
    },
    v_deck_representation: {
        tournaments_played: 'Quantidade de torneios distintos em que o deck apareceu.',
        unique_players: 'Quantidade de jogadores únicos usando o deck.',
        top4_finishes: 'Quantidade de resultados no Top 4.',
        avg_placement: 'Média de colocação do deck em todos os resultados.'
    },
    v_deck_stats: {
        best_finish: 'Melhor colocação já alcançada pelo deck.',
        worst_finish: 'Pior colocação já registrada para o deck.',
        performance_rank: 'Ranking geral de desempenho do deck.'
    },
    v_meta_by_month: {
        month: 'Mês analisado para o metagame.',
        meta_share_percent:
            'Meta Share (%): (aparições do deck no mês e formato selecionados / total de aparições no mesmo mês e formato) x 100.',
        top4_total: 'Total de resultados Top 4 no mês.',
        titles: 'Total de títulos no mês.'
    },
    v_top_cards_by_month: {
        monthly_rank: 'Posição da carta no mês com base na presença em decklists Top 4.',
        card_name: 'Nome da carta.',
        total: 'Total de decklists Top 4 contendo a carta no mês.',
        champion: 'Total de campeões com a carta no mês.',
        top2: 'Total de Top 2 com a carta no mês.',
        top3: 'Total de Top 3 com a carta no mês.',
        top4: 'Total de Top 4 com a carta no mês.'
    },
    v_player_ranking: {
        unique_decks_used: 'Quantidade de decks diferentes usados pelo jogador.',
        last_event_date: 'Data mais recente em que o jogador apareceu.',
        overall_rank: 'Posição geral do jogador no ranking acumulado.'
    },
    v_store_champions: {
        store_title_share_percent:
            'Share de Títulos da Loja (%): (títulos do player na loja / total de títulos da loja) x 100.',
        store_rank: 'Posição do jogador no ranking interno da loja.'
    }
};
const STATISTICS_HIDDEN_COLUMNS = new Set([
    'id',
    'store_id',
    'tournament_id',
    'player_id',
    'deck_id',
    'format_id',
    'created_at',
    'updated_at'
]);
const PLAYER_RANKING_TABLE_COLUMNS = [
    'player',
    'overall_rank',
    'ranking_points',
    'titles',
    'top4_total',
    'entries',
    'unique_decks_used',
    'title_rate_percent'
];
const STATISTICS_REMOVED_COLUMNS = new Set([
    'top8_total',
    'top16_total',
    'top_cut_total',
    'top_cut_finishes',
    'top_cut_rate_percent',
    'top_cut_conversion_percent'
]);
const STATISTICS_VIEW_COLUMN_ORDER = {
    v_deck_representation: [
        'deck',
        'appearances',
        'tournaments_played',
        'unique_players',
        'titles',
        'top4_finishes',
        'avg_placement',
        'meta_share_percent'
    ],
    v_deck_stats: [
        'deck',
        'entries',
        'titles',
        'top4_total',
        'avg_placement',
        'performance_rank',
        'best_finish',
        'worst_finish',
        'title_rate_percent',
        'top4_rate_percent',
        'ranking_points'
    ],
    v_meta_by_month: [
        'month',
        'format_code',
        'deck',
        'format_rank',
        'ranking_points',
        'titles',
        'top4_total',
        'appearances'
    ],
    v_top_cards_by_month: [
        'month',
        'monthly_rank',
        'card_name',
        'card_code',
        'is_staple',
        'card_type',
        'total',
        'champion',
        'top2',
        'top3',
        'top4'
    ],
    v_player_ranking: PLAYER_RANKING_TABLE_COLUMNS,
    v_store_champions: [
        'store',
        'store_rank',
        'player',
        'titles',
        'top4_total',
        'entries',
        'store_title_share_percent',
        'ranking_points'
    ]
};
function getTodayInSaoPaulo() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

let tournaments = [];
let filteredTournaments = [];
let currentSort = getSavedSort();
let currentPage = 1;
const PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 100];
const DEFAULT_PER_PAGE = 25;
let perPage = DEFAULT_PER_PAGE;
let createPlayers = [];
let createDecks = [];
let createStores = [];
let createResults = [];
let createOcrImportInProgress = false;
let createOcrSelectedFiles = [];
let selectedTournamentId = null;
let currentViewMode = getSavedViewMode();
let calendarMonthKey = '';
let currentDashboardView = 'tournaments';
let currentStatisticsView = getSavedStatisticsView();
let decksViewMounted = false;
let decksScriptsPromise = null;
let playersViewMounted = false;
let playersScriptsPromise = null;
let statisticsViewMounted = false;
let statisticsViewData = [];
let statisticsMonthlyRankingData = [];
let currentStatisticsSort = { column: '', direction: 'asc' };
let currentStatisticsMonthFilter = '';
let currentStatisticsStoreFilter = '';
let currentStatisticsFormatFilter = '';
let currentStatisticsDateFilter = '';
let currentStatisticsStapleFilter = '';
let currentStoreChampionsPlayerQuery = '';
let areStoreChampionsCardsCollapsed = true;
const stapleTogglePendingCodes = new Set();
const topCardsNameCache = new Map();
const topCardsNameLookupAttempted = new Set();
let tournamentFormatIdSupported = true;
const FALLBACK_FORMAT_OPTIONS = [
    { id: 1, code: 'BT23', isDefault: false },
    { id: 2, code: 'BT24', isDefault: false },
    { id: 3, code: 'EX11', isDefault: true }
];
let tournamentFormats = [];
let tournamentFormatsLoaded = false;

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

function getSavedDashboardView() {
    const saved = localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
    return saved === 'decks' || saved === 'players' || saved === 'statistics'
        ? saved
        : 'tournaments';
}

function saveDashboardViewPreference() {
    localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, currentDashboardView);
}

function getSavedStatisticsView() {
    const saved = localStorage.getItem(STATS_VIEW_STORAGE_KEY);
    return STATISTICS_VIEWS.some((item) => item.value === saved) ? saved : DEFAULT_STATISTICS_VIEW;
}

function saveStatisticsViewPreference(value) {
    if (!STATISTICS_VIEWS.some((item) => item.value === value)) return;
    localStorage.setItem(STATS_VIEW_STORAGE_KEY, value);
}

function getSavedStatisticsColumnWidths() {
    try {
        const raw = localStorage.getItem(STATS_COLUMN_WIDTHS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function saveStatisticsColumnWidths(map) {
    try {
        localStorage.setItem(STATS_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(map || {}));
    } catch (_error) {}
}

function getStatisticsColumnWidth(viewName, column) {
    const map = getSavedStatisticsColumnWidths();
    const viewMap = map?.[viewName];
    if (!viewMap || typeof viewMap !== 'object') return null;
    const width = Number(viewMap[column]);
    return Number.isFinite(width) && width > 0 ? width : null;
}

function setStatisticsColumnWidth(viewName, column, width) {
    const px = Math.max(72, Math.min(720, Math.round(Number(width) || 0)));
    if (!Number.isFinite(px)) return;
    const map = getSavedStatisticsColumnWidths();
    const viewMap = map?.[viewName] && typeof map[viewName] === 'object' ? map[viewName] : {};
    viewMap[column] = px;
    map[viewName] = viewMap;
    saveStatisticsColumnWidths(map);
}

function clearStatisticsColumnWidth(viewName, column) {
    const map = getSavedStatisticsColumnWidths();
    const viewMap = map?.[viewName];
    if (!viewMap || typeof viewMap !== 'object') return;
    if (!Object.prototype.hasOwnProperty.call(viewMap, column)) return;
    delete viewMap[column];
    map[viewName] = viewMap;
    saveStatisticsColumnWidths(map);
}

function applyStatisticsColumnWidth(head, body, columnIndex, widthPx) {
    const width = Math.max(72, Math.min(720, Math.round(Number(widthPx) || 0)));
    if (!Number.isFinite(width)) return;
    const th = head.querySelector(`tr th:nth-child(${columnIndex + 1})`);
    if (th) {
        th.style.width = `${width}px`;
        th.style.minWidth = `${width}px`;
        th.style.maxWidth = `${width}px`;
    }
    body.querySelectorAll(`tr td:nth-child(${columnIndex + 1})`).forEach((td) => {
        td.style.width = `${width}px`;
        td.style.minWidth = `${width}px`;
        td.style.maxWidth = `${width}px`;
    });
}

function applySavedStatisticsColumnWidths(head, body, viewName, columns) {
    columns.forEach((column, index) => {
        const width = getStatisticsColumnWidth(viewName, column);
        if (width) applyStatisticsColumnWidth(head, body, index, width);
    });
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

function readTournamentFormatValue(inputId) {
    const input = document.getElementById(inputId);
    if (!input) {
        return { formatId: null, formatCode: '' };
    }

    const selectedOption = input.options?.[input.selectedIndex] || null;
    const rawFormatId = String(input.value || '').trim();
    if (!rawFormatId) {
        return { formatId: null, formatCode: '' };
    }

    if (rawFormatId.startsWith('code:')) {
        const fallbackCode = normalizeFormatCode(rawFormatId.replace(/^code:/, ''));
        return { formatId: null, formatCode: fallbackCode };
    }

    const formatId = Number(rawFormatId);
    const formatCode = normalizeFormatCode(
        selectedOption?.dataset?.formatCode || selectedOption?.textContent || ''
    );

    return {
        formatId: Number.isFinite(formatId) && formatId > 0 ? formatId : null,
        formatCode
    };
}

function assignTournamentFormat(payload, formatSelection) {
    const formatId = Number(formatSelection?.formatId);
    const nextPayload = { ...payload };

    if (tournamentFormatIdSupported) {
        nextPayload.format_id = Number.isFinite(formatId) && formatId > 0 ? formatId : null;
    }

    return nextPayload;
}

function normalizeFormatCode(value) {
    const raw = String(value || '')
        .trim()
        .toUpperCase();
    if (!raw) return '';
    const explicitCode = raw.match(/[A-Z]{1,4}\d{1,3}/);
    if (explicitCode?.[0]) return explicitCode[0];
    return raw.replace(/[^A-Z0-9]/g, '');
}

function getDefaultTournamentFormatCode() {
    const preferred = tournamentFormats.find((item) => item.isDefault);
    if (preferred?.code) return preferred.code;
    return tournamentFormats[0]?.code || '';
}

function getTournamentFormatCode(tournament) {
    const relation = tournament?.format_ref;
    const relationCode = Array.isArray(relation) ? relation?.[0]?.code : relation?.code;
    const fromRelation = normalizeFormatCode(relationCode || '');
    if (fromRelation) return fromRelation;

    const fromDirect = normalizeFormatCode(tournament?.format_code || tournament?.format || '');
    if (fromDirect) return fromDirect;

    const formatId = Number(tournament?.format_id ?? tournament?.formar_id);
    if (Number.isFinite(formatId) && formatId > 0) {
        const byId = tournamentFormats.find((item) => Number(item?.id) === formatId);
        if (byId?.code) return normalizeFormatCode(byId.code);
    }

    return '';
}

async function loadTournamentFormats() {
    if (tournamentFormatsLoaded) return tournamentFormats;

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/formats?select=id,code,name,is_active,is_default&is_active=eq.true&order=is_default.desc,code.asc`,
            { headers }
        );

        if (!res.ok) throw new Error(`Erro ao carregar formatos (${res.status})`);

        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            tournamentFormats = FALLBACK_FORMAT_OPTIONS.map((item) => ({
                id: item.id,
                code: item.code,
                label: item.code,
                isDefault: item.isDefault
            }));
            tournamentFormatsLoaded = true;
            return tournamentFormats;
        }

        tournamentFormats = rows
            .map((row) => {
                const code = normalizeFormatCode(row?.code);
                if (!code) return null;
                const name = String(row?.name || '').trim();
                const normalizedName = normalizeFormatCode(name);
                return {
                    id: Number.isFinite(Number(row?.id)) ? Number(row.id) : null,
                    code,
                    label: name && normalizedName !== code ? `${code} - ${name}` : code,
                    isDefault: row?.is_default === true
                };
            })
            .filter(Boolean);

        tournamentFormatsLoaded = true;
    } catch (err) {
        console.warn(err);
        tournamentFormats = FALLBACK_FORMAT_OPTIONS.map((item) => ({
            id: item.id,
            code: item.code,
            label: item.code,
            isDefault: item.isDefault
        }));
        tournamentFormatsLoaded = true;
    }

    return tournamentFormats;
}

function populateTournamentFormatSelect(selectId, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const selectedValue = normalizeFormatCode(options.selectedValue || '');
    const selectedId = Number(options.selectedId);
    const includeBlank = options.includeBlank !== false;
    const optionItems = [];
    tournamentFormats.forEach((format) => {
        if (!format?.code) return;
        optionItems.push({
            id: Number.isFinite(Number(format.id)) ? Number(format.id) : null,
            code: format.code,
            label: format.label || format.code
        });
    });

    if (selectedValue && !optionItems.some((item) => item.code === selectedValue)) {
        optionItems.push({
            id: null,
            code: selectedValue,
            label: `${selectedValue} (code only)`
        });
    }

    select.innerHTML = '';
    if (includeBlank) {
        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = 'Select format...';
        select.appendChild(blankOption);
    }

    const sortedItems = optionItems.sort((a, b) => b.code.localeCompare(a.code));
    sortedItems.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id ? String(item.id) : `code:${item.code}`;
        option.dataset.formatCode = item.code;
        option.textContent = item.label;
        select.appendChild(option);
    });

    if (Number.isFinite(selectedId) && selectedId > 0) {
        const idMatch = sortedItems.find((item) => item.id === selectedId);
        if (idMatch) {
            select.value = String(selectedId);
            return;
        }
    }

    if (selectedValue) {
        const codeMatch = sortedItems.find((item) => item.code === selectedValue);
        if (codeMatch && codeMatch.id) {
            select.value = String(codeMatch.id);
            return;
        }
        if (codeMatch && !codeMatch.id) {
            select.value = `code:${codeMatch.code}`;
            return;
        }
    }

    const defaultCode = getDefaultTournamentFormatCode();
    const defaultItem = sortedItems.find((item) => item.code === defaultCode && item.id);
    if (defaultItem) {
        select.value = String(defaultItem.id);
        return;
    }
    const defaultCodeOnlyItem = sortedItems.find((item) => item.code === defaultCode && !item.id);
    if (defaultCodeOnlyItem) {
        select.value = `code:${defaultCodeOnlyItem.code}`;
        return;
    }

    if (includeBlank) {
        select.value = '';
    } else if (sortedItems[0]?.id) {
        select.value = String(sortedItems[0].id);
    }
}

function getAssetPrefix() {
    return window.location.pathname.includes('/torneios/list-tournaments/') ? '../../' : '';
}

function extractDeckCodeFromImageUrl(imageUrl) {
    const match = String(imageUrl || '').match(/\/([A-Z0-9-]+)\.webp(?:$|\?)/i);
    return match ? String(match[1]).toUpperCase() : '';
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
    setupDashboardViewSwitching();
    await Promise.all([loadTournaments(), loadTournamentFormats()]);
    populateTournamentFormatSelect('createTournamentFormat');
    populateTournamentFormatSelect('editTournamentFormat');
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
    const btnSelectOcrPrints = document.getElementById('btnSelectOcrPrints');
    const btnProcessOcrPrints = document.getElementById('btnProcessOcrPrints');
    const createOcrFilesInput = document.getElementById('createOcrFilesInput');
    if (btnSelectOcrPrints && createOcrFilesInput) {
        btnSelectOcrPrints.addEventListener('click', () => {
            if (createOcrImportInProgress) return;
            createOcrFilesInput.click();
        });
        if (btnProcessOcrPrints) {
            btnProcessOcrPrints.addEventListener('click', processCreateOcrFiles);
        }
        createOcrFilesInput.addEventListener('change', onCreateOcrFilesSelected);
    }

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
        const baseSelect =
            'id,store_id,tournament_date,store:stores(name),tournament_name,total_players,instagram_link';
        const selectWithFormatAndId = `${baseSelect},format_id,format_ref:formats!tournament_format_id_fkey(code)`;
        const selectWithFormatId = `${baseSelect},format_id`;
        const selectWithLegacyFormatId = `${baseSelect},formar_id`;
        let usedLegacyFormatId = false;
        let res = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament?select=${encodeURIComponent(selectWithFormatAndId)}&order=tournament_date.desc`,
            { headers }
        );
        if (!res.ok) {
            res = await fetch(
                `${SUPABASE_URL}/rest/v1/tournament?select=${encodeURIComponent(selectWithFormatId)}&order=tournament_date.desc`,
                { headers }
            );
        }
        if (!res.ok) {
            res = await fetch(
                `${SUPABASE_URL}/rest/v1/tournament?select=${encodeURIComponent(selectWithLegacyFormatId)}&order=tournament_date.desc`,
                { headers }
            );
            if (res.ok) {
                usedLegacyFormatId = true;
            }
        }
        if (!res.ok) {
            res = await fetch(
                `${SUPABASE_URL}/rest/v1/tournament?select=${encodeURIComponent(baseSelect)}&order=tournament_date.desc`,
                { headers }
            );
            tournamentFormatIdSupported = false;
        } else {
            tournamentFormatIdSupported = true;
        }
        if (!res.ok) throw new Error('Erro ao carregar torneios.');
        const rows = await res.json();
        tournaments = (Array.isArray(rows) ? rows : []).map((row) => ({
            ...row,
            format_id: row?.format_id ?? row?.formar_id ?? null
        }));
        if (usedLegacyFormatId) {
            tournamentFormatIdSupported = false;
        }
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

function openPostGeneratorWithTournamentData(tournament, results, totalPlayers) {
    const formatCode = getTournamentFormatCode(tournament);
    const tournamentDataForCanvas = {
        topFour: (results || []).slice(0, 4).map((item) => ({
            result_id: item.id || '',
            placement: Number(item.placement),
            deck: item.deck || '-',
            player: item.player || '-',
            image_url: item.image_url || ''
        })),
        tournamentId: String(tournament.id || ''),
        storeId: String(tournament.store_id || ''),
        tournamentDate: String(tournament.tournament_date || ''),
        pieStateKey: String(
            tournament.id || `${String(tournament.store_id || '')}-${String(tournament.tournament_date || '')}`
        ),
        storeName: tournament.store?.name || 'Store',
        tournamentName: tournament.tournament_name || 'Tournament',
        format: formatCode || '',
        dateStr: formatDate(tournament.tournament_date),
        totalPlayers: Number(totalPlayers) || 0,
        allResults: (results || []).map((item) => ({
            result_id: item.id || '',
            placement: Number(item.placement),
            deck: item.deck || '-',
            player: item.player || '-',
            image_url: item.image_url || ''
        }))
    };

    try {
        const previewState = { tournamentDataForCanvas };
        localStorage.setItem(POST_PREVIEW_STATE_KEY, JSON.stringify(previewState));
        const previewData = encodeURIComponent(JSON.stringify(previewState));
        window.open(
            `${getAssetPrefix()}post-preview/index.html?postPreview=1&previewData=${previewData}`,
            '_blank'
        );
    } catch (error) {
        console.error(error);
        alert('Falha ao abrir o gerador de post.');
    }
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

    if (currentDashboardView !== 'tournaments') {
        return;
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
    if (currentDashboardView !== 'tournaments') return;

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

function setupDashboardViewSwitching() {
    const btnShowTournamentsNav = document.getElementById('btnShowTournamentsNav');
    const btnManageDecksNav = document.getElementById('btnManageDecksNav');
    const btnManagePlayersNav = document.getElementById('btnManagePlayersNav');
    const btnShowStatisticsNav = document.getElementById('btnShowStatisticsNav');

    if (!btnShowTournamentsNav && !btnManageDecksNav && !btnManagePlayersNav && !btnShowStatisticsNav)
        return;

    if (btnShowTournamentsNav) {
        btnShowTournamentsNav.addEventListener('click', () => {
            switchDashboardView('tournaments');
        });
    }

    if (btnManageDecksNav) {
        btnManageDecksNav.addEventListener('click', () => {
            switchDashboardView('decks');
        });
    }

    if (btnManagePlayersNav) {
        btnManagePlayersNav.addEventListener('click', () => {
            switchDashboardView('players');
        });
    }

    if (btnShowStatisticsNav) {
        btnShowStatisticsNav.addEventListener('click', () => {
            switchDashboardView('statistics');
        });
    }

    updateDashboardViewUi();
    const savedDashboardView = getSavedDashboardView();
    if (savedDashboardView !== currentDashboardView) {
        switchDashboardView(savedDashboardView);
    }
}

async function switchDashboardView(view) {
    if (view !== 'tournaments' && view !== 'decks' && view !== 'players' && view !== 'statistics')
        return;
    if (currentDashboardView === view) return;

    currentDashboardView = view;
    saveDashboardViewPreference();
    updateDashboardViewUi();

    if (view === 'decks') {
        try {
            await ensureDecksViewReady();
            if (typeof window.initDecksPage === 'function') {
                window.initDecksPage();
            }
        } catch (error) {
            console.error(error);
            alert('Unable to load decks view right now.');
            currentDashboardView = 'tournaments';
            saveDashboardViewPreference();
            updateDashboardViewUi();
        }
        return;
    }

    if (view === 'players') {
        try {
            await ensurePlayersViewReady();
            if (typeof window.initPlayersPage === 'function') {
                window.initPlayersPage();
            }
        } catch (error) {
            console.error(error);
            alert('Unable to load players view right now.');
            currentDashboardView = 'tournaments';
            saveDashboardViewPreference();
            updateDashboardViewUi();
        }
        return;
    }

    if (view === 'statistics') {
        try {
            await ensureStatisticsViewReady();
            await loadAndRenderStatistics(currentStatisticsView);
        } catch (error) {
            console.error(error);
            alert('Unable to load statistics view right now.');
            currentDashboardView = 'tournaments';
            saveDashboardViewPreference();
            updateDashboardViewUi();
        }
    }
}

function updateDashboardViewUi() {
    const isDecks = currentDashboardView === 'decks';
    const isPlayers = currentDashboardView === 'players';
    const isStatistics = currentDashboardView === 'statistics';
    const isTournaments = !isDecks && !isPlayers && !isStatistics;
    const filtersRow = document.querySelector('.filters-row');
    const decksContainer = document.getElementById('decksDynamicContainer');
    const playersContainer = document.getElementById('playersDynamicContainer');
    const statisticsContainer = document.getElementById('statisticsDynamicContainer');
    const btnShowTournamentsNav = document.getElementById('btnShowTournamentsNav');
    const btnManageDecksNav = document.getElementById('btnManageDecksNav');
    const btnManagePlayersNav = document.getElementById('btnManagePlayersNav');
    const btnShowStatisticsNav = document.getElementById('btnShowStatisticsNav');

    if (filtersRow) filtersRow.classList.toggle('is-hidden', isDecks || isPlayers || isStatistics);
    if (decksContainer) decksContainer.classList.toggle('is-hidden', !isDecks);
    if (playersContainer) playersContainer.classList.toggle('is-hidden', !isPlayers);
    if (statisticsContainer) statisticsContainer.classList.toggle('is-hidden', !isStatistics);

    if (btnShowTournamentsNav) {
        btnShowTournamentsNav.classList.toggle('is-active', isTournaments);
        btnShowTournamentsNav.disabled = isTournaments;
        btnShowTournamentsNav.setAttribute('aria-pressed', String(isTournaments));
    }
    if (btnManageDecksNav) {
        btnManageDecksNav.classList.toggle('is-active', isDecks);
        btnManageDecksNav.disabled = isDecks;
        btnManageDecksNav.setAttribute('aria-pressed', String(isDecks));
    }
    if (btnManagePlayersNav) {
        btnManagePlayersNav.classList.toggle('is-active', isPlayers);
        btnManagePlayersNav.disabled = isPlayers;
        btnManagePlayersNav.setAttribute('aria-pressed', String(isPlayers));
    }
    if (btnShowStatisticsNav) {
        btnShowStatisticsNav.classList.toggle('is-active', isStatistics);
        btnShowStatisticsNav.disabled = isStatistics;
        btnShowStatisticsNav.setAttribute('aria-pressed', String(isStatistics));
    }

    if (!isDecks && !isPlayers && !isStatistics) {
        renderCurrentView();
        return;
    }

    const listContainer = document.getElementById('listViewContainer');
    const calendarContainer = document.getElementById('calendarViewContainer');
    const calendarDetails = document.getElementById('calendarTournamentDetails');
    if (listContainer) listContainer.classList.add('is-hidden');
    if (calendarContainer) calendarContainer.classList.add('is-hidden');
    if (calendarDetails) calendarDetails.classList.add('is-hidden');
}

async function ensureDecksViewReady() {
    unmountPlayersContainer();
    unmountStatisticsContainer();
    await mountDecksContainer();
    await loadDecksAssets();
}

async function mountDecksContainer() {
    if (decksViewMounted) return;

    const host = document.getElementById('decksDynamicContainer');
    if (!host) return;

    let embedded = null;
    const localTemplate = document.getElementById('decksContainerTemplate');
    if (localTemplate?.content?.firstElementChild) {
        embedded = localTemplate.content.firstElementChild.cloneNode(true);
    } else {
        const prefix = getAssetPrefix();
        const response = await fetch(`${prefix}decks/index.html`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to load decks markup (${response.status})`);
        }

        const pageHtml = await response.text();
        const parsed = new DOMParser().parseFromString(pageHtml, 'text/html');
        const decksContainer = parsed.querySelector('.decks-container');
        if (!decksContainer) {
            throw new Error('Decks container not found in decks/index.html');
        }
        embedded = decksContainer.cloneNode(true);
        const topNav = embedded.querySelector('.top-nav');
        if (topNav) topNav.remove();
    }

    host.innerHTML = '';
    if (embedded) {
        embedded.classList.add('embedded-decks-view');
        host.appendChild(embedded);
    }

    if (!host.querySelector('#createDeckModalHost')) {
        const createHost = document.createElement('div');
        createHost.id = 'createDeckModalHost';
        host.appendChild(createHost);
    }
    if (!host.querySelector('#editDeckModalHost')) {
        const editHost = document.createElement('div');
        editHost.id = 'editDeckModalHost';
        host.appendChild(editHost);
    }

    decksViewMounted = true;
}

async function loadDecksAssets() {
    if (decksScriptsPromise) return decksScriptsPromise;

    const prefix = getAssetPrefix();
    const scriptPaths = [
        `${prefix}decks/create-deck/modal.js`,
        `${prefix}decks/edit-deck/modal.js`,
        `${prefix}decks/page.js`
    ];

    decksScriptsPromise = scriptPaths.reduce(
        (chain, src) => chain.then(() => loadScriptOnce(src)),
        Promise.resolve()
    );

    return decksScriptsPromise;
}

function loadScriptOnce(src) {
    const absoluteSrc = new URL(src, window.location.href).href;
    const existing = Array.from(document.querySelectorAll('script')).find((script) => {
        return script.src === absoluteSrc;
    });

    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
    });
}

async function ensurePlayersViewReady() {
    unmountDecksContainer();
    unmountStatisticsContainer();
    await mountPlayersContainer();
    await loadPlayersAssets();
}

async function ensureStatisticsViewReady() {
    unmountDecksContainer();
    unmountPlayersContainer();
    await mountStatisticsContainer();
}

async function mountPlayersContainer() {
    if (playersViewMounted) return;

    const host = document.getElementById('playersDynamicContainer');
    if (!host) return;

    const template = document.getElementById('playersContainerTemplate');
    if (!template?.content?.firstElementChild) {
        throw new Error('Players template not found in index.html');
    }

    const embedded = template.content.firstElementChild.cloneNode(true);
    host.innerHTML = '';
    host.appendChild(embedded);

    if (!document.getElementById('toast-container')) {
        const toast = document.createElement('div');
        toast.id = 'toast-container';
        host.appendChild(toast);
    }

    playersViewMounted = true;
}

function unmountDecksContainer() {
    const host = document.getElementById('decksDynamicContainer');
    if (host && host.innerHTML) {
        host.innerHTML = '';
    }
    decksViewMounted = false;
    if (typeof window.resetDecksPage === 'function') {
        window.resetDecksPage();
    }
}

function unmountPlayersContainer() {
    const host = document.getElementById('playersDynamicContainer');
    if (host && host.innerHTML) {
        host.innerHTML = '';
    }
    playersViewMounted = false;
    if (typeof window.resetPlayersPage === 'function') {
        window.resetPlayersPage();
    }
}

async function loadPlayersAssets() {
    if (playersScriptsPromise) return playersScriptsPromise;

    const prefix = getAssetPrefix();
    playersScriptsPromise = loadScriptOnce(`${prefix}players/script.js`);
    return playersScriptsPromise;
}

async function mountStatisticsContainer() {
    if (statisticsViewMounted) return;

    const host = document.getElementById('statisticsDynamicContainer');
    if (!host) return;

    const template = document.getElementById('statisticsContainerTemplate');
    if (!template?.content?.firstElementChild) {
        throw new Error('Statistics template not found in index.html');
    }

    const embedded = template.content.firstElementChild.cloneNode(true);
    host.innerHTML = '';
    host.appendChild(embedded);

    const select = host.querySelector('#statisticsViewSelect');

    if (select) {
        select.value = currentStatisticsView;
        select.addEventListener('change', async () => {
            const nextView = String(select.value || '');
            currentStatisticsView = nextView;
            currentStatisticsSort = { column: '', direction: 'asc' };
            currentStatisticsMonthFilter = '';
            currentStatisticsStoreFilter = '';
            currentStatisticsFormatFilter = '';
            currentStatisticsDateFilter = '';
            currentStatisticsStapleFilter = '';
            currentStoreChampionsPlayerQuery = '';
            areStoreChampionsCardsCollapsed = true;
            saveStatisticsViewPreference(nextView);
            await loadAndRenderStatistics(nextView);
        });
    }

    const monthSelect = host.querySelector('#statisticsFilterMonth');
    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            currentStatisticsMonthFilter = String(monthSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const storeFilterSelect = host.querySelector('#statisticsFilterStore');
    if (storeFilterSelect) {
        storeFilterSelect.addEventListener('change', () => {
            currentStatisticsStoreFilter = String(storeFilterSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const formatFilterSelect = host.querySelector('#statisticsFilterFormat');
    if (formatFilterSelect) {
        formatFilterSelect.addEventListener('change', () => {
            currentStatisticsFormatFilter = String(formatFilterSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const dateFilterSelect = host.querySelector('#statisticsFilterDate');
    if (dateFilterSelect) {
        dateFilterSelect.addEventListener('change', () => {
            currentStatisticsDateFilter = String(dateFilterSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const stapleFilterSelect = host.querySelector('#statisticsFilterStaple');
    if (stapleFilterSelect) {
        stapleFilterSelect.addEventListener('change', () => {
            currentStatisticsStapleFilter = String(stapleFilterSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const playerSearchInput = host.querySelector('#statisticsPlayerSearch');
    if (playerSearchInput) {
        playerSearchInput.addEventListener('input', () => {
            currentStoreChampionsPlayerQuery = String(playerSearchInput.value || '').trim();
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    const toggleStoreCardsButton = host.querySelector('#btnToggleStoreCards');
    if (toggleStoreCardsButton) {
        toggleStoreCardsButton.addEventListener('click', () => {
            areStoreChampionsCardsCollapsed = !areStoreChampionsCardsCollapsed;
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }

    window.addEventListener('resize', handleStatisticsViewportChange);

    statisticsViewMounted = true;
}

function unmountStatisticsContainer() {
    const host = document.getElementById('statisticsDynamicContainer');
    if (host && host.innerHTML) {
        host.innerHTML = '';
    }
    statisticsViewMounted = false;
    statisticsViewData = [];
    statisticsMonthlyRankingData = [];
    currentStatisticsSort = { column: '', direction: 'asc' };
    currentStatisticsMonthFilter = '';
    currentStatisticsStoreFilter = '';
    currentStatisticsFormatFilter = '';
    currentStatisticsDateFilter = '';
    currentStatisticsStapleFilter = '';
    currentStoreChampionsPlayerQuery = '';
    areStoreChampionsCardsCollapsed = true;
    window.removeEventListener('resize', handleStatisticsViewportChange);
}

async function loadAndRenderStatistics(viewName) {
    const host = document.getElementById('statisticsDynamicContainer');
    if (!host) return;

    const status = host.querySelector('#statisticsStatus');
    if (status) status.textContent = '';

    try {
        if (viewName === 'v_player_ranking') {
            const allTimeEndpoint = '/rest/v1/v_player_ranking?select=*&limit=1000';
            const monthlyEndpoint = '/rest/v1/v_monthly_ranking?select=*&limit=1000';
            const [allTimeResponse, monthlyResponse] = await Promise.all([
                window.supabaseApi
                    ? window.supabaseApi.get(allTimeEndpoint)
                    : fetch(`${SUPABASE_URL}${allTimeEndpoint}`, { headers }),
                window.supabaseApi
                    ? window.supabaseApi.get(monthlyEndpoint)
                    : fetch(`${SUPABASE_URL}${monthlyEndpoint}`, { headers })
            ]);

            if (!allTimeResponse.ok) {
                throw new Error(`Failed to load v_player_ranking (${allTimeResponse.status})`);
            }
            if (!monthlyResponse.ok) {
                throw new Error(`Failed to load v_monthly_ranking (${monthlyResponse.status})`);
            }

            const [allTimeRows, monthlyRows] = await Promise.all([
                allTimeResponse.json(),
                monthlyResponse.json()
            ]);
            statisticsViewData = normalizePlayerRankingRows(
                Array.isArray(allTimeRows) ? allTimeRows : [],
                { isMonthly: false }
            );
            const playerAllTimeMap = new Map(
                statisticsViewData.map((row) => [String(row?.player || '').trim().toLowerCase(), row])
            );
            statisticsMonthlyRankingData = normalizePlayerRankingRows(
                Array.isArray(monthlyRows) ? monthlyRows : [],
                { isMonthly: true, allTimeByPlayer: playerAllTimeMap }
            );
        } else {
            const endpoint = `/rest/v1/${viewName}?select=*&limit=1000`;
            const response = window.supabaseApi
                ? await window.supabaseApi.get(endpoint)
                : await fetch(`${SUPABASE_URL}${endpoint}`, { headers });

            if (!response.ok) {
                throw new Error(`Failed to load ${viewName} (${response.status})`);
            }

            const rows = await response.json();
            const baseRows = Array.isArray(rows) ? rows : [];
            statisticsViewData =
                viewName === 'v_top_cards_by_month'
                    ? await enrichTopCardsWithCardName(baseRows)
                    : baseRows;
            statisticsMonthlyRankingData = [];
        }
        renderStatisticsTable(statisticsViewData, viewName);
    } catch (error) {
        console.error(error);
        statisticsViewData = [];
        statisticsMonthlyRankingData = [];
        renderStatisticsTable([], viewName, error.message || 'Unexpected error');
    }
}

async function enrichTopCardsWithCardName(rows) {
    const list = normalizeTopCardsRows(Array.isArray(rows) ? rows : []);
    if (!list.length) return [];

    const byCode = new Map(topCardsNameCache);
    try {
        const cacheRows = await fetchAllCardsCacheRows();
        (Array.isArray(cacheRows) ? cacheRows : []).forEach((row) => {
            const key = normalizeCardCodeForLookup(row?.card_code);
            const name = String(row?.name || '').trim();
            const normalizedNameAsCode = normalizeCardCodeForLookup(name);
            if (key && name && normalizedNameAsCode !== key) {
                byCode.set(key, name);
                topCardsNameCache.set(key, name);
            }
        });
    } catch (_error) {
        // Ignore cache failures; fallback stays local to avoid browser CORS/rate-limit loops.
    }

    const missingCodes = Array.from(
        new Set(
            list.map((row) => normalizeCardCodeForLookup(row?.card_code)).filter(
                (code) => code && !byCode.has(code) && !topCardsNameLookupAttempted.has(code)
            )
        )
    );
    if (missingCodes.length) {
        const apiRows = await fetchCardsFromDigimonApi(missingCodes);
        apiRows.forEach((row) => {
            const code = normalizeCardCodeForLookup(row?.card_code || row?.id || row?.card);
            const name = String(row?.name || '').trim();
            if (!code) return;
            topCardsNameLookupAttempted.add(code);
            if (name && normalizeCardCodeForLookup(name) !== code) {
                byCode.set(code, name);
                topCardsNameCache.set(code, name);
            }
        });
        missingCodes.forEach((code) => topCardsNameLookupAttempted.add(code));
    }

    return list.map((row) => {
        const code = normalizeCardCodeForLookup(row?.card_code);
        const inlineName = String(row?.card_name || '').trim();
        const inlineNameIsCode =
            normalizeCardCodeForLookup(inlineName) &&
            normalizeCardCodeForLookup(inlineName) === code;
        return {
            ...row,
            card_name:
                byCode.get(code) ||
                (!inlineNameIsCode ? inlineName : '') ||
                '-'
        };
    });
}

async function fetchAllCardsCacheRows() {
    const out = [];
    const limit = 1000;
    let offset = 0;
    while (true) {
        const endpoint = `/rest/v1/cards_cache?select=card_code,name&order=card_code.asc&limit=${limit}&offset=${offset}`;
        const response = window.supabaseApi
            ? await window.supabaseApi.get(endpoint)
            : await fetch(`${SUPABASE_URL}${endpoint}`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to load cards_cache (${response.status})`);
        }
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.length) break;
        out.push(...rows);
        if (rows.length < limit) break;
        offset += limit;
    }
    return out;
}

async function fetchCardsFromDigimonApi(codes) {
    const result = [];
    const usedCodes = new Set();
    const pushRow = (row) => {
        const code = normalizeCardCodeForLookup(row?.id || row?.card || '');
        if (!code || usedCodes.has(code)) return;
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
    };

    for (const chunk of chunkArray(codes, 20)) {
        try {
            const query = new URLSearchParams({ card: chunk.join(','), limit: String(chunk.length * 2) });
            const response = await fetch(`${DIGIMON_CARD_API_URL}?${query}`);
            if (response.ok) {
                const rows = await response.json();
                if (Array.isArray(rows)) rows.forEach(pushRow);
            }
        } catch (_error) {}

        const missed = chunk.filter((code) => !usedCodes.has(code));
        for (const code of missed) {
            try {
                const query = new URLSearchParams({ card: code, limit: '1' });
                const response = await fetch(`${DIGIMON_CARD_API_URL}?${query}`);
                if (!response.ok) continue;
                const rows = await response.json();
                if (Array.isArray(rows)) rows.forEach(pushRow);
            } catch (_error) {}
        }
    }
    return result;
}

function normalizeCardCodeForLookup(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

function chunkArray(items, size) {
    const source = Array.isArray(items) ? items : [];
    const result = [];
    const step = Math.max(1, Number(size) || 1);
    for (let i = 0; i < source.length; i += step) {
        result.push(source.slice(i, i + step));
    }
    return result;
}

function normalizeTopCardsRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const source = row || {};
        const totalValue = source.total ?? source.total_copies ?? source.decklists_with_card ?? 0;
        return {
            ...source,
            total: totalValue,
            champion: source.champion ?? source.champion_copies ?? 0,
            top2: source.top2 ?? source.top2_copies ?? 0,
            top3: source.top3 ?? source.top3_copies ?? 0,
            top4: source.top4 ?? source.top4_copies ?? 0
        };
    });
}

function renderStatisticsTable(rows, viewName, errorMessage = '') {
    const host = document.getElementById('statisticsDynamicContainer');
    if (!host) return;

    const status = host.querySelector('#statisticsStatus');
    const formulaHint = host.querySelector('#statisticsFormulaHint');
    const rowCount = host.querySelector('#statisticsRowCount');
    const dataCard = host.querySelector('.statistics-data-card');
    const tableWrapper = host.querySelector('.statistics-table-wrapper');
    const primaryControls = host.querySelector('.statistics-primary-controls');
    const mainSelects = host.querySelector('.statistics-main-selects');
    const secondaryControls = host.querySelector('.statistics-secondary-controls');
    const storeFilterSelect = host.querySelector('#statisticsFilterStore');
    const formatFilterSelect = host.querySelector('#statisticsFilterFormat');
    const monthFilterSelect = host.querySelector('#statisticsFilterMonth');
    const dateFilterSelect = host.querySelector('#statisticsFilterDate');
    const stapleFilterSelect = host.querySelector('#statisticsFilterStaple');
    const playerSearchInput = host.querySelector('#statisticsPlayerSearch');
    const toggleStoreCardsButton = host.querySelector('#btnToggleStoreCards');
    const previousBoard = host.querySelector('.store-champions-board');
    if (previousBoard) previousBoard.remove();
    const previousHighlights = host.querySelector('.statistics-highlights');
    if (previousHighlights) previousHighlights.remove();
    const head = host.querySelector('#statisticsTable thead');
    const body = host.querySelector('#statisticsTable tbody');
    if (!head || !body) return;

    head.innerHTML = '';
    body.innerHTML = '';
    if (status) {
        status.textContent = '';
        status.classList.add('is-hidden');
    }
    if (rowCount) rowCount.textContent = String(rows.length || 0);
    if (dataCard) dataCard.classList.add('is-hidden');
    if (tableWrapper) tableWrapper.classList.remove('is-hidden');
    if (tableWrapper) {
        tableWrapper.classList.toggle(
            'is-wide-table',
            viewName === 'v_player_ranking' ||
                viewName === 'v_deck_stats' ||
                viewName === 'v_deck_representation' ||
                viewName === 'v_top_cards_by_month'
        );
    }
    if (formulaHint) {
        const formulaHtml = getStatisticsFormulaHintHtml(viewName);
        formulaHint.innerHTML = formulaHtml;
        formulaHint.classList.toggle('is-hidden', !formulaHtml);
    }
    if (storeFilterSelect) {
        storeFilterSelect.classList.add('is-hidden');
        storeFilterSelect.innerHTML = '<option value="">Todas as lojas</option>';
        if (mainSelects && storeFilterSelect.parentElement !== mainSelects) {
            mainSelects.appendChild(storeFilterSelect);
        }
    }
    if (monthFilterSelect) {
        monthFilterSelect.classList.add('is-hidden');
        monthFilterSelect.innerHTML = '<option value="">Todos os meses</option>';
    }
    if (formatFilterSelect) {
        formatFilterSelect.classList.add('is-hidden');
        formatFilterSelect.innerHTML = '<option value="">Todos os formatos</option>';
    }
    if (dateFilterSelect) {
        dateFilterSelect.classList.add('is-hidden');
        dateFilterSelect.innerHTML = '<option value="">Todas as datas</option>';
    }
    if (stapleFilterSelect) {
        stapleFilterSelect.classList.add('is-hidden');
        stapleFilterSelect.innerHTML =
            '<option value="">Todas as cartas</option><option value="true">Somente staple</option>';
    }
    if (playerSearchInput) {
        playerSearchInput.classList.add('is-hidden');
        playerSearchInput.value = '';
    }
    if (toggleStoreCardsButton) {
        toggleStoreCardsButton.classList.add('is-hidden');
    }
    if (secondaryControls) {
        secondaryControls.classList.add('is-hidden');
        secondaryControls.classList.remove('is-store-champions-row');
    }
    if (primaryControls) {
        primaryControls.classList.remove('is-store-champions-layout');
    }

    if (errorMessage) {
        if (status) {
            status.textContent = `Unable to load ${viewName}: ${errorMessage}`;
            status.classList.remove('is-hidden');
        }
        if (dataCard) dataCard.classList.remove('is-hidden');
        return;
    }

    const playerMonthlyRows =
        viewName === 'v_player_ranking' && Array.isArray(statisticsMonthlyRankingData)
            ? statisticsMonthlyRankingData
            : [];
    const hasBaseRows = Array.isArray(rows) && rows.length > 0;
    const hasPlayerMonthlyRows = viewName === 'v_player_ranking' && playerMonthlyRows.length > 0;

    if (!hasBaseRows && !hasPlayerMonthlyRows) {
        if (status) {
            status.textContent = `No rows returned for ${viewName}.`;
            status.classList.remove('is-hidden');
        }
        if (dataCard) dataCard.classList.remove('is-hidden');
        return;
    }
    const playerMonthlyColumns = Object.keys(playerMonthlyRows[0] || {});

    const sourceColumns = Object.keys(rows[0] || {});
    const storeColumn = sourceColumns.includes('store') ? 'store' : '';
    const formatColumn = sourceColumns.includes('format_code')
        ? 'format_code'
        : sourceColumns.includes('format')
          ? 'format'
          : '';
    const monthColumn =
        sourceColumns.includes('month')
            ? 'month'
            : viewName === 'v_player_ranking' && playerMonthlyColumns.includes('month')
              ? 'month'
              : '';
    const dateColumn =
        viewName === 'v_player_ranking'
            ? ''
            : sourceColumns.includes('tournament_date')
        ? 'tournament_date'
        : sourceColumns.find((column) => /(^|_)date$/i.test(column)) || '';

    if (storeFilterSelect && storeColumn) {
        storeFilterSelect.classList.remove('is-hidden');
        populateStatisticsValueSelect(
            storeFilterSelect,
            rows.map((row) => row?.[storeColumn]),
            currentStatisticsStoreFilter,
            'Todas as lojas'
        );
        currentStatisticsStoreFilter = String(storeFilterSelect.value || '');
    } else {
        currentStatisticsStoreFilter = '';
    }

    if (formatFilterSelect && formatColumn) {
        formatFilterSelect.classList.remove('is-hidden');
        populateStatisticsValueSelect(
            formatFilterSelect,
            rows.map((row) => row?.[formatColumn]),
            currentStatisticsFormatFilter,
            'Todos os formatos'
        );
        if (viewName === 'v_meta_by_month' && !currentStatisticsFormatFilter) {
            const latestFormat = getLatestStatisticsFormat(rows, formatColumn, monthColumn);
            if (latestFormat) {
                currentStatisticsFormatFilter = latestFormat;
                formatFilterSelect.value = latestFormat;
            }
        }
        currentStatisticsFormatFilter = String(formatFilterSelect.value || '');
    } else {
        currentStatisticsFormatFilter = '';
    }

    if (monthFilterSelect && monthColumn) {
        const monthSourceRows =
            viewName === 'v_meta_by_month' && formatColumn && currentStatisticsFormatFilter
                ? rows.filter(
                      (row) =>
                          String(row?.[formatColumn] || '').trim() === currentStatisticsFormatFilter
                  )
                : rows;
        populateStatisticsMonthSelect(
            monthFilterSelect,
            viewName === 'v_player_ranking'
                ? playerMonthlyRows.map((row) => row?.[monthColumn])
                : monthSourceRows.map((row) => row?.[monthColumn]),
            currentStatisticsMonthFilter
        );
        if (viewName === 'v_player_ranking') {
            monthFilterSelect.classList.add('is-hidden');
        } else {
            monthFilterSelect.classList.remove('is-hidden');
        }
        currentStatisticsMonthFilter = String(monthFilterSelect.value || '');
    } else {
        currentStatisticsMonthFilter = '';
    }

    if (dateFilterSelect && dateColumn) {
        dateFilterSelect.classList.remove('is-hidden');
        populateStatisticsDateSelect(
            dateFilterSelect,
            rows.map((row) => row?.[dateColumn]),
            currentStatisticsDateFilter
        );
        currentStatisticsDateFilter = String(dateFilterSelect.value || '');
    } else {
        currentStatisticsDateFilter = '';
    }

    if (stapleFilterSelect && viewName === 'v_top_cards_by_month') {
        stapleFilterSelect.classList.remove('is-hidden');
        const allowedValues = new Set(['', 'true']);
        if (!allowedValues.has(currentStatisticsStapleFilter)) {
            currentStatisticsStapleFilter = '';
        }
        stapleFilterSelect.value = currentStatisticsStapleFilter;
        currentStatisticsStapleFilter = String(stapleFilterSelect.value || '');
    } else {
        currentStatisticsStapleFilter = '';
    }

    let filteredRows = rows;
    if (storeColumn && currentStatisticsStoreFilter) {
        filteredRows = filteredRows.filter(
            (row) => String(row?.[storeColumn] || '').trim() === currentStatisticsStoreFilter
        );
    }
    if (formatColumn && currentStatisticsFormatFilter) {
        filteredRows = filteredRows.filter(
            (row) => String(row?.[formatColumn] || '').trim() === currentStatisticsFormatFilter
        );
    }
    if (monthColumn && currentStatisticsMonthFilter) {
        if (viewName === 'v_player_ranking') {
            filteredRows = playerMonthlyRows.filter(
                (row) =>
                    normalizeStatisticsMonthKey(row?.[monthColumn]) === currentStatisticsMonthFilter
            );
        } else {
            filteredRows = filteredRows.filter(
                (row) =>
                    normalizeStatisticsMonthKey(row?.[monthColumn]) === currentStatisticsMonthFilter
            );
        }
    }
    if (dateColumn && currentStatisticsDateFilter) {
        filteredRows = filteredRows.filter(
            (row) => normalizeStatisticsDateKey(row?.[dateColumn]) === currentStatisticsDateFilter
        );
    }
    if (viewName === 'v_top_cards_by_month' && currentStatisticsStapleFilter === 'true') {
        filteredRows = filteredRows.filter((row) => {
            const value = String(row?.is_staple || '')
                .trim()
                .toLowerCase();
            return value === 'true' || value === 't' || value === '1' || value === 'yes' || value === 'sim';
        });
    }
    if (viewName === 'v_top_cards_by_month') {
        const compareTopCardsRows = (a, b) => {
            const totalDiff = (Number(b?.total) || 0) - (Number(a?.total) || 0);
            if (totalDiff !== 0) return totalDiff;
            const championDiff = (Number(b?.champion) || 0) - (Number(a?.champion) || 0);
            if (championDiff !== 0) return championDiff;
            const top2Diff = (Number(b?.top2) || 0) - (Number(a?.top2) || 0);
            if (top2Diff !== 0) return top2Diff;
            return String(a?.card_code || '').localeCompare(String(b?.card_code || ''));
        };

        const byMonth = new Map();
        filteredRows.forEach((row) => {
            const monthKey = normalizeStatisticsMonthKey(row?.month || '') || '';
            if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
            byMonth.get(monthKey).push(row);
        });

        const rankedRows = [];
        byMonth.forEach((monthRows, monthKey) => {
            const sortedMonthRows = [...monthRows].sort(compareTopCardsRows);
            sortedMonthRows.forEach((row, index) => {
                rankedRows.push({
                    ...row,
                    month: row?.month || monthKey,
                    monthly_rank: index + 1
                });
            });
        });

        filteredRows = rankedRows
            .sort((a, b) => {
                const monthA = normalizeStatisticsMonthKey(a?.month || '') || '';
                const monthB = normalizeStatisticsMonthKey(b?.month || '') || '';
                if (monthA !== monthB) return monthB.localeCompare(monthA);
                const rankDiff = (Number(a?.monthly_rank) || 0) - (Number(b?.monthly_rank) || 0);
                if (rankDiff !== 0) return rankDiff;
                return String(a?.card_code || '').localeCompare(String(b?.card_code || ''));
            })
            .slice(0, 20);
    }

    if (viewName === 'v_store_champions') {
        if (primaryControls) {
            primaryControls.classList.add('is-store-champions-layout');
        }
        if (secondaryControls && storeFilterSelect && storeFilterSelect.parentElement !== secondaryControls) {
            secondaryControls.prepend(storeFilterSelect);
        }
        if (secondaryControls) {
            secondaryControls.classList.add('is-store-champions-row');
        }
        if (playerSearchInput) {
            playerSearchInput.classList.remove('is-hidden');
            playerSearchInput.value = currentStoreChampionsPlayerQuery;
        }
        const isMobile = isStatisticsMobileViewport();
        if (toggleStoreCardsButton) {
            if (isMobile) {
                toggleStoreCardsButton.classList.remove('is-hidden');
                toggleStoreCardsButton.textContent = areStoreChampionsCardsCollapsed
                    ? 'Expandir lojas'
                    : 'Recolher lojas';
            } else {
                areStoreChampionsCardsCollapsed = false;
                toggleStoreCardsButton.classList.add('is-hidden');
            }
        }
        filteredRows = filterStoreChampionsRowsByPlayer(filteredRows, currentStoreChampionsPlayerQuery);
    }

    if (secondaryControls) {
        const hasVisibleSecondaryControl =
            (storeFilterSelect && !storeFilterSelect.classList.contains('is-hidden')) ||
            (formatFilterSelect && !formatFilterSelect.classList.contains('is-hidden')) ||
            (monthFilterSelect && !monthFilterSelect.classList.contains('is-hidden')) ||
            (dateFilterSelect && !dateFilterSelect.classList.contains('is-hidden')) ||
            (stapleFilterSelect && !stapleFilterSelect.classList.contains('is-hidden')) ||
            (playerSearchInput && !playerSearchInput.classList.contains('is-hidden')) ||
            (toggleStoreCardsButton && !toggleStoreCardsButton.classList.contains('is-hidden'));
        secondaryControls.classList.toggle('is-hidden', !hasVisibleSecondaryControl);
    }

    if (!filteredRows.length) {
        if (status) {
            if (viewName === 'v_store_champions' && currentStoreChampionsPlayerQuery) {
                status.textContent = 'Nenhum player encontrado com esse filtro.';
            } else if (storeColumn && currentStatisticsStoreFilter) {
                status.textContent = 'Nenhum dado para a loja selecionada.';
            } else if (formatColumn && currentStatisticsFormatFilter) {
                status.textContent = 'Sem dados para o formato selecionado.';
            } else if (monthColumn && currentStatisticsMonthFilter) {
                status.textContent = 'Sem dados para o mes selecionado.';
            } else if (dateColumn && currentStatisticsDateFilter) {
                status.textContent = 'Sem dados para a data selecionada.';
            } else if (viewName === 'v_top_cards_by_month' && currentStatisticsStapleFilter === 'true') {
                status.textContent = 'Sem dados para cartas staple.';
            } else {
                status.textContent = `No rows returned for ${viewName}.`;
            }
            status.classList.remove('is-hidden');
        }
        if (dataCard) dataCard.classList.remove('is-hidden');
        return;
    }
    if (rowCount) rowCount.textContent = String(filteredRows.length || 0);

    if (viewName === 'v_store_champions') {
        const columns = getStatisticsDisplayColumns(
            viewName,
            Object.keys(filteredRows[0] || {}).filter((column) => !isInternalStatisticsColumn(column))
        );
        if (tableWrapper) tableWrapper.classList.add('is-hidden');
        if (dataCard) dataCard.classList.add('is-hidden');
        renderStoreChampionsBoard(host, filteredRows, {
            isMobile: isStatisticsMobileViewport(),
            collapsedByDefault: areStoreChampionsCardsCollapsed
        });
        if (status) status.textContent = '';
        return;
    }

    const columns = getStatisticsDisplayColumns(
        viewName,
        Object.keys(filteredRows[0] || {}).filter((column) => !isInternalStatisticsColumn(column))
    );
    if (!columns.length) {
        if (status) status.textContent = `No user-facing columns available for ${viewName}.`;
        return;
    }
    if (currentStatisticsSort.column && !columns.includes(currentStatisticsSort.column)) {
        currentStatisticsSort = { column: '', direction: 'asc' };
    }

    const sortedRows = sortStatisticsRows(filteredRows, currentStatisticsSort);
    const headerRow = document.createElement('tr');
    columns.forEach((column, columnIndex) => {
        const th = document.createElement('th');
        const normalizedColumn = String(column || '').trim().toLowerCase();
        if (
            normalizedColumn === 'monthly_rank' ||
            normalizedColumn === 'overall_rank' ||
            normalizedColumn === 'store_rank' ||
            normalizedColumn === 'format_rank'
        ) {
            th.classList.add('stats-rank-col');
        }
        if (
            normalizedColumn === 'total' ||
            normalizedColumn === 'champion' ||
            normalizedColumn === 'top2' ||
            normalizedColumn === 'top3' ||
            normalizedColumn === 'top4'
        ) {
            th.classList.add('stats-metric-col');
        }
        if (normalizedColumn === 'is_staple') {
            th.classList.add('stats-staple-col');
        }
        const description = getStatisticsColumnDescription(viewName, column);
        const columnLabel = getStatisticsHeaderLabel(viewName, column);
        th.title = description;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stats-sort-button';
        button.dataset.statsSortColumn = column;
        button.title = description;
        button.setAttribute('aria-label', `${columnLabel}: ${description}`);
        button.innerHTML = `
            ${columnLabel}
            <span class="sort-indicator" data-stats-sort-indicator="${column}">\u21C5</span>
        `;
        th.appendChild(button);

        const resizer = document.createElement('span');
        resizer.className = 'stats-col-resizer';
        resizer.setAttribute('role', 'separator');
        resizer.setAttribute('aria-orientation', 'vertical');
        resizer.setAttribute('aria-label', `Resize column ${columnLabel}`);
        resizer.title = 'Arraste para ajustar a largura. Duplo clique para resetar.';
        resizer.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        resizer.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            clearStatisticsColumnWidth(viewName, column);
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
        resizer.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const startX = event.clientX;
            const startWidth = th.getBoundingClientRect().width;

            const onMouseMove = (moveEvent) => {
                const delta = moveEvent.clientX - startX;
                const nextWidth = startWidth + delta;
                applyStatisticsColumnWidth(head, body, columnIndex, nextWidth);
            };
            const onMouseUp = (upEvent) => {
                const delta = upEvent.clientX - startX;
                const finalWidth = startWidth + delta;
                setStatisticsColumnWidth(viewName, column, finalWidth);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        th.appendChild(resizer);
        headerRow.appendChild(th);
    });
    head.appendChild(headerRow);

    sortedRows.forEach((row) => {
        const tr = document.createElement('tr');
        columns.forEach((column) => {
            const td = document.createElement('td');
            const normalizedColumn = String(column || '').trim().toLowerCase();
            if (
                normalizedColumn === 'monthly_rank' ||
                normalizedColumn === 'overall_rank' ||
                normalizedColumn === 'store_rank' ||
                normalizedColumn === 'format_rank'
            ) {
                td.classList.add('stats-rank-col');
            }
            if (
                normalizedColumn === 'total' ||
                normalizedColumn === 'champion' ||
                normalizedColumn === 'top2' ||
                normalizedColumn === 'top3' ||
                normalizedColumn === 'top4'
            ) {
                td.classList.add('stats-metric-col');
            }
            if (normalizedColumn === 'is_staple') {
                td.classList.add('stats-staple-col');
            }
            td.innerHTML = formatStatisticsCellValue(row[column], column, row);
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    bindStatisticsCardPreview(body);
    bindStatisticsStapleToggle(body, viewName);
    applySavedStatisticsColumnWidths(head, body, viewName, columns);

    const sortButtons = head.querySelectorAll('.stats-sort-button[data-stats-sort-column]');
    sortButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const column = button.dataset.statsSortColumn || '';
            if (!column) return;
            toggleStatisticsSort(column);
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    });
    updateStatisticsSortIndicators(head);

    if (status) status.textContent = '';
}

function bindStatisticsCardPreview(root) {
    if (!root) return;
    const targets = root.querySelectorAll('[data-card-preview-code]');
    if (!targets.length) return;

    const popover = ensureStatisticsCardPreviewPopover();
    const img = popover.querySelector('img');
    if (!img) return;

    const show = (event) => {
        const el = event.currentTarget;
        const code = String(el?.getAttribute('data-card-preview-code') || '').trim();
        if (!code) return;
        const primary = `${IMAGE_BASE_URL}${encodeURIComponent(code)}.webp`;
        const fallback = `https://images.digimoncard.io/images/cards/${encodeURIComponent(code)}.png`;
        img.onerror = () => {
            if (img.dataset.fallback === '1') return;
            img.dataset.fallback = '1';
            img.src = fallback;
        };
        img.dataset.fallback = '';
        img.src = primary;
        popover.classList.add('is-visible');
        moveCardPreviewPopover(popover, event.clientX, event.clientY);
    };
    const move = (event) => {
        if (!popover.classList.contains('is-visible')) return;
        moveCardPreviewPopover(popover, event.clientX, event.clientY);
    };
    const hide = () => {
        popover.classList.remove('is-visible');
    };

    targets.forEach((el) => {
        el.addEventListener('mouseenter', show);
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', hide);
        el.addEventListener('blur', hide);
    });
}

function normalizeStatisticsStapleState(value) {
    if (value === true) return 'true';
    if (value === false) return 'false';
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    if (normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes' || normalized === 'sim') {
        return 'true';
    }
    if (normalized === 'false' || normalized === 'f' || normalized === '0' || normalized === 'no' || normalized === 'nao' || normalized === 'não') {
        return 'false';
    }
    return 'null';
}

function getNextStatisticsStapleState(state) {
    if (state === 'true') return 'false';
    if (state === 'false') return 'null';
    return 'true';
}

function serializeStatisticsStapleState(state) {
    if (state === 'true') return true;
    if (state === 'false') return false;
    return null;
}

function renderStatisticsStapleToggle(row, value) {
    const code = normalizeCardCodeForLookup(row?.card_code || '');
    if (!code) return '-';
    const state = normalizeStatisticsStapleState(value);
    const nextState = getNextStatisticsStapleState(state);
    const stateLabel = state === 'true' ? 'Staple: Sim' : state === 'false' ? 'Staple: Não' : 'Staple: Não definido';
    const nextLabel = nextState === 'true' ? 'Sim' : nextState === 'false' ? 'Não' : 'Não definido';
    const icon = state === 'true' ? '✓' : state === 'false' ? '✕' : '';
    return `
        <button
            type="button"
            class="stats-staple-toggle stats-staple-toggle-${state}"
            data-stats-staple-code="${escapeHtml(code)}"
            data-stats-staple-state="${state}"
            title="${escapeHtml(`${stateLabel}. Clique para mudar para ${nextLabel}.`)}"
            aria-label="${escapeHtml(`${stateLabel}. Clique para mudar para ${nextLabel}.`)}"
        >
            <span class="stats-staple-toggle-icon" aria-hidden="true">${icon}</span>
        </button>
    `;
}

function bindStatisticsStapleToggle(root, viewName) {
    if (!root || viewName !== 'v_top_cards_by_month') return;
    const buttons = root.querySelectorAll('button[data-stats-staple-code][data-stats-staple-state]');
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const code = normalizeCardCodeForLookup(button.dataset.statsStapleCode || '');
            const currentState = normalizeStatisticsStapleState(button.dataset.statsStapleState || '');
            if (!code || stapleTogglePendingCodes.has(code)) return;
            const nextState = getNextStatisticsStapleState(currentState);

            stapleTogglePendingCodes.add(code);
            button.disabled = true;
            button.classList.add('is-loading');

            try {
                await updateStatisticsStapleStateOnServer(code, nextState);
                const serialized = serializeStatisticsStapleState(nextState);
                if (Array.isArray(statisticsViewData) && statisticsViewData.length) {
                    statisticsViewData = statisticsViewData.map((row) => {
                        const rowCode = normalizeCardCodeForLookup(row?.card_code || '');
                        if (rowCode !== code) return row;
                        return { ...row, is_staple: serialized };
                    });
                }
                renderStatisticsTable(statisticsViewData, currentStatisticsView);
            } catch (error) {
                console.error('Failed to update is_staple:', error);
                alert('Falha ao atualizar staple. Tente novamente.');
            } finally {
                stapleTogglePendingCodes.delete(code);
                button.disabled = false;
                button.classList.remove('is-loading');
            }
        });
    });
}

async function updateStatisticsStapleStateOnServer(cardCode, nextState) {
    const code = normalizeCardCodeForLookup(cardCode || '');
    if (!code) throw new Error('Invalid card code');
    const payload = { is_staple: serializeStatisticsStapleState(nextState) };
    const endpoint = `/rest/v1/decklist_cards?card_code=eq.${encodeURIComponent(code)}`;
    const extraHeaders = { Prefer: 'return=minimal' };
    const response = window.supabaseApi
        ? await window.supabaseApi.patch(endpoint, payload, extraHeaders)
        : await fetch(`${SUPABASE_URL}${endpoint}`, {
              method: 'PATCH',
              headers: { ...headers, ...extraHeaders },
              body: JSON.stringify(payload)
          });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
}

function ensureStatisticsCardPreviewPopover() {
    let popover = document.getElementById('statisticsCardPreviewPopover');
    if (popover) return popover;
    popover = document.createElement('div');
    popover.id = 'statisticsCardPreviewPopover';
    popover.className = 'stats-card-preview-popover';
    popover.innerHTML = '<img alt="Card preview" />';
    document.body.appendChild(popover);
    return popover;
}

function moveCardPreviewPopover(popover, clientX, clientY) {
    if (!popover) return;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = popover.getBoundingClientRect();
    const offset = 14;
    const margin = 8;

    let left = clientX + offset;
    let top = clientY + offset;

    if (left + rect.width + margin > vw) {
        left = clientX - rect.width - offset;
    }
    if (top + rect.height + margin > vh) {
        top = clientY - rect.height - offset;
    }
    left = Math.max(margin, left);
    top = Math.max(margin, top);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

function renderStoreChampionsBoard(host, rows, options = {}) {
    const isMobile = options.isMobile === true;
    const collapsedByDefault = isMobile && options.collapsedByDefault === true;
    const grouped = new Map();
    rows.forEach((row) => {
        const store = String(row?.store || '').trim() || 'Unknown Store';
        if (!grouped.has(store)) grouped.set(store, []);
        grouped.get(store).push(row);
    });

    const board = document.createElement('div');
    board.className = 'store-champions-board';
    if (grouped.size === 1) {
        board.classList.add('is-single-store');
    }

    Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([storeName, storeRows]) => {
            const sorted = [...storeRows].sort((a, b) => {
                const rankDiff = (Number(a.store_rank) || 999) - (Number(b.store_rank) || 999);
                if (rankDiff !== 0) return rankDiff;
                const titleDiff = (Number(b.titles) || 0) - (Number(a.titles) || 0);
                if (titleDiff !== 0) return titleDiff;
                return (Number(b.ranking_points) || 0) - (Number(a.ranking_points) || 0);
            });

            const card = document.createElement('article');
            card.className = 'store-podium-card';
            if (collapsedByDefault) card.classList.add('is-collapsed');

            const iconSrc = resolveStoreIcon(storeName);
            const listHtml = sorted
                .map((item, index) => {
                    const rank = Number(item.store_rank) || index + 1;
                    const medalClass =
                        rank === 1
                            ? 'gold'
                            : rank === 2
                              ? 'silver'
                              : rank === 3
                                ? 'bronze'
                                : 'regular';
                    return `
                        <li class="store-podium-item ${medalClass}">
                            <span class="store-podium-rank">#${rank}</span>
                            <div class="store-podium-main">
                                <strong>${escapeHtml(item.player || '-')}</strong>
                                <small>
                                    Titulos: ${Number(item.titles) || 0}
                                    • Pontos: ${Number(item.ranking_points) || 0}
                                </small>
                            </div>
                        </li>
                    `;
                })
                .join('');

            card.innerHTML = `
                <header class="store-podium-header">
                    <div class="store-podium-title-wrap">
                        <img src="${escapeHtml(iconSrc)}" alt="${escapeHtml(storeName)}" class="store-podium-icon" loading="lazy" />
                        <h3>${escapeHtml(storeName)}</h3>
                    </div>
                    ${
                        isMobile
                            ? `<button type="button" class="store-podium-toggle">${collapsedByDefault ? 'Expandir' : 'Recolher'}</button>`
                            : ''
                    }
                </header>
                <ol class="store-podium-list">
                    ${listHtml || '<li class="store-podium-item regular"><div class="store-podium-main">Sem dados</div></li>'}
                </ol>
            `;

            board.appendChild(card);
        });

    host.appendChild(board);

    board.querySelectorAll('.store-podium-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const card = button.closest('.store-podium-card');
            if (!card) return;
            const nextCollapsed = !card.classList.contains('is-collapsed');
            card.classList.toggle('is-collapsed', nextCollapsed);
            button.textContent = nextCollapsed ? 'Expandir' : 'Recolher';
        });
    });
}

function prettifyStatisticsColumn(column, viewName = '') {
    const normalized = String(column || '').trim().toLowerCase();
    if (viewName === 'v_player_ranking') {
        const playerRankingLabels = {
            player: 'Jogador',
            overall_rank: currentStatisticsMonthFilter ? 'Rank Mensal' : 'Rank Geral',
            titles: 'Títulos',
            top4_total: 'Top4',
            entries: 'Aparições',
            unique_decks_used: 'Decks Únicos',
            title_rate_percent: 'Taxa de Títulos',
            ranking_points: 'Pontuação total',
            points: 'Pontuação total'
        };
        if (playerRankingLabels[normalized]) return playerRankingLabels[normalized];
    }

    const labels = {
        ranking_points: 'Pontuação total',
        points: 'Pontuação total',
        avg_placement: 'Média',
        monthly_rank: 'Rank Mensal',
        overall_rank: 'Rank Geral',
        store_rank: 'Rank Loja',
        performance_rank: 'Rank Performance',
        format_rank: 'Rank',
        card_code: 'Carta',
        card_name: 'Nome',
        card_type: 'Tipo',
        is_staple: 'Staple',
        total: 'Total',
        champion: 'Champion',
        top2: 'Top2',
        top3: 'Top3',
        top4: 'Top4',
        top4_total: 'Top4',
        meta_share_percent: 'Meta Share (%)',
        title_rate_percent: 'Taxa de Títulos (%)',
        unique_players: 'Players Únicos',
        unique_decks_used: 'Decks Únicos',
        tournaments_played: 'Torneios',
        store_title_share_percent: 'Share de Títulos Loja (%)',
        month: 'Mês',
        appearances: 'Aparições',
        entries: 'Aparições',
        titles: 'Títulos'
    };
    if (labels[normalized]) return labels[normalized];
    return String(column || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatisticsHeaderLabel(viewName, column) {
    const normalized = String(column || '').trim().toLowerCase();
    if (viewName === 'v_top_cards_by_month') {
        const topCardsHeaders = {
            month: 'Month',
            monthly_rank: 'Rank',
            card_code: 'Code',
            card_name: 'Name',
            is_staple: 'Staple',
            card_type: 'Type',
            decklists_with_card: 'Decklists',
            total: 'Total',
            total_copies: 'Total',
            champion: 'Champion',
            champion_copies: 'Champion',
            top2: 'Top 2',
            top2_copies: 'Top 2',
            top3: 'Top 3',
            top3_copies: 'Top 3',
            top4: 'Top 4',
            top4_copies: 'Top 4'
        };
        if (topCardsHeaders[normalized]) return topCardsHeaders[normalized];
    }
    return prettifyStatisticsColumn(column, viewName);
}

function getStatisticsDisplayColumns(viewName, columns) {
    let list = Array.isArray(columns) ? [...columns] : [];
    list = list.filter((column) => !STATISTICS_REMOVED_COLUMNS.has(String(column || '').trim()));
    if (viewName === 'v_meta_by_month') {
        list = list.filter((column) => column !== 'meta_share_percent');
    } else if (viewName === 'v_top_cards_by_month') {
        list = list.filter(
            (column) =>
                column !== 'card_level' &&
                column !== 'is_digi_egg' &&
                column !== 'decklists_with_card' &&
                column !== 'total_copies' &&
                column !== 'champion_copies' &&
                column !== 'top2_copies' &&
                column !== 'top3_copies' &&
                column !== 'top4_copies'
        );
    }
    const preferred = STATISTICS_VIEW_COLUMN_ORDER[viewName];
    if (!Array.isArray(preferred) || !preferred.length) return list;

    const ordered = preferred.filter((column) => list.includes(column));
    if (viewName === 'v_player_ranking') {
        return ordered;
    }
    const remaining = list.filter((column) => !ordered.includes(column));
    return [...ordered, ...remaining];
}

function normalizePlayerRankingRows(rows, options = {}) {
    const isMonthly = options?.isMonthly === true;
    const allTimeByPlayer =
        options?.allTimeByPlayer instanceof Map ? options.allTimeByPlayer : new Map();
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => {
        const source = row || {};
        const playerKey = String(source.player || '')
            .trim()
            .toLowerCase();
        const allTimeRow = allTimeByPlayer.get(playerKey) || null;
        const entriesValue = normalizeStatNumber(source.entries);
        const titlesValue = normalizeStatNumber(source.titles);
        const inferredTitleRate =
            Number.isFinite(entriesValue) && entriesValue > 0 && Number.isFinite(titlesValue)
                ? (titlesValue / entriesValue) * 100
                : null;
        const normalized = {
            ...source,
            player: String(source.player || '').trim(),
            overall_rank: normalizeStatNumber(source.overall_rank ?? source.monthly_rank ?? source.rank),
            titles: titlesValue,
            top4_total: normalizeStatNumber(source.top4_total ?? source.top4),
            entries: entriesValue,
            unique_decks_used:
                normalizeStatNumber(source.unique_decks_used) ??
                normalizeStatNumber(allTimeRow?.unique_decks_used),
            title_rate_percent: normalizeStatNumber(source.title_rate_percent) ?? inferredTitleRate,
            ranking_points: normalizeStatNumber(source.ranking_points ?? source.points)
        };

        if (isMonthly) {
            normalized.month = source.month || normalized.month || '';
        }
        return normalized;
    });
}

function normalizeStatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function formatStatisticsCellValue(value, column = '', row = null) {
    const normalizedColumn = String(column || '').toLowerCase();
    if (normalizedColumn === 'is_staple' && row) {
        return renderStatisticsStapleToggle(row, value);
    }

    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return escapeHtml(JSON.stringify(value));

    const text = String(value).trim();
    if (!text) return '-';

    const numeric = Number(text);
    const isNumeric = Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(text);
    const isPercentColumn = normalizedColumn.includes('percent');
    const isAverageColumn = normalizedColumn.includes('avg');
    const isMonthColumn = normalizedColumn === 'month';
    const isTopCardsMetricColumn =
        normalizedColumn === 'total' ||
        normalizedColumn === 'champion' ||
        normalizedColumn === 'top2' ||
        normalizedColumn === 'top3' ||
        normalizedColumn === 'top4';
    const isRankColumn =
        normalizedColumn === 'rank' ||
        normalizedColumn.endsWith('_rank') ||
        normalizedColumn === 'placement' ||
        normalizedColumn.endsWith('_placement');

    if (isMonthColumn) {
        const monthKey = normalizeStatisticsMonthKey(text);
        if (monthKey) return formatStatisticsMonthLabel(monthKey);
    }
    if (isRankColumn && isNumeric) {
        const rank = Math.trunc(numeric);
        const rankClass =
            rank === 1
                ? 'stats-pill-rank-first'
                : rank === 2
                  ? 'stats-pill-rank-second'
                  : rank === 3
                    ? 'stats-pill-rank-third'
                    : rank === 4
                      ? 'stats-pill-rank-fourth'
                      : 'stats-pill-rank-default';
        return `<span class="stats-pill stats-pill-rank ${rankClass}">${formatOrdinal(rank)}</span>`;
    }
    if ((normalizedColumn === 'card_name' || normalizedColumn === 'card_code') && row) {
        const code = normalizeCardCodeForLookup(row?.card_code || '');
        if (code) {
            const display = normalizedColumn === 'card_name' ? text : code;
            return `<span class="stats-card-hover" data-card-preview-code="${escapeHtml(code)}">${escapeHtml(display)}</span>`;
        }
    }
    if (isPercentColumn && isNumeric) {
        return `<span class="stats-pill stats-pill-percent">${numeric.toFixed(2)}%</span>`;
    }
    if (isAverageColumn && isNumeric) {
        return numeric.toFixed(2);
    }
    if (isTopCardsMetricColumn && isNumeric) {
        return String(Math.trunc(numeric));
    }
    if (isNumeric) {
        return numeric.toLocaleString('pt-BR');
    }
    return escapeHtml(text);
}

function renderStatisticsHighlights(host, viewName, rows, columns, options = {}) {
    if (!host || !Array.isArray(rows) || !rows.length || !Array.isArray(columns) || !columns.length) {
        return;
    }
    const tableWrapper = host.querySelector('.statistics-table-wrapper');
    if (!tableWrapper) return;

    const highlights = buildStatisticsHighlights(viewName, rows, columns).slice(0, 4);
    if (!highlights.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'statistics-highlights';
    const highlightCardsHtml = highlights
        .map(
            (item) => `
                <article class="statistics-highlight-card">
                    <span class="statistics-highlight-label">${escapeHtml(item.label)}</span>
                    <strong class="statistics-highlight-value">${escapeHtml(item.value)}</strong>
                </article>
            `
        )
        .join('');
    const monthOptions = getStatisticsMonthOptions(
        options.showInlineMonthSelect ? options.monthValues : [],
        options.selectedMonth || ''
    );
    const monthSelectHtml =
        options.showInlineMonthSelect && monthOptions.length
            ? `
                <article class="statistics-highlight-card is-month-select">
                    <span class="statistics-highlight-label">Seleção de mês</span>
                    <select id="statisticsInlineMonthSelect" class="statistics-inline-month-select" aria-label="Selecionar mês no ranking de players">
                        <option value="">Todos os meses</option>
                        ${monthOptions
                            .map(
                                (item) =>
                                    `<option value="${escapeHtml(item.value)}"${item.selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`
                            )
                            .join('')}
                    </select>
                </article>
            `
            : '';
    wrapper.innerHTML = highlightCardsHtml + monthSelectHtml;

    tableWrapper.insertAdjacentElement('beforebegin', wrapper);

    const inlineMonthSelect = wrapper.querySelector('#statisticsInlineMonthSelect');
    if (inlineMonthSelect) {
        inlineMonthSelect.addEventListener('change', () => {
            currentStatisticsMonthFilter = String(inlineMonthSelect.value || '');
            renderStatisticsTable(statisticsViewData, currentStatisticsView);
        });
    }
}

function buildStatisticsHighlights(viewName, rows, columns) {
    const list = [];
    const hasColumn = (key) => columns.includes(key);
    const valuesFor = (key) => rows.map((row) => row?.[key]);
    const countUnique = (key) =>
        new Set(
            valuesFor(key)
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ).size;
    const sumNumeric = (key) =>
        valuesFor(key).reduce((total, value) => {
            const n = Number(value);
            return Number.isFinite(n) ? total + n : total;
        }, 0);
    const averageNumeric = (key) => {
        const nums = valuesFor(key)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
        if (!nums.length) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    if (viewName === 'v_deck_representation') {
        if (hasColumn('deck')) list.push({ label: 'Decks', value: String(countUnique('deck')) });
        
    } else if (viewName === 'v_deck_stats') {
        if (hasColumn('deck')) list.push({ label: 'Decks', value: String(countUnique('deck')) });
        if (hasColumn('titles')) {
            list.push({ label: 'Torneios', value: sumNumeric('titles').toLocaleString('pt-BR') });
        }
    } else if (viewName === 'v_meta_by_month') {
        if (hasColumn('month')) list.push({ label: 'Meses', value: String(countUnique('month')) });
        if (hasColumn('deck')) list.push({ label: 'Decks', value: String(countUnique('deck')) });
        if (hasColumn('titles')) {
            list.push({ label: 'Torneios', value: sumNumeric('titles').toLocaleString('pt-BR') });
        }
    } else if (viewName === 'v_top_cards_by_month') {
        if (hasColumn('month')) list.push({ label: 'Meses', value: String(countUnique('month')) });
        if (hasColumn('card_code')) list.push({ label: 'Cartas', value: String(countUnique('card_code')) });
        if (hasColumn('total')) {
            list.push({ label: 'Total', value: sumNumeric('total').toLocaleString('pt-BR') });
        }
    } else if (viewName === 'v_player_ranking') {
        if (hasColumn('player')) list.push({ label: 'Players', value: String(countUnique('player')) });
        if (hasColumn('titles')) {
            list.push({ label: 'Torneios', value: sumNumeric('titles').toLocaleString('pt-BR') });
        }
    } else if (viewName === 'v_store_champions') {
        if (hasColumn('player')) list.push({ label: 'Players', value: String(countUnique('player')) });
        if (hasColumn('titles')) {
            list.push({ label: 'Torneios', value: sumNumeric('titles').toLocaleString('pt-BR') });
        }
    } else {
        if (hasColumn('player')) list.push({ label: 'Players', value: String(countUnique('player')) });
        if (hasColumn('deck')) list.push({ label: 'Decks', value: String(countUnique('deck')) });
        if (hasColumn('store')) list.push({ label: 'Lojas', value: String(countUnique('store')) });
        if (hasColumn('month')) list.push({ label: 'Meses', value: String(countUnique('month')) });
    }

    const dedup = [];
    const seen = new Set();
    list.forEach((item) => {
        const key = `${item.label}|${item.value}`;
        if (seen.has(key)) return;
        seen.add(key);
        dedup.push(item);
    });
    return dedup;
}

function getStatisticsColumnDescription(viewName, column) {
    const scoped = STATISTICS_COLUMN_HELP_PTBR[viewName] || {};
    const common = STATISTICS_COLUMN_HELP_PTBR.common || {};
    const message = scoped[column] || common[column];
    if (message) return message;
    return `Indicador: ${prettifyStatisticsColumn(column)}.`;
}

function isInternalStatisticsColumn(column) {
    const normalized = String(column || '').trim().toLowerCase();
    if (!normalized) return true;
    if (STATISTICS_HIDDEN_COLUMNS.has(normalized)) return true;
    if (normalized.endsWith('_id')) return true;
    if (normalized.includes('url')) return true;
    if (normalized.endsWith('_link')) return true;
    if (normalized === 'format_code' || normalized === 'format') return true;
    if (normalized === 'store') return true;
    if (normalized === 'month') return true;
    if (normalized.endsWith('_date') || normalized === 'date') return true;
    return false;
}

function toggleStatisticsSort(column) {
    if (currentStatisticsSort.column === column) {
        currentStatisticsSort.direction = currentStatisticsSort.direction === 'asc' ? 'desc' : 'asc';
        return;
    }
    currentStatisticsSort.column = column;
    currentStatisticsSort.direction = 'asc';
}

function sortStatisticsRows(rows, sortState) {
    const sorted = [...rows];
    const column = String(sortState?.column || '');
    if (!column) return sorted;

    const direction = sortState.direction === 'desc' ? -1 : 1;
    sorted.sort((a, b) => {
        const left = getStatisticsComparableValue(a?.[column]);
        const right = getStatisticsComparableValue(b?.[column]);

        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
        return 0;
    });
    return sorted;
}

function getStatisticsComparableValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
    if (typeof value === 'boolean') return value ? 1 : 0;

    const text = String(value).trim();
    if (!text) return '';

    const numeric = Number(text);
    if (!Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(text)) {
        return numeric;
    }

    const dateValue = Date.parse(text);
    if (!Number.isNaN(dateValue) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
        return dateValue;
    }

    return text.toLowerCase();
}

function updateStatisticsSortIndicators(head) {
    if (!head) return;
    const indicators = head.querySelectorAll('[data-stats-sort-indicator]');
    indicators.forEach((el) => {
        const field = el.dataset.statsSortIndicator;
        if (field === currentStatisticsSort.column) {
            el.textContent = currentStatisticsSort.direction === 'asc' ? '\u25B2' : '\u25BC';
            el.classList.add('is-active');
        } else {
            el.textContent = '\u21C5';
            el.classList.remove('is-active');
        }
    });
}

function populateStatisticsMonthSelect(select, values, selectedValue) {
    const monthKeys = getStatisticsMonthOptions(values, selectedValue).map((item) => item.value);

    select.innerHTML =
        '<option value="">Todos os meses</option>' +
        monthKeys
            .map((monthKey) => `<option value="${monthKey}">${formatStatisticsMonthLabel(monthKey)}</option>`)
            .join('');

    if (selectedValue && monthKeys.includes(selectedValue)) {
        select.value = selectedValue;
    } else {
        select.value = '';
    }
}

function getStatisticsMonthOptions(values, selectedValue) {
    const monthKeys = Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map((value) => normalizeStatisticsMonthKey(value))
                .filter(Boolean)
        )
    ).sort((a, b) => b.localeCompare(a));

    return monthKeys.map((monthKey) => ({
        value: monthKey,
        label: formatStatisticsMonthLabel(monthKey),
        selected: selectedValue === monthKey
    }));
}

function normalizeStatisticsMonthKey(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (!text) return '';

    const fullDateMatch = text.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (fullDateMatch) return `${fullDateMatch[1]}-${fullDateMatch[2]}`;
    const directMonthMatch = text.match(/^(\d{4})-(\d{2})$/);
    if (directMonthMatch) return `${directMonthMatch[1]}-${directMonthMatch[2]}`;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    return '';
}

function formatStatisticsMonthLabel(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return monthKey;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

function filterStoreChampionsRowsByPlayer(rows, query) {
    const text = String(query || '')
        .trim()
        .toLowerCase();
    if (!text) return rows;

    return rows.filter((row) => String(row?.player || '').toLowerCase().includes(text));
}

function populateStatisticsValueSelect(select, values, selectedValue, defaultLabel) {
    const options = Array.from(
        new Set(
            values
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    select.innerHTML =
        `<option value="">${escapeHtml(defaultLabel || 'Todos')}</option>` +
        options.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');

    if (selectedValue && options.includes(selectedValue)) {
        select.value = selectedValue;
    } else {
        select.value = '';
    }
}

function getLatestStatisticsFormat(rows, formatColumn, monthColumn) {
    if (!Array.isArray(rows) || !rows.length || !formatColumn) return '';

    const byFormat = new Map();
    rows.forEach((row) => {
        const formatValue = String(row?.[formatColumn] || '').trim();
        if (!formatValue) return;
        const monthKey = monthColumn ? normalizeStatisticsMonthKey(row?.[monthColumn]) : '';
        const current = byFormat.get(formatValue) || '';
        if (monthKey && (!current || monthKey > current)) {
            byFormat.set(formatValue, monthKey);
            return;
        }
        if (!byFormat.has(formatValue)) {
            byFormat.set(formatValue, current);
        }
    });

    let bestFormat = '';
    let bestMonth = '';
    Array.from(byFormat.entries()).forEach(([formatValue, latestMonth]) => {
        const monthKey = String(latestMonth || '');
        if (monthKey > bestMonth) {
            bestMonth = monthKey;
            bestFormat = formatValue;
            return;
        }
        if (monthKey === bestMonth && formatValue.localeCompare(bestFormat) > 0) {
            bestFormat = formatValue;
        }
    });

    return bestFormat;
}

function normalizeStatisticsDateKey(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (!text) return '';
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return '';
}

function populateStatisticsDateSelect(select, values, selectedValue) {
    const dateKeys = Array.from(
        new Set(values.map((value) => normalizeStatisticsDateKey(value)).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));

    select.innerHTML =
        '<option value="">Todas as datas</option>' +
        dateKeys
            .map((key) => `<option value="${key}">${formatDate(key)}</option>`)
            .join('');

    if (selectedValue && dateKeys.includes(selectedValue)) {
        select.value = selectedValue;
    } else {
        select.value = '';
    }
}

function isStatisticsMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function getStatisticsFormulaHintHtml(viewName) {
    const shouldShowPointsLegend =
        viewName === 'v_deck_stats' ||
        viewName === 'v_player_ranking' ||
        viewName === 'v_store_champions' ||
        viewName === 'v_meta_by_month';
    if (!shouldShowPointsLegend) return '';

    return `
        <div class="statistics-points-legend" aria-label="Sistema de pontuação">
            <span class="points-pill gold">1º +15pts</span>
            <span class="points-pill silver">2º +10pts</span>
            <span class="points-pill bronze">3º +7pts</span>
            <span class="points-pill top4">4º +5pts</span>
        </div>
    `;
}

function handleStatisticsViewportChange() {
    if (!statisticsViewMounted) return;
    if (currentDashboardView !== 'statistics') return;
    if (currentStatisticsView !== 'v_store_champions') return;
    renderStatisticsTable(statisticsViewData, currentStatisticsView);
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

    const fallbackTournament = {
        id: eventData.id || '',
        store_id: eventData.storeId || '',
        tournament_date: eventData.tournamentDate || '',
        tournament_name: eventData.tournamentName || 'Tournament',
        total_players: eventData.totalPlayers || '',
        format_id: eventData.formatId || null,
        format: eventData.format || eventData.formatCode || '',
        store: { name: eventData.storeName || 'Store' }
    };
    const matchedTournament = tournaments.find(
        (item) => String(item?.id || '') === String(eventData.id || '')
    );
    renderTournamentDetails(matchedTournament || fallbackTournament, container);
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
        : getTodayInSaoPaulo();
    document.getElementById('createTournamentDate').value = safeDate;
    document.getElementById('createTournamentName').value = '';
    document.getElementById('createTotalPlayers').value = '';
    document.getElementById('createInstagramLink').value = '';

    createResults = [];
    resetCreateOcrImportUi();

    // Carrega dados base para o modal
    try {
        await Promise.all([
            loadStoresToCreate(),
            loadPlayersToCreate(),
            loadDecksToCreate(),
            loadTournamentFormats()
        ]);
        populateTournamentFormatSelect('createTournamentFormat');
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
    resetCreateOcrImportUi();
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
        next.push(
            createResults[i] || {
                player_id: '',
                deck_id: '',
                player_name: '',
                deck_name: '',
                ocr_player_unmatched: false
            }
        );
    }
    createResults = next;
    renderCreateResultsRows();
}

function setCreateOcrStatus(message, tone = 'info') {
    const el = document.getElementById('createOcrStatus');
    if (!el) return;
    const prefix = tone === 'error' ? 'Erro: ' : tone === 'success' ? 'OK: ' : '';
    el.textContent = `${prefix}${message}`.trim();
}

function setCreateOcrSelectedInfo(message) {
    const el = document.getElementById('createOcrSelectedInfo');
    if (!el) return;
    el.textContent = message || '';
}

function resetCreateOcrImportUi() {
    createOcrImportInProgress = false;
    createOcrSelectedFiles = [];
    const input = document.getElementById('createOcrFilesInput');
    const btnSelect = document.getElementById('btnSelectOcrPrints');
    const btnProcess = document.getElementById('btnProcessOcrPrints');
    if (input) input.value = '';
    if (btnSelect) btnSelect.disabled = false;
    if (btnProcess) btnProcess.disabled = false;
    setCreateOcrSelectedInfo('');
    setCreateOcrStatus('');
}

function normalizeLookupName(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeMemberId(value) {
    return String(value || '')
        .toUpperCase()
        .replace(/\s+/g, '');
}

function isGuestMemberId(value) {
    const memberId = normalizeMemberId(value);
    return !memberId || /^GUEST/i.test(memberId);
}

function parseOcrRank(value, index) {
    const rank = Number(value);
    if (Number.isFinite(rank) && rank > 0) return rank;
    return index + 1;
}

function extractOcrPlayers(payload) {
    const players = Array.isArray(payload?.players) ? payload.players : [];
    return players
        .map((item, index) => ({
            rank: parseOcrRank(item?.rank, index),
            name: String(item?.name || '').trim(),
            member_id: normalizeMemberId(item?.member_id),
            points: String(item?.points || '').trim(),
            omw: String(item?.omw || '').trim()
        }))
        .filter((item) => item.name || item.member_id)
        .slice(0, 100);
}

function mergeOcrPlayersByMemberId(allPlayers) {
    const merged = new Map();
    allPlayers.forEach((item, index) => {
        const key = item.member_id || `NO_ID_${index}`;
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, { ...item });
            return;
        }
        if (item.rank < existing.rank) existing.rank = item.rank;
        if (!existing.name && item.name) existing.name = item.name;
        if (!existing.points && item.points) existing.points = item.points;
        if (!existing.omw && item.omw) existing.omw = item.omw;
    });
    return Array.from(merged.values())
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 36);
}

function findPlayerMatchFromOcr(ocrPlayer) {
    const ocrMemberId = normalizeMemberId(ocrPlayer.member_id);
    const ocrName = normalizeLookupName(ocrPlayer.name);

    if (ocrMemberId && !isGuestMemberId(ocrMemberId)) {
        const byBandaiId = createPlayers.find(
            (player) => normalizeMemberId(player.bandai_id) === ocrMemberId
        );
        if (byBandaiId?.id) {
            return byBandaiId;
        }
    }

    if (ocrName) {
        const byBandaiNick = createPlayers.find(
            (player) => normalizeLookupName(player.bandai_nick) === ocrName
        );
        if (byBandaiNick?.id) {
            return byBandaiNick;
        }

        const byName = createPlayers.find((player) => normalizeLookupName(player.name) === ocrName);
        if (byName?.id) {
            return byName;
        }
    }

    return null;
}

function extractOcrStoreAndDate(payload) {
    const storeName = String(
        payload?.store_name || payload?.store || payload?.shop || payload?.venue || ''
    ).trim();
    const dateRaw = String(
        payload?.tournament_date || payload?.event_date || payload?.tournament_datetime || payload?.date || ''
    ).trim();
    return {
        storeName,
        tournamentDate: normalizeOcrTournamentDate(dateRaw)
    };
}

function normalizeOcrTournamentDate(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const normalized = raw
        .replace(/~/g, '')
        .replace(/^\w{3}\.\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const monthMap = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12
    };

    const enMonthMatch = normalized.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (enMonthMatch) {
        const month = monthMap[String(enMonthMatch[1]).toLowerCase()];
        const day = Number(enMonthMatch[2]);
        const year = Number(enMonthMatch[3]);
        if (month && day >= 1 && day <= 31 && year >= 2000) {
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            return `${year}-${mm}-${dd}`;
        }
    }

    const brMatch = normalized.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (brMatch) {
        const day = Number(brMatch[1]);
        const month = Number(brMatch[2]);
        const year = Number(brMatch[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            return `${year}-${mm}-${dd}`;
        }
    }

    return '';
}

function resolveStoreFromOcrName(storeName) {
    const target = normalizeLookupName(storeName);
    if (!target || !createStores.length) return null;

    const getAliases = (store) =>
        [store?.name, store?.bandai_nick, store?.store_nick, store?.nick, store?.alias]
            .map((value) => normalizeLookupName(value))
            .filter(Boolean);

    const exact = createStores.find((store) => getAliases(store).some((alias) => alias === target));
    if (exact) return exact;

    const includes = createStores.find((store) =>
        getAliases(store).some((alias) => alias.includes(target) || target.includes(alias))
    );
    return includes || null;
}

function onCreateOcrFilesSelected(event) {
    const files = Array.from(event.target?.files || []);
    createOcrSelectedFiles = files;
    if (files.length === 0) {
        setCreateOcrSelectedInfo('');
        setCreateOcrStatus('');
        return;
    }
    setCreateOcrSelectedInfo(`${files.length} print(s) selecionado(s).`);
    setCreateOcrStatus('Processando...');
    processCreateOcrFiles();
}

async function requestOcrFromImage(file) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const res = await fetch(`${OCR_API_BASE_URL}/process`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) {
        throw new Error(`OCR endpoint respondeu ${res.status}`);
    }
    return res.json();
}

async function processCreateOcrFiles() {
    if (!createOcrSelectedFiles.length) {
        setCreateOcrStatus('Selecione ao menos um print antes de processar.', 'error');
        return;
    }
    if (createOcrImportInProgress) return;
    createOcrImportInProgress = true;

    const btnSelect = document.getElementById('btnSelectOcrPrints');
    const btnProcess = document.getElementById('btnProcessOcrPrints');
    if (btnSelect) btnSelect.disabled = true;
    if (btnProcess) btnProcess.disabled = true;
    setCreateOcrStatus(`Processando ${createOcrSelectedFiles.length} print(s)...`);

    try {
        if (!createPlayers.length) {
            await loadPlayersToCreate();
        }
        if (!createStores.length) {
            await loadStoresToCreate();
        }

        const allPlayers = [];
        const detectedStores = [];
        const detectedDates = [];
        for (const file of createOcrSelectedFiles) {
            const payload = await requestOcrFromImage(file);
            allPlayers.push(...extractOcrPlayers(payload));
            const meta = extractOcrStoreAndDate(payload);
            if (meta.storeName) detectedStores.push(meta.storeName);
            if (meta.tournamentDate) detectedDates.push(meta.tournamentDate);
        }

        const mergedPlayers = mergeOcrPlayersByMemberId(allPlayers);
        if (!mergedPlayers.length) {
            throw new Error('Nenhum resultado reconhecido na imagem');
        }

        createResults = mergedPlayers.map((ocrPlayer) => {
            const matchedPlayer = findPlayerMatchFromOcr(ocrPlayer);
            return {
                player_id: matchedPlayer?.id || '',
                deck_id: '',
                player_name: ocrPlayer.name || '',
                deck_name: '',
                ocr_player_unmatched: !matchedPlayer?.id
            };
        });

        renderCreateResultsRows();
        document.getElementById('createTotalPlayers').value = String(createResults.length);

        const selectedStoreName = detectedStores[0] || '';
        const selectedDate = detectedDates[0] || '';
        if (selectedStoreName) {
            const matchedStore = resolveStoreFromOcrName(selectedStoreName);
            if (matchedStore?.id) {
                document.getElementById('createStoreSelect').value = String(matchedStore.id);
            }
        }
        if (selectedDate) {
            document.getElementById('createTournamentDate').value = selectedDate;
        }

        const unresolvedPlayers = createResults.filter((row) => !row.player_id).length;
        const unresolvedStore = selectedStoreName
            ? !resolveStoreFromOcrName(selectedStoreName)
            : false;
        const dateDetected = Boolean(selectedDate);
        if (unresolvedPlayers) {
            setCreateOcrStatus(
                `OCR: ${createResults.length} players, ${unresolvedPlayers} sem match${unresolvedStore ? ', loja sem match' : ''}${dateDetected ? ', data preenchida' : ''}.`,
                'info'
            );
        } else {
            setCreateOcrStatus(
                `OCR concluido (${createResults.length} players)${selectedStoreName ? ', loja preenchida' : ''}${dateDetected ? ', data preenchida' : ''}.`,
                'success'
            );
        }
    } catch (err) {
        console.error('Erro no OCR:', err);
        setCreateOcrStatus(err.message || 'Falha ao processar OCR.', 'error');
    } finally {
        createOcrImportInProgress = false;
        if (btnSelect) btnSelect.disabled = false;
        if (btnProcess) btnProcess.disabled = false;
    }
}

async function loadStoresToCreate() {
    try {
        let res = await fetch(
            `${SUPABASE_URL}/rest/v1/stores?select=id,name,bandai_nick&order=name.asc`,
            { headers }
        );
        if (!res.ok) {
            res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=id,name&order=name.asc`, {
                headers
            });
        }
        if (!res.ok) throw new Error('Erro ao carregar lojas');

        const stores = await res.json();
        createStores = stores || [];
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
        const clamp = (value, min, max, fallback) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return fallback;
            return Math.max(min, Math.min(max, numeric));
        };
        const safeX = clamp(saved?.x ?? slice.dataset.x ?? 50, 0, 100, 50);
        const safeY = clamp(saved?.y ?? slice.dataset.y ?? 13, 0, 100, 13);
        const minZoom = clamp(slice.dataset.minZoom || 120, 80, 420, 120);
        const maxZoom = clamp(slice.dataset.maxZoom || 420, minZoom, 500, 420);
        const safeZoom = clamp(saved?.zoom ?? slice.dataset.zoom ?? 195, minZoom, maxZoom, 195);

        slice.dataset.x = String(safeX);
        slice.dataset.y = String(safeY);
        slice.dataset.zoom = String(safeZoom);
        slice.style.backgroundPosition = `${safeX}% ${safeY}%`;
        slice.style.backgroundSize = `${safeZoom}%`;

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
        const formatCode = getTournamentFormatCode(tournament);
        const header = `
            <div class="tournament-details-header">
                <div class="details-header-top">
                    <div class="details-header-meta">
                        <strong>${tournament.tournament_name || 'Tournament'}</strong>
                        <div>${formatDate(tournament.tournament_date)} - ${tournament.store?.name || 'Store'}</div>
                        <div>Total Players: ${totalPlayers}</div>
                        <div>Format: ${formatCode || '-'}</div>
                    </div>
                    <button type="button" class="btn-create-filter details-generate-post-btn" data-action="generate-post-details" aria-label="Generate post">
                        <svg class="btn-create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                            <circle cx="9" cy="10" r="1.7"></circle>
                            <path d="M4 17l5-4 3.2 2.6 3.8-3.6 4 5"></path>
                        </svg>
                        <span>Generate Post</span>
                    </button>
                </div>
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
                    (item) => {
                        const payload = encodeURIComponent(
                            JSON.stringify({
                                resultId: item.id || '',
                                deck: item.deck || '',
                                player: item.player || '',
                                code: extractDeckCodeFromImageUrl(item.image_url || ''),
                                store: tournament.store?.name || '',
                                date: tournament.tournament_date || '',
                                format: getTournamentFormatCode(tournament) || '',
                                tournamentName: tournament.tournament_name || ''
                            })
                        );
                        return `
                <div
                    class="results-mini-item with-action ${fullResultsPlacementClass(Number(item.placement))}"
                    data-action="open-decklist-builder"
                    data-decklist-payload="${payload}"
                    role="button"
                    tabindex="0"
                    aria-label="Open decklist builder for ${escapeHtml(item.deck || 'Deck')}"
                    title="Open decklist builder"
                >
                    <div class="results-mini-rank">${formatOrdinal(item.placement)}</div>
                    <div class="results-mini-main">
                        <strong>${item.deck || '-'}</strong>
                        <span>${item.player || '-'}</span>
                    </div>
                </div>
            `;
                    }
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
        const btnGeneratePost = content.querySelector('[data-action="generate-post-details"]');
        if (btnGeneratePost) {
            btnGeneratePost.addEventListener('click', () => {
                openPostGeneratorWithTournamentData(tournament, results, totalPlayers);
            });
        }
        content.querySelectorAll('.results-mini-item.with-action[data-action="open-decklist-builder"]').forEach((row) => {
            const openDecklistBuilder = () => {
                const rawPayload = row.getAttribute('data-decklist-payload') || '';
                let payload;
                try {
                    payload = JSON.parse(decodeURIComponent(rawPayload));
                } catch {
                    return;
                }

                const params = new URLSearchParams();
                if (payload.deck) params.set('deck', payload.deck);
                if (payload.player) params.set('player', payload.player);
                if (payload.code) params.set('code', payload.code);
                if (payload.store) params.set('store', payload.store);
                if (payload.date) params.set('date', payload.date);
                if (payload.format) params.set('format', payload.format);
                if (payload.tournamentName) params.set('tournamentName', payload.tournamentName);
                if (payload.resultId) params.set('resultId', payload.resultId);

                window.location.href = `${getAssetPrefix()}torneios/decklist-builder/index.html?${params.toString()}`;
            };

            row.addEventListener('click', openDecklistBuilder);
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDecklistBuilder();
                }
            });
        });
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
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/players?select=id,name,bandai_id,bandai_nick&order=name.asc`,
        {
            headers
        }
    );
    if (!res.ok) throw new Error('Erro ao carregar players');
    createPlayers = (await res.json()).map((player) => ({
        ...player,
        bandai_id: player.bandai_id || '',
        bandai_nick: player.bandai_nick || ''
    }));
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

    createResults.push({
        player_id: '',
        deck_id: '',
        player_name: '',
        deck_name: '',
        ocr_player_unmatched: false
    });
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

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[char] || char;
    });
}

function getItemNameById(items, id) {
    const match = items.find((item) => String(item.id) === String(id));
    return match?.name || '';
}

function bindCreateResultsAutocomplete() {
    const wrappers = document.querySelectorAll('#createResultsRows .autocomplete-wrapper');
    wrappers.forEach((wrapper) => {
        const input = wrapper.querySelector('input[data-autocomplete-type]');
        const dropdown = wrapper.querySelector('.autocomplete-dropdown');
        if (!input || !dropdown) return;

        const rowIndex = Number(wrapper.dataset.rowIndex);
        const type = input.dataset.autocompleteType;
        const field = type === 'player' ? 'player_id' : 'deck_id';
        const source = type === 'player' ? createPlayers : createDecks;

        const renderOptions = (query) => {
            const value = (query || '').trim().toLowerCase();
            const filtered = source
                .filter((item) => item.name.toLowerCase().includes(value))
                .slice(0, 8);

            if (filtered.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-item no-match">Nao encontrado</div>';
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = filtered
                .map(
                    (item) =>
                        `<div class="autocomplete-item" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>`
                )
                .join('');
            dropdown.style.display = 'block';
        };

        input.addEventListener('input', () => {
            updateCreateResultField(rowIndex, field, '');
            updateCreateResultField(rowIndex, `${type}_name`, input.value.trim());
            if (type === 'player') {
                updateCreateResultField(rowIndex, 'ocr_player_unmatched', Boolean(input.value.trim()));
            }
            renderOptions(input.value);
        });

        input.addEventListener('focus', () => {
            renderOptions(input.value);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 120);
        });

        dropdown.addEventListener('mousedown', (event) => {
            const option = event.target.closest('.autocomplete-item');
            if (!option || option.classList.contains('no-match')) return;
            event.preventDefault();
            updateCreateResultField(rowIndex, field, option.dataset.id || '');
            updateCreateResultField(rowIndex, `${type}_name`, option.dataset.name || '');
            if (type === 'player') {
                updateCreateResultField(rowIndex, 'ocr_player_unmatched', false);
            }
            input.value = option.dataset.name || '';
            dropdown.style.display = 'none';
        });
    });
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
                <label>Place</label>
                <input type="number" value="${index + 1}" disabled>
            </div>
            <div class="form-group">
                <label>Player<span class="required">*</span></label>
                <div class="autocomplete-wrapper" data-row-index="${index}">
                    <input
                        type="text"
                        class="player-input${row.ocr_player_unmatched ? ' ocr-player-unmatched' : ''}"
                        data-autocomplete-type="player"
                        placeholder="Digite o player..."
                        value="${escapeHtml(getItemNameById(createPlayers, row.player_id) || row.player_name || '')}"
                        ${row.ocr_player_unmatched ? 'style="border-color:#f59e0b;background:#fff7ed;" title="Player nao encontrado no cadastro"' : ''}
                        autocomplete="off"
                        required
                    >
                    <div class="autocomplete-dropdown"></div>
                </div>
            </div>
            <div class="form-group">
                <label>Deck<span class="required">*</span></label>
                <div class="autocomplete-wrapper" data-row-index="${index}">
                    <input
                        type="text"
                        class="deck-input"
                        data-autocomplete-type="deck"
                        placeholder="Digite o deck..."
                        value="${escapeHtml(getItemNameById(createDecks, row.deck_id) || row.deck_name || '')}"
                        autocomplete="off"
                        required
                    >
                    <div class="autocomplete-dropdown"></div>
                </div>
            </div>
            <button type="button" class="btn-remove-result" data-create-remove-index="${index}" aria-label="Remove result" title="Remove result">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M3 6h18"></path>
                    <path d="M8 6V4h8v2"></path>
                    <path d="M7 6l1 14h8l1-14"></path>
                    <path d="M10 10v7"></path>
                    <path d="M14 10v7"></path>
                </svg>
            </button>
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
    bindCreateResultsAutocomplete();

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
        const payloadBase = {
            store_id: document.getElementById('createStoreSelect').value,
            tournament_date: document.getElementById('createTournamentDate').value,
            tournament_name: document.getElementById('createTournamentName').value,
            total_players: totalPlayers,
            instagram_link: document.getElementById('createInstagramLink').value.trim()
        };
        const payload = assignTournamentFormat(
            payloadBase,
            readTournamentFormatValue('createTournamentFormat')
        );

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

