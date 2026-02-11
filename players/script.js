const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
};

let allPlayers = [];
let filteredPlayers = [];
let editingPlayerId = null;
let currentPage = 1;
const itemsPerPage = 5; // Atualizado para 5 conforme solicitado

document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    setupEventListeners();
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setupEventListeners() {
    document.getElementById('playerForm').addEventListener('submit', handleSubmit);
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        filteredPlayers = allPlayers.filter(p => p.name.toLowerCase().includes(term));
        currentPage = 1;
        renderPaginatedList();
    });
    
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderPaginatedList(); }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < Math.ceil(filteredPlayers.length / itemsPerPage)) { currentPage++; renderPaginatedList(); }
    });
}

async function loadPlayers() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=*&order=name.asc`, { headers });
    allPlayers = await res.json();
    filteredPlayers = allPlayers;
    document.getElementById('totalPlayersCount').textContent = allPlayers.length;
    renderPaginatedList();
}

function renderPaginatedList() {
    const list = document.getElementById('playersList');
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filteredPlayers.slice(start, start + itemsPerPage);
    
    list.innerHTML = '';
    
    if (filteredPlayers.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('paginationControls').style.display = 'flex';

    paginatedItems.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `
            <span><strong>${p.name}</strong></span>
            <div>
                <button class="btn-action" onclick="editPlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}')">✏️ Edit</button>
                <button class="btn-action" onclick="deletePlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });

    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = (currentPage === 1);
    document.getElementById('nextPage').disabled = (currentPage >= totalPages);
}

async function handleSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    
    const url = editingPlayerId ? `${SUPABASE_URL}/rest/v1/players?id=eq.${editingPlayerId}` : `${SUPABASE_URL}/rest/v1/players`;
    const method = editingPlayerId ? 'PATCH' : 'POST';

    const res = await fetch(url, { method, headers, body: JSON.stringify({ name }) });
    if (res.ok) {
        showToast(editingPlayerId ? "Player updated!" : "Player added!");
        cancelEdit();
        loadPlayers();
    }
}

function editPlayer(id, name) {
    editingPlayerId = id;
    document.getElementById('playerName').value = name;
    document.getElementById('submitBtn').textContent = '💾 Update Player';
    document.getElementById('cancelBtn').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    editingPlayerId = null;
    document.getElementById('playerForm').reset();
    document.getElementById('submitBtn').textContent = '+ Add Player';
    document.getElementById('cancelBtn').style.display = 'none';
}

async function deletePlayer(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${id}`, { method: 'DELETE', headers });
    if (res.ok) { showToast("Removed!"); loadPlayers(); }
}