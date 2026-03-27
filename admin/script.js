'use strict';

// ============================================================
// STATE
// ============================================================
let adminFormats = [];
let adminBanList = [];
let adminStores = [];
let adminBanNameMap = {}; // card_code -> name, from ban_list.card_name
let adminBanListLoaded = false;
let adminFormatsLoaded = false;
let adminStoresLoaded = false;
let adminActiveTab = 'formats';
let _banPreviewDebounceTimer = null;

// ============================================================
// INIT / RESET (called by list-tournaments/script.js)
// ============================================================
window.initAdminPage = function () {
    adminFormats = [];
    adminBanList = [];
    adminStores = [];
    adminBanListLoaded = false;
    adminFormatsLoaded = false;
    adminStoresLoaded = false;
    adminActiveTab = 'formats';
    setupAdminActions();
    loadAdminFormats();
    loadAdminBanList();
};

window.resetAdminPage = function () {
    adminFormats = [];
    adminBanList = [];
    adminStores = [];
    adminBanNameMap = {};
    adminBanListLoaded = false;
    adminFormatsLoaded = false;
    adminStoresLoaded = false;
};

// ============================================================
// SETUP
// ============================================================
function setupAdminActions() {
    const container = document.getElementById('adminContainer');
    if (!container) return;

    // Tab switching
    container.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
    });

    // Delegated clicks for all admin actions
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-admin-action]');
        if (!btn) return;
        const action = btn.dataset.adminAction;
        const id = btn.dataset.id ? Number(btn.dataset.id) : null;

        if (action === 'create-format') openFormatModal(null);
        if (action === 'edit-format') openFormatModal(id);
        if (action === 'set-default-format') setDefaultFormat(id);
        if (action === 'delete-format') deleteFormat(id, btn.dataset.name);
        if (action === 'add-ban') openBanModal(null);
        if (action === 'edit-ban') openBanModal(btn.dataset.code);
        if (action === 'remove-ban') removeBanEntry(btn.dataset.code);
        if (action === 'close-format-modal') closeFormatModal();
        if (action === 'close-ban-modal') closeBanModal();
        if (action === 'browse-bucket-images') toggleBucketBrowser();
        if (action === 'select-bucket-image') selectBucketImage(btn.dataset.url, btn.dataset.path);
        if (action === 'clear-format-bg') clearFormatBackground();
        if (action === 'repair-check') runRepairCheck();
        if (action === 'repair-run') runRepairRun();
        if (action === 'download-cards') runDownloadCards();
        if (action === 'export-catalog') runExportCatalog();
        if (action === 'create-store') openStoreModal(null);
        if (action === 'edit-store') openStoreModal(btn.dataset.id);
        if (action === 'delete-store') deleteStore(btn.dataset.id, btn.dataset.name);
        if (action === 'close-store-modal') closeStoreModal();
        if (action === 'clear-store-logo') clearStoreLogo();
        if (action === 'browse-store-logos') toggleStoreBucketBrowser();
        if (action === 'select-store-logo') selectStoreLogo(btn.dataset.url);
    });

    // Format form submit
    const formatForm = document.getElementById('adminFormatForm');
    if (formatForm) formatForm.addEventListener('submit', saveFormat);

    // Ban form submit
    const banForm = document.getElementById('adminBanForm');
    if (banForm) banForm.addEventListener('submit', saveBanEntry);

    // Close modals on backdrop click
    const formatModal = document.getElementById('adminFormatModal');
    if (formatModal) {
        formatModal.addEventListener('click', (e) => {
            if (e.target === formatModal) closeFormatModal();
        });
    }
    const banModal = document.getElementById('adminBanModal');
    if (banModal) {
        banModal.addEventListener('click', (e) => {
            if (e.target === banModal) closeBanModal();
        });
    }
    const storeModal = document.getElementById('adminStoreModal');
    if (storeModal) {
        storeModal.addEventListener('click', (e) => {
            if (e.target === storeModal) closeStoreModal();
        });
    }

    // Store form submit
    const storeForm = document.getElementById('adminStoreForm');
    if (storeForm) storeForm.addEventListener('submit', saveStore);

    // Store logo file input
    const storeLogoFile = document.getElementById('adminStoreLogoFile');
    if (storeLogoFile) {
        storeLogoFile.addEventListener('change', async () => {
            const file = storeLogoFile.files[0];
            if (!file) return;
            const statusEl = document.getElementById('adminStoreLogoUploadStatus');
            if (statusEl) statusEl.textContent = 'Uploading…';
            try {
                const storeName = (document.getElementById('adminStoreName')?.value.trim() || 'store')
                    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const { url } = await uploadStoreLogo(file, storeName);
                setStoreLogoPreview(url);
                if (statusEl) statusEl.textContent = '';
            } catch (err) {
                if (statusEl) statusEl.textContent = `Upload error: ${err.message}`;
            }
        });
    }

    // Card code preview in ban modal
    const banCodeInput = document.getElementById('adminBanCardCode');
    if (banCodeInput) {
        banCodeInput.addEventListener('input', () => {
            updateBanCardPreview(banCodeInput.value.trim().toUpperCase());
        });
    }

    // Ban list search filter
    const banSearch = document.getElementById('adminBanListSearch');
    if (banSearch) {
        banSearch.addEventListener('input', () => renderAdminBanList());
    }

    // Background file input — upload new
    const fileInput = document.getElementById('adminFormatFile');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            setFormatBgPreview(URL.createObjectURL(file), null, null);
            const browser = document.getElementById('adminBucketBrowser');
            if (browser) browser.classList.add('is-hidden');
        });
    }

    // Auto-detect background when code changes
    const codeInput = document.getElementById('adminFormatCode');
    if (codeInput) {
        codeInput.addEventListener('input', () => {
            const urlInput = document.getElementById('adminFormatBgUrl');
            // Only auto-detect if no background is currently chosen
            if (urlInput && urlInput.value) return;
            const code = codeInput.value.trim().toUpperCase();
            if (!code) return;
            autoDetectFormatBackground(code);
        });
    }
}

function switchAdminTab(tab) {
    adminActiveTab = tab;
    const container = document.getElementById('adminContainer');
    if (!container) return;
    container.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.adminTab === tab);
    });
    container.querySelectorAll('[data-admin-panel]').forEach((panel) => {
        panel.classList.toggle('is-hidden', panel.dataset.adminPanel !== tab);
    });
    if (tab === 'stores' && !adminStoresLoaded) loadAdminStores();
}

// ============================================================
// FORMATS / META
// ============================================================
async function loadAdminFormats() {
    const host = document.getElementById('adminFormatsBody');
    if (!host) return;
    host.innerHTML = '<tr><td colspan="6" class="admin-loading"><div class="spinner"></div></td></tr>';

    try {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/formats?select=*&order=id.asc`,
            { headers: window.createSupabaseHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        adminFormats = await res.json();
        adminFormatsLoaded = true;
        renderAdminFormats();
    } catch (err) {
        host.innerHTML = `<tr><td colspan="6" class="admin-error">${escapeAdminHtml(err.message)}</td></tr>`;
    }
}

function renderAdminFormats() {
    const host = document.getElementById('adminFormatsBody');
    if (!host) return;

    if (!adminFormats.length) {
        host.innerHTML = '<tr><td colspan="6" class="admin-empty">No formats registered yet.</td></tr>';
        return;
    }

    host.innerHTML = adminFormats
        .map(
            (f) => `
        <tr>
            <td><code>${escapeAdminHtml(f.code || '')}</code></td>
            <td>${escapeAdminHtml(f.name || '—')}</td>
            <td>${f.is_default ? '<span class="admin-badge admin-badge--default">Default</span>' : ''}</td>
            <td>${f.is_active ? '<span class="admin-badge admin-badge--active">Active</span>' : '<span class="admin-badge admin-badge--inactive">Inactive</span>'}</td>
            <td>${f.background_url ? `<a href="${escapeAdminHtml(f.background_url)}" target="_blank" rel="noopener" class="admin-link">View BG</a>` : '<span class="admin-dim">—</span>'}</td>
            <td class="admin-actions-cell">
                ${!f.is_default ? `<button class="player-history-register-btn" data-admin-action="set-default-format" data-id="${f.id}">Set Default</button>` : ''}
                <button class="player-history-register-btn" data-admin-action="edit-format" data-id="${f.id}">Edit</button>
                ${!f.is_default ? `<button class="player-history-register-btn admin-btn-danger" data-admin-action="delete-format" data-id="${f.id}" data-name="${escapeAdminHtml(f.name || f.code)}">Delete</button>` : ''}
            </td>
        </tr>
    `
        )
        .join('');
}

function openFormatModal(id) {
    const format = id ? adminFormats.find((f) => f.id === id) : null;
    const modal = document.getElementById('adminFormatModal');
    if (!modal) return;

    modal.querySelector('#adminFormatId').value = id || '';
    modal.querySelector('#adminFormatCode').value = format?.code || '';
    modal.querySelector('#adminFormatName').value = format?.name || '';
    modal.querySelector('#adminFormatIsActive').checked = format ? format.is_active : true;
    modal.querySelector('#adminFormatIsDefault').checked = format?.is_default || false;
    modal.querySelector('#adminFormatFile').value = '';
    modal.querySelector('#adminFormatStatus').textContent = '';

    // Reset bucket browser
    const browser = modal.querySelector('#adminBucketBrowser');
    if (browser) browser.classList.add('is-hidden');

    // Set existing background if any, otherwise try to auto-detect from code
    if (format?.background_url) {
        // Normalize: strip legacy /formats/ sub-path so URL points to bucket root
        const normalizedUrl = format.background_url.replace(
            /(\/storage\/v1\/object\/public\/[^/]+\/)formats\//,
            '$1'
        );
        const normalizedPath = (format.background_path || '').replace(/^formats\//, '');
        setFormatBgPreview(normalizedUrl, normalizedUrl, normalizedPath || null);
    } else {
        clearFormatBackground();
        if (format?.code) autoDetectFormatBackground(format.code);
    }

    modal.querySelector('.admin-modal-title').textContent = format ? 'Edit Format / Meta' : 'New Format / Meta';
    modal.classList.add('active');
}

function closeFormatModal() {
    const modal = document.getElementById('adminFormatModal');
    if (modal) modal.classList.remove('active');
}

async function saveFormat(e) {
    e.preventDefault();
    const modal = document.getElementById('adminFormatModal');
    const statusEl = modal.querySelector('#adminFormatStatus');
    const id = modal.querySelector('#adminFormatId').value;
    const code = modal.querySelector('#adminFormatCode').value.trim().toUpperCase();
    const name = modal.querySelector('#adminFormatName').value.trim();
    const isActive = modal.querySelector('#adminFormatIsActive').checked;
    const isDefault = modal.querySelector('#adminFormatIsDefault').checked;
    const fileInput = modal.querySelector('#adminFormatFile');
    const file = fileInput?.files?.[0] || null;
    const existingBgUrl = modal.querySelector('#adminFormatBgUrl')?.value || null;
    const existingBgPath = modal.querySelector('#adminFormatBgPath')?.value || null;

    if (!code) {
        statusEl.textContent = 'Code is required.';
        return;
    }

    statusEl.textContent = 'Saving…';

    try {
        const payload = { code, name: name || null, is_active: isActive, is_default: isDefault };

        if (file) {
            // New file uploaded — send to storage
            const uploaded = await uploadFormatBackground(file, code);
            payload.background_path = uploaded.path;
            payload.background_url = uploaded.url;
        } else if (existingBgUrl) {
            // Existing image selected from bucket browser
            payload.background_url = existingBgUrl;
            payload.background_path = existingBgPath || null;
        }

        const headers = {
            ...window.createSupabaseHeaders(),
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        };

        const url = id
            ? `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/formats?id=eq.${id}`
            : `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/formats`;

        const res = await fetch(url, {
            method: id ? 'PATCH' : 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.details || `HTTP ${res.status}`);
        }

        closeFormatModal();
        await loadAdminFormats();
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
    }
}

async function setDefaultFormat(id) {
    if (!id) return;
    const headers = {
        ...window.createSupabaseHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
    };
    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/formats?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_default: true }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to set default: ${err.message || res.status}`);
        return;
    }
    await loadAdminFormats();
}

async function deleteFormat(id, name) {
    if (!id) return;
    if (!confirm(`Delete format "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/formats?id=eq.${id}`, {
        method: 'DELETE',
        headers: window.createSupabaseHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to delete: ${err.message || res.status}`);
        return;
    }
    await loadAdminFormats();
}

async function uploadFormatBackground(file, code) {
    const ext = file.name.split('.').pop().toLowerCase() || 'png';
    const path = `${code}.${ext}`;
    const bucket = 'post-backgrounds';
    const uploadUrl = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'true',
        },
        body: file,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Upload failed: HTTP ${res.status}`);
    }

    const publicUrl = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    return { path, url: publicUrl };
}

// ============================================================
// BAN LIST
// ============================================================
async function loadAdminBanList() {
    const host = document.getElementById('adminBanListBody');
    if (!host) return;
    host.innerHTML = '<tr><td colspan="5" class="admin-loading"><div class="spinner"></div></td></tr>';

    try {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/ban_list?select=*&order=restriction.asc,card_code.asc`,
            { headers: window.createSupabaseHeaders() }
        );

        if (!res.ok) {
            if (res.status === 404 || res.status === 400) {
                host.innerHTML =
                    '<tr><td colspan="5" class="admin-empty">Ban list table not found. Run the migration <code>20260320_create_ban_list.sql</code> first.</td></tr>';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        adminBanList = await res.json();
        adminBanListLoaded = true;

        // Build name map from ban_list.card_name
        adminBanNameMap = {};
        adminBanList.forEach((e) => {
            if (e.card_name) adminBanNameMap[e.card_code] = e.card_name;
        });

        renderAdminBanList();
    } catch (err) {
        host.innerHTML = `<tr><td colspan="5" class="admin-error">${escapeAdminHtml(err.message)}</td></tr>`;
    }
}


function renderAdminBanList() {
    const host = document.getElementById('adminBanListBody');
    const countEl = document.getElementById('adminBanListCount');
    if (!host) return;

    if (!adminBanList.length) {
        host.innerHTML = '<tr><td colspan="5" class="admin-empty">No restrictions registered yet.</td></tr>';
        if (countEl) countEl.textContent = '';
        return;
    }

    const query = (document.getElementById('adminBanListSearch')?.value || '').trim().toUpperCase();
    const filtered = query
        ? adminBanList.filter((e) => {
            const name = adminBanNameMap[e.card_code] || '';
            return e.card_code.toUpperCase().includes(query) || name.toUpperCase().includes(query);
          })
        : adminBanList;

    if (countEl) {
        countEl.textContent = query
            ? `${filtered.length} of ${adminBanList.length}`
            : `${adminBanList.length} entries`;
    }

    if (!filtered.length) {
        host.innerHTML = `<tr><td colspan="5" class="admin-empty">No results for "${escapeAdminHtml(query)}".</td></tr>`;
        return;
    }

    const LABELS = {
        banned: 'Banned',
        limited: 'Limited (1 copy)',
        'choice-restricted': 'Choice-Restricted',
    };
    const BADGE_CLASS = {
        banned: 'admin-badge--banned',
        limited: 'admin-badge--limited',
        'choice-restricted': 'admin-badge--choice',
    };

    host.innerHTML = filtered
        .map(
            (entry) => {
                const name = adminBanNameMap[entry.card_code];
                const previewAttr = `data-card-preview-code="${encodeURIComponent(entry.card_code)}"`;
                return `
        <tr>
            <td><code class="stats-card-hover" ${previewAttr}>${escapeAdminHtml(entry.card_code)}</code></td>
            <td class="admin-dim">${name ? `<span class="stats-card-hover" ${previewAttr}>${escapeAdminHtml(name)}</span>` : '<span style="opacity:.45">—</span>'}</td>
            <td><span class="admin-badge ${BADGE_CLASS[entry.restriction] || ''}">${LABELS[entry.restriction] || escapeAdminHtml(entry.restriction)}</span></td>
            <td class="admin-dim">${escapeAdminHtml(entry.notes || '—')}</td>
            <td class="admin-actions-cell">
                <button class="player-history-register-btn" data-admin-action="edit-ban" data-code="${escapeAdminHtml(entry.card_code)}">Edit</button>
                <button class="player-history-register-btn admin-btn-danger" data-admin-action="remove-ban" data-code="${escapeAdminHtml(entry.card_code)}">Remove</button>
            </td>
        </tr>`;
            }
        )
        .join('');

    if (typeof bindStatisticsCardPreview === 'function') {
        bindStatisticsCardPreview(host);
    }
}

function openBanModal(cardCode) {
    const entry = cardCode ? adminBanList.find((b) => b.card_code === cardCode) : null;
    const modal = document.getElementById('adminBanModal');
    if (!modal) return;

    const codeInput = modal.querySelector('#adminBanCardCode');
    codeInput.value = entry?.card_code || '';
    modal.querySelector('#adminBanOriginalCode').value = entry?.card_code || '';

    modal.querySelector('#adminBanRestriction').value = entry?.restriction || 'limited';
    modal.querySelector('#adminBanNotes').value = entry?.notes || '';
    modal.querySelector('#adminBanStatus').textContent = '';
    modal.querySelector('.admin-modal-title').textContent = entry ? 'Edit Restriction' : 'Add Restriction';
    updateBanCardPreview(entry?.card_code || '');
    modal.classList.add('active');
}

function closeBanModal() {
    const modal = document.getElementById('adminBanModal');
    if (modal) modal.classList.remove('active');
}

async function saveBanEntry(e) {
    e.preventDefault();
    const modal = document.getElementById('adminBanModal');
    const statusEl = modal.querySelector('#adminBanStatus');
    const cardCode = modal.querySelector('#adminBanCardCode').value.trim().toUpperCase();
    const originalCode = modal.querySelector('#adminBanOriginalCode').value.trim().toUpperCase();
    const restriction = modal.querySelector('#adminBanRestriction').value;
    const notes = modal.querySelector('#adminBanNotes').value.trim();

    if (!cardCode) {
        statusEl.textContent = 'Card code is required.';
        return;
    }

    statusEl.textContent = 'Saving…';

    try {
        const headers = {
            ...window.createSupabaseHeaders(),
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        };

        const isEdit = !!originalCode;
        let res;

        if (isEdit) {
            // PATCH by original code — allows changing the code itself
            res = await fetch(
                `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/ban_list?card_code=eq.${encodeURIComponent(originalCode)}`,
                {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ card_code: cardCode, restriction, notes: notes || null, card_name: adminBanNameMap[cardCode] || null }),
                }
            );
        } else {
            res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/ban_list`, {
                method: 'POST',
                headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify({ card_code: cardCode, restriction, notes: notes || null, card_name: adminBanNameMap[cardCode] || null }),
            });
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.details || `HTTP ${res.status}`);
        }

        closeBanModal();
        await loadAdminBanList();
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
    }
}

async function removeBanEntry(cardCode) {
    if (!cardCode) return;
    if (!confirm(`Remove restriction for "${cardCode}"?`)) return;

    const res = await fetch(
        `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/ban_list?card_code=eq.${encodeURIComponent(cardCode)}`,
        { method: 'DELETE', headers: window.createSupabaseHeaders() }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to remove: ${err.message || res.status}`);
        return;
    }
    await loadAdminBanList();
}

// ============================================================
// BAN CARD PREVIEW
// ============================================================
const CARD_IMAGE_CDNS = [
    (code) => `https://images.digimoncard.io/images/cards/${code}.webp`,
    (code) => `https://images.digimoncard.io/images/cards/${code}.jpg`,
    (code) => `https://deckbuilder.egmanevents.com//card_images/digimon/${code}.webp`,
];

function updateBanCardPreview(code) {
    const container = document.getElementById('adminBanCardPreview');
    if (!container) return;

    // Cancel any pending debounced API fetch
    if (_banPreviewDebounceTimer) {
        clearTimeout(_banPreviewDebounceTimer);
        _banPreviewDebounceTimer = null;
    }

    // Simple validation: must look like a card code
    if (!code || !/^[A-Z]{1,3}\d{1,2}-\d{1,3}$/.test(code)) {
        container.innerHTML = '';
        return;
    }

    const candidates = CARD_IMAGE_CDNS.map((fn) => fn(code));

    // Show image + placeholder name immediately
    container.innerHTML = `
        <img
            class="admin-ban-card-img"
            src="${escapeAdminHtml(candidates[0])}"
            alt="${escapeAdminHtml(code)}"
            data-candidates='${JSON.stringify(candidates)}'
            data-candidate-index="0"
        />
        <p class="admin-ban-card-name" id="adminBanCardName" style="margin:6px 0 0;font-size:.85rem;text-align:center;opacity:.6;">…</p>
    `;

    const img = container.querySelector('img');
    img.addEventListener('error', () => {
        const list = JSON.parse(img.dataset.candidates || '[]');
        const next = Number(img.dataset.candidateIndex || 0) + 1;
        if (next < list.length) {
            img.dataset.candidateIndex = next;
            img.src = list[next];
        } else {
            img.remove();
        }
    });

    // Check local cache first
    if (adminBanNameMap[code]) {
        const nameEl = document.getElementById('adminBanCardName');
        if (nameEl) nameEl.textContent = adminBanNameMap[code];
        return;
    }

    // Debounce API fetch (400 ms)
    _banPreviewDebounceTimer = setTimeout(() => fetchAndCacheBanCardName(code), 400);
}

async function fetchAndCacheBanCardName(code) {
    const nameEl = document.getElementById('adminBanCardName');
    try {
        const apiUrl = `https://digimoncard.io/api-public/search?card=${encodeURIComponent(code)}&limit=1`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const card = Array.isArray(data) ? data[0] : data;
        const name = card?.name || null;

        if (name) {
            adminBanNameMap[code] = name;
            if (nameEl) nameEl.textContent = name;

            // Save name into ban_list.card_name (only if card is in ban_list)
            if (adminBanList.some((e) => e.card_code === code)) {
                try {
                    await fetch(
                        `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/ban_list?card_code=eq.${encodeURIComponent(code)}`,
                        {
                            method: 'PATCH',
                            headers: {
                                ...window.createSupabaseHeaders(),
                                'Content-Type': 'application/json',
                                Prefer: 'return=minimal',
                            },
                            body: JSON.stringify({ card_name: name }),
                        }
                    );
                } catch (_) { /* best-effort */ }
            }
        } else {
            if (nameEl) nameEl.textContent = '';
        }
    } catch (_) {
        if (nameEl) nameEl.textContent = '';
    }
}

// ============================================================
// BUCKET IMAGE BROWSER
// ============================================================
async function toggleBucketBrowser() {
    const browser = document.getElementById('adminBucketBrowser');
    if (!browser) return;

    if (!browser.classList.contains('is-hidden')) {
        browser.classList.add('is-hidden');
        return;
    }

    browser.classList.remove('is-hidden');
    const grid = document.getElementById('adminBucketImages');
    if (!grid) return;

    grid.innerHTML = '<p style="padding:12px;opacity:.6;">Loading…</p>';

    try {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/list/post-backgrounds`,
            {
                method: 'POST',
                headers: {
                    apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prefix: 'formats/',
                    limit: 200,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' },
                }),
            }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const files = await res.json();

        if (!Array.isArray(files) || files.length === 0) {
            grid.innerHTML = '<p style="padding:12px;opacity:.6;">No images found in formats/ folder.</p>';
            return;
        }

        const base = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/post-backgrounds/formats/`;

        grid.innerHTML = files
            .filter((f) => f.name && !f.name.endsWith('/'))
            .map((f) => {
                const url = base + encodeURIComponent(f.name);
                const displayName = f.name; // just the filename, e.g. "BT23.png"
                const fullPath = `formats/${f.name}`;
                const safeName = escapeAdminHtml(displayName);
                const safeUrl = escapeAdminHtml(url);
                const safePath = escapeAdminHtml(fullPath);
                return `
                <button type="button" class="admin-bucket-thumb" data-admin-action="select-bucket-image"
                    data-url="${safeUrl}" data-path="${safePath}" title="${safeName}">
                    <img src="${safeUrl}" alt="${safeName}" loading="lazy" />
                    <span class="admin-bucket-thumb-name">${safeName}</span>
                </button>`;
            })
            .join('');
    } catch (err) {
        grid.innerHTML = `<p style="padding:12px;color:var(--color-danger,#e74c3c);">${escapeAdminHtml(err.message)}</p>`;
    }
}

function autoDetectFormatBackground(code) {
    if (!code || !window.APP_CONFIG?.SUPABASE_URL) return;
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const bucketBase = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/post-backgrounds/`;

    let found = false;
    for (const ext of extensions) {
        if (found) break;
        const url = `${bucketBase}${encodeURIComponent(code)}.${ext}`;
        const path = `${code}.${ext}`;
        const img = new Image();
        img.onload = () => {
            if (found) return;
            found = true;
            const urlInput = document.getElementById('adminFormatBgUrl');
            if (!urlInput || urlInput.value) return;
            setFormatBgPreview(url, url, path);
        };
        img.src = url;
    }
}

function selectBucketImage(url, path) {
    setFormatBgPreview(url, url, path);
    const browser = document.getElementById('adminBucketBrowser');
    if (browser) browser.classList.add('is-hidden');
}

// ============================================================
// STORE BUCKET BROWSER
// ============================================================
async function toggleStoreBucketBrowser() {
    const browser = document.getElementById('adminStoreBucketBrowser');
    if (!browser) return;

    if (!browser.classList.contains('is-hidden')) {
        browser.classList.add('is-hidden');
        return;
    }

    browser.classList.remove('is-hidden');
    const grid = document.getElementById('adminStoreBucketImages');
    if (!grid) return;

    grid.innerHTML = '<p style="padding:12px;opacity:.6;">Loading…</p>';

    const bucketBase = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/store-logos/`;
    const listHeaders = {
        apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
    };

    async function listPrefix(prefix) {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/list/store-logos`,
            {
                method: 'POST',
                headers: listHeaders,
                body: JSON.stringify({ prefix, limit: 200, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
            }
        );
        if (!res.ok) return [];
        const items = await res.json();
        return Array.isArray(items) ? items : [];
    }

    try {
        // Collect files from root AND stores/ subfolder (covers pre-loaded + admin-uploaded)
        const [rootFiles, subFiles] = await Promise.all([listPrefix(''), listPrefix('stores/')]);

        const entries = [
            ...rootFiles
                .filter((f) => f.name && !f.name.endsWith('/') && f.id) // exclude directory entries
                .map((f) => ({ name: f.name, url: bucketBase + encodeURIComponent(f.name) })),
            ...subFiles
                .filter((f) => f.name && !f.name.endsWith('/') && f.id)
                .map((f) => ({ name: f.name, url: bucketBase + 'stores/' + encodeURIComponent(f.name) })),
        ];

        if (entries.length === 0) {
            grid.innerHTML = '<p style="padding:12px;opacity:.6;">No logos found in store-logos bucket.</p>';
            return;
        }

        grid.innerHTML = entries
            .map(({ name, url }) => {
                const safeName = escapeAdminHtml(name);
                const safeUrl = escapeAdminHtml(url);
                return `
                <button type="button" class="admin-bucket-thumb" data-admin-action="select-store-logo"
                    data-url="${safeUrl}" title="${safeName}">
                    <img src="${safeUrl}" alt="${safeName}" loading="lazy" />
                    <span class="admin-bucket-thumb-name">${safeName}</span>
                </button>`;
            })
            .join('');
    } catch (err) {
        grid.innerHTML = `<p style="padding:12px;color:var(--color-danger,#e74c3c);">${escapeAdminHtml(err.message)}</p>`;
    }
}

function selectStoreLogo(url) {
    setStoreLogoPreview(url);
    const browser = document.getElementById('adminStoreBucketBrowser');
    if (browser) browser.classList.add('is-hidden');
}

function setFormatBgPreview(src, url, path) {
    const wrap = document.getElementById('adminFormatBgSelectedWrap');
    const img = document.getElementById('adminFormatBgPreview');
    const urlInput = document.getElementById('adminFormatBgUrl');
    const pathInput = document.getElementById('adminFormatBgPath');

    if (wrap) wrap.style.display = src ? 'flex' : 'none';
    if (img) {
        img.style.display = '';
        img.alt = 'Selected background';
        img.onerror = () => {
            console.warn('[adminBgPreview] failed to load:', src);
            img.style.display = 'none';
            if (wrap) {
                let fl = wrap.querySelector('.admin-bg-fallback-label');
                if (!fl) {
                    fl = document.createElement('span');
                    fl.className = 'admin-bg-fallback-label';
                    wrap.insertBefore(fl, wrap.firstChild);
                }
                fl.textContent = path || (src ? src.split('/').pop() : '');
            }
        };
        img.src = src || '';
    }
    if (urlInput) urlInput.value = url || '';
    if (pathInput) pathInput.value = path || '';
}

function clearFormatBackground() {
    setFormatBgPreview(null, null, null);
    const fileInput = document.getElementById('adminFormatFile');
    if (fileInput) fileInput.value = '';
}

// ============================================================
// DATA REPAIR
// ============================================================
const REPAIR_DIGIMON_API = 'https://digimoncard.io/api-public/search';
let _repairIncompleteCodesCache = null;

function deriveCardMeta(row) {
    const typeRaw = String(row?.type || '').trim().toLowerCase();
    const card_level = Number.isFinite(Number(row?.level)) && row?.level !== '' && row?.level !== null
        ? Math.trunc(Number(row.level))
        : null;
    let card_type = null;
    if (typeRaw === 'digi-egg' || typeRaw === 'digitama') card_type = 'Digi-Egg';
    else if (typeRaw === 'digimon') card_type = 'Digimon';
    else if (typeRaw === 'tamer')   card_type = 'Tamer';
    else if (typeRaw === 'option')  card_type = 'Option';
    const is_digi_egg = card_type === 'Digi-Egg';
    return { card_type, card_level, is_digi_egg };
}

function repairLog(msg, type = 'info') {
    const log = document.getElementById('adminRepairLog');
    if (!log) return;
    log.classList.remove('is-hidden');
    const line = document.createElement('div');
    line.className = `admin-repair-log-line admin-repair-log-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function repairLogClear() {
    const log = document.getElementById('adminRepairLog');
    if (log) { log.innerHTML = ''; log.classList.add('is-hidden'); }
}

async function fetchRepairIncompleteCodes() {
    const base = window.APP_CONFIG.SUPABASE_URL;
    const hdrs = window.createSupabaseHeaders();
    const out = [];
    const limit = 1000;
    let offset = 0;
    // Fetch card_code + name for all records so we can detect stubs where name === card_code
    while (true) {
        const params = new URLSearchParams({
            select: 'card_code,name',
            order: 'card_code.asc',
            limit: String(limit),
            offset: String(offset),
        });
        const res = await fetch(`${base}/rest/v1/decklist_card_metadata?${params}`, { headers: hdrs });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) break;
        rows.forEach(r => {
            const code = String(r.card_code || '').trim().toUpperCase();
            const name = String(r.name || '').trim();
            // Incomplete if name is missing OR name was set to the card code (stub record)
            if (!name || name === code) out.push(code);
        });
        if (rows.length < limit) break;
        offset += limit;
    }
    return out;
}

// --- progress helpers ---
function repairProgressShow(label, pct, detail) {
    const wrap = document.getElementById('adminRepairProgress');
    const labelEl = document.getElementById('adminRepairProgressLabel');
    const pctEl = document.getElementById('adminRepairProgressPct');
    const bar = document.getElementById('adminRepairProgressBar');
    const detailEl = document.getElementById('adminRepairProgressDetail');
    if (!wrap) return;
    wrap.classList.remove('is-hidden');
    if (labelEl) labelEl.textContent = label;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    if (bar) bar.style.width = `${Math.min(100, pct)}%`;
    if (detailEl && detail !== undefined) detailEl.textContent = detail;
}

function repairProgressHide() {
    const wrap = document.getElementById('adminRepairProgress');
    if (wrap) wrap.classList.add('is-hidden');
}

async function fetchCardsFromDigimonApiAdmin(codes, onProgress) {
    const CHUNK = 20;
    const SLEEP_MS = 800;       // ~10 req/10s — safely under the 15/10s limit
    const SLEEP_MISSED_MS = 400; // individual retries are smaller; 400ms keeps them safe too
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const result = [];
    const usedCodes = new Set();
    const pushRow = (row) => {
        const code = String(row?.id || row?.card || '').trim().toUpperCase();
        if (!code || usedCodes.has(code)) return;
        usedCodes.add(code);
        const { card_type, card_level, is_digi_egg } = deriveCardMeta(row);
        result.push({
            card_code: code,
            id: row?.id || code,
            name: row?.name || null,
            pack: row?.pack || code.split('-')[0] || null,
            color: row?.color || null,
            card_type,
            card_level,
            is_digi_egg,
            card_payload: row || {},
        });
    };

    const chunks = [];
    for (let i = 0; i < codes.length; i += CHUNK) chunks.push(codes.slice(i, i + CHUNK));

    let processed = 0;
    let ci = 0;
    while (ci < chunks.length) {
        const chunk = chunks[ci];
        try {
            const q = new URLSearchParams({ card: chunk.join(','), limit: String(chunk.length * 2), series: 'Digimon Card Game' });
            const res = await fetch(`${REPAIR_DIGIMON_API}?${q}`);
            if (res.status === 429) {
                repairLog(`Rate limited no chunk ${ci + 1} — aguardando 10s…`, 'warn');
                await sleep(10000);
                continue; // retry same chunk
            }
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows)) rows.forEach(pushRow);
            }
        } catch (_) {}

        await sleep(SLEEP_MS);

        // Individual retry for cards not found in the batch
        const missed = chunk.filter(c => !usedCodes.has(c));
        for (const code of missed) {
            try {
                const q = new URLSearchParams({ card: code, limit: '1', series: 'Digimon Card Game' });
                const res = await fetch(`${REPAIR_DIGIMON_API}?${q}`);
                if (res.status === 429) {
                    repairLog(`Rate limited (individual retry ${code}) — aguardando 10s…`, 'warn');
                    await sleep(10000);
                    // retry this code once more
                    const res2 = await fetch(`${REPAIR_DIGIMON_API}?${q}`);
                    if (res2.ok) { const rows = await res2.json(); if (Array.isArray(rows)) rows.forEach(pushRow); }
                } else if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows)) rows.forEach(pushRow);
                }
            } catch (_) {}
            await sleep(SLEEP_MISSED_MS);
        }

        processed += chunk.length;
        ci++;
        if (onProgress) onProgress(processed, codes.length, result.length);
    }
    return result;
}

async function upsertRepairRows(rows, onProgress) {
    const base = window.APP_CONFIG.SUPABASE_URL;
    const hdrs = window.createSupabaseHeaders();
    const CHUNK = 200;
    let done = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const res = await fetch(`${base}/rest/v1/decklist_card_metadata?on_conflict=card_code`, {
            method: 'POST',
            headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(chunk),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`Upsert failed (HTTP ${res.status}): ${detail}`);
        }
        done += chunk.length;
        if (onProgress) onProgress(done, rows.length);
    }
}

async function runRepairCheck() {
    repairLogClear();
    repairProgressHide();
    _repairIncompleteCodesCache = null;
    const countEl = document.getElementById('adminRepairMissingCount');
    const runBtn = document.getElementById('adminRepairRunBtn');
    if (countEl) countEl.textContent = 'Scanning…';
    if (runBtn) runBtn.disabled = true;

    try {
        const codes = await fetchRepairIncompleteCodes();
        _repairIncompleteCodesCache = codes;
        if (countEl) {
            countEl.textContent = codes.length
                ? `Found ${codes.length} card(s) with incomplete metadata.`
                : 'All records are complete. Nothing to repair.';
        }
        if (runBtn) runBtn.disabled = codes.length === 0;
        if (codes.length) repairLog(`${codes.length} incomplete card(s) found. Click "Repair" to fix.`, 'info');
    } catch (err) {
        if (countEl) countEl.textContent = 'Error scanning records.';
        repairLog(`Error: ${err.message}`, 'error');
    }
}

async function runRepairRun() {
    const codes = _repairIncompleteCodesCache;
    if (!codes || !codes.length) { repairLog('Run "Check" first.', 'warn'); return; }

    const runBtn = document.getElementById('adminRepairRunBtn');
    const checkBtn = document.querySelector('[data-admin-action="repair-check"]');
    if (runBtn) runBtn.disabled = true;
    if (checkBtn) checkBtn.disabled = true;
    repairLogClear();

    repairProgressShow('Buscando dados na API…', 0, `0 / ${codes.length} cartas processadas`);
    repairLog(`Iniciando repair de ${codes.length} carta(s)…`, 'info');

    try {
        const fetched = await fetchCardsFromDigimonApiAdmin(codes, (done, total, found) => {
            const pct = (done / total) * 70; // API fetch = 0-70%
            repairProgressShow(
                'Buscando dados na API…',
                pct,
                `${done} / ${total} processadas · ${found} encontradas`
            );
        });

        repairLog(`API retornou dados para ${fetched.length} / ${codes.length} carta(s).`, fetched.length ? 'info' : 'warn');

        // For codes the API couldn't find, save a stub so they stop appearing as incomplete
        const fetchedCodes = new Set(fetched.map(r => r.card_code));
        const stubs = codes
            .filter(c => !fetchedCodes.has(c))
            .map(c => ({
                card_code: c,
                id: c,
                name: c,           // use card_code as name so name IS NOT NULL
                pack: c.split('-')[0] || null,
                color: null,
                card_type: null,   // genuinely unknown
                card_level: null,
                is_digi_egg: false,
                card_payload: {},
            }));

        const allToUpsert = [...fetched, ...stubs];
        repairProgressShow('Salvando no banco…', 70, `0 / ${allToUpsert.length} salvas`);

        await upsertRepairRows(allToUpsert, (done, total) => {
            const pct = 70 + (done / total) * 30;
            repairProgressShow('Salvando no banco…', pct, `${done} / ${total} salvas`);
        });

        repairProgressShow('Concluído!', 100, `${allToUpsert.length} registro(s) atualizados`);

        const missed = stubs.length;
        repairLog(
            `Pronto. ${fetched.length} registro(s) atualizados pela API.${missed ? ` ${missed} não encontrado(s) na API — salvo(s) com registro mínimo.` : ''}`,
            'success'
        );

        _repairIncompleteCodesCache = null;
        const countEl = document.getElementById('adminRepairMissingCount');
        if (countEl) countEl.textContent = 'Repair concluído. Clique em "Check" para verificar novamente.';
    } catch (err) {
        repairProgressHide();
        repairLog(`Erro: ${err.message}`, 'error');
        if (runBtn) runBtn.disabled = false;
    }
    if (checkBtn) checkBtn.disabled = false;
}

// ============================================================
// DOWNLOAD CARDS
// ============================================================
const DIGIMON_ALL_CARDS_API = 'https://digimoncard.io/api-public/getAllCards';
const DL_CHUNK_SIZE = 20;
const DL_SLEEP_MS = 800;

function downloadLog(msg, type = 'info') {
    const log = document.getElementById('adminDownloadLog');
    if (!log) return;
    log.classList.remove('is-hidden');
    const line = document.createElement('div');
    line.className = `admin-repair-log-line admin-repair-log-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function downloadLogClear() {
    const log = document.getElementById('adminDownloadLog');
    if (log) { log.innerHTML = ''; log.classList.add('is-hidden'); }
}

function downloadProgressShow(label, pct, detail) {
    const wrap = document.getElementById('adminDownloadProgress');
    const labelEl = document.getElementById('adminDownloadProgressLabel');
    const pctEl = document.getElementById('adminDownloadProgressPct');
    const bar = document.getElementById('adminDownloadProgressBar');
    const detailEl = document.getElementById('adminDownloadProgressDetail');
    if (!wrap) return;
    wrap.classList.remove('is-hidden');
    if (labelEl) labelEl.textContent = label;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    if (bar) bar.style.width = `${Math.min(100, pct)}%`;
    if (detailEl && detail != null) detailEl.textContent = detail;
}

function downloadProgressHide() {
    const wrap = document.getElementById('adminDownloadProgress');
    if (wrap) wrap.classList.add('is-hidden');
}

async function runDownloadCards() {
    const runBtn = document.getElementById('adminDownloadRunBtn');
    const statusEl = document.getElementById('adminDownloadStatus');
    if (runBtn) runBtn.disabled = true;
    downloadLogClear();
    downloadProgressShow('Buscando lista de cartas…', 0, '');

    try {
        // Step 1: fetch all card numbers from getAllCards
        const params = new URLSearchParams({ series: 'Digimon Card Game', sort: 'card_number', sortdirection: 'asc' });
        const allRes = await fetch(`${DIGIMON_ALL_CARDS_API}?${params}`);
        if (!allRes.ok) throw new Error(`getAllCards falhou: HTTP ${allRes.status}`);
        const allRows = await allRes.json();
        if (!Array.isArray(allRows)) throw new Error('Resposta inesperada do getAllCards');
        const allCodes = allRows.map(r => String(r?.cardnumber || '').trim().toUpperCase()).filter(Boolean);
        downloadLog(`${allCodes.length} cartas encontradas na API.`, 'info');

        if (!allCodes.length) {
            downloadProgressHide();
            if (runBtn) runBtn.disabled = false;
            return;
        }

        // Step 2: fetch existing card_codes from DB and skip them
        downloadProgressShow('Verificando banco de dados…', 5, '');
        const base = window.APP_CONFIG.SUPABASE_URL;
        const hdrs = window.createSupabaseHeaders();
        const existingCodes = new Set();
        let offset = 0;
        const PAGE = 1000;
        while (true) {
            const q = new URLSearchParams({ select: 'card_code,name', order: 'card_code.asc', limit: String(PAGE), offset: String(offset) });
            const res = await fetch(`${base}/rest/v1/decklist_card_metadata?${q}`, { headers: hdrs });
            if (!res.ok) throw new Error(`Erro ao ler banco: HTTP ${res.status}`);
            const batch = await res.json();
            if (!Array.isArray(batch) || !batch.length) break;
            batch.forEach(r => {
                const c = String(r?.card_code || '').trim().toUpperCase();
                const n = String(r?.name || '').trim();
                // Only skip if the record has a real name (not null and not equal to card code = not a stub)
                if (c && n && n !== c) existingCodes.add(c);
            });
            if (batch.length < PAGE) break;
            offset += PAGE;
        }
        const codes = allCodes.filter(c => !existingCodes.has(c));
        downloadLog(`${existingCodes.size} já no banco com nome real — ${codes.length} a baixar (novas + stubs sem nome).`, 'info');

        if (!codes.length) {
            downloadProgressShow('Concluído!', 100, 'Nenhuma carta nova.');
            downloadLog('Catálogo já está atualizado. Nenhuma carta nova para baixar.', 'success');
            if (statusEl) statusEl.textContent = `Catálogo atualizado — ${existingCodes.size} cartas no banco.`;
            if (runBtn) runBtn.disabled = false;
            return;
        }

        // Build a name lookup from getAllCards so we can save minimal records as fallback
        const codeToName = new Map();
        allRows.forEach(r => {
            const c = String(r?.cardnumber || '').trim().toUpperCase();
            if (c) codeToName.set(c, String(r?.name || '').trim() || null);
        });

        // Step 4: chunk and fetch metadata for new codes only
        const chunks = [];
        for (let i = 0; i < codes.length; i += DL_CHUNK_SIZE) chunks.push(codes.slice(i, i + DL_CHUNK_SIZE));

        const fetched = [];
        const usedCodes = new Set();
        let failedChunks = 0;
        let i = 0;

        while (i < chunks.length) {
            const chunk = chunks[i];
            const pct = (i / chunks.length) * 70;
            downloadProgressShow('Buscando metadados na API…', pct, `chunk ${i + 1}/${chunks.length} · ${fetched.length} cartas`);

            try {
                const q = new URLSearchParams({ card: chunk.join(','), limit: String(chunk.length * 2), series: 'Digimon Card Game' });
                const res = await fetch(`${REPAIR_DIGIMON_API}?${q}`);
                if (res.status === 429) {
                    downloadLog(`Rate limited no chunk ${i + 1} — aguardando 10s…`, 'warn');
                    await new Promise(r => setTimeout(r, 10000));
                    continue; // retry same chunk without incrementing i
                }
                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows)) {
                        rows.forEach(row => {
                            const code = String(row?.id || row?.card || '').trim().toUpperCase();
                            if (!code || usedCodes.has(code)) return;
                            usedCodes.add(code);
                            const { card_type, card_level, is_digi_egg } = deriveCardMeta(row);
                            fetched.push({
                                card_code: code,
                                id: row?.id || code,
                                name: row?.name || null,
                                pack: row?.pack || code.split('-')[0] || null,
                                color: row?.color || null,
                                card_type,
                                card_level,
                                is_digi_egg,
                                card_payload: row || {},
                            });
                        });
                    }
                } else {
                    failedChunks++;
                }
            } catch (_) {
                failedChunks++;
            }

            if ((i + 1) % 10 === 0 || i + 1 === chunks.length) {
                downloadLog(`Progresso: ${i + 1}/${chunks.length} chunks · ${fetched.length} cartas`, 'info');
            }

            await new Promise(r => setTimeout(r, DL_SLEEP_MS));
            i++;
        }

        downloadLog(
            `API retornou metadados para ${fetched.length} carta(s).${failedChunks ? ` ${failedChunks} chunk(s) falharam.` : ''}`,
            failedChunks ? 'warn' : 'info'
        );

        // Fallback: for codes not returned by the search API, save a minimal record
        // using the name from getAllCards so they at least exist in the DB.
        const fallback = [];
        codes.forEach(code => {
            if (usedCodes.has(code)) return;
            const name = codeToName.get(code) || null;
            fallback.push({
                card_code: code,
                id: code,
                name,
                pack: code.split('-')[0] || null,
                color: null,
                card_type: null,
                card_level: null,
                is_digi_egg: false,
                card_payload: name ? { id: code, name } : {},
            });
        });
        if (fallback.length) {
            downloadLog(`${fallback.length} carta(s) sem metadados na API — salvas com registro mínimo (nome + código).`, 'warn');
            fetched.push(...fallback);
        }

        if (!fetched.length) {
            downloadProgressHide();
            downloadLog('Nenhum dado retornado pela API.', 'warn');
            if (statusEl) statusEl.textContent = 'Nenhuma carta baixada. Tente novamente.';
            if (runBtn) runBtn.disabled = false;
            return;
        }

        // Step 5: upsert to DB
        downloadProgressShow('Salvando no banco…', 70, `0 / ${fetched.length} salvas`);
        await upsertRepairRows(fetched, (done, total) => {
            const pct = 70 + (done / total) * 30;
            downloadProgressShow('Salvando no banco…', pct, `${done} / ${total} salvas`);
        });

        downloadProgressShow('Concluído!', 100, `${fetched.length} carta(s) salvas`);
        downloadLog(`Pronto. ${fetched.length} carta(s) salvas em decklist_card_metadata.`, 'success');
        if (statusEl) statusEl.textContent = `Última sincronização: ${fetched.length} cartas salvas. Busca no Deck Builder atualizada.`;
    } catch (err) {
        downloadProgressHide();
        downloadLog(`Erro: ${err.message}`, 'error');
        if (statusEl) statusEl.textContent = 'Erro durante o download. Veja o log abaixo.';
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
}

// ============================================================
// EXPORT CATALOG
// ============================================================
const CATALOG_BUCKET = 'card-catalog';
const CATALOG_FILE   = 'card-catalog.json';

function exportLog(msg, type = 'info') {
    const log = document.getElementById('adminExportLog');
    if (!log) return;
    log.classList.remove('is-hidden');
    const line = document.createElement('div');
    line.className = `admin-repair-log-line admin-repair-log-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function exportLogClear() {
    const log = document.getElementById('adminExportLog');
    if (log) { log.innerHTML = ''; log.classList.add('is-hidden'); }
}

function exportProgressShow(label, pct, detail) {
    const wrap    = document.getElementById('adminExportProgress');
    const labelEl = document.getElementById('adminExportProgressLabel');
    const pctEl   = document.getElementById('adminExportProgressPct');
    const bar     = document.getElementById('adminExportProgressBar');
    const detailEl= document.getElementById('adminExportProgressDetail');
    if (!wrap) return;
    wrap.classList.remove('is-hidden');
    if (labelEl)  labelEl.textContent  = label;
    if (pctEl)    pctEl.textContent    = `${Math.round(pct)}%`;
    if (bar)      bar.style.width      = `${Math.min(100, pct)}%`;
    if (detailEl && detail != null) detailEl.textContent = detail;
}

function exportProgressHide() {
    const wrap = document.getElementById('adminExportProgress');
    if (wrap) wrap.classList.add('is-hidden');
}

async function runExportCatalog() {
    const runBtn  = document.getElementById('adminExportRunBtn');
    const statusEl= document.getElementById('adminExportStatus');
    if (runBtn) runBtn.disabled = true;
    exportLogClear();
    exportProgressShow('Lendo banco de dados…', 0, '');

    const base = window.APP_CONFIG.SUPABASE_URL;
    const hdrs = window.createSupabaseHeaders();

    try {
        // Step 1: fetch all cards (lightweight — only fields needed for search/display)
        const allCards = [];
        const PAGE = 1000;
        let offset = 0;
        while (true) {
            const q = new URLSearchParams({
                select: 'card_code,name,pack,color,card_type,card_level,card_payload',
                order:  'card_code.asc',
                limit:  String(PAGE),
                offset: String(offset),
            });
            const res = await fetch(`${base}/rest/v1/decklist_card_metadata?${q}`, { headers: hdrs });
            if (!res.ok) throw new Error(`Erro ao ler banco: HTTP ${res.status}`);
            const batch = await res.json();
            if (!Array.isArray(batch) || !batch.length) break;
            allCards.push(...batch);
            exportProgressShow('Lendo banco de dados…', Math.min(45, (allCards.length / 5000) * 45), `${allCards.length} cartas lidas…`);
            if (batch.length < PAGE) break;
            offset += PAGE;
        }
        exportLog(`${allCards.length} cartas lidas do banco.`, 'info');

        // Step 2: build lightweight catalog (extract only needed fields from payload)
        exportProgressShow('Gerando catálogo…', 50, '');
        const catalog = allCards.map(r => {
            const p = r.card_payload || {};
            return {
                card_code:  r.card_code,
                name:       r.name       || null,
                pack:       r.pack       || null,
                color:      r.color      || null,
                color2:     p.color2     || null,
                card_type:  r.card_type  || null,
                card_level: r.card_level ?? null,
                digi_type:  p.digi_type  || p.digitype  || null,
                digi_type2: p.digi_type2 || null,
                digi_type3: p.digi_type3 || null,
                digi_type4: p.digi_type4 || null,
                play_cost:  p.play_cost  ?? p.playcost ?? null,
                main_effect:   p.main_effect   || null,
                source_effect: p.source_effect || null,
                alt_effect:    p.alt_effect    || null,
                img:        p.img        || null,
            };
        });

        const json = JSON.stringify(catalog);
        const sizeKb = (new TextEncoder().encode(json).byteLength / 1024).toFixed(1);
        exportLog(`Catálogo gerado: ${catalog.length} cartas, ${sizeKb} KB.`, 'info');

        // Step 3: upload to Supabase Storage
        exportProgressShow('Fazendo upload para o bucket…', 70, '');
        const uploadRes = await fetch(
            `${base}/storage/v1/object/${CATALOG_BUCKET}/${CATALOG_FILE}`,
            {
                method: 'POST',
                headers: {
                    ...hdrs,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=86400',
                    'x-upsert': 'true',
                },
                body: json,
            }
        );

        if (!uploadRes.ok) {
            const detail = await uploadRes.text().catch(() => '');
            throw new Error(`Upload falhou: HTTP ${uploadRes.status} — ${detail}`);
        }

        exportProgressShow('Concluído!', 100, `${catalog.length} cartas exportadas`);
        exportLog(`Pronto. Arquivo disponível em: ${base}/storage/v1/object/public/${CATALOG_BUCKET}/${CATALOG_FILE}`, 'success');
        if (statusEl) statusEl.textContent = `Última exportação: ${catalog.length} cartas · ${sizeKb} KB.`;
    } catch (err) {
        exportProgressHide();
        exportLog(`Erro: ${err.message}`, 'error');
        if (statusEl) statusEl.textContent = 'Erro durante o export. Veja o log abaixo.';
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
}

// ============================================================
// STORES
// ============================================================
async function loadAdminStores() {
    const host = document.getElementById('adminStoresBody');
    if (!host) return;
    host.innerHTML = '<tr><td colspan="5" class="admin-loading"><div class="spinner"></div></td></tr>';

    try {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/stores?select=id,name,bandai_nick,logo_url,is_active&order=name.asc`,
            { headers: window.createSupabaseHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        adminStores = await res.json();
        adminStoresLoaded = true;
        renderAdminStores();
    } catch (err) {
        // Fallback: try without optional columns
        try {
            const res2 = await fetch(
                `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/stores?select=id,name,bandai_nick&order=name.asc`,
                { headers: window.createSupabaseHeaders() }
            );
            if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
            adminStores = await res2.json();
            adminStoresLoaded = true;
            renderAdminStores();
        } catch (err2) {
            host.innerHTML = `<tr><td colspan="5" class="admin-error">${escapeAdminHtml(err2.message)}</td></tr>`;
        }
    }
}

function renderAdminStores() {
    const host = document.getElementById('adminStoresBody');
    if (!host) return;

    if (!adminStores.length) {
        host.innerHTML = '<tr><td colspan="5" class="admin-empty">No stores registered yet.</td></tr>';
        return;
    }

    host.innerHTML = adminStores
        .map(
            (s) => `
        <tr>
            <td>${s.logo_url ? `<img src="${escapeAdminHtml(s.logo_url)}" alt="${escapeAdminHtml(s.name)}" style="height:36px;object-fit:contain;border-radius:6px;display:block;" />` : '<span class="admin-dim">—</span>'}</td>
            <td>${escapeAdminHtml(s.name || '—')}</td>
            <td>${s.bandai_nick ? `<code>${escapeAdminHtml(s.bandai_nick)}</code>` : '<span class="admin-dim">—</span>'}</td>
            <td>${s.is_active === false ? '<span class="admin-badge admin-badge--inactive">Inactive</span>' : '<span class="admin-badge admin-badge--active">Active</span>'}</td>
            <td class="admin-actions-cell">
                <button class="player-history-register-btn" data-admin-action="edit-store" data-id="${s.id}">Edit</button>
                <button class="player-history-register-btn admin-btn-danger" data-admin-action="delete-store" data-id="${s.id}" data-name="${escapeAdminHtml(s.name)}">Delete</button>
            </td>
        </tr>
    `
        )
        .join('');
}

function setStoreLogoPreview(url) {
    const wrap = document.getElementById('adminStoreLogoPreviewWrap');
    const img = document.getElementById('adminStoreLogoPreview');
    const urlInput = document.getElementById('adminStoreLogoUrl');
    if (!wrap || !img || !urlInput) return;
    if (url) {
        img.src = url;
        wrap.style.display = 'flex';
        urlInput.value = url;
    } else {
        img.src = '';
        wrap.style.display = 'none';
        urlInput.value = '';
    }
}

function clearStoreLogo() {
    setStoreLogoPreview('');
    const fileInput = document.getElementById('adminStoreLogoFile');
    if (fileInput) fileInput.value = '';
}

async function uploadStoreLogo(file, slug) {
    const ext = file.name.split('.').pop().toLowerCase() || 'png';
    const path = `stores/${slug}-${Date.now()}.${ext}`;
    const bucket = 'store-logos';
    const uploadUrl = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'true',
        },
        body: file,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Upload failed: HTTP ${res.status}`);
    }

    const publicUrl = `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    return { path, url: publicUrl };
}

function openStoreModal(id) {
    const store = id ? adminStores.find((s) => s.id === id) : null;
    const modal = document.getElementById('adminStoreModal');
    if (!modal) return;

    modal.querySelector('#adminStoreId').value = id || '';
    modal.querySelector('#adminStoreName').value = store?.name || '';
    modal.querySelector('#adminStoreBandaiNick').value = store?.bandai_nick || '';
    modal.querySelector('#adminStoreIsActive').checked = store ? store.is_active !== false : true;
    modal.querySelector('#adminStoreStatus').textContent = '';
    modal.querySelector('#adminStoreLogoUploadStatus').textContent = '';
    modal.querySelector('.admin-modal-title').textContent = id ? 'Edit Store' : 'New Store';

    const fileInput = modal.querySelector('#adminStoreLogoFile');
    if (fileInput) fileInput.value = '';
    setStoreLogoPreview(store?.logo_url || '');

    modal.classList.add('active');
}

function closeStoreModal() {
    const modal = document.getElementById('adminStoreModal');
    if (modal) modal.classList.remove('active');
}

async function saveStore(e) {
    e.preventDefault();
    const statusEl = document.getElementById('adminStoreStatus');
    if (statusEl) statusEl.textContent = '';

    const id = document.getElementById('adminStoreId')?.value;
    const name = document.getElementById('adminStoreName')?.value.trim();
    const bandai_nick = document.getElementById('adminStoreBandaiNick')?.value.trim() || null;
    const logo_url = document.getElementById('adminStoreLogoUrl')?.value.trim() || null;
    const is_active = document.getElementById('adminStoreIsActive')?.checked ?? true;

    if (!name) {
        if (statusEl) statusEl.textContent = 'Name is required.';
        return;
    }

    const payload = { name, bandai_nick, logo_url, is_active };
    const submitBtn = document.querySelector('#adminStoreForm [type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        let res;
        if (id) {
            res = await fetch(
                `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/stores?id=eq.${encodeURIComponent(id)}`,
                {
                    method: 'PATCH',
                    headers: { ...window.createSupabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
                    body: JSON.stringify(payload),
                }
            );
        } else {
            res = await fetch(
                `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/stores`,
                {
                    method: 'POST',
                    headers: { ...window.createSupabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
                    body: JSON.stringify(payload),
                }
            );
        }
        if (!res.ok) {
            const body = await res.text();
            throw new Error(body || `HTTP ${res.status}`);
        }
        closeStoreModal();
        adminStoresLoaded = false;
        await loadAdminStores();
    } catch (err) {
        if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteStore(id, name) {
    if (!confirm(`Delete store "${name}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(
            `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/stores?id=eq.${encodeURIComponent(id)}`,
            { method: 'DELETE', headers: window.createSupabaseHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        adminStoresLoaded = false;
        await loadAdminStores();
    } catch (err) {
        alert(`Error deleting store: ${err.message}`);
    }
}

// ============================================================
// UTILS
// ============================================================
function escapeAdminHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
