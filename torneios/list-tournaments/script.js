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
    
    // Submit do formulário de edição
    document.getElementById("editTournamentForm").addEventListener("submit", editTournamentFormSubmit);
});

// ============================================================
// CARREGAMENTO DE TORNEIOS
// ============================================================
async function loadTournaments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament?select=id,tournament_date,store:stores(name),tournament_name,total_players,instagram,instagram_link&order=tournament_date.desc`, { headers });
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
        td7.innerHTML = `<button class="btn-edit" onclick="editTournament('${t.id}')">✏️ Edit</button>`;
        
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);
        tr.appendChild(td6);
        tr.appendChild(td7);
        
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
    document.getElementById("createTotalPlayers").value = "0";
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
        document.getElementById("createTotalPlayers").value = "0";
        return;
    }

    container.innerHTML = createResults.map((row, index) => `
        <div class="result-row">
            <div class="form-group">
                <label>Placement</label>
                <input type="number" value="${index + 1}" readonly>
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

            await fetch(`${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`, {
                method: "DELETE",
                headers
            });
            throw new Error(`Erro ao cadastrar tournament_results (${resultsRes.status})`);
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
