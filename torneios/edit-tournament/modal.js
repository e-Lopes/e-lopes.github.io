let editingTournamentId = null;
let editPlayers = [];
let editDecks = [];
let editResults = [];
let editOriginalResultIds = [];

function editTournament(id) {
    if (!id) {
        alert("Erro: ID do torneio nao encontrado");
        return;
    }

    editingTournamentId = id;
    openEditModal();
    loadEditFormData(id);
}

async function loadEditFormData(id) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(id)}&select=*`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
            throw new Error(`Erro ao carregar dados do torneio (${res.status})`);
        }

        const data = (await res.json())[0];
        if (!data) {
            alert("Torneio nao encontrado");
            closeEditModal();
            return;
        }

        document.getElementById("editTournamentDate").value = data.tournament_date || "";
        document.getElementById("editTournamentName").value = data.tournament_name || "";
        document.getElementById("editTotalPlayers").value = "0";
        document.getElementById("editInstagramLink").value = data.instagram_link || "";

        await Promise.all([
            loadStoresToEdit(data.store_id),
            loadPlayersToEdit(),
            loadDecksToEdit()
        ]);

        await loadResultsToEdit(id, data);
        renderEditResultsRows();
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao carregar dados do torneio: " + err.message);
        closeEditModal();
    }
}

async function loadStoresToEdit(selectedStoreId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro ao carregar lojas (${res.status}): ${errorText}`);
    }

    const stores = await res.json();
    const select = document.getElementById("editStoreSelect");
    select.innerHTML = '<option value="">Selecione a loja...</option>';

    stores.forEach((s) => {
        const isSelected = String(s.id) === String(selectedStoreId);
        select.innerHTML += `<option value="${s.id}" ${isSelected ? "selected" : ""}>${s.name}</option>`;
    });
}

async function loadPlayersToEdit() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id,name&order=name.asc`, { headers });
    if (!res.ok) throw new Error("Erro ao carregar players");
    editPlayers = await res.json();
}

async function loadDecksToEdit() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=id,name&order=name.asc`, { headers });
    if (!res.ok) throw new Error("Erro ao carregar decks");
    editDecks = await res.json();
}

async function loadResultsToEdit(tournamentId, tournamentData) {
    let res = await fetch(
        `${SUPABASE_URL}/rest/v1/tournament_results?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=id,placement,player_id,deck_id&order=placement.asc`,
        { headers }
    );

    if (!res.ok) throw new Error("Erro ao carregar resultados do torneio");

    let rows = await res.json();

    if ((!rows || rows.length === 0) && tournamentData?.store_id && tournamentData?.tournament_date) {
        // compatibilidade para resultados antigos sem tournament_id
        res = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${encodeURIComponent(tournamentData.store_id)}&tournament_date=eq.${tournamentData.tournament_date}&select=id,placement,player_id,deck_id&order=placement.asc`,
            { headers }
        );
        if (!res.ok) throw new Error("Erro ao carregar resultados antigos do torneio");
        rows = await res.json();
    }

    editResults = (rows || []).slice(0, 36).map((r) => ({
        id: r.id,
        player_id: r.player_id || "",
        deck_id: r.deck_id || ""
    }));

    editOriginalResultIds = editResults.map((r) => r.id).filter(Boolean);
}

function buildEditOptions(items, selectedValue, placeholder) {
    const initial = `<option value="">${placeholder}</option>`;
    const options = items.map((item) => {
        const selected = String(item.id) === String(selectedValue) ? "selected" : "";
        return `<option value="${item.id}" ${selected}>${item.name}</option>`;
    });

    return initial + options.join("");
}

function renderEditResultsRows() {
    const container = document.getElementById("editResultsRows");
    if (!container) return;

    if (editResults.length === 0) {
        container.innerHTML = "";
        document.getElementById("editTotalPlayers").value = "";
        return;
    }

    container.innerHTML = editResults.map((row, index) => `
        <div class="result-row">
            <div class="form-group">
                <label>Placement</label>
                <input type="number" value="${index + 1}" disabled>
            </div>
            <div class="form-group">
                <label>Player<span class="required">*</span></label>
                <select onchange="updateEditResultField(${index}, 'player_id', this.value)" required>
                    ${buildEditOptions(editPlayers, row.player_id, "Selecione o player...")}
                </select>
            </div>
            <div class="form-group">
                <label>Deck<span class="required">*</span></label>
                <select onchange="updateEditResultField(${index}, 'deck_id', this.value)" required>
                    ${buildEditOptions(editDecks, row.deck_id, "Selecione o deck...")}
                </select>
            </div>
            <button type="button" class="btn-remove-result" onclick="removeEditResultRow(${index})">Remove</button>
        </div>
    `).join("");

    document.getElementById("editTotalPlayers").value = String(editResults.length);
}

function syncEditResultsByTotal() {
    const totalInput = document.getElementById("editTotalPlayers");
    const qty = parseInt(totalInput.value, 10);

    if (!Number.isInteger(qty) || qty < 1) {
        editResults = [];
        renderEditResultsRows();
        return;
    }

    const next = [];
    for (let i = 0; i < Math.min(qty, 36); i++) {
        next.push(editResults[i] || { id: null, player_id: "", deck_id: "" });
    }
    editResults = next;
    renderEditResultsRows();
}

function addEditResultRow() {
    if (editResults.length >= 36) {
        alert("O limite maximo e 36 jogadores neste modal.");
        return;
    }

    editResults.push({ id: null, player_id: "", deck_id: "" });
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
    document.getElementById("btnAddEditResultRow").onclick = addEditResultRow;
    document.getElementById("editTotalPlayers").oninput = syncEditResultsByTotal;
    document.getElementById("editModal").classList.add("active");
}

function closeEditModal() {
    document.getElementById("editModal").classList.remove("active");
    editResults = [];
    editOriginalResultIds = [];
    renderEditResultsRows();
}

async function editTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#editTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";

    try {
        const totalPlayers = editResults.length;
        const updated = {
            store_id: document.getElementById("editStoreSelect").value,
            tournament_date: document.getElementById("editTournamentDate").value,
            tournament_name: document.getElementById("editTournamentName").value,
            total_players: totalPlayers,
            instagram_link: document.getElementById("editInstagramLink").value.trim()
        };

        const hasInvalidResult = editResults.some((r) => !r.player_id || !r.deck_id);
        if (!updated.store_id || !updated.tournament_date || !updated.tournament_name || updated.total_players < 1 || hasInvalidResult) {
            alert("Por favor preencha todos os campos obrigatorios");
            return;
        }

        const url = `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(editingTournamentId)}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(updated)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Erro ao salvar torneio:", res.status, errorText);
            throw new Error(`Erro ao salvar torneio (${res.status})`);
        }

        for (const id of editOriginalResultIds) {
            await fetch(`${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers
            });
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

        const resultsRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results`, {
            method: "POST",
            headers,
            body: JSON.stringify(resultsPayload)
        });

        if (!resultsRes.ok) {
            const errorText = await resultsRes.text();
            console.error("Erro ao salvar results:", resultsRes.status, errorText);
            throw new Error(`Erro ao salvar tournament_results (${resultsRes.status})`);
        }

        closeEditModal();
        // Recarrega a tabela de torneios
        if (typeof loadTournaments === 'function') {
            await loadTournaments();
            if (typeof applyFilters === "function") {
                applyFilters();
            } else {
                renderTable();
                renderPagination();
            }
        }
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao salvar torneio: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
