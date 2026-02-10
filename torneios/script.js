const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
};

let allDecks = []; // ✅ Array completo de decks
let isEditMode = false;
let currentTournamentData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadStores(), loadDecks()]);
    setupDynamicRows();
    setTodayDate();
    setupTournamentCheck();
});

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tournamentDate').value = today;
}

async function loadStores() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*`, { headers });
        
        if (!res.ok) throw new Error('Error loading stores');
        
        const stores = await res.json();
        const select = document.getElementById("storeSelect");
        
        select.innerHTML = '<option value="">Select store...</option>';
        stores.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading stores:", err);
        alert("Error loading stores. Please refresh the page.");
    }
}

async function loadDecks() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*`, { headers });
        
        if (!res.ok) throw new Error('Error loading decks');
        
        allDecks = await res.json();
        
        if (!allDecks || allDecks.length === 0) {
            alert("No decks registered! Please add decks before submitting tournament results.");
            return;
        }
        
        // Ordenar alfabeticamente
        allDecks.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error("Error loading decks:", err);
        alert("Error loading decks. Please refresh the page.");
    }
}

// ✅ SISTEMA DE DETECÇÃO E EDIÇÃO DE TORNEIO EXISTENTE
function setupTournamentCheck() {
    const storeSelect = document.getElementById('storeSelect');
    const dateInput = document.getElementById('tournamentDate');
    
    storeSelect.addEventListener('change', checkExistingTournament);
    dateInput.addEventListener('change', checkExistingTournament);
}

async function checkExistingTournament() {
    const storeId = document.getElementById('storeSelect').value;
    const date = document.getElementById('tournamentDate').value;
    
    if (!storeId || !date) return;
    
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${storeId}&tournament_date=eq.${date}&order=placement.asc`,
            { headers }
        );
        
        if (!res.ok) return;
        
        const results = await res.json();
        
        if (results && results.length > 0) {
            await loadExistingTournament(results);
        } else {
            clearEditMode();
        }
    } catch (error) {
        console.error('Error checking tournament:', error);
    }
}

async function loadExistingTournament(results) {
    isEditMode = true;
    currentTournamentData = results;
    
    const totalPlayers = results[0].total_players;
    const storeName = document.getElementById('storeSelect').selectedOptions[0].text;
    const [year, month, day] = results[0].tournament_date.split('-');
    const dateStr = `${day}/${month}/${year}`;
    
    showEditBanner(storeName, dateStr);
    
    document.getElementById('totalPlayers').value = totalPlayers;
    document.getElementById('totalPlayers').dispatchEvent(new Event('input'));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ✅ Preencher inputs de autocomplete com nomes dos decks
    const inputs = document.querySelectorAll('.deck-input');
    results.forEach((result, index) => {
        if (inputs[index]) {
            const deck = allDecks.find(d => d.id === result.deck_id);
            if (deck) {
                inputs[index].value = deck.name;
                inputs[index].dataset.deckId = deck.id;
            }
        }
    });
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '💾 Update Tournament Results';
    submitBtn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
}

function showEditBanner(storeName, dateStr) {
    const oldBanner = document.getElementById('editBanner');
    if (oldBanner) oldBanner.remove();
    
    const banner = document.createElement('div');
    banner.id = 'editBanner';
    banner.style.cssText = `
        background: linear-gradient(135deg, #f39c12, #e67e22);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        text-align: center;
        font-weight: 600;
        box-shadow: 0 4px 10px rgba(243, 156, 18, 0.3);
    `;
    banner.innerHTML = `
        ✏️ <strong>EDIT MODE</strong> - Editing tournament: ${storeName} on ${dateStr}
        <div style="font-size: 0.9em; margin-top: 5px; opacity: 0.9;">
            Changes will replace existing results
        </div>
    `;
    
    const form = document.getElementById('reportForm');
    form.insertBefore(banner, form.firstChild);
}

function clearEditMode() {
    isEditMode = false;
    currentTournamentData = null;
    
    const banner = document.getElementById('editBanner');
    if (banner) banner.remove();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '💾 Save Tournament Results';
    submitBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
}

function setupDynamicRows() {
    const totalPlayersInput = document.getElementById('totalPlayers');
    const container = document.getElementById('placementsContainer');
    const countBadge = document.getElementById('placementsCount');

    totalPlayersInput.addEventListener('input', (e) => {
        const quantity = parseInt(e.target.value) || 0;
        
        countBadge.textContent = quantity;
        
        if (quantity === 0) {
            container.innerHTML = `
                <div class="placements-empty">
                    <div class="placements-empty-icon">🎯</div>
                    <p>Enter the total number of players above to add placements</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';

        const limit = Math.min(quantity, 16);

        if (quantity > 16) {
            const notice = document.createElement('div');
            notice.style.cssText = 'background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 15px; color: #856404; text-align: center;';
            notice.innerHTML = `⚠️ Showing only top 16. Total players: ${quantity}`;
            container.appendChild(notice);
        }

        for (let i = 1; i <= limit; i++) {
            const row = document.createElement('div');
            row.className = 'placement-row';
            row.innerHTML = `
                <span class="rank-number">${i}</span>
                <div class="autocomplete-wrapper">
                    <input 
                        type="text" 
                        class="deck-input" 
                        data-rank="${i}" 
                        placeholder="Type deck name for ${getOrdinal(i)} place..."
                        autocomplete="off"
                        required
                    >
                    <div class="autocomplete-dropdown"></div>
                </div>
            `;
            container.appendChild(row);
        }
        
        // ✅ Configurar autocomplete para cada input criado
        setupAutocomplete();
    });
}

// ✅ AUTOCOMPLETE SYSTEM
function setupAutocomplete() {
    const inputs = document.querySelectorAll('.deck-input');
    
    inputs.forEach(input => {
        const dropdown = input.nextElementSibling;
        
        // Input event - mostrar sugestões
        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            
            if (value.length === 0) {
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
                delete input.dataset.deckId;
                return;
            }
            
            // Filtrar decks que contém o texto digitado
            const matches = allDecks.filter(deck => 
                deck.name.toLowerCase().includes(value)
            );
            
            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-item no-match">No decks found</div>';
                dropdown.style.display = 'block';
                delete input.dataset.deckId;
                return;
            }
            
            // Limitar a 8 sugestões
            const limitedMatches = matches.slice(0, 8);
            
            dropdown.innerHTML = limitedMatches.map(deck => `
                <div class="autocomplete-item" data-deck-id="${deck.id}" data-deck-name="${deck.name}">
                    ${highlightMatch(deck.name, value)}
                </div>
            `).join('');
            
            dropdown.style.display = 'block';
            
            // Click nos itens
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const deckId = item.dataset.deckId;
                    const deckName = item.dataset.deckName;
                    
                    if (deckId && deckName) {
                        input.value = deckName;
                        input.dataset.deckId = deckId;
                        dropdown.innerHTML = '';
                        dropdown.style.display = 'none';
                    }
                });
            });
        });
        
        // Fechar dropdown ao clicar fora
        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
            }, 200);
        });
        
        // Focus - mostrar sugestões se tiver texto
        input.addEventListener('focus', (e) => {
            if (e.target.value.trim().length > 0) {
                e.target.dispatchEvent(new Event('input'));
            }
        });
    });
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const store_id = document.getElementById('storeSelect').value;
    const date = document.getElementById('tournamentDate').value;
    const total_players = parseInt(document.getElementById('totalPlayers').value);

    if (!store_id) {
        alert("Please select a store!");
        return;
    }

    if (!date) {
        alert("Please select a date!");
        return;
    }

    if (!total_players || total_players < 1) {
        alert("Please enter the total number of players!");
        return;
    }

    const inputs = document.querySelectorAll('.deck-input');
    
    // ✅ Validar que todos os inputs têm um deck selecionado
    const hasEmptyInputs = Array.from(inputs).some(input => !input.dataset.deckId);
    if (hasEmptyInputs) {
        alert("Please select a valid deck for all placements from the suggestions!");
        return;
    }

    const payload = Array.from(inputs).map(input => ({
        store_id: store_id,
        tournament_date: date,
        total_players: total_players,
        placement: parseInt(input.dataset.rank),
        deck_id: input.dataset.deckId
    }));

    try {
        showLoading(true);
        
        if (isEditMode) {
            await fetch(
                `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${store_id}&tournament_date=eq.${date}`,
                {
                    method: 'DELETE',
                    headers: headers
                }
            );
        }
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showLoading(false);
            alert(isEditMode ? "✅ Tournament updated successfully!" : "✅ Tournament results saved successfully!");
            window.location.href = "../index.html";
        } else {
            const error = await res.json();
            throw error;
        }
    } catch (err) {
        console.error("Error saving:", err);
        showLoading(false);
        alert("❌ Error saving data. Please try again.\n\nDetails: " + (err.message || JSON.stringify(err)));
    }
});

function showLoading(show) {
    const loading = document.getElementById('loading');
    const submitBtn = document.getElementById('submitBtn');
    const form = document.getElementById('reportForm');
    
    if (show) {
        loading.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Saving...';
        form.style.opacity = '0.6';
        form.style.pointerEvents = 'none';
    } else {
        loading.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.textContent = isEditMode ? '💾 Update Tournament Results' : '💾 Save Tournament Results';
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';
    }
}