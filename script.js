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
    clearDisplay(); // ✅ ESCONDER CARDS VAZIOS AO CARREGAR
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

// Carrega as Lojas
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
            
            // ✅ Formatar data usando UTC para evitar problemas de timezone
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
        
        console.log("Buscando dados para:", currentStore, currentDate);
        
        // PRIMEIRO: Buscar resultados do torneio
        const resultsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${currentStore}&tournament_date=eq.${currentDate}&select=*&order=placement.asc`, 
            { headers }
        );
        
        if (!resultsRes.ok) throw new Error('Error loading results');
        
        const results = await resultsRes.json();
        console.log("Resultados brutos:", results);

        if (!results || results.length === 0) {
            clearDisplay();
            showLoading(false);
            return;
        }

        // SEGUNDO: Coletar todos os deck_ids únicos
        const deckIds = [...new Set(results.map(r => r.deck_id).filter(id => id))];
        console.log("Deck IDs encontrados:", deckIds);
        
        // TERCEIRO: Buscar informações dos decks E suas imagens
        let decksMap = {};
        if (deckIds.length > 0) {
            try {
                const decksRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/decks?id=in.(${deckIds.join(',')})&select=id,name`, 
                    { headers }
                );
                
                if (decksRes.ok) {
                    const decks = await decksRes.json();
                    console.log("Decks encontrados:", decks);
                    
                    // Buscar todas as imagens de uma vez
                    const imagesRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/deck_images?deck_id=in.(${deckIds.join(',')})&select=deck_id,image_url`, 
                        { headers }
                    );
                    
                    let imagesMap = {};
                    if (imagesRes.ok) {
                        const images = await imagesRes.json();
                        console.log("Imagens encontradas:", images);
                        
                        images.forEach(img => {
                            if (!imagesMap[img.deck_id]) {
                                imagesMap[img.deck_id] = img.image_url;
                            }
                        });
                    }
                    
                    decks.forEach(deck => {
                        decksMap[deck.id] = {
                            name: deck.name,
                            image_url: imagesMap[deck.id] || null
                        };
                    });
                }
            } catch (err) {
                console.error("Error searching for decks/images:", err);
            }
        }
        
        console.log("Deck map (with images):", decksMap);

        // QUARTO: Combinar dados
        const combinedResults = results.map(result => {
            const deckInfo = decksMap[result.deck_id];
            
            if (!deckInfo) {
                return {
                    ...result,
                    deck: { 
                        name: `Deck ID: ${result.deck_id || 'Unknown'}`,
                        image_url: null
                    }
                };
            }
            
            return {
                ...result,
                deck: deckInfo
            };
        });

        console.log("Resultados combinados:", combinedResults);

        // Atualizar total de jogadores
        const totalPlayers = combinedResults[0].total_players;
        document.getElementById('totalPlayers').textContent = totalPlayers;

        // Exibir pódio
        displayPodium(combinedResults.slice(0, 3));
        
        // Exibir lista completa
        displayPositions(combinedResults);
        
        showLoading(false);
    } catch (err) {
        console.error("Error displaying tournament:", err);
        showError();
        showLoading(false);
    }
}


function displayPodium(topThree) {
    const positions = [
        { id: 'firstPlace', placement: 1 },
        { id: 'secondPlace', placement: 2 },
        { id: 'thirdPlace', placement: 3 }
    ];
    
    positions.forEach((pos, index) => {
        const card = document.getElementById(pos.id);
        const entry = topThree.find(e => e.placement === pos.placement); // ✅ BUSCAR POR PLACEMENT
        
        if (entry && entry.deck) {
            const img = card.querySelector('.deck-card-image');
            const name = card.querySelector('.deck-name');
            
            console.log(`Exibindo deck ${pos.placement}º:`, entry.deck);
            
            let imageUrl = entry.deck.image_url;
            
            if (!imageUrl) {
                imageUrl = `https://via.placeholder.com/320x480/667eea/ffffff?text=${encodeURIComponent(entry.deck.name.substring(0, 15))}`;
            } else if (imageUrl.endsWith('.webp')) {
                imageUrl = imageUrl;
            } else if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                if (imageUrl.startsWith('/')) {
                    imageUrl = `https://vllqakohumoinpdwnsqa.supabase.co/storage/v1/object/public${imageUrl}`;
                } else {
                    imageUrl = `https://via.placeholder.com/320x480/667eea/ffffff?text=${encodeURIComponent(entry.deck.name.substring(0, 15))}`;
                }
            }
            
            console.log(`URL da imagem para ${entry.deck.name}:`, imageUrl);
            
            img.src = imageUrl;
            img.alt = entry.deck.name;
            
            img.onerror = () => {
                console.log(`Error loading image: ${imageUrl}`);
                if (imageUrl.endsWith('.webp')) {
                    const jpgUrl = imageUrl.replace('.webp', '.jpg');
                    img.src = jpgUrl;
                    
                    img.onerror = () => {
                        img.src = `https://via.placeholder.com/320x480/667eea/ffffff?text=${encodeURIComponent(entry.deck.name.substring(0, 15))}`;
                    };
                } else {
                    img.src = `https://via.placeholder.com/320x480/667eea/ffffff?text=${encodeURIComponent(entry.deck.name.substring(0, 15))}`;
                }
            };
            
            name.textContent = entry.deck.name;
            
            if (entry.decklist_link) {
                card.style.cursor = 'pointer';
                card.onclick = () => window.open(entry.decklist_link, '_blank');
            } else {
                card.style.cursor = 'default';
                card.onclick = null;
            }
            
            card.style.display = 'block'; // ✅ MOSTRAR o card
        } else {
            console.log(`Sem dados para posição ${pos.placement}`);
            card.style.display = 'none'; // ✅ ESCONDER se não tem dados
        }
    });
}

function displayPositions(results) {
    const container = document.getElementById('positionsList');
    container.innerHTML = '';
    
    results.forEach(entry => {
        if (!entry.deck) return;
        
        const div = document.createElement('div');
        div.className = 'position-item';
        
        if (entry.placement === 1) div.classList.add('top-1');
        if (entry.placement === 2) div.classList.add('top-2');
        if (entry.placement === 3) div.classList.add('top-3');
        
        div.innerHTML = `
            <span class="position-number">${entry.placement}º</span>
            <span class="position-deck">${entry.deck.name}</span>
        `;
        
        if (entry.decklist_link) {
            div.style.cursor = 'pointer';
            div.onclick = () => window.open(entry.decklist_link, '_blank');
        }
        
        container.appendChild(div);
    });
}

function clearDisplay() {
    document.getElementById('totalPlayers').textContent = '-';
    
    // Limpar e ESCONDER pódio
    ['firstPlace', 'secondPlace', 'thirdPlace'].forEach(id => {
        const card = document.getElementById(id);
        const img = card.querySelector('.deck-card-image');
        const name = card.querySelector('.deck-name');
        
        img.src = '';
        img.alt = '';
        name.textContent = '-';
        card.style.display = 'none'; // ✅ ESCONDER o card
        card.onclick = null;
    });
    
    // Limpar lista
    document.getElementById('positionsList').innerHTML = '';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.querySelector('.container').style.opacity = show ? '0.5' : '1';
}

function showError() {
    document.getElementById('errorMessage').style.display = 'block';
}