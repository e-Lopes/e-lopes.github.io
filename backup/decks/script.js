const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://vllqakohumoinpdwnsqa.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
const headers = window.createSupabaseHeaders
    ? window.createSupabaseHeaders()
    : {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
      };

const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';

const isListPage =
    window.location.pathname.includes('decks/index.html') ||
    window.location.pathname === '/decks/' ||
    window.location.pathname.endsWith('decks/');

document.addEventListener('DOMContentLoaded', () => {
    if (isListPage) {
        setupDeckActions();
        loadDecks();
    }
});

function setupDeckActions() {
    const container = document.getElementById('decksList');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-action="edit-deck"]');
        if (editButton) {
            editDeck(editButton.dataset.deckId);
            return;
        }

        const deleteButton = event.target.closest('[data-action="delete-deck"]');
        if (deleteButton) {
            deleteDeck(deleteButton.dataset.deckId, deleteButton.dataset.deckName || '');
        }
    });
}

// ========== VALIDAÇÃO DE NOME DUPLICADO ==========
async function checkDuplicateDeckName(deckName, excludeDeckId = null) {
    try {
        let query = `${SUPABASE_URL}/rest/v1/decks?name=eq.${encodeURIComponent(deckName)}`;

        const res = await fetch(query, { headers });

        if (!res.ok) return false;

        const decks = await res.json();

        // Se estiver editando, excluir o deck atual da verificação
        if (excludeDeckId) {
            const duplicates = decks.filter((d) => d.id !== excludeDeckId);
            return duplicates.length > 0;
        }

        return decks.length > 0;
    } catch (error) {
        console.error('Error checking duplicate name:', error);
        return false;
    }
}

// ========== PREVIEW DA IMAGEM ==========
function updateImagePreview() {
    try {
        const deckCodeInput = document.getElementById('deckCode');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const imageUrlDisplay = document.getElementById('imageUrlDisplay');
        const generatedUrlSpan = document.getElementById('generatedUrl');

        if (!deckCodeInput) return;

        const code = deckCodeInput.value.trim().toUpperCase();

        if (code && isValidDeckCode(code)) {
            const imageUrl = IMAGE_BASE_URL + code + '.webp';

            if (previewImage && imagePreview) {
                previewImage.src = imageUrl;
                previewImage.alt = `Card: ${code}`;
                imagePreview.classList.add('active');

                previewImage.onerror = () => {
                    imagePreview.classList.remove('active');
                };
            }

            if (imageUrlDisplay && generatedUrlSpan) {
                generatedUrlSpan.textContent = imageUrl;
                imageUrlDisplay.classList.add('active');
            }
        } else {
            if (imagePreview) {
                imagePreview.classList.remove('active');
            }
            if (previewImage) {
                previewImage.src = '';
            }
            if (imageUrlDisplay) {
                imageUrlDisplay.classList.remove('active');
            }
        }
    } catch (error) {
        console.error('Error in updateImagePreview:', error);
    }
}

function isValidDeckCode(code) {
    // ✅ Aceita: BT16-064, EX5-001, ST17-01, P-183, P-001, RB1-035
    const pattern = /^[A-Z]{1,3}\d{0,2}-\d{1,3}$/;
    return pattern.test(code);
}

// ========== LISTAGEM DE DECKS ==========
async function loadDecks() {
    try {
        showLoading(true);

        const decksRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*&order=name.asc`, {
            headers
        });
        if (!decksRes.ok) throw new Error('Error loading decks');

        const decks = await decksRes.json();

        const imagesRes = await fetch(
            `${SUPABASE_URL}/rest/v1/deck_images?select=deck_id,image_url`,
            { headers }
        );
        let imagesMap = {};

        if (imagesRes.ok) {
            const images = await imagesRes.json();
            images.forEach((img) => {
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

    decks.forEach((deck) => {
        const imageUrl =
            imagesMap[deck.id] ||
            'https://via.placeholder.com/300x200/667eea/ffffff?text=' +
                encodeURIComponent(deck.name.substring(0, 15));
        const deckCode = extractCodeFromUrl(imagesMap[deck.id]);

        const deckCard = document.createElement('div');
        deckCard.className = 'deck-card';
        deckCard.innerHTML = `
            <div class="deck-image-container">
                <img src="${imageUrl}" alt="${deck.name}" class="deck-image" onerror="this.src='https://via.placeholder.com/300x200/667eea/ffffff?text=${encodeURIComponent(deck.name.substring(0, 15))}'">
                ${!imagesMap[deck.id] ? '<div style="position: absolute; top: 10px; right: 10px; background: rgba(255,0,0,0.7); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em;">No image</div>' : ''}
            </div>
            <div class="deck-info">
                <h3 class="deck-name">${deck.name}</h3>
                ${deckCode ? `<div class="deck-code">${deckCode}</div>` : ''}
                <div class="deck-actions">
                    <button class="btn-secondary" type="button" data-action="edit-deck" data-deck-id="${deck.id}">Edit</button>
                    <button class="btn-secondary btn-danger" type="button" data-action="delete-deck" data-deck-id="${deck.id}" data-deck-name="${deck.name.replace(/"/g, '&quot;')}">Delete</button>
                </div>
            </div>
        `;

        container.appendChild(deckCard);
    });
}

function extractCodeFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/([A-Z0-9-]+)\.webp$/);
    return match ? match[1] : null;
}

async function deleteDeck(deckId, deckName) {
    try {
        showLoading(true);

        const tournamentResultsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/tournament_results?deck_id=eq.${deckId}`,
            { headers }
        );

        if (!tournamentResultsRes.ok) {
            throw new Error(`HTTP ${tournamentResultsRes.status}`);
        }

        const tournamentResults = await tournamentResultsRes.json();

        if (tournamentResults && tournamentResults.length > 0) {
            showLoading(false);
            alert(
                `Cannot delete deck "${deckName}" because it has ${tournamentResults.length} tournament result(s) recorded.\n\nPlease delete the tournament results first.`
            );
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete the deck "${deckName}"?\n\nThis action cannot be undone.`
            )
        ) {
            showLoading(false);
            return;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });

        const res = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
            method: 'DELETE',
            headers: headers
        });

        if (res.ok) {
            loadDecks();
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
    if (typeof openEditDeckModal === 'function') {
        openEditDeckModal(deckId, '', '');
    }
}

// ========== CADASTRO DE DECKS ==========
function setupCadastroForm() {
    const form = document.getElementById('deckForm');
    const deckCodeInput = document.getElementById('deckCode');

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (editId) {
        loadDeckForEdit(editId);
    }

    if (deckCodeInput) {
        deckCodeInput.addEventListener('input', function (e) {
            this.value = this.value.toUpperCase();
            updateImagePreview();
        });

        deckCodeInput.addEventListener('change', updateImagePreview);
        deckCodeInput.addEventListener('keyup', updateImagePreview);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveDeck(editId);
        });
    }
}

async function loadDeckForEdit(deckId) {
    try {
        if (!deckId) {
            alert('No deck ID specified. Going back...');
            window.history.back();
            return;
        }

        showLoading(true);

        const deckRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
            headers,
            mode: 'cors'
        });

        if (!deckRes.ok) {
            throw new Error(`Error loading deck: ${deckRes.status}`);
        }

        const deckData = await deckRes.json();

        if (!deckData || deckData.length === 0) {
            throw new Error('Deck not found');
        }

        const deck = deckData[0];
        let deckCode = '';

        try {
            const imageRes = await fetch(
                `${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}&select=image_url`,
                { headers }
            );

            if (imageRes.ok) {
                const images = await imageRes.json();

                if (images && images.length > 0 && images[0].image_url) {
                    const imageUrl = images[0].image_url;
                    const match = imageUrl.match(/\/([A-Z0-9-]+)\.webp$/);
                    if (match) {
                        deckCode = match[1];
                    }
                }
            }
        } catch (imageError) {
            console.warn('Error loading image:', imageError);
        }

        const deckNameInput = document.getElementById('deckName');
        const deckCodeInput = document.getElementById('deckCode');

        if (deckNameInput) {
            deckNameInput.value = deck.name;
        }

        if (deckCodeInput && deckCode) {
            deckCodeInput.value = deckCode;
            setTimeout(() => updateImagePreview(), 100);
        }

        const pageTitle = document.querySelector('.page-title');
        const submitBtn = document.getElementById('submitBtn');

        if (pageTitle) {
            pageTitle.textContent = '✏️ Edit Deck';
        }

        if (submitBtn) {
            submitBtn.textContent = 'Update Deck';
        }

        window.currentDeckId = deckId;
        window.originalDeckName = deck.name; // ✅ Guardar nome original

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

    if (!isValidDeckCode(deckCode)) {
        showError('Invalid code format. Use: SET-NUMBER (ex: BT16-064, ST22-05, EX5-001)');
        return;
    }

    // ✅ VALIDAÇÃO DE NOME DUPLICADO
    const isDuplicate = await checkDuplicateDeckName(deckName, editId);

    if (isDuplicate) {
        showError(`A deck named "${deckName}" already exists!\n\nPlease choose a different name.`);
        return;
    }

    const imageUrl = IMAGE_BASE_URL + deckCode + '.webp';

    try {
        showLoading(true);

        if (editId) {
            await updateDeck(editId, deckName, imageUrl);
        } else {
            await createDeck(deckName, imageUrl);
        }
    } catch (error) {
        console.error('Error saving deck:', error);
        showError('Error saving deck. Try Again.');
        showLoading(false);
    }
}

async function createDeck(deckName, imageUrl) {
    try {
        const deckRes = await fetch(`${SUPABASE_URL}/rest/v1/decks`, {
            method: 'POST',
            headers: {
                ...headers,
                Prefer: 'return=representation'
            },
            body: JSON.stringify([{ name: deckName }])
        });

        if (!deckRes.ok) {
            throw new Error('Error creating deck');
        }

        const newDeck = (await deckRes.json())[0];

        const imagePayload = {
            deck_id: newDeck.id,
            image_url: imageUrl
        };

        const imageRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images`, {
            method: 'POST',
            headers: {
                ...headers,
                Prefer: 'return=representation'
            },
            body: JSON.stringify([imagePayload])
        });

        if (!imageRes.ok) {
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
        console.error('Error in createDeck:', error);
        showError(error.message);
        showLoading(false);
    }
}

async function updateDeck(deckId, deckName, imageUrl) {
    await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${deckId}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ name: deckName })
    });

    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
        headers
    });
    const existingImages = await checkRes.json();

    if (existingImages.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images?deck_id=eq.${deckId}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ image_url: imageUrl })
        });
    } else {
        await fetch(`${SUPABASE_URL}/rest/v1/deck_images`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify([
                {
                    deck_id: deckId,
                    image_url: imageUrl
                }
            ])
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
