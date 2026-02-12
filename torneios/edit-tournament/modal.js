let editingTournamentId = null;

// ============================================================
// MODAL DE EDIÇÃO - FUNÇÕES
// ============================================================
function editTournament(id) {
    if (!id) {
        alert("Erro: ID do torneio não encontrado");
        return;
    }
    editingTournamentId = id;
    openEditModal();
    loadEditFormData(id);
}

async function loadEditFormData(id) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(id)}&select=*`;
        console.log("Carregando torneio com URL:", url);
        
        const res = await fetch(url, { headers });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error("Erro ao carregar:", res.status, errorText);
            throw new Error(`Erro ao carregar dados do torneio (${res.status})`);
        }
        
        const data = (await res.json())[0];
        console.log("Dados carregados:", data);
        
        if (!data) {
            alert("Torneio não encontrado");
            closeEditModal();
            return;
        }

        // Carrega os dados do formulário
        document.getElementById("editTournamentDate").value = data.tournament_date || "";
        document.getElementById("editTournamentName").value = data.tournament_name || "";
        document.getElementById("editInstagramPost").checked = data.instagram || false;

        // Carrega as lojas e seleciona a atual
        await loadStoresToEdit(data.store_id);
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao carregar dados do torneio: " + err.message);
        closeEditModal();
    }
}

async function loadStoresToEdit(selectedStoreId) {
    try {
        console.log("Carregando lojas para edição. Store ID selecionado:", selectedStoreId);
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Erro ao carregar lojas (${res.status}): ${errorText}`);
        }
        
        const stores = await res.json();
        console.log("Lojas carregadas:", stores);
        
        const select = document.getElementById("editStoreSelect");
        select.innerHTML = '<option value="">Selecione a loja...</option>';
        stores.forEach(s => {
            const isSelected = String(s.id) === String(selectedStoreId);
            console.log("Loja:", s.id, "Selecionada:", isSelected, "StoreId:", selectedStoreId);
            select.innerHTML += `<option value="${s.id}" ${isSelected ? "selected" : ""}>${s.name}</option>`;
        });
    } catch (err) {
        console.error("Erro ao carregar lojas:", err);
        alert("Falha ao carregar lojas: " + err.message);
    }
}

function openEditModal() {
    document.getElementById("editModal").classList.add("active");
}

function closeEditModal() {
    document.getElementById("editModal").classList.remove("active");
}

async function editTournamentFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector("#editTournamentForm button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Salvando...";

    try {
        const updated = {
            store_id: document.getElementById("editStoreSelect").value,
            tournament_date: document.getElementById("editTournamentDate").value,
            tournament_name: document.getElementById("editTournamentName").value.trim(),
            instagram: document.getElementById("editInstagramPost").checked
        };
        
        if (!updated.store_id || !updated.tournament_date || !updated.tournament_name) {
            alert("Por favor preencha todos os campos obrigatórios");
            return;
        }
        
        console.log("Atualizando torneio:", editingTournamentId, updated);
        
        const url = `${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(editingTournamentId)}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(updated)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Erro ao salvar:", res.status, errorText);
            throw new Error(`Erro ao salvar torneio (${res.status})`);
        }

        closeEditModal();
        alert("✅ Torneio atualizado com sucesso!");
        
        // Recarrega a tabela de torneios
        if (typeof loadTournaments === 'function') {
            await loadTournaments();
            renderTable();
        }
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao salvar torneio: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
