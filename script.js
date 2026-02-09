// ===== CONFIGURAÇÃO =====
const SHEET_ID = '1oxs8t6edJ-aOHfINthhqp9uqo-jRsbmSP9yJ1Jp7MoA';

const TOURNAMENTS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Respostas ao formulário 1`;
const IMAGES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Base_Imagens`;

// ===== VARIÁVEIS GLOBAIS =====
let tournamentsData = [];
let imagesData = {};
let currentStore = '';
let currentDate = '';

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// ===== SETUP DE EVENT LISTENERS =====
function setupEventListeners() {
    const storeFilter = document.getElementById('storeFilter');
    const dateFilter = document.getElementById('dateFilter');
    
    storeFilter.addEventListener('change', (e) => {
        currentStore = e.target.value;
        
        if (currentStore) {
            // Habilitar filtro de data e popular com as datas dessa loja
            populateDateFilter();
            dateFilter.disabled = false;
        } else {
            // Desabilitar filtro de data
            dateFilter.disabled = true;
            dateFilter.innerHTML = '<option value="">Select a date...</option>';
            clearDisplay();
        }
    });
    
    dateFilter.addEventListener('change', (e) => {
        currentDate = e.target.value;
        
        if (currentDate) {
            displayTournament();
        } else {
            clearDisplay();
        }
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
        
        // Popular filtro de lojas
        populateStoreFilter();
        
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
        if (cells && cells[2] && cells[3] && cells[4] && cells[5]) {
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
    
    storeFilter.innerHTML = '<option value="">Select a store...</option>';
    stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store;
        option.textContent = store;
        storeFilter.appendChild(option);
    });
}

// ===== POPULAR FILTRO DE DATAS (baseado na loja selecionada) =====
function populateDateFilter() {
    const dateFilter = document.getElementById('dateFilter');
    
    // Filtrar torneios da loja selecionada
    const storeTournaments = tournamentsData.filter(t => t.storeName === currentStore);
    
    // Pegar datas únicas
    const dates = [...new Set(storeTournaments.map(t => t.date))].sort((a, b) => {
        // Ordenar por data (mais recente primeiro)
        return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
    });
    
    dateFilter.innerHTML = '<option value="">Select a date...</option>';
    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        dateFilter.appendChild(option);
    });
}

// ===== EXIBIR TORNEIO =====
function displayTournament() {
    // Filtrar por loja e data
    const filtered = tournamentsData.filter(t => 
        t.storeName === currentStore && t.date === currentDate
    );
    
    if (filtered.length === 0) {
        clearDisplay();
        return;
    }
    
    // Ordenar por placement
    filtered.sort((a, b) => a.placement - b.placement);
    
    // Atualizar total de jogadores
    const totalPlayers = filtered[0].numPlayers;
    document.getElementById('totalPlayers').textContent = totalPlayers;
    
    // Exibir TOP 3 no pódio
    displayPodium(filtered.slice(0, 3));
    
    // Exibir lista completa de resultados
    displayPositions(filtered);
}

// ===== EXIBIR PÓDIO (TOP 3) =====
function displayPodium(topThree) {
    const positions = ['firstPlace', 'secondPlace', 'thirdPlace'];
    const placements = [1, 2, 3];
    
    placements.forEach((placement, index) => {
        const card = document.getElementById(positions[index]);
        const entry = topThree.find(e => e.placement === placement);
        
        if (entry) {
            const img = card.querySelector('.deck-card-image');
            const name = card.querySelector('.deck-name');
            
            // Atualizar imagem
            const imageUrl = imagesData[entry.deck] || 'https://via.placeholder.com/320x480?text=No+Image';
            img.src = imageUrl;
            img.alt = entry.deck;
            img.onerror = () => {
                img.src = 'https://via.placeholder.com/320x480?text=Image+Error';
            };
            
            // Atualizar nome
            name.textContent = entry.deck;
            
            // Adicionar link se disponível
            if (entry.decklistLink) {
                card.style.cursor = 'pointer';
                card.onclick = () => window.open(entry.decklistLink, '_blank');
            } else {
                card.style.cursor = 'default';
                card.onclick = null;
            }
            
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ===== EXIBIR LISTA DE POSIÇÕES =====
function displayPositions(entries) {
    const container = document.getElementById('positionsList');
    container.innerHTML = '';
    
    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'position-item';
        
        // Destacar top 3
        if (entry.placement === 1) div.classList.add('top-1');
        if (entry.placement === 2) div.classList.add('top-2');
        if (entry.placement === 3) div.classList.add('top-3');
        
        div.innerHTML = `
            <span class="position-number">${entry.placement}º</span>
            <span class="position-deck">${entry.deck}</span>
        `;
        
        // Adicionar link se disponível
        if (entry.decklistLink) {
            div.style.cursor = 'pointer';
            div.onclick = () => window.open(entry.decklistLink, '_blank');
        }
        
        container.appendChild(div);
    });
}

// ===== LIMPAR DISPLAY =====
function clearDisplay() {
    document.getElementById('totalPlayers').textContent = '-';
    
    // Limpar pódio
    ['firstPlace', 'secondPlace', 'thirdPlace'].forEach(id => {
        const card = document.getElementById(id);
        card.querySelector('.deck-card-image').src = '';
        card.querySelector('.deck-name').textContent = '-';
        card.style.display = 'none';
    });
    
    // Limpar lista
    document.getElementById('positionsList').innerHTML = '';
}

// ===== LOADING E ERRO =====
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.querySelector('.container').style.opacity = show ? '0.5' : '1';
}

function showError() {
    document.getElementById('errorMessage').style.display = 'block';
}