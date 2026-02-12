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
    
    // Submit do formulário de edição
    document.getElementById("editTournamentForm").addEventListener("submit", editTournamentFormSubmit);
});

// ============================================================
// CARREGAMENTO DE TORNEIOS
// ============================================================
async function loadTournaments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament?select=id,tournament_date,store:stores(name),tournament_name,instagram&order=tournament_date.desc`, { headers });
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
        tr.innerHTML = `
            <td>${t.tournament_date}</td>
            <td>${t.store?.name || "—"}</td>
            <td>${t.tournament_name || "—"}</td>
            <td>${t.instagram ? "Postado" : "Não postado"}</td>
            <td>${instagramLink}</td>
            <td>
                <button class="btn-edit" onclick="editTournament('${t.id}')">
                    ✏️ Editar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (slice.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" style="text-align:center;">Nenhum torneio encontrado</td>`;
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
function openCreateTournamentModal() {
    // Limpa o formulário
    document.getElementById("createStoreSelect").value = "";
    document.getElementById("createTournamentDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("createTournamentName").value = "";
    document.getElementById("createInstagramPost").checked = false;
    
    // Carrega as lojas
    loadStoresToCreate();
    
    // Abre o modal
    document.getElementById("createModal").classList.add("active");
}

function closeCreateModal() {
    document.getElementById("createModal").classList.remove("active");
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

async function createTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#createTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Criando...";

    try {
        const payload = {
            store_id: document.getElementById("createStoreSelect").value,
            tournament_date: document.getElementById("createTournamentDate").value,
            tournament_name: document.getElementById("createTournamentName").value.trim(),
            instagram_link: document.getElementById("createInstagramLink").value.trim(),
            instagram: document.getElementById("createInstagramPost").checked
        };

        if (!payload.store_id || !payload.tournament_date || !payload.tournament_name) {
            alert("Por favor preencha todos os campos obrigatórios");
            return;
        }
        
        console.log("Criando torneio:", payload);
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Erro ao criar:", res.status, errorText);
            throw new Error(`Erro ao cadastrar torneio (${res.status})`);
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
