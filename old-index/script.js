const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

let currentStore = '';
let currentDate = '';

document.addEventListener('DOMContentLoaded', async () => {
    clearDisplay();
    await loadStores();
    setupEventListeners();
});

function setupEventListeners() {
    const storeFilter = document.getElementById('storeFilter');
    const dateFilter = document.getElementById('dateFilter');
    
    storeFilter.addEventListener('change', async (e) => {
        currentStore = e.target.value;
        if (currentStore) {
            await loadDatesForStore(currentStore);
            dateFilter.disabled = false;
        } else {
            dateFilter.disabled = true;
            dateFilter.innerHTML = '<option value="">Select a date...</option>';
            clearDisplay();
        }
    });
    
    dateFilter.addEventListener('change', async (e) => {
        currentDate = e.target.value;
        if (currentDate) {
            await displayTournament();
        } else {
            clearDisplay();
        }
    });
}

async function loadStores() {
    try {
        showLoading(true);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*`, { 
            headers,
            method: 'GET'
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const stores = await res.json();
        const select = document.getElementById("storeFilter");
        
        select.innerHTML = '<option value="">Select store...</option>';
        stores.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            select.appendChild(option);
        });
        showLoading(false);
    } catch (err) {
        console.error("Error loading stores:", err);
        showError();
        showLoading(false);
    }
}

async function loadDatesForStore(storeId) {
    try {
        showLoading(true);
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${storeId}&select=tournament_date,total_players&order=tournament_date.desc`, 
            { headers }
        );
        
        if (!res.ok) throw new Error('Error loading dates');
        
        const data = await res.json();
        const dates = [...new Set(data.map(item => item.tournament_date))];
        
        const select = document.getElementById('dateFilter');
        select.innerHTML = '<option value="">Select a date...</option>';
        
        dates.forEach(dateStr => {
            const option = document.createElement('option');
            option.value = dateStr;
            
            const [year, month, day] = dateStr.split('-');
            const formattedDate = `${day}/${month}/${year}`;
            
            option.textContent = formattedDate;
            select.appendChild(option);
        });
        showLoading(false);
    } catch (err) {
        console.error("Error loading dates:", err);
        showError();
        showLoading(false);
    }
}

async function displayTournament() {
    try {
        showLoading(true);

        const resultsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/v_podium_full?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&order=placement.asc`,
            { headers }
        );

        if (!resultsRes.ok) throw new Error('Error loading results');

        const results = await resultsRes.json();

        if (!results || results.length === 0) {
            clearDisplay();
            showLoading(false);
            return;
        }

        const totalPlayers = results[0].total_players;
        document.getElementById('totalPlayers').textContent = totalPlayers;

        const storeSelect = document.getElementById('storeFilter');
        const storeName = storeSelect.options[storeSelect.selectedIndex].text;

        const [year, month, day] = currentDate.split('-');
        const dateStr = `${day}/${month}/${year}`;

        if (typeof setTournamentDataForCanvas === 'function') {
            setTournamentDataForCanvas({
                topFour: results.slice(0, 4),
                storeName: storeName,
                dateStr: dateStr,
                totalPlayers: totalPlayers,
                allResults: results
            });
        }

        displayPodium(results.slice(0, 4));
        displayPositions(results);

        // Mostrar seção de resultados completos quando há dados
        const positionsSection = document.querySelector('.positions-section');
        if (positionsSection) {
            positionsSection.style.display = 'block';
        }

        showLoading(false);

    } catch (err) {
        console.error("Error displaying tournament:", err);
        showError();
        showLoading(false);
    }
}

function displayPodium(topFour) {
    const positions = [
        { id: 'firstPlace', placement: 1 },
        { id: 'secondPlace', placement: 2 },
        { id: 'thirdPlace', placement: 3 },
        { id: 'fourthPlace', placement: 4 }
    ];

    positions.forEach((pos) => {
        const card = document.getElementById(pos.id);
        const entry = topFour.find(e => e.placement === pos.placement);

        if (entry) {
            const img = card.querySelector('.deck-card-image');
            const deckNameEl = card.querySelector('.deck-name');
            const playerNameEl = card.querySelector('.player-name');

            let imageUrl = entry.image_url;

            if (!imageUrl) {
                imageUrl = `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent(entry.deck.substring(0, 10))}`;
            }

            img.src = imageUrl;
            img.alt = entry.deck;

            img.onerror = () => {
                img.src = `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent(entry.deck.substring(0, 10))}`;
            };

            deckNameEl.textContent = entry.deck;

            if (entry.player) {
                playerNameEl.textContent = entry.player;
                playerNameEl.style.display = 'block';
            } else {
                playerNameEl.style.display = 'none';
            }

            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function displayPositions(results) {
    const container = document.getElementById('positionsList');
    container.innerHTML = '';

    results.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'position-item';

        if (entry.placement <= 4) {
            div.classList.add(`top-${entry.placement}`);
        }

        div.innerHTML = `
            <div class="position-rank">${entry.placement}º</div>
            <div class="position-content">
                <div class="position-deck">${entry.deck}</div>
                ${entry.player ? `<div class="position-player">${entry.player}</div>` : ''}
            </div>
        `;

        container.appendChild(div);
    });
}

function clearDisplay() {
    document.getElementById('totalPlayers').textContent = '-';
    
    ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'].forEach(id => {
        const card = document.getElementById(id);
        if (card) {
            const img = card.querySelector('.deck-card-image');
            const deckName = card.querySelector('.deck-name');
            const playerName = card.querySelector('.player-name');
            
            img.src = '';
            img.alt = '';
            deckName.textContent = '-';
            if (playerName) playerName.textContent = '';
            card.style.display = 'none';
        }
    });
    
    document.getElementById('positionsList').innerHTML = '';
    
    // Ocultar seção de resultados completos quando não há dados
    const positionsSection = document.querySelector('.positions-section');
    if (positionsSection) {
        positionsSection.style.display = 'none';
    }
    
    const generateSection = document.getElementById('generatePostSection');
    if (generateSection) {
        generateSection.style.display = 'none';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.querySelector('.container').style.opacity = show ? '0.5' : '1';
}

function showError() {
    document.getElementById('errorMessage').style.display = 'block';
}