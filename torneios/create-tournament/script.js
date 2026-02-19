const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
      };

// ============================================================
// INIT - DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadStores();
    setTodayDate();
});

// ============================================================
// CARREGAMENTO DE LOJAS
// ============================================================
async function loadStores() {
    try {
        const res = window.supabaseApi
            ? await window.supabaseApi.get('/rest/v1/stores?select=*&order=name.asc')
            : await fetch(`${SUPABASE_URL}/rest/v1/stores?select=*&order=name.asc`, { headers });
        const stores = await res.json();
        const select = document.getElementById('storeSelect');
        stores.forEach((s) => {
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
    document.getElementById('tournamentDate').value = getTodayInSaoPaulo();
}

function getTodayInSaoPaulo() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

// ============================================================
// FORM SUBMIT
// ============================================================
document.getElementById('tournamentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const store_id = document.getElementById('storeSelect').value;
    const tournament_date = document.getElementById('tournamentDate').value;
    const tournament_name = document.getElementById('tournamentName').value;
    const total_players = parseInt(document.getElementById('totalPlayers').value, 10);
    const instagram_link = document.getElementById('instagramLink').value.trim();

    const validName = window.validation
        ? window.validation.isNonEmptyText(tournament_name, 2)
        : !!tournament_name;
    const validPlayers = window.validation
        ? window.validation.isPositiveInteger(total_players, 1, 999)
        : Number.isInteger(total_players) && total_players > 0;
    const validInstagram = window.validation
        ? window.validation.isValidOptionalUrl(instagram_link)
        : true;

    if (!store_id || !tournament_date || !validName || !validPlayers || !validInstagram) {
        alert('Please fill in all required fields correctly.');
        return;
    }

    try {
        document.getElementById('loading').style.display = 'block';

        const payload = {
            store_id,
            tournament_date,
            tournament_name,
            total_players,
            instagram_link
        };
        const res = window.supabaseApi
            ? await window.supabaseApi.post('/rest/v1/tournament', payload)
            : await fetch(`${SUPABASE_URL}/rest/v1/tournament`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(payload)
              });

        if (!res.ok) {
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {}
            console.error('Status:', res.status, 'Response text:', text, 'Parsed JSON:', json);
            alert('Erro ao cadastrar. Veja console para detalhes.');
            return;
        }

        window.location.href = '../list-tournaments/';
    } catch (err) {
        console.error('Fetch failed:', err);
        alert('Rede ou outro erro: veja console.');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
});
