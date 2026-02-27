const modalSupabaseUrl =
    window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const modalSupabaseAnonKey = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const modalHeaders = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: modalSupabaseAnonKey,
          Authorization: `Bearer ${modalSupabaseAnonKey}`,
          'Content-Type': 'application/json'
      };

let editingTournamentId = null;
let editPlayers = [];
let editDecks = [];
let editStores = [];
let editResults = [];
let editOriginalResultIds = [];
let editOcrSelectedFiles = [];
let editOcrImportInProgress = false;
const editOcrApiBaseUrl = 'https://e-lopes-digimon-ocr-api.hf.space';

function editTournament(id) {
    if (!id) {
        alert('Erro: ID do torneio nao encontrado');
        return;
    }

    editingTournamentId = id;
    openEditModal();
    loadEditFormData(id);
}

async function loadEditFormData(id) {
    try {
        resetEditOcrImportUi();
        const url = `${modalSupabaseUrl}/rest/v1/tournament?id=eq.${encodeURIComponent(id)}&select=*`;
        const res = await fetch(url, { headers: modalHeaders });

        if (!res.ok) {
            throw new Error(`Erro ao carregar dados do torneio (${res.status})`);
        }

        const data = (await res.json())[0];
        if (!data) {
            alert('Torneio nao encontrado');
            closeEditModal();
            return;
        }

        document.getElementById('editTournamentDate').value = data.tournament_date || '';
        document.getElementById('editTournamentName').value = data.tournament_name || '';
        document.getElementById('editTotalPlayers').value = '0';
        document.getElementById('editInstagramLink').value = data.instagram_link || '';

        const formatLoaderPromise =
            typeof loadTournamentFormats === 'function' ? loadTournamentFormats() : Promise.resolve();
        await Promise.all([
            loadStoresToEdit(data.store_id),
            loadPlayersToEdit(),
            loadDecksToEdit(),
            formatLoaderPromise
        ]);

        if (typeof populateTournamentFormatSelect === 'function') {
            populateTournamentFormatSelect('editTournamentFormat', {
                selectedId: data.format_id
            });
        } else {
            const editFormatInput = document.getElementById('editTournamentFormat');
            if (editFormatInput) editFormatInput.value = String(data.format_id || '');
        }

        await loadResultsToEdit(id, data);
        renderEditResultsRows();
    } catch (err) {
        console.error('Erro completo:', err);
        alert('Falha ao carregar dados do torneio: ' + err.message);
        closeEditModal();
    }
}

async function loadStoresToEdit(selectedStoreId) {
    let res = await fetch(
        `${modalSupabaseUrl}/rest/v1/stores?select=id,name,bandai_nick&order=name.asc`,
        {
            headers: modalHeaders
        }
    );
    if (!res.ok) {
        res = await fetch(`${modalSupabaseUrl}/rest/v1/stores?select=id,name&order=name.asc`, {
            headers: modalHeaders
        });
    }
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro ao carregar lojas (${res.status}): ${errorText}`);
    }

    const stores = await res.json();
    editStores = stores || [];
    const select = document.getElementById('editStoreSelect');
    select.innerHTML = '<option value="">Selecione a loja...</option>';

    stores.forEach((s) => {
        const isSelected = String(s.id) === String(selectedStoreId);
        select.innerHTML += `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
    });
}

async function loadPlayersToEdit() {
    const res = await fetch(
        `${modalSupabaseUrl}/rest/v1/players?select=id,name,bandai_id,bandai_nick&order=name.asc`,
        {
            headers: modalHeaders
        }
    );
    if (!res.ok) throw new Error('Erro ao carregar players');
    editPlayers = (await res.json()).map((player) => ({
        ...player,
        bandai_id: player.bandai_id || '',
        bandai_nick: player.bandai_nick || ''
    }));
}

async function loadDecksToEdit() {
    const res = await fetch(`${modalSupabaseUrl}/rest/v1/decks?select=id,name&order=name.asc`, {
        headers: modalHeaders
    });
    if (!res.ok) throw new Error('Erro ao carregar decks');
    editDecks = await res.json();
}

async function loadResultsToEdit(tournamentId, tournamentData) {
    let res = await fetch(
        `${modalSupabaseUrl}/rest/v1/tournament_results?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=id,placement,player_id,deck_id&order=placement.asc`,
        { headers: modalHeaders }
    );

    if (!res.ok) throw new Error('Erro ao carregar resultados do torneio');

    let rows = await res.json();

    if (
        (!rows || rows.length === 0) &&
        tournamentData?.store_id &&
        tournamentData?.tournament_date
    ) {
        // compatibilidade para resultados antigos sem tournament_id
        res = await fetch(
            `${modalSupabaseUrl}/rest/v1/tournament_results?store_id=eq.${encodeURIComponent(tournamentData.store_id)}&tournament_date=eq.${tournamentData.tournament_date}&select=id,placement,player_id,deck_id&order=placement.asc`,
            { headers: modalHeaders }
        );
        if (!res.ok) throw new Error('Erro ao carregar resultados antigos do torneio');
        rows = await res.json();
    }

    editResults = (rows || []).slice(0, 36).map((r) => ({
        id: r.id,
        player_id: r.player_id || '',
        deck_id: r.deck_id || '',
        player_name: '',
        ocr_player_unmatched: false
    }));

    editOriginalResultIds = editResults.map((r) => r.id).filter(Boolean);
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

function bindEditResultsAutocomplete() {
    const wrappers = document.querySelectorAll('#editResultsRows .autocomplete-wrapper');
    wrappers.forEach((wrapper) => {
        const input = wrapper.querySelector('input[data-autocomplete-type]');
        const dropdown = wrapper.querySelector('.autocomplete-dropdown');
        if (!input || !dropdown) return;

        const rowIndex = Number(wrapper.dataset.rowIndex);
        const type = input.dataset.autocompleteType;
        const field = type === 'player' ? 'player_id' : 'deck_id';
        const source = type === 'player' ? editPlayers : editDecks;

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
            updateEditResultField(rowIndex, field, '');
            if (type === 'player') {
                updateEditResultField(rowIndex, 'player_name', input.value.trim());
                updateEditResultField(rowIndex, 'ocr_player_unmatched', Boolean(input.value.trim()));
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
            updateEditResultField(rowIndex, field, option.dataset.id || '');
            if (type === 'player') {
                updateEditResultField(rowIndex, 'player_name', option.dataset.name || '');
                updateEditResultField(rowIndex, 'ocr_player_unmatched', false);
            }
            input.value = option.dataset.name || '';
            dropdown.style.display = 'none';
        });
    });
}

function renderEditResultsRows() {
    const container = document.getElementById('editResultsRows');
    if (!container) return;

    if (editResults.length === 0) {
        container.innerHTML = '';
        document.getElementById('editTotalPlayers').value = '';
        return;
    }

    container.innerHTML = editResults
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
                        value="${escapeHtml(getItemNameById(editPlayers, row.player_id) || row.player_name || '')}"
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
                        value="${escapeHtml(getItemNameById(editDecks, row.deck_id))}"
                        autocomplete="off"
                        required
                    >
                    <div class="autocomplete-dropdown"></div>
                </div>
            </div>
            <button type="button" class="btn-remove-result" data-edit-remove-index="${index}" aria-label="Remove result" title="Remove result">
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

    container.querySelectorAll('[data-edit-remove-index]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-edit-remove-index'));
            removeEditResultRow(index);
        });
    });
    bindEditResultsAutocomplete();

    document.getElementById('editTotalPlayers').value = String(editResults.length);
}

function syncEditResultsByTotal() {
    const totalInput = document.getElementById('editTotalPlayers');
    const qty = parseInt(totalInput.value, 10);

    if (!Number.isInteger(qty) || qty < 1) {
        editResults = [];
        renderEditResultsRows();
        return;
    }

    const next = [];
    for (let i = 0; i < Math.min(qty, 36); i++) {
        next.push(
            editResults[i] || {
                id: null,
                player_id: '',
                deck_id: '',
                player_name: '',
                ocr_player_unmatched: false
            }
        );
    }
    editResults = next;
    renderEditResultsRows();
}

function addEditResultRow() {
    if (editResults.length >= 36) {
        alert('O limite maximo e 36 jogadores neste modal.');
        return;
    }

    editResults.push({
        id: null,
        player_id: '',
        deck_id: '',
        player_name: '',
        ocr_player_unmatched: false
    });
    renderEditResultsRows();
}

function removeEditResultRow(index) {
    editResults.splice(index, 1);
    renderEditResultsRows();
}

function updateEditResultField(index, field, value) {
    if (!editResults[index]) return;
    editResults[index][field] = value;
}

function openEditModal() {
    bindEditModalActions();
    document.getElementById('editModal').classList.add('active');
}

function bindEditModalActions() {
    const btnAddEditResultRow = document.getElementById('btnAddEditResultRow');
    const editTotalPlayers = document.getElementById('editTotalPlayers');
    const btnEditModalCancel = document.getElementById('btnEditModalCancel');
    const btnSelectEditOcrPrints = document.getElementById('btnSelectEditOcrPrints');
    const editOcrFilesInput = document.getElementById('editOcrFilesInput');

    if (btnAddEditResultRow && !btnAddEditResultRow.dataset.bound) {
        btnAddEditResultRow.addEventListener('click', addEditResultRow);
        btnAddEditResultRow.dataset.bound = 'true';
    }

    if (editTotalPlayers && !editTotalPlayers.dataset.bound) {
        editTotalPlayers.addEventListener('input', syncEditResultsByTotal);
        editTotalPlayers.dataset.bound = 'true';
    }

    if (btnEditModalCancel && !btnEditModalCancel.dataset.bound) {
        btnEditModalCancel.addEventListener('click', closeEditModal);
        btnEditModalCancel.dataset.bound = 'true';
    }

    if (btnSelectEditOcrPrints && editOcrFilesInput && !btnSelectEditOcrPrints.dataset.bound) {
        btnSelectEditOcrPrints.addEventListener('click', () => {
            if (editOcrImportInProgress) return;
            editOcrFilesInput.click();
        });
        editOcrFilesInput.addEventListener('change', onEditOcrFilesSelected);
        btnSelectEditOcrPrints.dataset.bound = 'true';
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editResults = [];
    editOriginalResultIds = [];
    resetEditOcrImportUi();
    renderEditResultsRows();
}

function setEditOcrStatus(message, tone = 'info') {
    const el = document.getElementById('editOcrStatus');
    if (!el) return;
    const prefix = tone === 'error' ? 'Erro: ' : tone === 'success' ? 'OK: ' : '';
    el.textContent = `${prefix}${message}`.trim();
}

function setEditOcrSelectedInfo(message) {
    const el = document.getElementById('editOcrSelectedInfo');
    if (!el) return;
    el.textContent = message || '';
}

function resetEditOcrImportUi() {
    editOcrImportInProgress = false;
    editOcrSelectedFiles = [];
    const input = document.getElementById('editOcrFilesInput');
    const button = document.getElementById('btnSelectEditOcrPrints');
    if (input) input.value = '';
    if (button) button.disabled = false;
    setEditOcrSelectedInfo('');
    setEditOcrStatus('');
}

function normalizeLookupNameModal(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeMemberIdModal(value) {
    return String(value || '')
        .toUpperCase()
        .replace(/\s+/g, '');
}

function isGuestMemberIdModal(value) {
    return /^GUEST/i.test(normalizeMemberIdModal(value));
}

function parseOcrRankModal(value, index) {
    const rank = Number(value);
    if (Number.isFinite(rank) && rank > 0) return rank;
    return index + 1;
}

function extractOcrPlayersModal(payload) {
    const players = Array.isArray(payload?.players) ? payload.players : [];
    return players
        .map((item, index) => ({
            rank: parseOcrRankModal(item?.rank, index),
            name: String(item?.name || '').trim(),
            member_id: normalizeMemberIdModal(item?.member_id),
            points: String(item?.points || '').trim(),
            omw: String(item?.omw || '').trim()
        }))
        .filter((item) => item.name || item.member_id)
        .slice(0, 100);
}

function mergeOcrPlayersByMemberIdModal(allPlayers) {
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

function findPlayerMatchFromOcrModal(ocrPlayer) {
    const ocrMemberId = normalizeMemberIdModal(ocrPlayer.member_id);
    const ocrName = normalizeLookupNameModal(ocrPlayer.name);

    if (ocrMemberId && !isGuestMemberIdModal(ocrMemberId)) {
        const byBandaiId = editPlayers.find(
            (player) => normalizeMemberIdModal(player.bandai_id) === ocrMemberId
        );
        if (byBandaiId?.id) return byBandaiId;
    }

    if (ocrName) {
        const byBandaiNick = editPlayers.find(
            (player) => normalizeLookupNameModal(player.bandai_nick) === ocrName
        );
        if (byBandaiNick?.id) return byBandaiNick;

        const byName = editPlayers.find((player) => normalizeLookupNameModal(player.name) === ocrName);
        if (byName?.id) return byName;
    }

    return null;
}

function normalizeOcrTournamentDateModal(rawText) {
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
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    const brMatch = normalized.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (brMatch) {
        const day = Number(brMatch[1]);
        const month = Number(brMatch[2]);
        const year = Number(brMatch[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    return '';
}

function extractOcrStoreAndDateModal(payload) {
    return {
        storeName: String(
            payload?.store_name || payload?.store || payload?.shop || payload?.venue || ''
        ).trim(),
        tournamentDate: normalizeOcrTournamentDateModal(
            payload?.tournament_date || payload?.event_date || payload?.tournament_datetime || payload?.date || ''
        )
    };
}

function resolveStoreFromOcrNameModal(storeName) {
    const target = normalizeLookupNameModal(storeName);
    if (!target || !editStores.length) return null;

    const getAliases = (store) =>
        [store?.name, store?.bandai_nick, store?.store_nick, store?.nick, store?.alias]
            .map((value) => normalizeLookupNameModal(value))
            .filter(Boolean);

    const exact = editStores.find((store) => getAliases(store).some((alias) => alias === target));
    if (exact) return exact;

    return (
        editStores.find((store) =>
            getAliases(store).some((alias) => alias.includes(target) || target.includes(alias))
        ) || null
    );
}

async function requestOcrFromImageModal(file) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const res = await fetch(`${editOcrApiBaseUrl}/process`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) {
        throw new Error(`OCR endpoint respondeu ${res.status}`);
    }
    return res.json();
}

function onEditOcrFilesSelected(event) {
    const files = Array.from(event.target?.files || []);
    editOcrSelectedFiles = files;
    if (!files.length) {
        setEditOcrSelectedInfo('');
        setEditOcrStatus('');
        return;
    }
    setEditOcrSelectedInfo(`${files.length} print(s) selecionado(s).`);
    setEditOcrStatus('Processando...');
    processEditOcrFiles();
}

async function processEditOcrFiles() {
    if (!editOcrSelectedFiles.length) {
        setEditOcrStatus('Selecione ao menos um print antes de processar.', 'error');
        return;
    }
    if (editOcrImportInProgress) return;
    editOcrImportInProgress = true;

    const btnSelect = document.getElementById('btnSelectEditOcrPrints');
    if (btnSelect) btnSelect.disabled = true;

    try {
        if (!editPlayers.length) await loadPlayersToEdit();
        if (!editStores.length) await loadStoresToEdit(document.getElementById('editStoreSelect').value);

        const allPlayers = [];
        const detectedStores = [];
        const detectedDates = [];
        for (const file of editOcrSelectedFiles) {
            const payload = await requestOcrFromImageModal(file);
            allPlayers.push(...extractOcrPlayersModal(payload));
            const meta = extractOcrStoreAndDateModal(payload);
            if (meta.storeName) detectedStores.push(meta.storeName);
            if (meta.tournamentDate) detectedDates.push(meta.tournamentDate);
        }

        const mergedPlayers = mergeOcrPlayersByMemberIdModal(allPlayers);
        if (!mergedPlayers.length) {
            throw new Error('Nenhum resultado reconhecido na imagem');
        }

        const preservedDecks = editResults.map((row) => row.deck_id || '');
        editResults = mergedPlayers.map((ocrPlayer, index) => {
            const matchedPlayer = findPlayerMatchFromOcrModal(ocrPlayer);
            return {
                id: null,
                player_id: matchedPlayer?.id || '',
                deck_id: preservedDecks[index] || '',
                player_name: ocrPlayer.name || '',
                ocr_player_unmatched: !matchedPlayer?.id
            };
        });

        renderEditResultsRows();
        document.getElementById('editTotalPlayers').value = String(editResults.length);

        const selectedStoreName = detectedStores[0] || '';
        const selectedDate = detectedDates[0] || '';
        if (selectedStoreName) {
            const matchedStore = resolveStoreFromOcrNameModal(selectedStoreName);
            if (matchedStore?.id) {
                document.getElementById('editStoreSelect').value = String(matchedStore.id);
            }
        }
        if (selectedDate) {
            document.getElementById('editTournamentDate').value = selectedDate;
        }

        const unresolvedPlayers = editResults.filter((row) => !row.player_id).length;
        const unresolvedStore = selectedStoreName
            ? !resolveStoreFromOcrNameModal(selectedStoreName)
            : false;
        if (unresolvedPlayers) {
            setEditOcrStatus(
                `OCR: ${editResults.length} players, ${unresolvedPlayers} sem match${unresolvedStore ? ', loja sem match' : ''}. Decks preservados.`,
                'info'
            );
        } else {
            setEditOcrStatus(
                `OCR concluido (${editResults.length} players). Decks preservados.`,
                'success'
            );
        }
    } catch (err) {
        console.error('Erro no OCR (edit):', err);
        setEditOcrStatus(err.message || 'Falha ao processar OCR.', 'error');
    } finally {
        editOcrImportInProgress = false;
        if (btnSelect) btnSelect.disabled = false;
    }
}

async function editTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#editTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
        const totalPlayers = editResults.length;
        const updatedBase = {
            store_id: document.getElementById('editStoreSelect').value,
            tournament_date: document.getElementById('editTournamentDate').value,
            tournament_name: document.getElementById('editTournamentName').value,
            total_players: totalPlayers,
            instagram_link: document.getElementById('editInstagramLink').value.trim()
        };
        const formatSelection =
            typeof readTournamentFormatValue === 'function'
                ? readTournamentFormatValue('editTournamentFormat')
                : { formatId: null, formatCode: '' };
        const updated =
            typeof assignTournamentFormat === 'function'
                ? assignTournamentFormat(updatedBase, formatSelection)
                : updatedBase;

        const hasInvalidResult = editResults.some((r) => !r.player_id || !r.deck_id);
        const validInstagram = window.validation
            ? window.validation.isValidOptionalUrl(updated.instagram_link)
            : true;
        if (
            !updated.store_id ||
            !updated.tournament_date ||
            !updated.tournament_name ||
            updated.total_players < 1 ||
            !validInstagram ||
            hasInvalidResult
        ) {
            alert('Please fill all required fields correctly.');
            return;
        }

        const url = `${modalSupabaseUrl}/rest/v1/tournament?id=eq.${encodeURIComponent(editingTournamentId)}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: modalHeaders,
            body: JSON.stringify(updated)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Erro ao salvar torneio:', res.status, errorText);
            throw new Error(`Erro ao salvar torneio (${res.status})`);
        }

        for (const id of editOriginalResultIds) {
            await fetch(
                `${modalSupabaseUrl}/rest/v1/tournament_results?id=eq.${encodeURIComponent(id)}`,
                {
                    method: 'DELETE',
                    headers: modalHeaders
                }
            );
        }

        const resultsPayload = editResults.map((row, index) => ({
            tournament_id: editingTournamentId,
            store_id: updated.store_id,
            tournament_date: updated.tournament_date,
            total_players: updated.total_players,
            placement: index + 1,
            deck_id: row.deck_id,
            player_id: row.player_id
        }));

        const resultsRes = await fetch(`${modalSupabaseUrl}/rest/v1/tournament_results`, {
            method: 'POST',
            headers: modalHeaders,
            body: JSON.stringify(resultsPayload)
        });

        if (!resultsRes.ok) {
            const errorText = await resultsRes.text();
            console.error('Erro ao salvar results:', resultsRes.status, errorText);
            throw new Error(`Erro ao salvar tournament_results (${resultsRes.status})`);
        }

        closeEditModal();
        // Recarrega a tabela de torneios
        if (typeof loadTournaments === 'function') {
            await loadTournaments();
            if (typeof applyFilters === 'function') {
                applyFilters();
            } else {
                renderTable();
                renderPagination();
            }
        }
    } catch (err) {
        console.error('Erro completo:', err);
        alert('Falha ao salvar torneio: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
