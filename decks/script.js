const SUPABASE_URL = "https://vllqakohumoinpdwnsqa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbHFha29odW1vaW5wZHduc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjIwMTAsImV4cCI6MjA4NjE5ODAxMH0.uXSjwwM_RqeNWJwRQM8We9WEsWsz3C2JfdhlZXNoTKM";

const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

// URL base para as imagens
const IMAGE_BASE_URL = "https://deckbuilder.egmanevents.com/card_images/digimon/";

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

// ========== FUNÇÃO PARA ATUALIZAR PREVIEW DA IMAGEM ==========
function updateImagePreview() {
    try {
        const deckCodeInput = document.getElementById('deckCode');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const imageUrlDisplay = document.getElementById('imageUrlDisplay');
        const generatedUrlSpan = document.getElementById('generatedUrl');
        
        if (!deckCodeInput) {
            console.warn('❌ Input deckCode não encontrado');
            return;
        }
        
        const code = deckCodeInput.value.trim().toUpperCase();
        
        console.log('🔍 Código digitado:', code);
        console.log('✅ Código válido?', isValidDeckCode(code));
        
        if (code && isValidDeckCode(code)) {
            const imageUrl = IMAGE_BASE_URL + code + ".webp";
            
            console.log('🖼️ URL gerada:', imageUrl);
            
            // Atualizar preview da imagem
            if (previewImage && imagePreview) {
                previewImage.src = imageUrl;
                previewImage.alt = `Card: ${code}`;
                imagePreview.classList.add('active');
                
                previewImage.onerror = () => {
                    console.warn(`⚠️ Imagem não encontrada: ${code}`);
                    imagePreview.classList.remove('active');
                };
                
                previewImage.onload = () => {
                    console.log('✅ Imagem carregada com sucesso!');
                };
            }
            
            // Atualizar display da URL
            if (imageUrlDisplay && generatedUrlSpan) {
                generatedUrlSpan.textContent = imageUrl;
                imageUrlDisplay.classList.add('active');
            }
            
            console.log('✅ Preview atualizado para:', code);
        } else {
            // Esconder preview se código inválido ou vazio
            if (imagePreview) {
                imagePreview.classList.remove('active');
            }
            if (previewImage) {
                previewImage.src = '';
            }
            if (imageUrlDisplay) {
                imageUrlDisplay.classList.remove('active');
            }
            
            if (code) {
                console.log('⚠️ Código inválido:', code);
            }
        }
    } catch (error) {
        console.error('❌ Erro em updateImagePreview:', error);
    }
}

// ========== VALIDAÇÃO DO CÓDIGO DO DECK ==========
function isValidDeckCode(code) {
    // Valida formatos comuns: BT16-064, EX5-001, ST17-01, P-001, BT24-030
    const pattern = /^[A-Z]{1,3}\d{1,2}-\d{2,3}$/;
    const isValid = pattern.test(code);
    
    if (!isValid && code) {
        console.log('🔍 Regex não passou. Código:', code);
        console.log('📋 Exemplos válidos: BT24-030, ST22-05, EX5-001');
    }
    
    return isValid;
}

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
    try {
        showLoading(true);
        
        // 1. Verificar se há resultados de torneio vinculados a este deck
        const tournamentResultsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?deck_id=eq.${deckId}`,
            { headers }
        );
        
        if (!tournamentResultsRes.ok) {
            throw new Error(`HTTP ${tournamentResultsRes.status}: ${await tournamentResultsRes.text()}`);
        }
        
        const tournamentResults = await tournamentResultsRes.json();
        
        if (tournamentResults && tournamentResults.length > 0) {
            showLoading(false);
            
            const message = `Cannot delete deck "${deckName}" because it has ${tournamentResults.length} tournament result(s) recorded.\n\nPlease delete the tournament results first or contact support.`;
            
            alert(message);
            return;
        }
        
        // 2. Se não houver resultados, pedir confirmação
        if (!confirm(`Are you sure you want to delete the deck "${deckName}"?\n\nThis action cannot be undone.`)) {
            showLoading(false);
            return;
        }
        
        // 3. Primeiro excluir a imagem associada (se existir)
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });
        
        // 4. Depois excluir o deck
        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });
        
        if (res.ok) {
            alert('Successfully deleted deck!');
            loadDecks(); // Recarregar a lista
        } else {
            throw new Error('Error deleting deck');
        }
        
    } catch (error) {
        console.error('Error deleting deck:', error);
        alert('Error deleting deck. Please try again.');
    } finally {
        showLoading(false);
    }
}

function editDeck(deckId) {
    console.log('Editing deck:', deckId);
    window.location.href = `cadastro.html?edit=${deckId}`;
}

// ========== FUNÇÕES PARA CADASTRO DE DECKS ==========
function setupCadastroForm() {
    const form = document.getElementById('deckForm');
    const deckCodeInput = document.getElementById('deckCode');
    
    // Verificar se é edição
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    console.log('🚀 SetupCadastroForm chamado. Edit ID:', editId);
    
    if (editId) {
        console.log('✏️ Edit mode detected, loading deck:', editId);
        loadDeckForEdit(editId);
    }
    
    // Atualizar preview ao digitar
    if (deckCodeInput) {
        console.log('✅ Event listeners configurados no deckCode input');
        
        deckCodeInput.addEventListener('input', function(e) {
            console.log('⌨️ Input event disparado. Valor:', e.target.value);
            this.value = this.value.toUpperCase();
            updateImagePreview();
        });
        
        deckCodeInput.addEventListener('change', function(e) {
            console.log('🔄 Change event disparado. Valor:', e.target.value);
            updateImagePreview();
        });
        
        deckCodeInput.addEventListener('keyup', function(e) {
            console.log('⬆️ KeyUp event disparado. Valor:', e.target.value);
            updateImagePreview();
        });
    } else {
        console.error('❌ Input deckCode não encontrado!');
    }
    
    // Submissão do formulário
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveDeck(editId);
        });
    }
}

async function loadDeckForEdit(deckId) {
    try {
        console.log('loadDeckForEdit chamado com ID:', deckId);
        
        if (!deckId) {
            console.error('No deck ID provided');
            alert('No deck ID specified. Going back...');
            window.history.back();
            return;
        }
        
        showLoading(true);
        
        // Buscar deck
        const deckRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, { 
            headers,
            mode: 'cors'
        });
        
        console.log('Deck response status:', deckRes.status);
        
        if (!deckRes.ok) {
            const errorText = await deckRes.text();
            throw new Error(`Error loading deck: ${deckRes.status} - ${errorText}`);
        }
        
        const deckData = await deckRes.json();
        console.log('Deck data:', deckData);
        
        if (!deckData || deckData.length === 0) {
            throw new Error('Deck not found');
        }
        
        const deck = deckData[0];
        console.log('Deck encontrado:', deck.name);
        
        // Buscar imagem
        let deckCode = '';
        
        try {
            const imageRes = await fetch(
                `${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}&select=image_url`,
                { headers }
            );
            
            console.log('Image response status:', imageRes.status);
            
            if (imageRes.ok) {
                const images = await imageRes.json();
                console.log('Images encontradas:', images);
                
                if (images && images.length > 0 && images[0].image_url) {
                    const imageUrl = images[0].image_url;
                    console.log('Image URL:', imageUrl);
                    
                    // Extrair código da URL
                    const match = imageUrl.match(/\/([A-Z0-9-]+)\.webp$/);
                    if (match) {
                        deckCode = match[1];
                        console.log('Deck code extraído:', deckCode);
                    }
                }
            }
        } catch (imageError) {
            console.warn('Erro ao buscar imagem:', imageError);
        }
        
        // Preencher formulário
        const deckNameInput = document.getElementById('deckName');
        const deckCodeInput = document.getElementById('deckCode');
        
        if (deckNameInput) {
            deckNameInput.value = deck.name;
        }
        
        if (deckCodeInput && deckCode) {
            deckCodeInput.value = deckCode;
            
            // Chamar updateImagePreview após um pequeno delay
            setTimeout(() => {
                updateImagePreview();
            }, 100);
        }
        
        // Atualizar título e botão
        const pageTitle = document.querySelector('.page-title');
        const submitBtn = document.getElementById('submitBtn');
        
        if (pageTitle) {
            pageTitle.textContent = '✏️ Edit Deck';
        }
        
        if (submitBtn) {
            submitBtn.textContent = 'Update Deck';
        }
        
        // Armazenar deckId para uso no update
        window.currentDeckId = deckId;
        
        console.log('Deck carregado para edição');
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
        showError('Please fill in all required fields.');
        return;
    }
    
    // Validar formato do código
    if (!isValidDeckCode(deckCode)) {
        showError('Invalid code format. Use: SET-NUMBER (ex: BT16-064, ST22-05, EX5-001)');
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
        
        // 2. Criar a imagem associada
        console.log('2. Creating image at deck_images table...');
        
        const imagePayload = {
            deck_id: newDeck.id,
            image_url: imageUrl
        };
        
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
            await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${newDeck.id}`, {
                method: 'DELETE',
                headers: headers
            });
            
            throw new Error(`Error saving image: ${imageRes.status}`);
        }
        
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
    
    showSuccess('Deck updated successfully!');
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