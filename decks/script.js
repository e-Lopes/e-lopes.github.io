const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

// URL base para as imagens
const IMAGE_BASE_URL = "https://deckbuilder.egmanevents.com//card_images/digimon/";

// Detecta em qual página estamos
const isListPage = window.location.pathname.includes('decks/index.html') || 
                   window.location.pathname === '/decks/' || 
                   window.location.pathname.endsWith('decks/');
const isCadastroPage = window.location.pathname.includes('cadastro.html');

document.addEventListener('DOMContentLoaded', () => {
    if (isListPage) {
        loadDecks();
    } else if (isCadastroPage) {
        setupCadastroForm();
    }
});

// ========== FUNÇÕES PARA LISTAGEM DE DECKS ==========
async function loadDecks() {
    try {
        showLoading(true);
        
        // Buscar decks com suas imagens
        const decksRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*&order=name.asc`, { headers });
        if (!decksRes.ok) throw new Error('Error loading decks');
        
        const decks = await decksRes.json();
        
        // Buscar imagens separadamente
        const imagesRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images?select=deck_id,image_url`, { headers });
        let imagesMap = {};
        
        if (imagesRes.ok) {
            const images = await imagesRes.json();
            images.forEach(img => {
                imagesMap[img.deck_id] = img.image_url;
            });
        }
        
        displayDecks(decks, imagesMap);
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading decks:', error);
        showError('Error loading decks. Try Again.');
        showLoading(false);
    }
}

function displayDecks(decks, imagesMap) {
    const container = document.getElementById('decksList');
    const emptyState = document.getElementById('emptyState');
    
    if (!decks || decks.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    emptyState.style.display = 'none';
    
    decks.forEach(deck => {
        const imageUrl = imagesMap[deck.id] || 'https://via.placeholder.com/300x200/667eea/ffffff?text=' + encodeURIComponent(deck.name.substring(0, 15));
        
        const deckCard = document.createElement('div');
        deckCard.className = 'deck-card';
        deckCard.innerHTML = `
            <div class="deck-image-container">
                <img src="${imageUrl}" alt="${deck.name}" class="deck-image" onerror="this.src='https://via.placeholder.com/300x200/667eea/ffffff?text=${encodeURIComponent(deck.name.substring(0, 15))}'">
            </div>
            <div class="deck-info">
                <h3 class="deck-name">${deck.name}</h3>
                <p class="deck-url">${imagesMap[deck.id] || 'Sem imagem'}</p>
                <div class="deck-actions">
                    <button class="btn-secondary" onclick="editDeck('${deck.id}')">Edit</button>
                    <button class="btn-secondary btn-danger" onclick="deleteDeck('${deck.id}', '${deck.name}')">Delete</button>
                </div>
            </div>
        `;
        
        container.appendChild(deckCard);
    });
}

async function deleteDeck(deckId, deckName) {
    if (!confirm(`Are you sure you want to delete the deck "${deckName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        // Primeiro excluir a imagem associada
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });
        
        // Depois excluir o deck
        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });
        
        if (res.ok) {
            alert('Deck excluído com sucesso!');
            loadDecks(); // Recarregar a lista
        } else {
            throw new Error('Error deleting deck');
        }
        
    } catch (error) {
        console.error('Error deleting deck:', error);
        alert('Error deleting deck. Check that there are no tournaments using this deck.');
    } finally {
        showLoading(false);
    }
}

function editDeck(deckId) {
    window.location.href = `cadastro.html?edit=${deckId}`;
}

// ========== FUNÇÕES PARA CADASTRO DE DECKS ==========
function setupCadastroForm() {
    const form = document.getElementById('deckForm');
    const deckCodeInput = document.getElementById('deckCode');
    const previewContainer = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const urlDisplay = document.getElementById('imageUrlDisplay');
    const generatedUrlSpan = document.getElementById('generatedUrl');
    
    // Gerar URL da imagem em tempo real
    function updateImagePreview() {
        const code = deckCodeInput.value.trim().toUpperCase();
        
        if (code && isValidDeckCode(code)) {
            const imageUrl = IMAGE_BASE_URL + code + ".webp";
            
            // Atualizar pré-visualização
            previewImage.src = imageUrl;
            previewContainer.classList.add('active');
            
            // Atualizar display da URL
            generatedUrlSpan.textContent = imageUrl;
            urlDisplay.classList.add('active');
            
            // Tratar erro na pré-visualização
            previewImage.onerror = () => {
                previewContainer.classList.remove('active');
                urlDisplay.classList.remove('active');
            };
        } else {
            previewContainer.classList.remove('active');
            urlDisplay.classList.remove('active');
        }
    }
    
    // Validar formato do código
    function isValidDeckCode(code) {
        // Formato: LETRAS-NÚMEROS (ex: BT16-064, ST22-05, EX5-001)
        const pattern = /^[A-Z]{2,3}\d{1,2}-\d{2,3}$/;
        return pattern.test(code);
    }
    
    // Atualizar preview ao digitar
    deckCodeInput.addEventListener('input', () => {
        // Converter para maiúsculas
        deckCodeInput.value = deckCodeInput.value.toUpperCase();
        updateImagePreview();
    });
    
    // Verificar se é edição
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
        loadDeckForEdit(editId);
    }
    
    // Submissão do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveDeck(editId);
    });
}

async function loadDeckForEdit(deckId) {
    try {
        showLoading(true);
        
        // Buscar deck
        const deckRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, { headers });
        if (!deckRes.ok) throw new Error('Error loading deck');
        
        const deck = (await deckRes.json())[0];
        if (!deck) throw new Error('Deck not found');
        
        // Buscar imagem
        const imageRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, { headers });
        let imageUrl = '';
        let deckCode = '';
        
        if (imageRes.ok) {
            const images = await imageRes.json();
            if (images.length > 0) {
                imageUrl = images[0].image_url;
                // Extrair código da URL
                const match = imageUrl.match(/\/([A-Z0-9-]+)\.webp$/);
                if (match) {
                    deckCode = match[1];
                }
            }
        }
        
        // Preencher formulário
        document.getElementById('deckName').value = deck.name;
        if (deckCode) {
            document.getElementById('deckCode').value = deckCode;
            updateImagePreview(); // Ativar preview
        }
        
        // Atualizar título
        document.querySelector('.page-title').textContent = '✏️ Edit Deck';
        document.getElementById('submitBtn').textContent = 'Update Deck';
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading deck for editing:', error);
        showError('Error loading. Redirecting...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

async function saveDeck(editId = null) {
    const deckName = document.getElementById('deckName').value.trim();
    const deckCode = document.getElementById('deckCode').value.trim().toUpperCase();
    
    if (!deckName || !deckCode) {
        showError('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    // Validar formato do código
    if (!isValidDeckCode(deckCode)) {
        showError('Invalid code format. Use: SET-NUMBER (ex: BT16-064, ST22-05, EX5-001)Formato de código inválido. Use: SET-NÚMERO (ex: BT16-064, ST22-05, EX5-001)');
        return;
    }
    
    // Gerar URL completa
    const imageUrl = IMAGE_BASE_URL + deckCode + ".webp";
    
    try {
        showLoading(true);
        
        if (editId) {
            // Atualizar deck existente
            await updateDeck(editId, deckName, imageUrl);
        } else {
            // Criar novo deck
            await createDeck(deckName, imageUrl);
        }
        
    } catch (error) {
        console.error('Error saving deck:', error);
        showError('Error saving deck. Try Again.');
        showLoading(false);
    }
}

function isValidDeckCode(code) {
    // Valida formatos comuns: BT16-064, EX5-001, ST17-01, P-001
    const pattern = /^[A-Z]{1,3}\d{1,2}-\d{2,3}$/;
    return pattern.test(code);
}

async function createDeck(deckName, imageUrl) {
    console.log('=== INICIANDO CRIAÇÃO DE DECK ===');
    
    try {
        // 1. Criar o deck
        console.log('1. Creating deck at decks table...');
        const deckRes = await fetch(`${SUPABASE_URL}/rest/v1/decks`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify([{ name: deckName }])
        });
        
        console.log('Status deck:', deckRes.status, deckRes.statusText);
        
        if (!deckRes.ok) {
            const errorText = await deckRes.text();
            console.error('Error creating deck:', errorText);
            throw new Error('Error creating deck');
        }
        
        const newDeck = (await deckRes.json())[0];
        console.log('Deck created with ID:', newDeck.id);
        console.log('Deck complete:', newDeck);
        
        // 2. Criar a imagem associada
        console.log('2. Creating image at deck_images table...');
        console.log('Deck ID for imagem:', newDeck.id);
        console.log('Image URL:', imageUrl);
        
        const imagePayload = {
            deck_id: newDeck.id,
            image_url: imageUrl
        };
        
        console.log('Payload da imagem:', JSON.stringify([imagePayload]));
        
        const imageRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify([imagePayload])
        });
        
        console.log('Status imagem:', imageRes.status, imageRes.statusText);
        
        if (!imageRes.ok) {
            const errorText = await imageRes.text();
            console.error('Detailed image error:', errorText);
            
            // Deletar o deck criado (rollback)
            console.log('Rollback: deleting deck created...');
            await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${newDeck.id}`, {
                method: 'DELETE',
                headers: headers
            });
            
            // Analisar o erro
            if (imageRes.status === 400) {
                throw new Error('Error 400: Data invalid for deck_images. Please check table  structure.');
            } else if (imageRes.status === 401 || imageRes.status === 403) {
                throw new Error('Permission denied for deck_images. Check RLS.');
            } else {
                throw new Error(`Error saving image: ${imageRes.status} ${imageRes.statusText}`);
            }
        }
        
        const newImage = (await imageRes.json())[0];
        console.log('Image created:', newImage);
        
        showSuccess('Deck created successfully!');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Erro completo no createDeck:', error);
        showError(error.message);
        showLoading(false);
    }
}

async function updateDeck(deckId, deckName, imageUrl) {
    // 1. Atualizar o deck
    await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ name: deckName })
    });
    
    // 2. Verificar se já existe imagem
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, { headers });
    const existingImages = await checkRes.json();
    
    if (existingImages.length > 0) {
        // Atualizar imagem existente
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ image_url: imageUrl })
        });
    } else {
        // Criar nova imagem
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify([{
                deck_id: deckId,
                image_url: imageUrl
            }])
        });
    }
    
    showSuccess('Deck atualizado com sucesso!');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// ========== FUNÇÕES UTILITÁRIAS ==========
function showLoading(show) {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        showLoading(false);
    }
}

function extractCodeFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/([A-Z0-9-]+)\.webp$/);
    return match ? match[1] : null;
}