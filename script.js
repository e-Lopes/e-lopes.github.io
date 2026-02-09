// ===== CONFIGURAÇÃO =====
// ID da planilha do Google Sheets
const SHEET_ID = '1oxs8t6edJ-aOHfINthhqp9uqo-jRsbmSP9yJ1Jp7MoA';

// URLs das APIs do Google Sheets
const TOURNAMENTS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Respostas ao formulário 1`;
const IMAGES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Base_Imagens`;

// ===== VARIÁVEIS GLOBAIS =====
let tournamentsData = [];
let imagesData = {};
let currentFilter = {
    store: '',
    date: ''
};

// ===== CORES DOS DECKS =====
const deckColors = {
    'Mastemon': 'yellow',
    'Jesmon': 'red',
    'Hudiemon': 'orange',
    'Beelzemon': 'purple',
    'Sakuyamon': 'green',
    'BlueFlare': 'blue'
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// ===== SETUP DE EVENT LISTENERS =====
function setupEventListeners() {
    document.getElementById('storeFilter').addEventListener('change', (e) => {
        currentFilter.store = e.target.value;
        filterAndDisplay();
    });

    document.getElementById('dateFilter').addEventListener('input', (e) => {
        currentFilter.date = e.target.value.toLowerCase();
        filterAndDisplay();
    });
}

// ===== CARREGAR DADOS DO GOOGLE SHEETS =====
async function loadData() {
    try {
        showLoading(true);
        
        // Carregar dados dos torneios
        const tournamentsResponse = await fetch(TOURNAMENTS_URL);
        const tournamentsText = await tournamentsResponse.text();
        const tournamentsJson = JSON.parse(tournamentsText.substring(47).slice(0, -2));
        
        // Carregar dados das imagens
        const imagesResponse = await fetch(IMAGES_URL);
        const imagesText = await imagesResponse.text();
        const imagesJson = JSON.parse(imagesText.substring(47).slice(0, -2));
        
        // Processar dados
        processTournamentsData(tournamentsJson);
        processImagesData(imagesJson);
        
        // Exibir dados
        populateStoreFilter();
        filterAndDisplay();
        
        showLoading(false);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showError();
        showLoading(false);
    }
}

// ===== PROCESSAR DADOS DOS TORNEIOS =====
function processTournamentsData(json) {
    const rows = json.table.rows;
    tournamentsData = [];
    
    rows.forEach(row => {
        const cells = row.c;
        if (cells && cells[2] && cells[3] && cells[4] && cells[5]) { // Verificar se tem dados essenciais
            tournamentsData.push({
                timestamp: cells[0]?.f || '',
                email: cells[1]?.v || '',
                storeName: cells[2]?.v || '',
                date: cells[3]?.f || cells[3]?.v || '',
                numPlayers: parseInt(cells[4]?.v) || 0,
                placement: parseInt(cells[5]?.v) || 0,
                deck: cells[6]?.v || '',
                decklistLink: cells[7]?.v || '',
                notes: cells[8]?.v || ''
            });
        }
    });
}

// ===== PROCESSAR DADOS DAS IMAGENS =====
function processImagesData(json) {
    const rows = json.table.rows;
    imagesData = {};
    
    rows.forEach(row => {
        const cells = row.c;
        if (cells && cells[0] && cells[1]) {
            const deckName = cells[0].v;
            const imageUrl = cells[1].v;
            imagesData[deckName] = imageUrl;
        }
    });
}

// ===== POPULAR FILTRO DE LOJAS =====
function populateStoreFilter() {
    const stores = [...new Set(tournamentsData.map(t => t.storeName))].sort();
    const storeFilter = document.getElementById('storeFilter');
    
    storeFilter.innerHTML = '<option value="">All Stores</option>';
    stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store;
        option.textContent = store;
        storeFilter.appendChild(option);
    });
}

// ===== FILTRAR E EXIBIR DADOS =====
function filterAndDisplay() {
    let filtered = tournamentsData;
    
    // Filtrar por loja
    if (currentFilter.store) {
        filtered = filtered.filter(t => t.storeName === currentFilter.store);
    }
    
    // Filtrar por data
    if (currentFilter.date) {
        filtered = filtered.filter(t => 
            t.date.toLowerCase().includes(currentFilter.date)
        );
    }
    
    // Agrupar por torneio (mesma loja e data)
    const tournaments = groupByTournament(filtered);
    
    // Se houver torneios, mostrar o primeiro
    if (tournaments.length > 0) {
        displayTournament(tournaments[0]);
    } else {
        displayNoData();
    }
}

// ===== AGRUPAR POR TORNEIO =====
function groupByTournament(data) {
    const grouped = {};
    
    data.forEach(entry => {
        const key = `${entry.storeName}_${entry.date}`;
        if (!grouped[key]) {
            grouped[key] = {
                storeName: entry.storeName,
                date: entry.date,
                entries: []
            };
        }
        grouped[key].entries.push(entry);
    });
    
    // Ordenar entries por placement
    Object.values(grouped).forEach(tournament => {
        tournament.entries.sort((a, b) => a.placement - b.placement);
    });
    
    return Object.values(grouped);
}

// ===== EXIBIR TORNEIO =====
function displayTournament(tournament) {
    const entries = tournament.entries;
    
    // Calcular total de jogadores
    const totalPlayers = entries.length > 0 ? entries[0].numPlayers : 0;
    document.getElementById('totalPlayers').textContent = totalPlayers;
    
    // Exibir lista de posições
    displayPositions(entries);
    
    // Exibir cards dos decks (top 6)
    displayDecks(entries.slice(0, 6));
}

// ===== EXIBIR LISTA DE POSIÇÕES =====
function displayPositions(entries) {
    const container = document.getElementById('positionsList');
    container.innerHTML = '';
    
    entries.slice(0, 6).forEach(entry => {
        const div = document.createElement('div');
        div.className = 'position-item';
        div.innerHTML = `
            <span class="position-number">${entry.placement}.</span>
            <span class="position-deck">${entry.deck}</span>
        `;
        container.appendChild(div);
    });
}

// ===== EXIBIR CARDS DOS DECKS =====
function displayDecks(entries) {
    const container = document.getElementById('decksContainer');
    container.innerHTML = '';
    
    entries.forEach((entry, index) => {
        const card = createDeckCard(entry, index + 1);
        container.appendChild(card);
    });
}

// ===== CRIAR CARD DE DECK =====
function createDeckCard(entry, rank) {
    const card = document.createElement('div');
    card.className = `deck-card rank-${rank}`;
    
    // Adicionar cor baseada no deck
    const color = deckColors[entry.deck] || 'blue';
    card.classList.add(`color-${color}`);
    
    // Obter imagem do deck
    const imageUrl = imagesData[entry.deck] || 'https://via.placeholder.com/280x400?text=No+Image';
    
    card.innerHTML = `
        <div class="rank-badge">${rank}</div>
        <img src="${imageUrl}" alt="${entry.deck}" class="deck-card-image" onerror="this.src='https://via.placeholder.com/280x400?text=Image+Error'">
        <div class="deck-card-footer">${entry.deck}</div>
    `;
    
    // Adicionar link para decklist se disponível
    if (entry.decklistLink) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            window.open(entry.decklistLink, '_blank');
        });
    }
    
    return card;
}

// ===== EXIBIR MENSAGEM SEM DADOS =====
function displayNoData() {
    document.getElementById('totalPlayers').textContent = '0';
    document.getElementById('positionsList').innerHTML = '<p style="color: #999;">No tournaments found</p>';
    document.getElementById('decksContainer').innerHTML = '<p style="color: #999;">No data available</p>';
}

// ===== LOADING E ERRO =====
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.querySelector('.content').style.display = show ? 'none' : 'grid';
}

function showError() {
    document.getElementById('errorMessage').style.display = 'block';
}