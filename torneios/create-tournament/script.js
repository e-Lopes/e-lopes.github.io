const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

// ============================================================
// INICIALIZAÇÃO - DOMContentLoaded
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    loadStores();
    setTodayDate();
});

// ============================================================
// CARREGAMENTO DE LOJAS
// ============================================================
async function loadStores() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
        const stores = await res.json();
        const select = document.getElementById("storeSelect");
        stores.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (err) {
        console.error(err);
    }
}

// ============================================================
// DEFINIR DATA ATUAL
// ============================================================
function setTodayDate() {
    document.getElementById('tournamentDate').value = new Date().toISOString().split('T')[0];
}

// ============================================================
// SUBMIT DO FORMULÁRIO
// ============================================================
document.getElementById("tournamentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const store_id = document.getElementById("storeSelect").value;
    const tournament_date = document.getElementById("tournamentDate").value;
    const tournament_name = document.getElementById("tournamentName").value;
    const total_players = parseInt(document.getElementById("totalPlayers").value, 10);
    const instagram_link = document.getElementById("instagramLink").value.trim();

    if (!store_id || !tournament_date || !tournament_name || !Number.isInteger(total_players) || total_players < 1) {
        alert("Por favor preencha todos os campos obrigatórios.");
        return;
    }

    try {
        document.getElementById("loading").style.display = "block";

        const payload = { store_id, tournament_date, tournament_name, total_players, instagram_link };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournament`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            let json;
            try { json = JSON.parse(text); } catch {}
            console.error("Status:", res.status, "Response text:", text, "Parsed JSON:", json);
            alert("Erro ao cadastrar. Veja console para detalhes.");
            return;
        }

        window.location.href = "../list-tournaments/";

    } catch (err) {
        console.error("Fetch failed:", err);
        alert("Rede ou outro erro: veja console.");
    } finally {
        document.getElementById("loading").style.display = "none";
    }
});
