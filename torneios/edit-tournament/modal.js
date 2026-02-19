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
let editResults = [];
let editOriginalResultIds = [];

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
    const res = await fetch(`${modalSupabaseUrl}/rest/v1/stores?select=*&order=name.asc`, {
        headers: modalHeaders
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro ao carregar lojas (${res.status}): ${errorText}`);
    }

    const stores = await res.json();
    const select = document.getElementById('editStoreSelect');
    select.innerHTML = '<option value="">Selecione a loja...</option>';

    stores.forEach((s) => {
        const isSelected = String(s.id) === String(selectedStoreId);
        select.innerHTML += `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
    });
}

async function loadPlayersToEdit() {
    const res = await fetch(`${modalSupabaseUrl}/rest/v1/players?select=id,name&order=name.asc`, {
        headers: modalHeaders
    });
    if (!res.ok) throw new Error('Erro ao carregar players');
    editPlayers = await res.json();
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
        deck_id: r.deck_id || ''
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
                        class="player-input"
                        data-autocomplete-type="player"
                        placeholder="Digite o player..."
                        value="${escapeHtml(getItemNameById(editPlayers, row.player_id))}"
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
        next.push(editResults[i] || { id: null, player_id: '', deck_id: '' });
    }
    editResults = next;
    renderEditResultsRows();
}

function addEditResultRow() {
    if (editResults.length >= 36) {
        alert('O limite maximo e 36 jogadores neste modal.');
        return;
    }

    editResults.push({ id: null, player_id: '', deck_id: '' });
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
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editResults = [];
    editOriginalResultIds = [];
    renderEditResultsRows();
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
