const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";
const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

const TOURNAMENT_NAME_OPTIONS = [
    "Semanal",
    "Mensal",
    "Quinzenal",
    "Pre-Release",
    "Top 8",
    "Win-A-Box",
    "Evo Cup",
    "Regulation Battle",
    "For Fun"
];

const SORT_STORAGE_KEY = "tournamentsSort";
const DEFAULT_SORT = { field: "tournament_date", direction: "desc" };
const SORTABLE_FIELDS = ["tournament_date", "total_players"];
const SORT_DIRECTIONS = ["asc", "desc"];

let tournaments = [];
let filteredTournaments = [];
let currentSort = getSavedSort();
let currentPage = 1;
const perPage = 30;
let createPlayers = [];
let createDecks = [];
let createResults = [];
let selectedTournamentId = null;

// ============================================================
// FUNÃƒâ€¡ÃƒÆ’O DE FORMATAÃƒâ€¡ÃƒÆ’O DE DATA
// ============================================================
function getSavedSort() {
    try {
        const raw = localStorage.getItem(SORT_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SORT };

        const parsed = JSON.parse(raw);
        const field = SORTABLE_FIELDS.includes(parsed?.field) ? parsed.field : DEFAULT_SORT.field;
        const direction = SORT_DIRECTIONS.includes(parsed?.direction) ? parsed.direction : DEFAULT_SORT.direction;

        return { field, direction };
    } catch (error) {
        return { ...DEFAULT_SORT };
    }
}

function saveSortPreference() {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(currentSort));
}
function formatDate(dateString) {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// ============================================================
// INICIALIZAÃƒâ€¡ÃƒÆ’O - DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadTournaments();
    setupFilters();
    setupSorting();
    applyFilters();
    
    // Event listeners para modal de criaÃƒÂ§ÃƒÂ£o
    document.getElementById("btnCreateTournament").addEventListener("click", openCreateTournamentModal);
    
    // Fechar modal de criaÃƒÂ§ÃƒÂ£o ao clicar fora dele
    document.getElementById("createModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("createModal")) {
            closeCreateModal();
        }
    });

    // Fechar modal de ediÃƒÂ§ÃƒÂ£o ao clicar fora dele
    document.getElementById("editModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("editModal")) {
            closeEditModal();
        }
    });
    
    // Submit do formulÃƒÂ¡rio de criaÃƒÂ§ÃƒÂ£o
    document.getElementById("createTournamentForm").addEventListener("submit", createTournamentFormSubmit);
    document.getElementById("btnAddResultRow").addEventListener("click", addCreateResultRow);
    document.getElementById("createTotalPlayers").addEventListener("input", syncCreateResultsByTotal);
    
    // Submit do formulÃƒÂ¡rio de ediÃƒÂ§ÃƒÂ£o
    document.getElementById("editTournamentForm").addEventListener("submit", editTournamentFormSubmit);
});

// ============================================================
// CARREGAMENTO DE TORNEIOS
// ============================================================
async function loadTournaments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament?select=id,store_id,tournament_date,store:stores(name),tournament_name,total_players,instagram_link&order=tournament_date.desc`, { headers });
        if (!res.ok) throw new Error("Erro ao carregar torneios.");
        tournaments = await res.json();
        populateFilterOptions();
    } catch (err) {
        console.error(err);
        alert("Falha ao carregar dados.");
    }
}

function setupFilters() {
    const filterStore = document.getElementById("filterStore");
    const filterTournamentName = document.getElementById("filterTournamentName");
    const filterInstagram = document.getElementById("filterInstagram");
    const btnClearFilters = document.getElementById("btnClearFilters");

    if (filterStore) filterStore.addEventListener("change", applyFilters);
    if (filterTournamentName) filterTournamentName.addEventListener("change", applyFilters);
    if (filterInstagram) filterInstagram.addEventListener("change", applyFilters);
    if (btnClearFilters) {
        btnClearFilters.addEventListener("click", () => {
            if (filterStore) filterStore.value = "";
            if (filterTournamentName) filterTournamentName.value = "";
            if (filterInstagram) filterInstagram.value = "";
            applyFilters();
        });
    }
}

function populateFilterOptions() {
    const filterStore = document.getElementById("filterStore");
    const filterTournamentName = document.getElementById("filterTournamentName");
    if (!filterStore || !filterTournamentName) return;

    const selectedStore = filterStore.value;
    const selectedName = filterTournamentName.value;

    const storesMap = new Map();
    tournaments.forEach((t) => {
        if (t.store_id && t.store?.name) storesMap.set(String(t.store_id), t.store.name);
    });
    const stores = Array.from(storesMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    filterStore.innerHTML = `<option value="">All stores</option>` +
        stores.map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
    if (selectedStore && storesMap.has(String(selectedStore))) filterStore.value = String(selectedStore);

    filterTournamentName.innerHTML = `<option value="">All names</option>` +
        TOURNAMENT_NAME_OPTIONS.map((name) => `<option value="${name}">${name}</option>`).join("");
    if (selectedName && TOURNAMENT_NAME_OPTIONS.includes(selectedName)) filterTournamentName.value = selectedName;
}

function getFilteredTournaments() {
    const filterStore = document.getElementById("filterStore")?.value || "";
    const filterTournamentName = document.getElementById("filterTournamentName")?.value || "";
    const filterInstagram = document.getElementById("filterInstagram")?.value || "";

    return tournaments.filter((t) => {
        const byStore = !filterStore || String(t.store_id) === String(filterStore);
        const byName = !filterTournamentName || (t.tournament_name || "") === filterTournamentName;
        const hasInstagramLink = Boolean((t.instagram_link || "").trim());
        const byInstagram = !filterInstagram ||
            (filterInstagram === "with_link" && hasInstagramLink) ||
            (filterInstagram === "without_link" && !hasInstagramLink);
        return byStore && byName && byInstagram;
    });
}

function applyFilters() {
    filteredTournaments = sortTournaments(getFilteredTournaments());
    currentPage = 1;

    if (selectedTournamentId && !filteredTournaments.some((t) => String(t.id) === String(selectedTournamentId))) {
        selectedTournamentId = null;
        clearTournamentDetails();
    }

    renderTable();
    renderPagination();
}

function setupSorting() {
    const sortButtons = document.querySelectorAll(".sort-button[data-sort-field]");
    sortButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const field = btn.dataset.sortField;
            if (!field) return;
            toggleSort(field);
        });
    });
    updateSortIndicators();
}

function toggleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
    } else {
        currentSort.field = field;
        currentSort.direction = field === "tournament_date" ? "desc" : "asc";
    }
    saveSortPreference();
    updateSortIndicators();
    applyFilters();
}

function sortTournaments(list) {
    const sorted = [...list];
    const direction = currentSort.direction === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
        if (currentSort.field === "tournament_date") {
            const aTime = Date.parse(a.tournament_date || "") || 0;
            const bTime = Date.parse(b.tournament_date || "") || 0;
            return (aTime - bTime) * direction;
        }

        if (currentSort.field === "total_players") {
            const aPlayers = Number(a.total_players) || 0;
            const bPlayers = Number(b.total_players) || 0;
            return (aPlayers - bPlayers) * direction;
        }

        return 0;
    });

    return sorted;
}

function updateSortIndicators() {
    const indicators = document.querySelectorAll("[data-sort-indicator]");
    indicators.forEach((el) => {
        const field = el.dataset.sortIndicator;
        if (field === currentSort.field) {
            el.textContent = currentSort.direction === "asc" ? "▲" : "▼";
            el.classList.add("is-active");
        } else {
            el.textContent = "⇅";
            el.classList.remove("is-active");
        }
    });
}

// ============================================================
// RENDERIZAÃƒâ€¡ÃƒÆ’O DA TABELA
// ============================================================
function renderTable() {
    const tbody = document.querySelector("#tournamentsTable tbody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const slice = filteredTournaments.slice(start, end);

    slice.forEach(t => {
        const tr = document.createElement("tr");
        tr.classList.add("clickable-row");
        if (selectedTournamentId && String(selectedTournamentId) === String(t.id)) {
            tr.classList.add("is-active");
        }
        const instagramLink = t.instagram_link ? `<a href="${t.instagram_link}" target="_blank" style="color: #667eea; text-decoration: none;">Abrir</a>` : "-";
        
        const td1 = document.createElement("td");
        td1.setAttribute("data-label", "Data:");
        td1.textContent = formatDate(t.tournament_date);
        
        const td2 = document.createElement("td");
        td2.setAttribute("data-label", "Loja:");
        td2.textContent = t.store?.name || "-";
        
        const td3 = document.createElement("td");
        td3.setAttribute("data-label", "Nome:");
        td3.textContent = t.tournament_name || "-";
        
        const td4 = document.createElement("td");
        td4.setAttribute("data-label", "Players:");
        td4.textContent = Number.isFinite(Number(t.total_players)) ? String(t.total_players) : "-";
        
        const td5 = document.createElement("td");
        td5.setAttribute("data-label", "Instagram:");
        td5.innerHTML = instagramLink;

        const td6 = document.createElement("td");
        td6.setAttribute("data-label", "Acoes:");
        td6.innerHTML = `<button class="btn-edit btn-icon-only" type="button" title="Edit tournament" aria-label="Edit tournament" onclick="event.stopPropagation(); editTournament('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
        </button>`;

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);
        tr.appendChild(td6);
        tr.addEventListener("click", () => toggleTournamentDetails(t));
        
        tbody.appendChild(tr);
    });

    if (slice.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" style="text-align:center;">Nenhum torneio encontrado</td>`;
        tbody.appendChild(tr);
    }
}

// ============================================================
// PAGINAÃƒâ€¡ÃƒÆ’O
// ============================================================
function renderPagination() {
    const totalPages = Math.ceil(filteredTournaments.length / perPage);
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
// MODAL DE CRIAÃƒâ€¡ÃƒÆ’O
// ============================================================
async function openCreateTournamentModal() {
    // Limpa o formulÃƒÂ¡rio
    document.getElementById("createStoreSelect").value = "";
    document.getElementById("createTournamentDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("createTournamentName").value = "";
    document.getElementById("createTotalPlayers").value = "";
    document.getElementById("createInstagramLink").value = "";

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
        console.error("Erro ao abrir modal de criaÃƒÂ§ÃƒÂ£o:", err);
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

function syncCreateResultsByTotal() {
    const totalInput = document.getElementById("createTotalPlayers");
    const qty = parseInt(totalInput.value, 10);

    if (!Number.isInteger(qty) || qty < 1) {
        createResults = [];
        renderCreateResultsRows();
        return;
    }

    const next = [];
    for (let i = 0; i < Math.min(qty, 36); i++) {
        next.push(createResults[i] || { player_id: "", deck_id: "" });
    }
    createResults = next;
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

async function toggleTournamentDetails(tournament) {
    if (selectedTournamentId && String(selectedTournamentId) === String(tournament.id)) {
        selectedTournamentId = null;
        clearTournamentDetails();
        renderTable();
        return;
    }

    selectedTournamentId = tournament.id;
    renderTable();
    await renderTournamentDetails(tournament);
}

function clearTournamentDetails() {
    const section = document.getElementById("tournamentDetailsSection");
    const content = document.getElementById("tournamentDetailsContent");
    if (!section || !content) return;
    content.innerHTML = "";
    section.style.display = "none";
}

function buildPieSlicePolygon(startDeg, endDeg, steps = 24) {
    const points = ["50% 50%"];
    for (let i = 0; i <= steps; i++) {
        const angle = startDeg + ((endDeg - startDeg) * i / steps);
        const rad = angle * Math.PI / 180;
        const x = 50 + (50 * Math.cos(rad));
        const y = 50 + (50 * Math.sin(rad));
        points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    return `polygon(${points.join(",")})`;
}

function buildDeckPieData(results) {
    const grouped = new Map();
    (results || []).forEach((item) => {
        const key = item.deck || "Unknown Deck";
        if (!grouped.has(key)) {
            grouped.set(key, {
                deck: key,
                image_url: item.image_url || "",
                count: 0
            });
        }
        grouped.get(key).count += 1;
        if (!grouped.get(key).image_url && item.image_url) grouped.get(key).image_url = item.image_url;
    });

    const entries = Array.from(grouped.values()).sort((a, b) => b.count - a.count);
    const total = entries.reduce((acc, item) => acc + item.count, 0) || 1;
    const colors = ["#ffd700", "#c0c0c0", "#cd7f32", "#268d7c", "#667eea", "#764ba2", "#2a9d8f", "#e76f51", "#8ab17d", "#3d5a80"];

    let currentAngle = -90;
    return entries.map((entry, index) => {
        const sliceAngle = (entry.count / total) * 360;
        const start = currentAngle;
        const end = currentAngle + sliceAngle;
        currentAngle = end;
        const midDeg = (start + end) / 2;
        const midRad = midDeg * Math.PI / 180;

        const fallback = `https://via.placeholder.com/300x300/667eea/ffffff?text=${encodeURIComponent((entry.deck || "Deck").substring(0, 10))}`;
        const percent = (entry.count / total) * 100;
        // Tuned for better perceived centering inside each slice.
        const initialZoom = Math.max(155, Math.min(320, 155 + (percent * 3.2)));
        const minZoom = Math.max(120, initialZoom - 55);
        const maxZoom = Math.min(420, initialZoom + 130);

        // Shift image opposite to slice direction so content appears centered in the wedge.
        const initialX = Math.max(34, Math.min(66, 50 - (Math.cos(midRad) * 12)));
        const initialY = Math.max(4, Math.min(24, 13 - (Math.sin(midRad) * 4)));
        return {
            deck: entry.deck,
            count: entry.count,
            percent,
            color: colors[index % colors.length],
            image_url: entry.image_url || fallback,
            clipPath: buildPieSlicePolygon(start, end),
            initialZoom,
            minZoom,
            maxZoom,
            initialX,
            initialY
        };
    });
}

function getPieStorageKey(tournamentId) {
    return `pieState:${tournamentId}`;
}

function loadPieState(tournamentId) {
    try {
        const raw = localStorage.getItem(getPieStorageKey(tournamentId));
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

function savePieState(tournamentId, rootElement) {
    if (!tournamentId || !rootElement) return;
    const slices = rootElement.querySelectorAll(".details-pie-slice");
    const state = {};

    slices.forEach((slice) => {
        const deck = slice.dataset.deck || "";
        if (!deck) return;
        state[deck] = {
            x: parseFloat(slice.dataset.x || "50"),
            y: parseFloat(slice.dataset.y || "13"),
            zoom: parseFloat(slice.dataset.zoom || "195")
        };
    });

    try {
        localStorage.setItem(getPieStorageKey(tournamentId), JSON.stringify(state));
    } catch (_) {}
}

function setupInteractivePieSlices(rootElement, tournamentId) {
    if (!rootElement) return;
    const slices = rootElement.querySelectorAll(".details-pie-slice");
    const savedState = loadPieState(tournamentId);
    let topZ = 10;

    slices.forEach((slice) => {
        const deck = slice.dataset.deck || "";
        const saved = deck ? savedState[deck] : null;

        slice.dataset.x = String(saved?.x ?? slice.dataset.x ?? "50");
        slice.dataset.y = String(saved?.y ?? slice.dataset.y ?? "13");
        slice.dataset.zoom = String(saved?.zoom ?? slice.dataset.zoom ?? "195");
        slice.style.backgroundPosition = `${slice.dataset.x}% ${slice.dataset.y}%`;
        slice.style.backgroundSize = `${slice.dataset.zoom}%`;

        slice.onpointerdown = (e) => {
            slice.style.zIndex = String(++topZ);
            slice.setPointerCapture(e.pointerId);

            let lastX = e.clientX;
            let lastY = e.clientY;

            const onMove = (ev) => {
                let posX = parseFloat(slice.dataset.x || "50");
                let posY = parseFloat(slice.dataset.y || "50");
                const dx = ev.clientX - lastX;
                const dy = ev.clientY - lastY;
                lastX = ev.clientX;
                lastY = ev.clientY;

                posX += dx * 0.2;
                posY += dy * 0.2;

                slice.dataset.x = String(posX);
                slice.dataset.y = String(posY);
                slice.style.backgroundPosition = `${posX}% ${posY}%`;
            };

            const onUp = (ev) => {
                try { slice.releasePointerCapture(ev.pointerId); } catch (_) {}
                slice.removeEventListener("pointermove", onMove);
                slice.removeEventListener("pointerup", onUp);
                slice.removeEventListener("pointercancel", onUp);
                savePieState(tournamentId, rootElement);
            };

            slice.addEventListener("pointermove", onMove);
            slice.addEventListener("pointerup", onUp);
            slice.addEventListener("pointercancel", onUp);
        };

        slice.onwheel = (e) => {
            e.preventDefault();
            let currentZoom = parseFloat(slice.dataset.zoom || "220");
            const minZoom = parseFloat(slice.dataset.minZoom || "120");
            const maxZoom = parseFloat(slice.dataset.maxZoom || "420");
            currentZoom += e.deltaY < 0 ? 8 : -8;
            if (currentZoom < minZoom) currentZoom = minZoom;
            if (currentZoom > maxZoom) currentZoom = maxZoom;
            slice.dataset.zoom = String(currentZoom);
            slice.style.backgroundSize = `${currentZoom}%`;
            savePieState(tournamentId, rootElement);
        };
    });
}

async function renderTournamentDetails(tournament) {
    const section = document.getElementById("tournamentDetailsSection");
    const content = document.getElementById("tournamentDetailsContent");
    if (!section || !content) return;

    section.style.display = "block";
    content.innerHTML = `<div class="details-block">Loading details...</div>`;

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/v_podium_full?store_id=eq.${encodeURIComponent(tournament.store_id)}&tournament_date=eq.${tournament.tournament_date}&order=placement.asc`,
            { headers }
        );

        if (!res.ok) {
            throw new Error(`Erro ao carregar detalhes (${res.status})`);
        }

        const results = await res.json();
        const topFour = (results || []).filter(r => Number(r.placement) <= 4);
        const totalPlayers = Number.isFinite(Number(tournament.total_players))
            ? Number(tournament.total_players)
            : (results[0]?.total_players || 0);
        const header = `
            <div class="tournament-details-header">
                <strong>${tournament.tournament_name || "Tournament"}</strong> - ${formatDate(tournament.tournament_date)} - ${tournament.store?.name || "Store"}
                <div>Total Players: ${totalPlayers}</div>
            </div>
        `;

        const placementClass = (placement) => {
            if (placement === 1) return "first-place";
            if (placement === 2) return "second-place";
            if (placement === 3) return "third-place";
            if (placement === 4) return "fourth-place";
            return "";
        };

        const podiumHtml = topFour.length
            ? topFour.map(item => {
                const imageUrl = item.image_url || `https://via.placeholder.com/200x200/667eea/ffffff?text=${encodeURIComponent((item.deck || "Deck").substring(0, 10))}`;
                return `
                <div class="details-podium-card ${placementClass(Number(item.placement))}">
                    <div class="details-rank-badge">${item.placement}º</div>
                    <div class="details-deck-card-footer">
                        <div class="details-player-name">${item.player || "-"}</div>
                        <div class="details-deck-name">${item.deck || "-"}</div>
                    </div>
                    <div class="details-card-image-wrapper">
                        <img src="${imageUrl}" alt="${item.deck || "Deck"}" class="details-deck-card-image">
                    </div>
                </div>
            `;
            }).join("")
            : `<div class="results-mini-item"><div class="results-mini-main">No podium data found.</div></div>`;

        const pieSlices = buildDeckPieData(results);
        const pieHtml = pieSlices.length
            ? pieSlices.map(slice => `
                <div class="details-pie-slice"
                     style="clip-path:${slice.clipPath}; background-image:url('${slice.image_url}');"
                     data-deck="${String(slice.deck || "").replace(/"/g, "&quot;")}"
                     data-x="${slice.initialX}" data-y="${slice.initialY}"
                     data-zoom="${slice.initialZoom}" data-min-zoom="${slice.minZoom}" data-max-zoom="${slice.maxZoom}"
                     title="${slice.deck} (${slice.percent.toFixed(1)}%)"></div>
            `).join("")
            : "";
        const pieLegend = pieSlices.length
            ? pieSlices.map(slice => `
                <div class="details-pie-legend-item">
                    <span class="details-pie-legend-color" style="background:${slice.color}"></span>
                    <span class="details-pie-legend-name" title="${slice.deck}">${slice.deck}</span>
                    <strong>${slice.count}</strong>
                </div>
            `).join("")
            : `<div class="details-pie-legend-item">No deck data</div>`;

        const resultsHtml = (results || []).length
            ? results.map(item => `
                <div class="results-mini-item">
                    <div class="results-mini-rank">${item.placement}º</div>
                    <div class="results-mini-main">
                        <strong>${item.deck || "-"}</strong>
                        <span>${item.player || "-"}</span>
                    </div>
                </div>
            `).join("")
            : `<div class="results-mini-item"><div class="results-mini-main">No results found.</div></div>`;

        content.innerHTML = `
            ${header}
            <div class="details-grid">
                <div class="details-block">
                    <h3>Podium</h3>
                    <div class="details-podium">${podiumHtml}</div>
                </div>
                <div class="details-block">
                    <h3>Full Results</h3>
                    <div class="results-mini">${resultsHtml}</div>
                </div>
                <div class="details-block details-pie-block">
                    <h3>Deck Distribution</h3>
                    <div class="details-pie-panel">
                        <div class="details-pie-container">${pieHtml}</div>
                        <div class="details-pie-legend">${pieLegend}</div>
                    </div>
                </div>
            </div>
        `;
        setupInteractivePieSlices(content, tournament.id);
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="details-block">Falha ao carregar detalhes do torneio.</div>`;
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
        alert("O limite maximo e 36 jogadores neste modal.");
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
        document.getElementById("createTotalPlayers").value = "";
        return;
    }

    container.innerHTML = createResults.map((row, index) => `
        <div class="result-row">
            <div class="form-group">
                <label>Placement</label>
                <input type="number" value="${index + 1}" disabled>
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
    submitBtn.textContent = "Criando...";

    try {
        const totalPlayers = createResults.length;
        const payload = {
            store_id: document.getElementById("createStoreSelect").value,
            tournament_date: document.getElementById("createTournamentDate").value,
            tournament_name: document.getElementById("createTournamentName").value,
            total_players: totalPlayers,
            instagram_link: document.getElementById("createInstagramLink").value.trim(),
        };

        const hasInvalidResult = createResults.some(r => !r.player_id || !r.deck_id);
        if (!payload.store_id || !payload.tournament_date || !payload.tournament_name || payload.total_players < 1 || hasInvalidResult) {
            alert("Por favor preencha todos os campos obrigatorios");
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
            if (resultsRes.status === 409) {
                const existingRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/tournament_results?store_id=eq.${encodeURIComponent(payload.store_id)}&tournament_date=eq.${payload.tournament_date}&select=id,placement,tournament_id&order=placement.asc`,
                    { headers }
                );

                if (!existingRes.ok) {
                    await fetch(`${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`, {
                        method: "DELETE",
                        headers
                    });
                    throw new Error(`Erro ao correlacionar tournament_results existentes (${existingRes.status})`);
                }

                const existingRows = await existingRes.json();
                for (const row of existingRows) {
                    if (!row?.id || row.tournament_id) continue;

                    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_results?id=eq.${encodeURIComponent(row.id)}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ tournament_id: createdTournament.id })
                    });

                    if (!patchRes.ok) {
                        throw new Error(`Falha ao correlacionar tournament_result ${row.id} (${patchRes.status})`);
                    }
                }
            } else {
                await fetch(`${SUPABASE_URL}/rest/v1/tournament?id=eq.${encodeURIComponent(createdTournament.id)}`, {
                    method: "DELETE",
                    headers
                });
                throw new Error(`Erro ao cadastrar tournament_results (${resultsRes.status})`);
            }
        }

        await loadTournaments();
        applyFilters();
        closeCreateModal();
        
        // Limpa o formulÃƒÂ¡rio
        document.getElementById("createTournamentForm").reset();
        
    } catch (err) {
        console.error("Erro completo:", err);
        alert("Falha ao cadastrar torneio: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}







