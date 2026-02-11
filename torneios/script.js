/**
 * SISTEMA DE RELATÓRIO DE TORNEIOS - VERSÃO FINAL (FIX LAYOUT & DATA LOSS)
 */

const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

let allDecks = [];
let allPlayers = [];
let isEditMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    await Promise.all([loadStores(), loadDecks(), loadPlayers()]);
    setupDynamicRows();
    setTodayDate();
    setupTournamentCheck();
    showLoading(false);
});

// --- CARREGAMENTO DE DADOS ---

async function loadStores() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
        const stores = await res.json();
        const select = document.getElementById("storeSelect");
        if (select) {
            select.innerHTML = '<option value="">Selecione a loja...</option>';
            stores.forEach(s => { select.innerHTML += `<option value="${s.id}">${s.name}</option>`; });
        }
    } catch (err) { console.error(err); }
}

async function loadDecks() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*&order=name.asc`, { headers });
        allDecks = await res.json();
    } catch (err) { console.error(err); }
}

async function loadPlayers() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=*&order=name.asc`, { headers });
        allPlayers = await res.json();
    } catch (err) { console.error(err); }
}

// --- LÓGICA DE EDIÇÃO ---

function setupTournamentCheck() {
    const storeSelect = document.getElementById('storeSelect');
    const dateInput = document.getElementById('tournamentDate');
    
    const check = async () => {
        const storeId = storeSelect.value;
        const date = dateInput.value;
        if (!storeId || !date) return;

        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${storeId}&tournament_date=eq.${date}&order=placement.asc`,
                { headers }
            );
            const results = await res.json();
            
            if (results && results.length > 0) {
                loadExistingTournament(results);
            } else {
                clearEditMode();
            }
        } catch (err) { console.error(err); }
    };

    storeSelect?.addEventListener('change', check);
    dateInput?.addEventListener('change', check);
}

function loadExistingTournament(results) {
    isEditMode = true;
    const totalPlayers = results[0].total_players;
    const storeName = document.getElementById('storeSelect').selectedOptions[0].text;
    showEditBanner(storeName, results[0].tournament_date);

    // 1. Limpa o container totalmente para evitar o bug visual da imagem
    const container = document.getElementById('placementsContainer');
    container.innerHTML = ''; 

    // 2. Sincroniza o estado dos inputs
    const totalInput = document.getElementById('totalPlayers');
    totalInput.value = totalPlayers;
    document.getElementById('placementsCount').textContent = totalPlayers;

    // 3. Cria as linhas do zero para garantir ordem correta
    syncRows(totalPlayers);

    // 4. Preenche os dados nos inputs criados
    const deckInputs = document.querySelectorAll('.deck-input');
    const playerInputs = document.querySelectorAll('.player-input');

    results.forEach((result, index) => {
        if (deckInputs[index]) {
            const deck = allDecks.find(d => d.id === result.deck_id);
            if (deck) { 
                deckInputs[index].value = deck.name; 
                deckInputs[index].dataset.deckId = deck.id; 
            }
        }
        if (playerInputs[index]) {
            const player = allPlayers.find(p => p.id === result.player_id);
            if (player) { 
                playerInputs[index].value = player.name; 
                playerInputs[index].dataset.playerId = player.id; 
            }
        }
    });
    updateSubmitButton();
}

// --- SINCRONIZAÇÃO DE LINHAS ---

function setupDynamicRows() {
    const totalInput = document.getElementById('totalPlayers');
    totalInput.addEventListener('input', (e) => {
        const qty = parseInt(e.target.value) || 0;
        document.getElementById('placementsCount').textContent = qty;
        syncRows(qty);
    });
}

function syncRows(qty) {
    const container = document.getElementById('placementsContainer');
    const limit = Math.min(qty, 16);

    // Se houver qualquer coisa que NÃO seja uma linha de colocação (como o texto inicial), limpa.
    if (container.children.length > 0 && !container.firstElementChild.classList.contains('placement-row')) {
        container.innerHTML = '';
    }

    const currentRows = container.querySelectorAll('.placement-row');
    const currentCount = currentRows.length;

    if (limit > currentCount) {
        // Adiciona apenas as novas linhas ao final
        for (let i = currentCount + 1; i <= limit; i++) {
            const row = document.createElement('div');
            row.className = 'placement-row';
            row.innerHTML = `
                <span class="rank-number">${i}</span>
                <div class="autocomplete-wrapper">
                    <input type="text" class="deck-input" data-rank="${i}" placeholder="Deck..." autocomplete="off" required>
                    <input type="text" class="player-input" data-rank="${i}" placeholder="Jogador..." autocomplete="off" ${i <= 4 ? "required" : ""}>
                    <div class="autocomplete-dropdown"></div>
                </div>
            `;
            container.appendChild(row);
        }
        setupAutocomplete(); 
    } 
    else if (limit < currentCount) {
        // Remove apenas as do final, mantendo os dados das primeiras
        for (let i = currentCount; i > limit; i--) {
            container.lastElementChild.remove();
        }
    }
}

// --- SUBMISSÃO ---

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const store_id = document.getElementById('storeSelect').value;
    const date = document.getElementById('tournamentDate').value;
    const total_players = parseInt(document.getElementById('totalPlayers').value);
    
    const deckInputs = document.querySelectorAll('.deck-input');
    const playerInputs = document.querySelectorAll('.player-input');
    const payload = [];

    for (let i = 0; i < deckInputs.length; i++) {
        const deckId = deckInputs[i].dataset.deckId;
        const playerId = playerInputs[i].dataset.playerId || null;
        if (!deckId) { alert(`❌ Defina o Deck para a ${i+1}ª colocação.`); return; }
        payload.push({
            store_id, tournament_date: date, total_players,
            placement: i + 1, deck_id: deckId, player_id: playerId
        });
    }

    try {
        showLoading(true);
        // Se for edição, limpa o banco antes de salvar o novo estado (estratégia Clean & Save)
        if (isEditMode) {
            await fetch(`${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${store_id}&tournament_date=eq.${date}`, 
            { method: 'DELETE', headers });
        }
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results`, {
            method: 'POST',
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Erro ao salvar.");
        alert("✅ Resultados salvos!");
        window.location.href = "../index.html";
    } catch (err) { alert(err.message); } finally { showLoading(false); }
});

// --- AUTOCOMPLETE ---

function setupAutocomplete() {
    const wrappers = document.querySelectorAll('.autocomplete-wrapper');
    wrappers.forEach(wrapper => {
        const deckInput = wrapper.querySelector('.deck-input');
        const playerInput = wrapper.querySelector('.player-input');
        const dropdown = wrapper.querySelector('.autocomplete-dropdown');

        const attach = (input, source, type) => {
            input.addEventListener('input', () => {
                const val = input.value.toLowerCase().trim();
                if (!val) { dropdown.style.display = 'none'; delete input.dataset[`${type}Id`]; return; }
                const matches = source.filter(s => s.name.toLowerCase().includes(val)).slice(0, 5);
                if (matches.length > 0) {
                    dropdown.innerHTML = matches.map(m => `<div class="autocomplete-item" data-id="${m.id}" data-name="${m.name}" data-target-type="${type}">${m.name}</div>`).join('');
                    dropdown.style.display = 'block';
                } else {
                    dropdown.innerHTML = '<div class="autocomplete-item no-match">Não encontrado</div>';
                    dropdown.style.display = 'block';
                }
            });
            input.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
        };
        attach(deckInput, allDecks, 'deck');
        attach(playerInput, allPlayers, 'player');
    });
}

document.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (item && !item.classList.contains('no-match')) {
        const wrapper = item.closest('.autocomplete-wrapper');
        const type = item.dataset.targetType;
        const input = wrapper.querySelector(`.${type}-input`);
        input.value = item.dataset.name;
        input.dataset[`${type}Id`] = item.dataset.id;
        item.closest('.autocomplete-dropdown').style.display = 'none';
    }
});

// --- UI HELPERS ---

function setTodayDate() { document.getElementById('tournamentDate').value = new Date().toISOString().split('T')[0]; }

function showEditBanner(store, date) {
    document.getElementById('editBanner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'editBanner';
    banner.style.cssText = `background: #f39c12; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold;`;
    banner.innerHTML = `✏️ MODO EDIÇÃO: ${store} (${date})`;
    document.getElementById('reportForm').prepend(banner);
}

function clearEditMode() { 
    isEditMode = false; 
    document.getElementById('editBanner')?.remove(); 
    updateSubmitButton(); 
}

function updateSubmitButton() {
    const btn = document.getElementById('submitBtn');
    if (btn) btn.textContent = isEditMode ? '💾 Update Tournament Results' : '💾 Save Tournament Results';
}

function showLoading(show) {
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = show;
}