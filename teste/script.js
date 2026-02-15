const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
      };

let currentStore = '';
let currentDate = '';
let tournamentDataForCanvas = null;
let selectedBackgroundPath = '';

const TOP_LEFT_LOGO_CANDIDATES = ['../icons/digimon-card-game.png', '../icons/logo.png'];
const TROPHY_ICON_CANDIDATES = [
    '../icons/Postagem.svg'
];
const TROPHY_SVG_BASE_COLOR = '#50c89f';
const PLACEMENT_STYLES = {
    1: { border: '#c99a2e', medal: '#f1c451', dark: '#8f6100' },
    2: { border: '#9497a1', medal: '#c2c4ca', dark: '#616a79' },
    3: { border: '#a85d2f', medal: '#d88b44', dark: '#6f3417' },
    4: { border: '#4dbf9f', medal: '#59d1af', dark: '#1f6f62' }
};
const trophySvgTemplateCache = new Map();
const trophyTintedIconCache = new Map();
const POST_LAYOUT_STORAGE_KEY = 'digistats.post-layout.v1';
const TEMPLATE_EDITOR_STATE_KEY = 'digistats.template-editor.state.v1';
const TEMPLATE_EDITOR_UPDATED_KEY = 'digistats.template-editor.updated.v1';
const POST_PREVIEW_STATE_KEY = 'digistats.post-preview.state.v1';
const POST_PRESETS_STORAGE_KEY = 'digistats.post-layout-presets.v1';
const CUSTOM_BACKGROUNDS_STORAGE_KEY = 'digistats.custom-backgrounds.v1';
const POST_TYPE_STORAGE_KEY = 'digistats.post-type.v1';
const POST_TYPE_OPTIONS = ['top4', 'distribution_results', 'blank_middle'];
const FORMAT_BG_BUCKET = 'post-backgrounds';
let formatBackgroundMapPromise = null;
let selectedPostType = loadSelectedPostType();

function loadSelectedPostType() {
    try {
        const raw = localStorage.getItem(POST_TYPE_STORAGE_KEY);
        return POST_TYPE_OPTIONS.includes(raw) ? raw : 'top4';
    } catch (_) {
        return 'top4';
    }
}

function saveSelectedPostType() {
    try {
        localStorage.setItem(POST_TYPE_STORAGE_KEY, selectedPostType);
    } catch (_) {
        // Ignore storage failures.
    }
}

function buildPublicBucketObjectUrl(bucketName, objectPath) {
    const cleanPath = String(objectPath || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return '';
    return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanPath}`;
}

const DEFAULT_BACKGROUND_OPTIONS = [
    { label: 'None', value: '' },
    { label: 'EX11', value: buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, 'EX11.png') },
    { label: 'BT23', value: buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, 'BT23.png') },
    { label: 'BT24', value: buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, 'BT24.png') }
];
const INSTAGRAM_DEFAULT_LAYOUT = {
    logo: { x: 80, y: 74, w: 540, h: 198 },
    title: { x: 634, y: 82, w: 338, h: 182, titleOffsetY: 82, dateOffsetY: 136, dateMaxWidth: 302 },
    rows: { x: 92, startY: 280, w: 896, rowHeight: 178, rowGap: 24 },
    rowBorder: { x: 92, startY: 280, w: 896, rowHeight: 178, rowGap: 24 },
    rowElements: {
        trophy: { x: 74, y: 91, w: 156, h: 156, gap: 24 },
        podiumNumber: { offsetX: 0, offsetY: -8, size: 52 },
        avatar: {
            xFromRight: 88,
            yOffset: 0,
            outerRadius: 86,
            imageRadius: 78,
            whiteRingWidth: 0,
            borderRingWidth: 4,
            gap: 24
        },
        text: { leftPadding: 190, rightPadding: 96, playerY: 62, deckY: 116, gap: 24 }
    },
    store: { x: 96, y: 1162, w: 330, h: 122 },
    handle: { x: 988, y: 1234 },
    typography: { titleSize: 72, dateSize: 72, playerSize: 54, deckSize: 62, handleSize: 46 }
};
const DEFAULT_POST_LAYOUT = INSTAGRAM_DEFAULT_LAYOUT;
const BUILT_IN_PRESETS = {
    Instagram: {
        layout: INSTAGRAM_DEFAULT_LAYOUT,
        builtIn: true
    }
};
let postLayout = loadPostLayout();
let isPostTemplateEditorActive = false;
let postEditorDragState = null;
let postEditorGuides = [];
const EDITOR_SNAP_DISTANCE = 12;
let activeTemplateHandleKey = 'logo';

function formatPlacementLabel(value) {
    const n = Number(value);
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    if (n === 4) return '4th';
    return `${n}th`;
}

document.addEventListener('DOMContentLoaded', async () => {
    clearDisplay();
    await loadStores();
    setupEventListeners();
    setupModalActionButtons();
    setupTypographyControls();
    setupPodiumGapControl();
    setupTemplateObjectControls();
    setupTemplateKeyboardControls();
    setupTemplateSyncListeners();
    setupPresetControls();
    setupPostTypeControls();
    bootTemplateEditorPageIfNeeded();
    bootPostPreviewPageIfNeeded();
});

function setupEventListeners() {
    const storeFilter = document.getElementById('storeFilter');
    const dateFilter = document.getElementById('dateFilter');
    const backgroundSelects = ['postBackgroundSelect', 'templateBackgroundSelect']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    const backgroundUploads = ['postBackgroundUpload', 'templateBackgroundUpload']
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    initializeBackgroundSelector();

    storeFilter.addEventListener('change', async (e) => {
        currentStore = e.target.value;
        if (currentStore) {
            await loadDatesForStore(currentStore);
            dateFilter.disabled = false;
        } else {
            dateFilter.disabled = true;
            dateFilter.innerHTML = '<option value="">Select a date...</option>';
            clearDisplay();
        }
    });

    dateFilter.addEventListener('change', async (e) => {
        currentDate = e.target.value;
        if (currentDate) {
            await displayTournament();
        } else {
            clearDisplay();
        }
    });

    backgroundSelects.forEach((select) => {
        select.addEventListener('change', (event) => {
            selectedBackgroundPath = event.target.value || '';
            syncBackgroundSelectors();
            if (tournamentDataForCanvas) drawPostCanvas();
        });
    });

    backgroundUploads.forEach((input) => {
        input.addEventListener('change', onCustomBackgroundUpload);
    });
}

function isTopFourPostType() {
    return selectedPostType === 'top4';
}

function syncPostTypeSelector() {
    const select = document.getElementById('postTypeSelect');
    if (!select) return;
    if (POST_TYPE_OPTIONS.includes(selectedPostType)) {
        select.value = selectedPostType;
    } else {
        select.value = 'top4';
    }
}

function setupPostTypeControls() {
    const select = document.getElementById('postTypeSelect');
    if (!select) return;
    syncPostTypeSelector();
    select.addEventListener('change', () => {
        selectedPostType = POST_TYPE_OPTIONS.includes(select.value) ? select.value : 'top4';
        saveSelectedPostType();
        if (!isTopFourPostType() && isPostTemplateEditorActive) {
            setPostTemplateEditorActive(false);
        }
        updateTemplateEditorButtons();
        if (tournamentDataForCanvas) {
            void drawPostCanvas();
        }
    });
}

function getCustomBackgrounds() {
    try {
        const raw = localStorage.getItem(CUSTOM_BACKGROUNDS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function saveCustomBackgrounds(list) {
    try {
        localStorage.setItem(CUSTOM_BACKGROUNDS_STORAGE_KEY, JSON.stringify(list));
    } catch (_) {
        // Ignore storage failures.
    }
}

function initializeBackgroundSelector(selectedValue) {
    const custom = getCustomBackgrounds();
    const options = [...DEFAULT_BACKGROUND_OPTIONS, ...custom];
    if (
        selectedValue &&
        !options.some((opt) => String(opt.value || '') === String(selectedValue))
    ) {
        options.push({ label: 'Format Background', value: selectedValue });
    }
    const selects = ['postBackgroundSelect', 'templateBackgroundSelect']
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    selects.forEach((select) => {
        select.innerHTML = '';
        options.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
    });

    const nextValue =
        selectedValue !== undefined
            ? selectedValue
            : options.some((o) => o.value === selectedBackgroundPath)
              ? selectedBackgroundPath
              : DEFAULT_BACKGROUND_OPTIONS[1].value;
    selectedBackgroundPath = nextValue;
    syncBackgroundSelectors();
}

function syncBackgroundSelectors() {
    ['postBackgroundSelect', 'templateBackgroundSelect'].forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        if ([...select.options].some((opt) => opt.value === selectedBackgroundPath)) {
            select.value = selectedBackgroundPath;
        }
    });
}

async function uploadBackgroundAsFormat(file) {
    const defaultCode = normalizeFormatCode(file.name.replace(/\.[^.]+$/, ''));
    const rawCode = window.prompt('Format code (ex: EX12):', defaultCode || '');
    if (!rawCode) return null;

    const formatCode = normalizeFormatCode(rawCode);
    if (!formatCode) {
        alert('Invalid format code.');
        return null;
    }

    const rawName = window.prompt('Format name (optional):', formatCode);
    if (rawName === null) return null;
    const formatName = String(rawName || '').trim() || formatCode;

    const extMatch = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = extMatch?.[1] || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png';
    const objectPath = `${formatCode}.${safeExt}`;

    const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${FORMAT_BG_BUCKET}/${encodeURIComponent(objectPath)}`,
        {
            method: 'POST',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': file.type || `image/${safeExt}`,
                'x-upsert': 'true'
            },
            body: file
        }
    );

    if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Storage upload failed (${uploadRes.status}): ${errorText}`);
    }

    const formatPayload = [
        {
            code: formatCode,
            name: formatName,
            background_path: objectPath,
            is_active: true
        }
    ];
    const formatRes = await fetch(`${SUPABASE_URL}/rest/v1/formats?on_conflict=code`, {
        method: 'POST',
        headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(formatPayload)
    });

    if (!formatRes.ok) {
        const errorText = await formatRes.text();
        throw new Error(`Formats upsert failed (${formatRes.status}): ${errorText}`);
    }

    return {
        code: formatCode,
        name: formatName,
        backgroundUrl: buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, objectPath)
    };
}

async function onCustomBackgroundUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const createdFormat = await uploadBackgroundAsFormat(file);
        if (!createdFormat) return;

        formatBackgroundMapPromise = null;
        selectedBackgroundPath = createdFormat.backgroundUrl;

        const custom = getCustomBackgrounds();
        const deduped = custom.filter(
            (item) =>
                String(item?.value || '') !== createdFormat.backgroundUrl &&
                String(item?.label || '').toUpperCase() !== createdFormat.code
        );
        deduped.push({ label: createdFormat.code, value: createdFormat.backgroundUrl });
        saveCustomBackgrounds(deduped.slice(-20));

        initializeBackgroundSelector(createdFormat.backgroundUrl);
        if (tournamentDataForCanvas) {
            tournamentDataForCanvas.format = createdFormat.code;
            await drawPostCanvas();
        }
    } catch (error) {
        console.error(error);
        alert('Failed to upload background to Supabase or create format.');
    }

    event.target.value = '';
}

function normalizeFormatCode(value) {
    const raw = String(value || '')
        .trim()
        .toUpperCase();
    if (!raw) return '';

    const explicitCode = raw.match(/[A-Z]{1,4}\d{1,3}/);
    if (explicitCode?.[0]) return explicitCode[0];

    return raw
        .split(/[\/|,-]/)[0]
        .trim()
        .replace(/[^A-Z0-9]/g, '');
}

function normalizeFormatMapKey(value) {
    return normalizeFormatCode(value).replace(/[^A-Z0-9]/g, '');
}

function getFormatFallbackBackgroundUrl(formatCode) {
    if (!formatCode) return '';
    return buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, `${formatCode}.png`);
}

function resolveFormatBackgroundUrl(formatCode, formatBackgroundState) {
    const normalizedCode = normalizeFormatCode(formatCode);
    if (!normalizedCode) {
        return String(formatBackgroundState?.defaultUrl || '');
    }

    const normalizedMapKey = normalizeFormatMapKey(normalizedCode);
    const map = formatBackgroundState?.byCode || {};
    const mapped =
        map[normalizedCode] ||
        map[normalizedMapKey] ||
        map[normalizeFormatCode(normalizedCode.replace(/\s+/g, ''))] ||
        null;
    if (mapped) return mapped;

    return getFormatFallbackBackgroundUrl(normalizedCode);
}

async function loadFormatBackgroundMap() {
    if (formatBackgroundMapPromise) return formatBackgroundMapPromise;

    formatBackgroundMapPromise = (async () => {
        try {
            const query =
                '/rest/v1/formats?select=code,background_path,background_url,is_active,is_default';
            const res = window.supabaseApi
                ? await window.supabaseApi.get(query)
                : await fetch(`${SUPABASE_URL}${query}`, { headers });

            if (!res.ok) return { byCode: {}, defaultUrl: '' };

            const rows = await res.json();
            if (!Array.isArray(rows)) return { byCode: {}, defaultUrl: '' };

            const byCode = {};
            let defaultUrl = '';
            rows.forEach((row) => {
                if (!row?.code || row?.is_active === false) return;
                const backgroundUrl = String(row.background_url || '').trim();
                const backgroundPath = String(row.background_path || '').trim();
                const resolvedUrl =
                    backgroundUrl || buildPublicBucketObjectUrl(FORMAT_BG_BUCKET, backgroundPath);
                if (!resolvedUrl) return;

                const code = normalizeFormatCode(row.code);
                byCode[code] = resolvedUrl;
                byCode[normalizeFormatMapKey(code)] = resolvedUrl;
                if (row?.is_default === true) {
                    defaultUrl = resolvedUrl;
                }
            });

            return { byCode, defaultUrl };
        } catch (_) {
            return { byCode: {}, defaultUrl: '' };
        }
    })();

    return formatBackgroundMapPromise;
}

async function syncBackgroundWithTournamentFormat(data) {
    const formatCode = normalizeFormatCode(data?.format);
    const formatBackgroundState = await loadFormatBackgroundMap();
    const backgroundUrl = resolveFormatBackgroundUrl(formatCode, formatBackgroundState);
    if (!backgroundUrl) return;

    selectedBackgroundPath = backgroundUrl;
    initializeBackgroundSelector(backgroundUrl);
    if (tournamentDataForCanvas) {
        await drawPostCanvas();
    }
}

async function loadStores() {
    try {
        showLoading(true);
        const res = window.supabaseApi
            ? await window.supabaseApi.get('/rest/v1/stores?select=*')
            : await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*`, {
                  headers,
                  method: 'GET'
              });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const stores = await res.json();
        const select = document.getElementById('storeFilter');

        select.innerHTML = '<option value="">Select store...</option>';
        stores
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((s) => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                select.appendChild(option);
            });
        showLoading(false);
    } catch (err) {
        console.error('Error loading stores:', err);
        showError();
        showLoading(false);
    }
}

async function loadDatesForStore(storeId) {
    try {
        showLoading(true);
        const res = window.supabaseApi
            ? await window.supabaseApi.get(
                  `/rest/v1/tournament_results?store_id=eq.${storeId}&select=tournament_date,total_players&order=tournament_date.desc`
              )
            : await fetch(
                  `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${storeId}&select=tournament_date,total_players&order=tournament_date.desc`,
                  { headers }
              );

        if (!res.ok) throw new Error('Error loading dates');

        const data = await res.json();
        const dates = [...new Set(data.map((item) => item.tournament_date))];

        const select = document.getElementById('dateFilter');
        select.innerHTML = '<option value="">Select a date...</option>';

        dates.forEach((dateStr) => {
            const option = document.createElement('option');
            option.value = dateStr;

            const [year, month, day] = dateStr.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            option.textContent = formattedDate;
            select.appendChild(option);
        });
        showLoading(false);
    } catch (err) {
        console.error('Error loading dates:', err);
        showError();
        showLoading(false);
    }
}

async function displayTournament() {
    try {
        showLoading(true);

        const resultsPromise = window.supabaseApi
            ? window.supabaseApi.get(
                  `/rest/v1/v_podium_full?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&order=placement.asc`
              )
            : fetch(
                  `${SUPABASE_URL}/rest/v1/v_podium_full?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&order=placement.asc`,
                  { headers }
              );

        const tournamentPromise = window.supabaseApi
            ? window.supabaseApi.get(
                  `/rest/v1/tournament?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&select=tournament_name,format_id,format_ref:formats!tournament_format_id_fkey(code)&order=created_at.desc&limit=1`
              )
            : fetch(
                  `${SUPABASE_URL}/rest/v1/tournament?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&select=tournament_name,format_id,format_ref:formats!tournament_format_id_fkey(code)&order=created_at.desc&limit=1`,
                  { headers }
              );

        const [resultsRes, tournamentRes] = await Promise.all([resultsPromise, tournamentPromise]);

        if (!resultsRes.ok) throw new Error('Error loading results');
        if (!tournamentRes.ok) throw new Error('Error loading tournament metadata');

        const results = await resultsRes.json();
        const tournamentRows = await tournamentRes.json();
        const tournamentName = tournamentRows?.[0]?.tournament_name || 'SEMANAL';
        const tournamentFormat = tournamentRows?.[0]?.format_ref?.code || '';

        if (!results || results.length === 0) {
            clearDisplay();
            showLoading(false);
            return;
        }

        const totalPlayers = results[0].total_players;
        document.getElementById('totalPlayers').textContent = totalPlayers;

        const storeSelect = document.getElementById('storeFilter');
        const storeName = storeSelect.options[storeSelect.selectedIndex].text;

        const [year, month, day] = currentDate.split('-');
        const dateStr = `${day}/${month}/${year}`;

        if (typeof setTournamentDataForCanvas === 'function') {
            setTournamentDataForCanvas({
                topFour: results.slice(0, 4),
                storeName: storeName,
                tournamentName: tournamentName,
                format: tournamentFormat,
                dateStr: dateStr,
                totalPlayers: totalPlayers,
                allResults: results
            });
        }

        displayPodium(results.slice(0, 4));
        displayPositions(results);

        // Mostrar seÃ§Ã£o de resultados completos quando hÃ¡ dados
        const positionsSection = document.querySelector('.positions-section');
        if (positionsSection) {
            positionsSection.style.display = 'block';
        }

        showLoading(false);
    } catch (err) {
        console.error('Error displaying tournament:', err);
        showError();
        showLoading(false);
    }
}

function displayPodium(topFour) {
    const positions = [
        { id: 'firstPlace', placement: 1 },
        { id: 'secondPlace', placement: 2 },
        { id: 'thirdPlace', placement: 3 },
        { id: 'fourthPlace', placement: 4 }
    ];

    positions.forEach((pos) => {
        const card = document.getElementById(pos.id);
        const entry = topFour.find((e) => e.placement === pos.placement);

        if (entry) {
            const img = card.querySelector('.deck-card-image');
            const deckNameEl = card.querySelector('.deck-name');
            const playerNameEl = card.querySelector('.player-name');

            let imageUrl = entry.image_url;

            if (!imageUrl) {
                imageUrl = `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent(entry.deck.substring(0, 10))}`;
            }

            img.src = imageUrl;
            img.alt = entry.deck;

            img.onerror = () => {
                img.src = `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent(entry.deck.substring(0, 10))}`;
            };

            deckNameEl.textContent = entry.deck;

            if (entry.player) {
                playerNameEl.textContent = entry.player;
                playerNameEl.style.display = 'block';
            } else {
                playerNameEl.style.display = 'none';
            }

            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function displayPositions(results) {
    const container = document.getElementById('positionsList');
    container.innerHTML = '';

    results.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'position-item';

        if (entry.placement <= 4) {
            div.classList.add(`top-${entry.placement}`);
        }

        div.innerHTML = `
            <div class="position-rank">${entry.placement}º</div>
            <div class="position-content">
                <div class="position-deck">${entry.deck}</div>
                ${entry.player ? `<div class="position-player">${entry.player}</div>` : ''}
            </div>
        `;

        container.appendChild(div);
    });
}

function clearDisplay() {
    document.getElementById('totalPlayers').textContent = '-';

    ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'].forEach((id) => {
        const card = document.getElementById(id);
        if (card) {
            const img = card.querySelector('.deck-card-image');
            const deckName = card.querySelector('.deck-name');
            const playerName = card.querySelector('.player-name');

            img.src = '';
            img.alt = '';
            deckName.textContent = '-';
            if (playerName) playerName.textContent = '';
            card.style.display = 'none';
        }
    });

    document.getElementById('positionsList').innerHTML = '';

    // Ocultar secao de resultados completos quando nÃ£o hÃ¡ dados
    const positionsSection = document.querySelector('.positions-section');
    if (positionsSection) {
        positionsSection.style.display = 'none';
    }

    const generateSection = document.getElementById('generatePostSection');
    if (generateSection) {
        generateSection.style.display = 'block';
    }
    const generatePostBtn = document.getElementById('generatePostBtn');
    if (generatePostBtn) {
        generatePostBtn.disabled = true;
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.querySelector('.container').style.opacity = show ? '0.5' : '1';
}

function showError() {
    document.getElementById('errorMessage').style.display = 'block';
}

function setupModalActionButtons() {
    const generatePostBtn = document.getElementById('generatePostBtn');
    const btnPostModalCloseTop = document.getElementById('btnPostModalCloseTop');
    const btnPostDownload = document.getElementById('btnPostDownload');
    const btnPostModalCloseBottom = document.getElementById('btnPostModalCloseBottom');
    const btnPostTemplateEdit = document.getElementById('btnPostTemplateEdit');
    const btnPostTemplateReset = document.getElementById('btnPostTemplateReset');
    const btnSavePreset = document.getElementById('btnSavePreset');
    const btnLoadPreset = document.getElementById('btnLoadPreset');
    const btnDeletePreset = document.getElementById('btnDeletePreset');

    if (generatePostBtn) {
        generatePostBtn.addEventListener('click', onGeneratePostAction);
    }
    if (btnPostModalCloseTop) {
        btnPostModalCloseTop.addEventListener('click', closePostPreview);
    }
    if (btnPostDownload) {
        btnPostDownload.addEventListener('click', downloadPost);
    }
    if (btnPostModalCloseBottom) {
        btnPostModalCloseBottom.addEventListener('click', closePostPreview);
    }
    if (btnPostTemplateEdit) {
        btnPostTemplateEdit.addEventListener('click', onPostTemplateEditAction);
    }
    if (btnPostTemplateReset) {
        btnPostTemplateReset.addEventListener('click', resetPostTemplateLayout);
    }
    if (btnSavePreset) {
        btnSavePreset.addEventListener('click', saveLayoutPreset);
    }
    if (btnLoadPreset) {
        btnLoadPreset.addEventListener('click', loadSelectedLayoutPreset);
    }
    if (btnDeletePreset) {
        btnDeletePreset.addEventListener('click', deleteSelectedLayoutPreset);
    }
    window.addEventListener('resize', () => {
        if (isPostTemplateEditorActive) {
            renderTemplateEditorOverlay();
        }
    });
}

function setupPresetControls() {
    const select = document.getElementById('templatePresetSelect');
    if (!select) return;
    select.addEventListener('dblclick', loadSelectedLayoutPreset);
    refreshPresetOptions('Instagram');
}

function getUserLayoutPresetsMap() {
    try {
        const raw = localStorage.getItem(POST_PRESETS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch (_) {
        return {};
    }
}

function getLayoutPresetsMap() {
    return {
        ...BUILT_IN_PRESETS,
        ...getUserLayoutPresetsMap()
    };
}

function saveLayoutPresetsMap(map) {
    try {
        const userOnly = {};
        Object.entries(map || {}).forEach(([name, preset]) => {
            if (preset?.builtIn) return;
            userOnly[name] = preset;
        });
        localStorage.setItem(POST_PRESETS_STORAGE_KEY, JSON.stringify(userOnly));
    } catch (_) {
        // Ignore storage failures.
    }
}

function refreshPresetOptions(selectedName = '') {
    const select = document.getElementById('templatePresetSelect');
    if (!select) return;

    const presets = getLayoutPresetsMap();
    const names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">Select preset...</option>';
    names.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    if (selectedName && names.includes(selectedName)) {
        select.value = selectedName;
    }
}

function saveLayoutPreset() {
    const name = window.prompt('Preset name (checkpoint):');
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;

    const presets = getLayoutPresetsMap();
    presets[cleanName] = {
        layout: JSON.parse(JSON.stringify(postLayout)),
        updatedAt: new Date().toISOString()
    };
    saveLayoutPresetsMap(presets);
    refreshPresetOptions(cleanName);
}

function loadSelectedLayoutPreset() {
    const select = document.getElementById('templatePresetSelect');
    if (!select || !select.value) return;
    const presets = getLayoutPresetsMap();
    const preset = presets[select.value];
    if (!preset?.layout) return;

    postLayout = mergePostLayout(getDefaultPostLayout(), preset.layout);
    savePostLayout();
    syncTypographyControls();
    syncPodiumGapControl();
    syncTemplateObjectSelect();
    drawPostCanvas();
}

function deleteSelectedLayoutPreset() {
    const select = document.getElementById('templatePresetSelect');
    if (!select || !select.value) return;
    const name = select.value;
    const presets = getLayoutPresetsMap();
    if (presets[name]?.builtIn) {
        alert('Built-in preset cannot be deleted.');
        return;
    }
    const confirmed = window.confirm(`Delete preset "${name}"?`);
    if (!confirmed) return;

    delete presets[name];
    saveLayoutPresetsMap(presets);
    refreshPresetOptions('Instagram');
}

function onGeneratePostAction() {
    if (isTemplateEditorPage() || isPostPreviewPage()) {
        openPostPreview();
        return;
    }
    openPostPreviewTab();
}

function setupTypographyControls() {
    const controls = [
        { id: 'fontSizeTournamentTitle', key: 'titleSize' },
        { id: 'fontSizeTournamentDate', key: 'dateSize' },
        { id: 'fontSizePlayerName', key: 'playerSize' },
        { id: 'fontSizeDeckName', key: 'deckSize' },
        { id: 'fontSizeHandle', key: 'handleSize' }
    ];

    controls.forEach((control) => {
        const input = document.getElementById(control.id);
        if (!input) return;
        input.addEventListener('input', () => {
            const value = Number(input.value);
            if (!Number.isFinite(value) || value <= 0) return;
            postLayout.typography[control.key] = value;
            savePostLayout();
            drawPostCanvas();
        });
    });

    syncTypographyControls();
}

function setupPodiumGapControl() {
    const input = document.getElementById('podiumGapInput');
    if (!input) return;
    input.addEventListener('input', () => {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) return;
        setActiveObjectGap(value);
        savePostLayout();
        drawPostCanvas();
    });
    syncPodiumGapControl();
}

function syncPodiumGapControl() {
    const input = document.getElementById('podiumGapInput');
    if (!input) return;
    const value = getActiveObjectGap();
    if (value === null) {
        input.value = '';
        input.disabled = true;
        return;
    }
    input.disabled = false;
    input.value = String(value);
}

function setupTemplateObjectControls() {
    const select = document.getElementById('templateObjectSelect');
    if (!select) return;
    let previousValue = activeTemplateHandleKey;
    select.addEventListener('change', () => {
        const nextValue = select.value;
        if (nextValue === previousValue) return;
        const confirmed = window.confirm(
            `Switch selected object from "${previousValue}" to "${nextValue}"?`
        );
        if (!confirmed) {
            select.value = previousValue;
            return;
        }
        activeTemplateHandleKey = nextValue;
        previousValue = nextValue;
        syncPodiumGapControl();
        renderTemplateEditorOverlay();
    });
    select.value = activeTemplateHandleKey;
}

function syncTemplateObjectSelect() {
    const select = document.getElementById('templateObjectSelect');
    if (!select) return;
    select.value = activeTemplateHandleKey;
    syncPodiumGapControl();
}

function setupTemplateKeyboardControls() {
    window.addEventListener('keydown', (event) => {
        if (!isPostTemplateEditorActive) return;
        if (!document.getElementById('postPreviewModal') || document.getElementById('postPreviewModal').classList.contains('u-hidden')) return;
        if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;

        const moveStep = event.shiftKey ? 10 : 2;
        const resizeStep = event.shiftKey ? 10 : 4;
        const gapStep = event.shiftKey ? 8 : 2;
        let handled = true;

        const key = String(event.key || '').toLowerCase();
        if (key === 'a') nudgeTemplateHandle(activeTemplateHandleKey, -moveStep, 0);
        else if (key === 'd') nudgeTemplateHandle(activeTemplateHandleKey, moveStep, 0);
        else if (key === 'w') nudgeTemplateHandle(activeTemplateHandleKey, 0, -moveStep);
        else if (key === 's') nudgeTemplateHandle(activeTemplateHandleKey, 0, moveStep);
        else if (key === 'q') adjustPodiumGap(-gapStep);
        else if (key === 'e') adjustPodiumGap(gapStep);
        else if (event.key === '>' || event.key === '.') resizeTemplateHandle(activeTemplateHandleKey, resizeStep);
        else if (event.key === '<' || event.key === ',') resizeTemplateHandle(activeTemplateHandleKey, -resizeStep);
        else handled = false;

        if (handled) {
            event.preventDefault();
            savePostLayout();
            drawPostCanvas();
        }
    });
}

function onPostTemplateEditAction() {
    if (!isTopFourPostType()) {
        alert('Template editor is available only for Top 4 post type.');
        return;
    }
    if (isTemplateEditorPage()) {
        togglePostTemplateEditor();
        return;
    }
    openTemplateEditorTab();
}

function isTemplateEditorPage() {
    return new URLSearchParams(window.location.search).get('templateEditor') === '1';
}

function isPostPreviewPage() {
    return new URLSearchParams(window.location.search).get('postPreview') === '1';
}

function openTemplateEditorTab() {
    if (!tournamentDataForCanvas) {
        alert('Load a tournament first.');
        return;
    }
    try {
        localStorage.setItem(
            TEMPLATE_EDITOR_STATE_KEY,
            JSON.stringify({
                tournamentDataForCanvas,
                selectedBackgroundPath,
                selectedPostType
            })
        );
    } catch (_) {
        // Ignore storage write failures.
    }
    window.open('./index.html?templateEditor=1', '_blank');
}

function openPostPreviewTab() {
    if (!tournamentDataForCanvas) {
        alert('Load a tournament first.');
        return;
    }
    try {
        localStorage.setItem(
            POST_PREVIEW_STATE_KEY,
            JSON.stringify({
                tournamentDataForCanvas,
                selectedBackgroundPath,
                selectedPostType
            })
        );
    } catch (_) {
        // Ignore storage write failures.
    }
    window.open('./index.html?postPreview=1', '_blank');
}

function notifyTemplateEditorUpdated() {
    try {
        localStorage.setItem(TEMPLATE_EDITOR_UPDATED_KEY, String(Date.now()));
    } catch (_) {
        // Ignore storage failures.
    }

    try {
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'template-editor-updated' }, window.location.origin);
        }
    } catch (_) {
        // Ignore opener failures.
    }
}

function setupTemplateSyncListeners() {
    const refreshPreviewFromStorage = () => {
        postLayout = loadPostLayout();
        syncTypographyControls();
        syncPodiumGapControl();
        syncTemplateObjectSelect();

        const modal = document.getElementById('postPreviewModal');
        const isPreviewOpen = modal && !modal.classList.contains('u-hidden');
        if (isPreviewOpen && tournamentDataForCanvas) {
            drawPostCanvas();
        }
    };

    window.addEventListener('storage', (event) => {
        if (event.key === POST_LAYOUT_STORAGE_KEY || event.key === TEMPLATE_EDITOR_UPDATED_KEY) {
            refreshPreviewFromStorage();
        }
    });

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'template-editor-updated') {
            refreshPreviewFromStorage();
        }
    });

    window.addEventListener('focus', () => {
        refreshPreviewFromStorage();
    });
}

function bootTemplateEditorPageIfNeeded() {
    if (!isTemplateEditorPage()) return;
    enableDedicatedTemplateEditorLayout();
    try {
        const raw = localStorage.getItem(TEMPLATE_EDITOR_STATE_KEY);
        if (!raw) {
            alert('No template session found. Load a tournament first.');
            window.location.href = './index.html';
            return;
        }
        const state = JSON.parse(raw);
        if (state?.selectedBackgroundPath) {
            selectedBackgroundPath = state.selectedBackgroundPath;
            initializeBackgroundSelector(selectedBackgroundPath);
        }
        if (POST_TYPE_OPTIONS.includes(state?.selectedPostType)) {
            selectedPostType = state.selectedPostType;
            syncPostTypeSelector();
            saveSelectedPostType();
        }
        if (state?.tournamentDataForCanvas) {
            setTournamentDataForCanvas(state.tournamentDataForCanvas);
            openPostPreview().then(() => {
                setPostTemplateEditorActive(true);
                syncTemplateObjectSelect();
                renderTemplateEditorOverlay();
                const closeBottom = document.getElementById('btnPostModalCloseBottom');
                if (closeBottom) closeBottom.textContent = 'Close Editor';
            });
        } else {
            alert('No tournament loaded for template editor.');
            window.location.href = './index.html';
        }
    } catch (_) {
        alert('Invalid template session.');
        window.location.href = './index.html';
    }
}

function bootPostPreviewPageIfNeeded() {
    if (isTemplateEditorPage() || !isPostPreviewPage()) return;
    enableDedicatedPostPreviewLayout();
    try {
        const stateFromUrl = getPostPreviewStateFromUrl();
        const raw = localStorage.getItem(POST_PREVIEW_STATE_KEY);
        const state = stateFromUrl || (raw ? JSON.parse(raw) : null);
        if (!state) {
            alert('No preview session found. Load a tournament first.');
            window.location.href = './index.html';
            return;
        }
        if (state?.selectedBackgroundPath) {
            selectedBackgroundPath = state.selectedBackgroundPath;
            initializeBackgroundSelector(selectedBackgroundPath);
        }
        if (POST_TYPE_OPTIONS.includes(state?.selectedPostType)) {
            selectedPostType = state.selectedPostType;
            syncPostTypeSelector();
            saveSelectedPostType();
        }
        if (state?.tournamentDataForCanvas) {
            setTournamentDataForCanvas(state.tournamentDataForCanvas);
            openPostPreview().then(() => {
                setPostTemplateEditorActive(false);
                const closeBottom = document.getElementById('btnPostModalCloseBottom');
                if (closeBottom) closeBottom.textContent = 'Close Preview';
            });
        } else {
            alert('No tournament loaded for preview.');
            window.location.href = './index.html';
        }
    } catch (_) {
        alert('Invalid preview session.');
        window.location.href = './index.html';
    }
}

function getPostPreviewStateFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('previewData');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function enableDedicatedTemplateEditorLayout() {
    document.body.classList.add('template-editor-page');
    const title = document.querySelector('#postPreviewModal .modal-header h2');
    if (title) {
        title.textContent = 'Template Editor';
    }
}

function enableDedicatedPostPreviewLayout() {
    document.body.classList.add('template-preview-page');
    const title = document.querySelector('#postPreviewModal .modal-header h2');
    if (title) {
        title.textContent = 'Post Preview';
    }
}

function syncTypographyControls() {
    const map = {
        fontSizeTournamentTitle: postLayout.typography.titleSize,
        fontSizeTournamentDate: postLayout.typography.dateSize,
        fontSizePlayerName: postLayout.typography.playerSize,
        fontSizeDeckName: postLayout.typography.deckSize,
        fontSizeHandle: postLayout.typography.handleSize
    };

    Object.entries(map).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = String(value);
    });
}

function getActiveObjectGap() {
    switch (activeTemplateHandleKey) {
        case 'rows':
            return postLayout.rowBorder.rowGap;
        case 'trophy':
        case 'podiumNumber':
            return postLayout.rowElements.trophy.gap;
        case 'avatar':
            return postLayout.rowElements.avatar.gap;
        case 'rowText':
            return postLayout.rowElements.text.gap;
        default:
            return null;
    }
}

function setActiveObjectGap(value) {
    const gap = Math.max(0, Math.round(value));
    switch (activeTemplateHandleKey) {
        case 'rows':
            postLayout.rowBorder.rowGap = gap;
            break;
        case 'trophy':
        case 'podiumNumber':
            postLayout.rowElements.trophy.gap = gap;
            break;
        case 'avatar':
            postLayout.rowElements.avatar.gap = gap;
            break;
        case 'rowText':
            postLayout.rowElements.text.gap = gap;
            break;
        default:
            return;
    }
    syncPodiumGapControl();
}

function adjustPodiumGap(delta) {
    const current = getActiveObjectGap();
    if (current === null) return;
    setActiveObjectGap(current + delta);
}

function setTournamentDataForCanvas(data) {
    tournamentDataForCanvas = data || null;
    syncPostTypeSelector();
    const generatePostBtn = document.getElementById('generatePostBtn');
    if (generatePostBtn) {
        generatePostBtn.disabled = !tournamentDataForCanvas;
    }
    updateTemplateEditorButtons();
    if (tournamentDataForCanvas) {
        void syncBackgroundWithTournamentFormat(tournamentDataForCanvas);
    }
}

function closePostPreview() {
    if (isTemplateEditorPage() || isPostPreviewPage()) {
        notifyTemplateEditorUpdated();
        window.close();
        window.location.href = './index.html';
        return;
    }
    const modal = document.getElementById('postPreviewModal');
    if (!modal) return;
    setPostTemplateEditorActive(false);
    modal.classList.add('u-hidden');
}

async function openPostPreview() {
    if (!tournamentDataForCanvas) {
        alert('Load a tournament first.');
        return;
    }

    await drawPostCanvas();
    const modal = document.getElementById('postPreviewModal');
    if (modal) {
        modal.classList.remove('u-hidden');
    }
    syncTypographyControls();
    syncPodiumGapControl();
    updateTemplateEditorButtons();
    if (isPostTemplateEditorActive) {
        renderTemplateEditorOverlay();
    }
}

function downloadPost() {
    const canvas = document.getElementById('postCanvas');
    if (!canvas || !tournamentDataForCanvas) return;

    const safeStore = String(tournamentDataForCanvas.storeName || 'store')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const safeDate = String(tournamentDataForCanvas.dateStr || 'date').replace(/[\/\s]+/g, '-');

    const link = document.createElement('a');
    link.download = `digistats-${safeStore}-${safeDate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function drawPostCanvas() {
    const canvas = document.getElementById('postCanvas');
    if (!canvas || !tournamentDataForCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const layout = postLayout;
    ctx.clearRect(0, 0, width, height);

    if (selectedBackgroundPath) {
        const customBg = await loadImage(selectedBackgroundPath);
        if (customBg) {
            drawImageCover(ctx, customBg, 0, 0, width, height);
        } else {
            const bg = ctx.createLinearGradient(0, 0, width, height);
            bg.addColorStop(0, '#2f3a7a');
            bg.addColorStop(1, '#6f47c7');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, '#2f3a7a');
        bg.addColorStop(1, '#6f47c7');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
    }

    drawRoundedRect(ctx, 56, 72, width - 112, height - 120, 36, 'rgba(255,255,255,0.88)');

    const logo = await loadFirstAvailableImage(TOP_LEFT_LOGO_CANDIDATES);
    if (logo) {
        const logoPaddingX = Math.round(layout.logo.w * 0.1);
        const logoPaddingY = Math.round(layout.logo.h * 0.12);
        const logoShiftLeft = 74;
        drawImageContain(
            ctx,
            logo,
            Math.max(0, layout.logo.x + logoPaddingX - logoShiftLeft),
            layout.logo.y + logoPaddingY,
            layout.logo.w - logoPaddingX * 2,
            layout.logo.h - logoPaddingY * 2
        );
    }

    const titleBoxX = layout.title.x;
    const titleBoxY = layout.title.y;
    const titleBoxW = layout.title.w;
    const titleBoxH = layout.title.h;
    const titleCenterX = titleBoxX + titleBoxW / 2;
    // No container padding for title/date: text is placed directly from layout bounds.
    const tournamentTitle = String(
        tournamentDataForCanvas.tournamentName || 'SEMANAL'
    ).toUpperCase();
    ctx.fillStyle = '#184fae';
    ctx.font = `italic 900 ${postLayout.typography.titleSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    const titleY = titleBoxY + layout.title.titleOffsetY;
    ctx.strokeText(tournamentTitle.slice(0, 14), titleCenterX, titleY);
    ctx.fillText(tournamentTitle.slice(0, 14), titleCenterX, titleY);

    ctx.fillStyle = '#ff3959';
    const dateLabel = tournamentDataForCanvas.dateStr || '--/--/--';
    let dateFontSize = postLayout.typography.dateSize;
    ctx.font = `italic 900 ${dateFontSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    while (ctx.measureText(dateLabel).width > layout.title.dateMaxWidth && dateFontSize > 58) {
        dateFontSize -= 2;
        ctx.font = `italic 900 ${dateFontSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    const dateY = titleBoxY + layout.title.dateOffsetY;
    ctx.strokeText(dateLabel, titleCenterX, dateY);
    ctx.fillText(dateLabel, titleCenterX, dateY);

    if (selectedPostType === 'distribution_results') {
        await drawDistributionAndResultsContent(ctx, width, height, tournamentDataForCanvas, layout);
    } else if (selectedPostType === 'blank_middle') {
        drawBlankMiddleContent(ctx, width, height, layout);
    } else {
        const rows = (tournamentDataForCanvas.topFour || []).slice(0, 4);
        const trophyAsset = await loadFirstAvailableAsset(TROPHY_ICON_CANDIDATES);
        const startY = layout.rows.startY;
        const rowHeight = layout.rows.rowHeight;
        const rowGap = layout.rows.rowGap;
        const borderStartY = layout.rowBorder.startY;
        const borderRowHeight = layout.rowBorder.rowHeight;
        const borderRowGap = layout.rowBorder.rowGap;
        const trophyGap = layout.rowElements.trophy.gap ?? rowGap;
        const avatarGap = layout.rowElements.avatar.gap ?? rowGap;
        const textGap = layout.rowElements.text.gap ?? rowGap;
        for (let i = 0; i < 4; i += 1) {
            const y = startY + i * (rowHeight + rowGap);
            const borderY = borderStartY + i * (borderRowHeight + borderRowGap);
            const trophyY = startY + i * (rowHeight + trophyGap);
            const avatarY = startY + i * (rowHeight + avatarGap);
            const textY = startY + i * (rowHeight + textGap);
            await drawPlacementRow(
                ctx,
                i + 1,
                y,
                borderY,
                trophyY,
                avatarY,
                textY,
                rowHeight,
                borderRowHeight,
                rows[i] || null,
                trophyAsset,
                layout.rows,
                layout.rowBorder
            );
        }
    }

    const storeBoxX = layout.store.x;
    const storeBoxY = layout.store.y;
    const storeBoxW = layout.store.w;
    const storeBoxH = layout.store.h;
    drawStoreBadge(ctx, storeBoxX, storeBoxY, storeBoxW, storeBoxH, '#0a2f6d');
    const storeIconPath = resolveStoreIconPath(tournamentDataForCanvas.storeName || '');
    const storeIcon = await loadImage(storeIconPath);
    if (storeIcon) {
        const storePaddingX = 36;
        const storePaddingY = 18;
        drawImageContain(
            ctx,
            storeIcon,
            storeBoxX + storePaddingX,
            storeBoxY + storePaddingY,
            storeBoxW - storePaddingX * 2,
            storeBoxH - storePaddingY * 2
        );
    }

    ctx.fillStyle = '#184fae';
    ctx.font = `bold ${postLayout.typography.handleSize}px Segoe UI`;
    ctx.textAlign = 'right';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText('@digimoncwb', layout.handle.x, layout.handle.y);
    ctx.fillText('@digimoncwb', layout.handle.x, layout.handle.y);

    if (isPostTemplateEditorActive) {
        renderTemplateEditorOverlay();
    }
}

async function drawPlacementRow(
    ctx,
    placement,
    y,
    borderY,
    trophyY,
    avatarYBase,
    textYBase,
    rowHeight,
    borderRowHeight,
    entry,
    trophyAsset,
    rowLayout,
    rowBorderLayout
) {
    const style = PLACEMENT_STYLES[placement] || PLACEMENT_STYLES[4];
    const rowElements = postLayout.rowElements;

    const borderRowX = rowBorderLayout.x;
    const borderRowW = rowBorderLayout.w;
    const borderGradient = ctx.createLinearGradient(
        borderRowX,
        borderY,
        borderRowX + borderRowW,
        borderY + borderRowHeight
    );
    borderGradient.addColorStop(0, '#ffffff');
    borderGradient.addColorStop(0.45, style.border);
    borderGradient.addColorStop(1, style.dark || style.border);
    drawRoundedRect(
        ctx,
        borderRowX,
        borderY,
        borderRowW,
        borderRowHeight,
        26,
        '#f3f3f6',
        borderGradient,
        6
    );

    const rowX = rowLayout.x;
    const rowW = rowLayout.w;

    await drawTrophyBadge(
        ctx,
        rowX + rowElements.trophy.x,
        trophyY + rowElements.trophy.y,
        placement,
        style.border,
        trophyAsset,
        rowElements
    );

    ctx.fillStyle = '#1e4f95';
    ctx.textAlign = 'center';
    ctx.font = `italic 700 ${postLayout.typography.playerSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    const playerText = (entry?.player || 'PLAYER').toUpperCase().slice(0, 18);
    const avatarX = rowX + rowW - rowElements.avatar.xFromRight;
    const textAreaLeft = rowX + rowElements.text.leftPadding;
    const textAreaRight = avatarX - rowElements.text.rightPadding;
    const textCenterX = textAreaLeft + (textAreaRight - textAreaLeft) / 2;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(playerText, textCenterX, textYBase + rowElements.text.playerY);
    ctx.fillText(playerText, textCenterX, textYBase + rowElements.text.playerY);

    const deckText = (entry?.deck || 'DECK').toUpperCase().slice(0, 14);
    const deckCenterX = textCenterX;
    ctx.font = `700 ${postLayout.typography.deckSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#1e4f95';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(deckText, deckCenterX, textYBase + rowElements.text.deckY);
    ctx.fillText(deckText, deckCenterX, textYBase + rowElements.text.deckY);

    const avatarY = avatarYBase + rowHeight / 2 + rowElements.avatar.yOffset;
    const avatarOuterRadius = rowElements.avatar.outerRadius;
    const avatarImageRadius = Math.max(
        rowElements.avatar.imageRadius,
        avatarOuterRadius - rowElements.avatar.borderRingWidth / 2
    );
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarOuterRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const image = entry?.image_url ? await loadImage(entry.image_url) : null;
    if (image) {
        drawImageCoverInCircle(ctx, image, avatarX, avatarY, avatarImageRadius);
    }

    const ringGradient = ctx.createLinearGradient(
        avatarX - avatarOuterRadius,
        avatarY - avatarOuterRadius,
        avatarX + avatarOuterRadius,
        avatarY + avatarOuterRadius
    );
    ringGradient.addColorStop(0, '#ffffff');
    ringGradient.addColorStop(0.5, style.border);
    ringGradient.addColorStop(1, style.dark || style.border);
    ctx.lineWidth = rowElements.avatar.borderRingWidth;
    ctx.strokeStyle = ringGradient;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarOuterRadius - 2, 0, Math.PI * 2);
    ctx.stroke();
}

async function drawTrophyBadge(ctx, centerX, centerY, placement, color, trophyAsset, rowElements) {
    const trophyScale = 1.18;
    const trophyW = Math.round(rowElements.trophy.w * trophyScale);
    const trophyH = Math.round(rowElements.trophy.h * trophyScale);
    const numberOffsetX = rowElements.podiumNumber.offsetX;
    const numberOffsetY = rowElements.podiumNumber.offsetY;
    const numberSize = rowElements.podiumNumber.size;
    const style = PLACEMENT_STYLES[placement] || PLACEMENT_STYLES[4];
    function drawAssetWithMetallicGradient(assetImage) {
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.max(1, Math.round(trophyW));
        offscreen.height = Math.max(1, Math.round(trophyH));
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) {
            drawImageContain(ctx, assetImage, drawX, drawY, trophyW, trophyH);
            return;
        }

        // Draw icon into isolated buffer first.
        drawImageContain(offCtx, assetImage, 0, 0, trophyW, trophyH);

        // Apply metallic gradient only where icon pixels exist.
        const medalGradient = offCtx.createLinearGradient(0, 0, trophyW, trophyH);
        medalGradient.addColorStop(0, '#fffef7');
        medalGradient.addColorStop(0.4, style.medal);
        medalGradient.addColorStop(1, style.dark || color);
        offCtx.globalCompositeOperation = 'source-atop';
        offCtx.fillStyle = medalGradient;
        offCtx.fillRect(0, 0, trophyW, trophyH);
        offCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(offscreen, drawX, drawY);
    }

    const drawX = centerX - trophyW / 2;
    const drawY = centerY - trophyH / 2;

    if (trophyAsset?.type === 'svg') {
        const tintedTrophyIcon = await loadTintedSvgIcon(trophyAsset.src, color);
        if (tintedTrophyIcon) {
            drawAssetWithMetallicGradient(tintedTrophyIcon);
        }
    } else if (trophyAsset?.image) {
        drawAssetWithMetallicGradient(trophyAsset.image);
    }

    if (trophyAsset) {
        const textGradient = ctx.createLinearGradient(
            centerX,
            centerY - trophyH / 2,
            centerX,
            centerY + trophyH / 2
        );
        textGradient.addColorStop(0, '#fffef7');
        textGradient.addColorStop(0.42, style.medal);
        textGradient.addColorStop(1, style.dark || color);
        ctx.fillStyle = textGradient;
        ctx.font = `700 ${numberSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#111111';
        const placementLabel = formatPlacementLabel(placement);
        ctx.strokeText(placementLabel, centerX + numberOffsetX, centerY + numberOffsetY);
        ctx.fillText(placementLabel, centerX + numberOffsetX, centerY + numberOffsetY);
        return;
    }

    const fallbackTextGradient = ctx.createLinearGradient(
        centerX,
        centerY - trophyH / 2,
        centerX,
        centerY + trophyH / 2
    );
    fallbackTextGradient.addColorStop(0, '#fffef7');
    fallbackTextGradient.addColorStop(0.42, style.medal);
    fallbackTextGradient.addColorStop(1, style.dark || color);
    ctx.fillStyle = fallbackTextGradient;
    ctx.font = `700 ${numberSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
    const fallbackPlacementLabel = formatPlacementLabel(placement);
    ctx.strokeText(fallbackPlacementLabel, centerX + numberOffsetX, centerY + numberOffsetY);
    ctx.fillText(fallbackPlacementLabel, centerX + numberOffsetX, centerY + numberOffsetY);
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke, strokeWidth) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke) {
        ctx.lineWidth = strokeWidth || 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}

function loadImage(src) {
    return new Promise((resolve) => {
        const image = new Image();
        const resolvedSrc = new URL(src, window.location.href).href;
        const isHttpContext =
            window.location.protocol === 'http:' || window.location.protocol === 'https:';
        const isHttpAsset = resolvedSrc.startsWith('http://') || resolvedSrc.startsWith('https://');
        if (isHttpContext && isHttpAsset) {
            image.crossOrigin = 'anonymous';
        }
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = resolvedSrc;
    });
}

function normalizeStoreName(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function resolveStoreIconPath(storeName) {
    const normalized = normalizeStoreName(storeName);
    if (normalized.includes('gladiator')) return '../icons/stores/Gladiators.png';
    if (normalized.includes('meruru')) return '../icons/stores/Meruru.svg';
    if (normalized.includes('taverna')) return '../icons/stores/Taverna.png';
    if (normalized.includes('tcgbr') || normalized.includes('tcg br'))
        return '../icons/stores/TCGBR.png';
    return '../icons/stores/images.png';
}

async function loadFirstAvailableImage(candidates) {
    for (const candidate of candidates) {
        const image = await loadImage(candidate);
        if (image) return image;
    }
    return null;
}

async function loadFirstAvailableAsset(candidates) {
    for (const candidate of candidates) {
        if (candidate.toLowerCase().endsWith('.svg')) {
            try {
                const response = await fetch(candidate, { cache: 'no-store' });
                if (response.ok) {
                    return { type: 'svg', src: new URL(candidate, window.location.href).href };
                }
            } catch (_) {
                // Keep trying next candidates.
            }

            const svgImage = await loadImage(candidate);
            if (svgImage) {
                return { type: 'image', image: svgImage };
            }
        }

        const image = await loadImage(candidate);
        if (image) {
            return { type: 'image', image };
        }
    }

    return null;
}

async function loadTintedSvgIcon(svgPath, color) {
    const cacheKey = `${svgPath}|${color.toLowerCase()}`;
    if (trophyTintedIconCache.has(cacheKey)) {
        return trophyTintedIconCache.get(cacheKey);
    }

    try {
        let svgTemplate = trophySvgTemplateCache.get(svgPath) || null;
        if (!svgTemplate) {
            const response = await fetch(svgPath, { cache: 'no-store' });
            if (!response.ok) return null;
            svgTemplate = await response.text();
            trophySvgTemplateCache.set(svgPath, svgTemplate);
        }

        const withoutOuterWhite = svgTemplate.replace(
            /<path\s+fill="#(?:fff|ffffff)"\s+d="M 0\.199219 0 L 809\.800781 0 L 809\.800781 1012 L 0\.199219 1012 Z M 0\.199219 0 "\s+fill-opacity="1"\s+fill-rule="nonzero"\/>/gi,
            ''
        );

        const tintedSvg = withoutOuterWhite.replace(new RegExp(TROPHY_SVG_BASE_COLOR, 'gi'), color);
        const svgBlob = new Blob([tintedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(svgBlob);
        const tintedIcon = await loadImage(blobUrl);
        URL.revokeObjectURL(blobUrl);

        if (tintedIcon) {
            trophyTintedIconCache.set(cacheKey, tintedIcon);
        }
        return tintedIcon;
    } catch (_) {
        return null;
    }
}

function drawImageCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = x + (width - drawWidth) / 2;
    const dy = y + (height - drawHeight) / 2;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawImageContain(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = x + (width - drawWidth) / 2;
    const dy = y + (height - drawHeight) / 2;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawImageCoverInCircle(ctx, image, centerX, centerY, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const size = radius * 2;
    // Match .card-image-wrapper feel: cover + extra zoom, anchored near top.
    const coverScale = Math.max(size / image.width, size / image.height);
    const isWebp = /\.webp(?:$|\?)/i.test(String(image.currentSrc || image.src || ''));
    const scale = coverScale * (isWebp ? 1.95 : 1.95);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = centerX - drawWidth / 2;
    const dy = centerY - drawHeight * (isWebp ? 0.25 : 0.11);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    ctx.restore();
}

function drawStoreBadge(ctx, x, y, w, h, color) {
    const r = 18;
    const notch = 14;
    ctx.beginPath();
    ctx.moveTo(x + r + notch, y);
    ctx.lineTo(x + w - r - notch, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r - notch, y + h);
    ctx.lineTo(x + r + notch, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r + notch, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function getDefaultPostLayout() {
    return JSON.parse(JSON.stringify(DEFAULT_POST_LAYOUT));
}

function loadPostLayout() {
    const fallback = getDefaultPostLayout();
    try {
        const raw = localStorage.getItem(POST_LAYOUT_STORAGE_KEY);
        if (!raw) return fallback;
        const saved = JSON.parse(raw);
        return mergePostLayout(fallback, saved);
    } catch (_) {
        return fallback;
    }
}

function savePostLayout() {
    try {
        localStorage.setItem(POST_LAYOUT_STORAGE_KEY, JSON.stringify(postLayout));
    } catch (_) {
        // Ignore storage errors in private modes.
    }
}

function mergePostLayout(base, override) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    Object.keys(override || {}).forEach((key) => {
        const baseValue = out[key];
        const overrideValue = override[key];
        if (
            baseValue &&
            overrideValue &&
            typeof baseValue === 'object' &&
            typeof overrideValue === 'object' &&
            !Array.isArray(baseValue) &&
            !Array.isArray(overrideValue)
        ) {
            out[key] = mergePostLayout(baseValue, overrideValue);
        } else {
            out[key] = overrideValue;
        }
    });
    return out;
}

function resetPostTemplateLayout() {
    postLayout = getDefaultPostLayout();
    savePostLayout();
    syncTypographyControls();
    syncPodiumGapControl();
    drawPostCanvas();
    if (isPostTemplateEditorActive) {
        renderTemplateEditorOverlay();
    }
}

function togglePostTemplateEditor() {
    if (!tournamentDataForCanvas) return;
    if (!isTopFourPostType()) return;
    setPostTemplateEditorActive(!isPostTemplateEditorActive);
    if (isPostTemplateEditorActive && isTopFourPostType()) {
        renderTemplateEditorOverlay();
    }
}

function getDeckDistributionRows(results) {
    const map = new Map();
    (results || []).forEach((item) => {
        const deck = String(item?.deck || 'Unknown').trim() || 'Unknown';
        if (!map.has(deck)) {
            map.set(deck, {
                deck,
                count: 0,
                image_url: String(item?.image_url || '').trim()
            });
        }
        const current = map.get(deck);
        current.count += 1;
        if (!current.image_url && item?.image_url) {
            current.image_url = String(item.image_url).trim();
        }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.deck.localeCompare(b.deck));
}

function getResultRowStyle(placement) {
    if (placement === 1) return { fill: 'rgba(255,215,0,0.38)', stroke: '#c99a2e' };
    if (placement === 2) return { fill: 'rgba(192,192,192,0.36)', stroke: '#9497a1' };
    if (placement === 3) return { fill: 'rgba(205,127,50,0.34)', stroke: '#a85d2f' };
    if (placement === 4) return { fill: 'rgba(77,191,159,0.32)', stroke: '#4dbf9f' };
    return { fill: 'rgba(173,186,230,0.28)', stroke: '#8292cf' };
}

function getMiddlePanelRect(layout, width, height) {
    const rowBaseY = Number(layout?.rows?.startY) || 280;
    const rowBaseH = Number(layout?.rows?.rowHeight) || 178;
    const rowBaseGap = Number(layout?.rows?.rowGap) || 24;
    const borderBaseY = Number(layout?.rowBorder?.startY) || rowBaseY;
    const borderBaseH = Number(layout?.rowBorder?.rowHeight) || rowBaseH;
    const borderBaseGap = Number(layout?.rowBorder?.rowGap) || rowBaseGap;
    const baseX = Math.min(Number(layout?.rows?.x) || 92, Number(layout?.rowBorder?.x) || 92);
    const baseW = Math.max(Number(layout?.rows?.w) || 896, Number(layout?.rowBorder?.w) || 896);

    const rowEnd = rowBaseY + rowBaseH * 4 + rowBaseGap * 3;
    const borderEnd = borderBaseY + borderBaseH * 4 + borderBaseGap * 3;
    const panelY = Math.max(220, Math.min(rowBaseY, borderBaseY) - 12);
    const panelH = Math.min(height - panelY - 210, Math.max(rowEnd, borderEnd) - panelY + 12);

    return {
        x: baseX,
        y: panelY,
        w: Math.min(baseW, width - baseX * 2),
        h: Math.max(420, panelH)
    };
}

async function drawDistributionAndResultsContent(ctx, width, height, data, layout) {
    const panelRect = getMiddlePanelRect(layout, width, height);
    const panelX = panelRect.x;
    const panelY = panelRect.y;
    const panelW = panelRect.w;
    const panelH = panelRect.h;
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 30, 'rgba(255,255,255,0.58)');

    const pieCardX = panelX + 24;
    const pieCardY = panelY + 24;
    const pieCardW = 444;
    const pieCardH = panelH - 48;
    drawRoundedRect(ctx, pieCardX, pieCardY, pieCardW, pieCardH, 24, 'rgba(15,48,106,0.10)');

    const listCardX = pieCardX + pieCardW + 24;
    const listCardY = pieCardY;
    const listCardW = panelW - (listCardX - panelX) - 24;
    const listCardH = pieCardH;
    drawRoundedRect(ctx, listCardX, listCardY, listCardW, listCardH, 24, 'rgba(15,48,106,0.10)');

    ctx.fillStyle = '#184fae';
    ctx.textAlign = 'left';
    const sectionTitleSize = Math.max(30, Math.round((layout?.typography?.deckSize || 62) * 0.65));
    ctx.font = `900 ${sectionTitleSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    ctx.fillText('DECK DISTRIBUTION', pieCardX + 26, pieCardY + 54);
    ctx.fillText('FULL RESULTS', listCardX + 26, listCardY + 54);

    const allResults = (data?.allResults || [])
        .map((item) => ({
            placement: Number(item?.placement) || 0,
            deck: String(item?.deck || 'Unknown'),
            player: String(item?.player || '-')
        }))
        .sort((a, b) => a.placement - b.placement);
    const distributionRows = getDeckDistributionRows(allResults);
    const pieRows = distributionRows.slice(0, 8);
    const total = pieRows.reduce((sum, row) => sum + row.count, 0) || 1;
    const colors = [
        '#2f6ecb',
        '#ff6b6b',
        '#ffd166',
        '#06d6a0',
        '#9b5de5',
        '#118ab2',
        '#f8961e',
        '#43aa8b'
    ];

    const centerX = pieCardX + pieCardW / 2;
    const centerY = pieCardY + Math.min(230, Math.max(190, pieCardH * 0.32));
    const radius = Math.min(142, Math.max(110, pieCardW * 0.31));
    const fallbackImage = (deckName) =>
        `https://via.placeholder.com/420x420/5f75b9/ffffff?text=${encodeURIComponent(String(deckName || 'Deck').slice(0, 10))}`;
    const pieImages = await Promise.all(
        pieRows.map((row) => loadImage(row.image_url || fallbackImage(row.deck)))
    );
    let angle = -Math.PI / 2;
    pieRows.forEach((row, index) => {
        const slice = (row.count / total) * Math.PI * 2;
        const sliceStart = angle;
        const sliceEnd = angle + slice;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sliceStart, sliceEnd);
        ctx.closePath();
        ctx.clip();

        const image = pieImages[index];
        if (image) {
            drawImageCover(ctx, image, centerX - radius, centerY - radius, radius * 2, radius * 2);
        } else {
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sliceStart, sliceEnd);
        ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.stroke();

        angle += slice;
    });
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 66, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.fillStyle = '#184fae';
    ctx.textAlign = 'center';
    ctx.font = `900 ${sectionTitleSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    ctx.fillText(String(allResults.length || 0), centerX, centerY + 14);

    const legendStartY = centerY + 190;
    ctx.textAlign = 'left';
    const legendFontSize = Math.max(20, Math.round((layout?.typography?.playerSize || 54) * 0.48));
    ctx.font = `700 ${legendFontSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    pieRows.forEach((row, index) => {
        const y = legendStartY + index * 38;
        if (y > pieCardY + pieCardH - 22) return;
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(pieCardX + 26, y - 18, 20, 20);
        ctx.fillStyle = '#0f2f63';
        const label = `${row.deck} (${row.count})`;
        ctx.fillText(label.slice(0, 26), pieCardX + 54, y);
    });

    ctx.fillStyle = '#0f2f63';
    const listFontSize = Math.max(20, Math.round((layout?.typography?.playerSize || 54) * 0.5));
    ctx.font = `700 ${listFontSize}px "Barlow Condensed", "Segoe UI", sans-serif`;
    const maxRows = 24;
    const rowStartY = listCardY + 96;
    const rowGap = Math.max(26, Math.round(listFontSize * 1.3));
    allResults.slice(0, maxRows).forEach((row, index) => {
        const y = rowStartY + index * rowGap;
        if (y > listCardY + listCardH - 20) return;

        const rowStyle = getResultRowStyle(row.placement);
        const rowHeight = Math.max(24, Math.round(listFontSize * 1.18));
        const rowY = y - rowHeight + 8;
        drawRoundedRect(
            ctx,
            listCardX + 20,
            rowY,
            listCardW - 40,
            rowHeight,
            10,
            rowStyle.fill,
            rowStyle.stroke,
            1.2
        );

        const left = `${String(row.placement).padStart(2, '0')}. ${row.player}`;
        const right = row.deck;
        ctx.textAlign = 'left';
        ctx.fillText(left.slice(0, 20), listCardX + 30, y);
        ctx.textAlign = 'right';
        ctx.fillText(right.slice(0, 18), listCardX + listCardW - 30, y);
    });
}

function drawBlankMiddleContent(ctx, width, height, layout) {
    const panelRect = getMiddlePanelRect(layout, width, height);
    const panelX = panelRect.x;
    const panelY = panelRect.y;
    const panelW = panelRect.w;
    const panelH = panelRect.h;
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 30, 'rgba(255,255,255,0.52)');
}

function setPostTemplateEditorActive(active) {
    isPostTemplateEditorActive = Boolean(active);
    const overlay = document.getElementById('postEditorOverlay');
    if (overlay) {
        overlay.classList.toggle('u-hidden', !isPostTemplateEditorActive);
        if (!isPostTemplateEditorActive) {
            postEditorGuides = [];
            overlay.innerHTML = '';
        }
    }
    updateTemplateEditorButtons();
}

function updateTemplateEditorButtons() {
    const btn = document.getElementById('btnPostTemplateEdit');
    if (!btn) return;
    const enabled = isTopFourPostType();
    btn.disabled = !enabled;
    if (!enabled) {
        btn.textContent = 'Edit Template (Top 4 only)';
        btn.classList.remove('is-active');
        return;
    }
    btn.textContent = isPostTemplateEditorActive ? 'Finish Editing' : 'Edit Template';
    btn.classList.toggle('is-active', isPostTemplateEditorActive);
}

function renderTemplateEditorOverlay() {
    const overlay = document.getElementById('postEditorOverlay');
    const wrap = document.getElementById('postCanvasWrap');
    const canvas = document.getElementById('postCanvas');
    if (!overlay || !wrap || !canvas || !isPostTemplateEditorActive) return;

    const wrapRect = wrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;

    overlay.style.left = `${canvasRect.left - wrapRect.left}px`;
    overlay.style.top = `${canvasRect.top - wrapRect.top}px`;
    overlay.style.width = `${canvasRect.width}px`;
    overlay.style.height = `${canvasRect.height}px`;
    overlay.innerHTML = '';

    const handles = getTemplateEditorHandles();
    postEditorGuides.forEach((guide) => {
        const line = document.createElement('div');
        line.className = `post-editor-guide ${guide.axis}`;
        if (guide.axis === 'x') {
            line.style.left = `${guide.value * scaleX}px`;
        } else {
            line.style.top = `${guide.value * scaleY}px`;
        }
        overlay.appendChild(line);
    });

    handles.forEach((handle) => {
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'post-editor-handle';
        div.dataset.key = handle.key;
        div.style.left = `${handle.x * scaleX}px`;
        div.style.top = `${handle.y * scaleY}px`;
        div.style.width = `${handle.w * scaleX}px`;
        div.style.height = `${handle.h * scaleY}px`;
        div.innerHTML = `<span>${handle.label}</span>`;
        div.addEventListener('pointerdown', (event) => startTemplateHandleDrag(event, handle.key));
        overlay.appendChild(div);
    });
}

function getTemplateEditorHandles() {
    const rowsHeight = postLayout.rows.rowHeight * 4 + postLayout.rows.rowGap * 3;
    const rowX = postLayout.rows.x;
    const rowY = postLayout.rows.startY;
    const rowW = postLayout.rows.w;
    const rowH = postLayout.rows.rowHeight;
    const rowElements = postLayout.rowElements;
    const avatarX = rowX + rowW - rowElements.avatar.xFromRight;
    const avatarY = rowY + rowH / 2 + rowElements.avatar.yOffset;
    const textAreaLeft = rowX + rowElements.text.leftPadding;
    const textAreaRight = avatarX - rowElements.text.rightPadding;
    const textWidth = Math.max(80, textAreaRight - textAreaLeft);
    return [
        {
            key: 'logo',
            label: 'Logo',
            x: postLayout.logo.x,
            y: postLayout.logo.y,
            w: postLayout.logo.w,
            h: postLayout.logo.h
        },
        {
            key: 'title',
            label: 'Title/Date',
            x: postLayout.title.x,
            y: postLayout.title.y,
            w: postLayout.title.w,
            h: postLayout.title.h
        },
        {
            key: 'rows',
            label: 'Podium Border',
            x: postLayout.rowBorder.x,
            y: postLayout.rowBorder.startY,
            w: postLayout.rowBorder.w,
            h: postLayout.rowBorder.rowHeight
        },
        {
            key: 'trophy',
            label: 'Trophy Icon',
            x: rowX + rowElements.trophy.x - rowElements.trophy.w / 2,
            y: rowY + rowElements.trophy.y - rowElements.trophy.h / 2,
            w: rowElements.trophy.w,
            h: rowElements.trophy.h
        },
        {
            key: 'podiumNumber',
            label: 'Podium Number',
            x: rowX + rowElements.trophy.x + rowElements.podiumNumber.offsetX - 48,
            y: rowY + rowElements.trophy.y + rowElements.podiumNumber.offsetY - 34,
            w: 96,
            h: 68
        },
        {
            key: 'avatar',
            label: 'Deck Circle',
            x: avatarX - rowElements.avatar.outerRadius,
            y: avatarY - rowElements.avatar.outerRadius,
            w: rowElements.avatar.outerRadius * 2,
            h: rowElements.avatar.outerRadius * 2
        },
        {
            key: 'rowText',
            label: 'Player/Deck',
            x: textAreaLeft,
            y: rowY + rowElements.text.playerY - 36,
            w: textWidth,
            h: Math.max(72, rowElements.text.deckY - rowElements.text.playerY + 54)
        },
        {
            key: 'store',
            label: 'Store Logo',
            x: postLayout.store.x,
            y: postLayout.store.y,
            w: postLayout.store.w,
            h: postLayout.store.h
        },
        {
            key: 'handle',
            label: '@digimoncwb',
            x: postLayout.handle.x - 280,
            y: postLayout.handle.y - 52,
            w: 280,
            h: 62
        }
    ];
}

function startTemplateHandleDrag(event, key) {
    if (!isPostTemplateEditorActive) return;
    event.preventDefault();
    activeTemplateHandleKey = key;
    syncTemplateObjectSelect();

    const canvas = document.getElementById('postCanvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    const origin = getHandleOrigin(key);

    postEditorDragState = {
        key,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: origin.x,
        originY: origin.y,
        scaleX,
        scaleY
    };

    window.addEventListener('pointermove', onTemplateHandleDrag);
    window.addEventListener('pointerup', stopTemplateHandleDrag);
}

function onTemplateHandleDrag(event) {
    if (!postEditorDragState) return;

    const dx = (event.clientX - postEditorDragState.startClientX) / postEditorDragState.scaleX;
    const dy = (event.clientY - postEditorDragState.startClientY) / postEditorDragState.scaleY;

    const nextX = Math.round(postEditorDragState.originX + dx);
    const nextY = Math.round(postEditorDragState.originY + dy);
    const snapped = applyTemplateSnap(postEditorDragState.key, nextX, nextY);
    postEditorGuides = snapped.guides;
    updateHandleOrigin(postEditorDragState.key, snapped.x, snapped.y);
    drawPostCanvas();
}

function stopTemplateHandleDrag() {
    if (!postEditorDragState) return;
    postEditorDragState = null;
    postEditorGuides = [];
    savePostLayout();
    renderTemplateEditorOverlay();
    window.removeEventListener('pointermove', onTemplateHandleDrag);
    window.removeEventListener('pointerup', stopTemplateHandleDrag);
}

function getHandleOrigin(key) {
    const rowX = postLayout.rows.x;
    const rowY = postLayout.rows.startY;
    const rowW = postLayout.rows.w;
    const rowH = postLayout.rows.rowHeight;
    const rowElements = postLayout.rowElements;
    const avatarX = rowX + rowW - rowElements.avatar.xFromRight;
    const avatarY = rowY + rowH / 2 + rowElements.avatar.yOffset;
    const textAreaLeft = rowX + rowElements.text.leftPadding;
    switch (key) {
        case 'logo':
            return { x: postLayout.logo.x, y: postLayout.logo.y };
        case 'title':
            return { x: postLayout.title.x, y: postLayout.title.y };
        case 'rows':
            return { x: postLayout.rowBorder.x, y: postLayout.rowBorder.startY };
        case 'trophy':
            return {
                x: rowX + rowElements.trophy.x - rowElements.trophy.w / 2,
                y: rowY + rowElements.trophy.y - rowElements.trophy.h / 2
            };
        case 'podiumNumber':
            return {
                x: rowX + rowElements.trophy.x + rowElements.podiumNumber.offsetX - 48,
                y: rowY + rowElements.trophy.y + rowElements.podiumNumber.offsetY - 34
            };
        case 'avatar':
            return {
                x: avatarX - rowElements.avatar.outerRadius,
                y: avatarY - rowElements.avatar.outerRadius
            };
        case 'rowText':
            return {
                x: textAreaLeft,
                y: rowY + rowElements.text.playerY - 36
            };
        case 'store':
            return { x: postLayout.store.x, y: postLayout.store.y };
        case 'handle':
            return { x: postLayout.handle.x - 280, y: postLayout.handle.y - 52 };
        default:
            return { x: 0, y: 0 };
    }
}

function updateHandleOrigin(key, x, y) {
    const rowX = postLayout.rows.x;
    const rowY = postLayout.rows.startY;
    const rowW = postLayout.rows.w;
    const rowH = postLayout.rows.rowHeight;
    const rowElements = postLayout.rowElements;
    switch (key) {
        case 'logo':
            postLayout.logo.x = x;
            postLayout.logo.y = y;
            break;
        case 'title':
            postLayout.title.x = x;
            postLayout.title.y = y;
            break;
        case 'rows':
            postLayout.rowBorder.x = x;
            postLayout.rowBorder.startY = y;
            break;
        case 'trophy':
            postLayout.rowElements.trophy.x = Math.round(x + postLayout.rowElements.trophy.w / 2 - rowX);
            postLayout.rowElements.trophy.y = Math.round(y + postLayout.rowElements.trophy.h / 2 - rowY);
            break;
        case 'podiumNumber':
            postLayout.rowElements.podiumNumber.offsetX = Math.round(x + 48 - (rowX + rowElements.trophy.x));
            postLayout.rowElements.podiumNumber.offsetY = Math.round(y + 34 - (rowY + rowElements.trophy.y));
            break;
        case 'avatar': {
            const centerX = x + rowElements.avatar.outerRadius;
            const centerY = y + rowElements.avatar.outerRadius;
            postLayout.rowElements.avatar.xFromRight = Math.round(rowX + rowW - centerX);
            postLayout.rowElements.avatar.yOffset = Math.round(centerY - (rowY + rowH / 2));
            break;
        }
        case 'rowText': {
            const delta = rowElements.text.deckY - rowElements.text.playerY;
            postLayout.rowElements.text.leftPadding = Math.round(x - rowX);
            postLayout.rowElements.text.playerY = Math.round(y + 36 - rowY);
            postLayout.rowElements.text.deckY = postLayout.rowElements.text.playerY + delta;
            break;
        }
        case 'store':
            postLayout.store.x = x;
            postLayout.store.y = y;
            break;
        case 'handle':
            postLayout.handle.x = x + 280;
            postLayout.handle.y = y + 52;
            break;
        default:
            break;
    }
}

function getTemplateHandleRect(key) {
    const rowX = postLayout.rows.x;
    const rowY = postLayout.rows.startY;
    const rowW = postLayout.rows.w;
    const rowH = postLayout.rows.rowHeight;
    const rowElements = postLayout.rowElements;
    const avatarX = rowX + rowW - rowElements.avatar.xFromRight;
    const avatarY = rowY + rowH / 2 + rowElements.avatar.yOffset;
    const textAreaLeft = rowX + rowElements.text.leftPadding;
    const textAreaRight = avatarX - rowElements.text.rightPadding;
    switch (key) {
        case 'logo':
            return { x: postLayout.logo.x, y: postLayout.logo.y, w: postLayout.logo.w, h: postLayout.logo.h };
        case 'title':
            return { x: postLayout.title.x, y: postLayout.title.y, w: postLayout.title.w, h: postLayout.title.h };
        case 'rows':
            return {
                x: postLayout.rowBorder.x,
                y: postLayout.rowBorder.startY,
                w: postLayout.rowBorder.w,
                h: postLayout.rowBorder.rowHeight
            };
        case 'trophy':
            return {
                x: rowX + rowElements.trophy.x - rowElements.trophy.w / 2,
                y: rowY + rowElements.trophy.y - rowElements.trophy.h / 2,
                w: rowElements.trophy.w,
                h: rowElements.trophy.h
            };
        case 'podiumNumber':
            return {
                x: rowX + rowElements.trophy.x + rowElements.podiumNumber.offsetX - 48,
                y: rowY + rowElements.trophy.y + rowElements.podiumNumber.offsetY - 34,
                w: 96,
                h: 68
            };
        case 'avatar':
            return {
                x: avatarX - rowElements.avatar.outerRadius,
                y: avatarY - rowElements.avatar.outerRadius,
                w: rowElements.avatar.outerRadius * 2,
                h: rowElements.avatar.outerRadius * 2
            };
        case 'rowText':
            return {
                x: textAreaLeft,
                y: rowY + rowElements.text.playerY - 36,
                w: Math.max(80, textAreaRight - textAreaLeft),
                h: Math.max(72, rowElements.text.deckY - rowElements.text.playerY + 54)
            };
        case 'store':
            return { x: postLayout.store.x, y: postLayout.store.y, w: postLayout.store.w, h: postLayout.store.h };
        case 'handle':
            return { x: postLayout.handle.x - 280, y: postLayout.handle.y - 52, w: 280, h: 62 };
        default:
            return { x: 0, y: 0, w: 0, h: 0 };
    }
}

function applyTemplateSnap(key, x, y) {
    const canvasW = 1080;
    const canvasH = 1350;
    const rect = getTemplateHandleRect(key);
    const guides = [];
    let snappedX = x;
    let snappedY = y;

    const xTargets = [0, canvasW - rect.w, Math.round((canvasW - rect.w) / 2)];
    const yTargets = [0, canvasH - rect.h, Math.round((canvasH - rect.h) / 2)];

    const otherHandles = getTemplateEditorHandles().filter((h) => h.key !== key);
    otherHandles.forEach((h) => {
        xTargets.push(Math.round(h.x));
        xTargets.push(Math.round(h.x + h.w / 2 - rect.w / 2));
        yTargets.push(Math.round(h.y));
        yTargets.push(Math.round(h.y + h.h / 2 - rect.h / 2));
    });

    const closestX = findClosestSnap(x, xTargets, EDITOR_SNAP_DISTANCE);
    if (closestX !== null) {
        snappedX = closestX;
        guides.push({ axis: 'x', value: closestX + rect.w / 2 });
    }

    const closestY = findClosestSnap(y, yTargets, EDITOR_SNAP_DISTANCE);
    if (closestY !== null) {
        snappedY = closestY;
        guides.push({ axis: 'y', value: closestY + rect.h / 2 });
    }

    return { x: snappedX, y: snappedY, guides };
}

function nudgeTemplateHandle(key, dx, dy) {
    const origin = getHandleOrigin(key);
    updateHandleOrigin(key, origin.x + dx, origin.y + dy);
    postEditorGuides = [];
    renderTemplateEditorOverlay();
}

function resizeTemplateHandle(key, delta) {
    switch (key) {
        case 'logo':
            postLayout.logo.w = Math.max(120, postLayout.logo.w + delta);
            postLayout.logo.h = Math.max(60, postLayout.logo.h + delta);
            break;
        case 'title':
            postLayout.title.w = Math.max(180, postLayout.title.w + delta);
            postLayout.title.h = Math.max(90, postLayout.title.h + delta);
            break;
        case 'rows':
            postLayout.rowBorder.w = Math.max(500, postLayout.rowBorder.w + delta);
            postLayout.rowBorder.rowHeight = Math.max(
                120,
                postLayout.rowBorder.rowHeight + Math.round(delta / 2)
            );
            break;
        case 'trophy':
            postLayout.rowElements.trophy.w = Math.max(70, postLayout.rowElements.trophy.w + delta);
            postLayout.rowElements.trophy.h = Math.max(70, postLayout.rowElements.trophy.h + delta);
            break;
        case 'podiumNumber':
            postLayout.rowElements.podiumNumber.size = Math.max(
                24,
                postLayout.rowElements.podiumNumber.size + Math.round(delta / 2)
            );
            break;
        case 'avatar':
            postLayout.rowElements.avatar.outerRadius = Math.max(
                40,
                postLayout.rowElements.avatar.outerRadius + Math.round(delta / 2)
            );
            postLayout.rowElements.avatar.imageRadius = Math.max(
                34,
                postLayout.rowElements.avatar.imageRadius + Math.round(delta / 2)
            );
            break;
        case 'rowText':
            postLayout.rowElements.text.rightPadding = Math.max(
                40,
                postLayout.rowElements.text.rightPadding - Math.round(delta / 2)
            );
            break;
        case 'store':
            postLayout.store.w = Math.max(120, postLayout.store.w + delta);
            postLayout.store.h = Math.max(60, postLayout.store.h + Math.round(delta / 2));
            break;
        case 'handle':
            postLayout.typography.handleSize = Math.max(20, postLayout.typography.handleSize + Math.round(delta / 2));
            break;
        default:
            break;
    }
    postEditorGuides = [];
    renderTemplateEditorOverlay();
}

function findClosestSnap(value, targets, threshold) {
    let closest = null;
    let minDistance = Number.POSITIVE_INFINITY;
    targets.forEach((target) => {
        const distance = Math.abs(value - target);
        if (distance <= threshold && distance < minDistance) {
            minDistance = distance;
            closest = target;
        }
    });
    return closest;
}


