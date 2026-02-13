const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";
const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

let tournaments = [];
let currentPage = 1;
const perPage = 30;
let createPlayers = [];
let createDecks = [];
let createResults = [];
let selectedTournamentId = null;

// ============================================================
// FUNÇÃO DE FORMATAÇÃO DE DATA
// ============================================================
function formatDate(dateString) {
    if (!dateString) return "—";
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// ============================================================
// INICIALIZAÇÃO - DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadTournaments();
    renderTable();
    renderPagination();
    
    // Event listeners para modal de criação
    document.getElementById("btnCreateTournament").addEventListener("click", openCreateTournamentModal);
    
    // Fechar modal de criação ao clicar fora dele
    document.getElementById("createModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("createModal")) {
            closeCreateModal();
        }
    });

    // Fechar modal de edição ao clicar fora dele
    document.getElementById("editModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("editModal")) {
            closeEditModal();
        }
    });
    
    // Submit do formulário de criação
    document.getElementById("createTournamentForm").addEventListener("submit", createTournamentFormSubmit);
    document.getElementById("btnAddResultRow").addEventListener("click", addCreateResultRow);
    document.getElementById("createTotalPlayers").addEventListener("input", syncCreateResultsByTotal);
    
    // Submit do formulário de edição
    document.getElementById("editTournamentForm").addEventListener("submit", editTournamentFormSubmit);
});

// ============================================================
// CARREGAMENTO DE TORNEIOS
// ============================================================
async function loadTournaments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament?select=id,store_id,tournament_date,store:stores(name),tournament_name,total_players,instagram,instagram_link&order=tournament_date.desc`, { headers });
        if (!res.ok) throw new Error("Erro ao carregar torneios.");
        tournaments = await res.json();
    } catch (err) {
        console.error(err);
        alert("Falha ao carregar dados.");
    }
}

// ============================================================
// RENDERIZAÇÃO DA TABELA
// ============================================================
function renderTable() {
    const tbody = document.querySelector("#tournamentsTable tbody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const slice = tournaments.slice(start, end);

    slice.forEach(t => {
        const tr = document.createElement("tr");
        tr.classList.add("clickable-row");
        if (selectedTournamentId && String(selectedTournamentId) === String(t.id)) {
            tr.classList.add("is-active");
        }
        const instagramLink = t.instagram_link ? `<a href="${t.instagram_link}" target="_blank" style="color: #667eea; text-decoration: none;">🔗 Abrir</a>` : "—";
        
        const td1 = document.createElement("td");
        td1.setAttribute("data-label", "Data:");
        td1.textContent = formatDate(t.tournament_date);
        
        const td2 = document.createElement("td");
        td2.setAttribute("data-label", "Loja:");
        td2.textContent = t.store?.name || "—";
        
        const td3 = document.createElement("td");
        td3.setAttribute("data-label", "Nome:");
        td3.textContent = t.tournament_name || "—";
        
        const td4 = document.createElement("td");
        td4.setAttribute("data-label", "Players:");
        td4.textContent = Number.isFinite(Number(t.total_players)) ? String(t.total_players) : "—";
        
        const td5 = document.createElement("td");
        td5.setAttribute("data-label", "Postado:");
        td5.textContent = t.instagram ? "Postado" : "Não postado";
        
        const td6 = document.createElement("td");
        td6.setAttribute("data-label", "Instagram:");
        td6.innerHTML = instagramLink;
        
        const td7 = document.createElement("td");
        td7.setAttribute("data-label", "Ações:");
        td7.innerHTML = `<button class="btn-edit" onclick="event.stopPropagation(); editTournament('${t.id}')">✏️ Edit</button>`;
        
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);
        tr.appendChild(td6);
        tr.appendChild(td7);
        tr.addEventListener("click", () => toggleTournamentDetails(t));
        
        tbody.appendChild(tr);
    });

    if (slice.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7" style="text-align:center;">Nenhum torneio encontrado</td>`;
        tbody.appendChild(tr);
    }
}

// ============================================================
// PAGINAÇÃO
// ============================================================
function renderPagination() {
    const totalPages = Math.ceil(tournaments.length / perPage);
    const div = document.getElementById("pagination");
    div.innerHTML = "";

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.disabled = (i === currentPage);
        btn.addEventListener("click", () => {
            currentPage = i;
            renderTable();
            renderPagination();
        });
        div.appendChild(btn);
    }
}

// ============================================================
// MODAL DE CRIAÇÃO
// ============================================================
async function openCreateTournamentModal() {
    // Limpa o formulário
    document.getElementById("createStoreSelect").value = "";
    document.getElementById("createTournamentDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("createTournamentName").value = "";
    document.getElementById("createTotalPlayers").value = "";
    document.getElementById("createInstagramLink").value = "";
    document.getElementById("createInstagramPost").checked = false;
    createResults = [];
    
    // Carrega dados base para o modal
    try {
        await Promise.all([
            loadStoresToCreate(),
            loadPlayersToCreate(),
            loadDecksToCreate()
        ]);
        renderCreateResultsRows();
    } catch (err) {
        console.error("Erro ao abrir modal de criação:", err);
        alert("Falha ao carregar dados de players/decks/lojas.");
        return;
    }
    
    // Abre o modal
    document.getElementById("createModal").classList.add("active");
}

function closeCreateModal() {
    document.getElementById("createModal").classList.remove("active");
    createResults = [];
    renderCreateResultsRows();
}

function syncCreateResultsByTotal() {
    const totalInput = document.getElementById("createTotalPlayers");
    const qty = parseInt(totalInput.value, 10);

    if (!Number.isInteger(qty) || qty < 1) {
        createResults = [];
        renderCreateResultsRows();
        return;
    }

    const next = [];
    for (let i = 0; i < Math.min(qty, 36); i++) {
        next.push(createResults[i] || { player_id: "", deck_id: "" });
    }
    createResults = next;
    renderCreateResultsRows();
}

async function loadStoresToCreate() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
        if (!res.ok) throw new Error("Erro ao carregar lojas");
        
        const stores = await res.json();
        const select = document.getElementById("createStoreSelect");
        select.innerHTML = '<option value="">Selecione a loja...</option>';
        stores.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (err) {
        console.error("Erro ao carregar lojas:", err);
        alert("Falha ao carregar lojas: " + err.message);
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

function clearTournamentDetails() {
    const section = document.getElementById("tournamentDetailsSection");
    const content = document.getElementById("tournamentDetailsContent");
    if (!section || !content) return;
    content.innerHTML = "";
    section.style.display = "none";
}

async function renderTournamentDetails(tournament) {
    const section = document.getElementById("tournamentDetailsSection");
    const content = document.getElementById("tournamentDetailsContent");
    if (!section || !content) return;

    section.style.display = "block";
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
        const topFour = (results || []).filter(r => Number(r.placement) <= 4);
        const totalPlayers = Number.isFinite(Number(tournament.total_players))
            ? Number(tournament.total_players)
            : (results[0]?.total_players || 0);
        const header = `
            <div class="tournament-details-header">
                <strong>${tournament.tournament_name || "Tournament"}</strong> - ${formatDate(tournament.tournament_date)} - ${tournament.store?.name || "Store"}
                <div>Total Players: ${totalPlayers}</div>
            </div>
        `;

        const placementClass = (placement) => {
            if (placement === 1) return "first-place";
            if (placement === 2) return "second-place";
            if (placement === 3) return "third-place";
            if (placement === 4) return "fourth-place";
            return "";
        };

        const podiumHtml = topFour.length
            ? topFour.map(item => {
                const imageUrl = item.image_url || `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent((item.deck || "Deck").substring(0, 10))}`;
                return `
                <div class="details-podium-card ${placementClass(Number(item.placement))}">
                    <div class="details-rank-badge">${item.placement}º</div>
                    <div class="details-deck-card-footer">
                        <div class="details-player-name">${item.player || "-"}</div>
                        <div class="details-deck-name">${item.deck || "-"}</div>
                    </div>
                    <div class="details-card-image-wrapper">
                        <img src="${imageUrl}" alt="${item.deck || "Deck"}" class="details-deck-card-image">
                    </div>
                </div>
            `;
            }).join("")
            : `<div class="results-mini-item"><div class="results-mini-main">No podium data found.</div></div>`;

        const resultsHtml = (results || []).length
            ? results.map(item => `
                <div class="results-mini-item">
                    <div class="results-mini-rank">${item.placement}º</div>
                    <div class="results-mini-main">
                        <strong>${item.deck || "-"}</strong>
                        <span>${item.player || "-"}</span>
                    </div>
                </div>
            `).join("")
            : `<div class="results-mini-item"><div class="results-mini-main">No results found.</div></div>`;

        content.innerHTML = `
            ${header}
            <div class="details-grid">
                <div class="details-block">
                    <h3>Podium</h3>
                    <div class="details-podium">${podiumHtml}</div>
                </div>
                <div class="details-block">
                    <h3>Full Results</h3>
                    <div class="results-mini">${resultsHtml}</div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="details-block">Falha ao carregar detalhes do torneio.</div>`;
    }
}

async function loadPlayersToCreate() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id,name&order=name.asc`, { headers });
    if (!res.ok) throw new Error("Erro ao carregar players");
    createPlayers = await res.json();
}

async function loadDecksToCreate() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=id,name&order=name.asc`, { headers });
    if (!res.ok) throw new Error("Erro ao carregar decks");
    createDecks = await res.json();
}

function addCreateResultRow() {
    if (createResults.length >= 36) {
        alert("O limite máximo é 36 jogadores neste modal.");
        return;
    }

    createResults.push({ player_id: "", deck_id: "" });
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
    const options = items.map(item => {
        const selected = String(item.id) === String(selectedValue) ? "selected" : "";
        return `<option value="${item.id}" ${selected}>${item.name}</option>`;
    });
    return initial + options.join("");
}

function renderCreateResultsRows() {
    const container = document.getElementById("createResultsRows");
    if (!container) return;

    if (createResults.length === 0) {
        container.innerHTML = "";
        document.getElementById("createTotalPlayers").value = "";
        return;
    }

    container.innerHTML = createResults.map((row, index) => `
        <div class="result-row">
            <div class="form-group">
                <label>Placement</label>
                <input type="number" value="${index + 1}" disabled>
            </div>
            <div class="form-group">
                <label>Player<span class="required">*</span></label>
                <select onchange="updateCreateResultField(${index}, 'player_id', this.value)" required>
                    ${buildOptions(createPlayers, row.player_id, "Selecione o player...")}
                </select>
            </div>
            <div class="form-group">
                <label>Deck<span class="required">*</span></label>
                <select onchange="updateCreateResultField(${index}, 'deck_id', this.value)" required>
                    ${buildOptions(createDecks, row.deck_id, "Selecione o deck...")}
                </select>
            </div>
            <button type="button" class="btn-remove-result" onclick="removeCreateResultRow(${index})">Remove</button>
        </div>
    `).join("");

    document.getElementById("createTotalPlayers").value = String(createResults.length);
}

async function createTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#createTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Criando...";

    try {
        const totalPlayers = createResults.length;
        const payload = {
            store_id: document.getElementById("createStoreSelect").value,
            tournament_date: document.getElementById("createTournamentDate").value,
            tournament_name: document.getElementById("createTournamentName").value.trim(),
            total_players: totalPlayers,
            instagram_link: document.getElementById("createInstagramLink").value.trim(),
            instagram: document.getElementById("createInstagramPost").checked
        };

        const hasInvalidResult = createResults.some(r => !r.player_id || !r.deck_id);
        if (!payload.store_id || !payload.tournament_date || !payload.tournament_name || payload.total_players < 1 || hasInvalidResult) {
            alert("Por favor preencha todos os campos obrigatórios");
            return;
        }
        
        console.log("Criando torneio:", payload);
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament`, {
            method: "POST",
            headers: {
                ...headers,
                "Prefer": "return=representation"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Erro ao criar:", res.status, errorText);
            throw new Error(`Erro ao cadastrar torneio (${res.status})`);
        }

        const createdTournament = (await res.json())[0];
        if (!createdTournament?.id) {
            throw new Error("Torneio criado sem retornar ID");
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
            method: "POST",
            headers,
            body: JSON.stringify(resultsPayload)
        });

        if (!resultsRes.ok) {
            const resultsError = await resultsRes.text();
            console.error("Erro ao criar results:", resultsRes.status, resultsError);
            if (resultsRes.status === 409) {
                const existingRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${encodeURIComponent(payload.store_id)}&tournament_date=eq.${payload.tournament_date}&select=id,placement,tournament_id&order=placement.asc`,
                    { headers }
                );

                if (!existingRes.ok) {
                    await fetch(`${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`, {
                        method: "DELETE",
                        headers
                    });
                    throw new Error(`Erro ao correlacionar tournament_results existentes (${existingRes.status})`);
                }

                const existingRows = await existingRes.json();
                for (const row of existingRows) {
                    if (!row?.id || row.tournament_id) continue;

                    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(row.id)}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ tournament_id: createdTournament.id })
                    });

                    if (!patchRes.ok) {
                        throw new Error(`Falha ao correlacionar tournament_result ${row.id} (${patchRes.status})`);
                    }
                }
            } else {
                await fetch(`${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`, {
                    method: "DELETE",
                    headers
                });
                throw new Error(`Erro ao cadastrar tournament_results (${resultsRes.status})`);
            }
        }

        await loadTournaments();
        renderTable();
        renderPagination();
        closeCreateModal();
        
        // Limpa o formulário
        document.getElementById("createTournamentForm").reset();
        
        alert("✅ Torneio cadastrado com sucesso!");
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao cadastrar torneio: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
