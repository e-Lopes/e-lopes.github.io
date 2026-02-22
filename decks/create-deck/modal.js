(function () {
    const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
    const COLOR_OPTIONS = [
        { code: 'r', label: 'Red', className: 'is-red' },
        { code: 'u', label: 'Blue', className: 'is-blue' },
        { code: 'b', label: 'Black', className: 'is-black' },
        { code: 'w', label: 'White', className: 'is-white' },
        { code: 'g', label: 'Green', className: 'is-green' },
        { code: 'y', label: 'Yellow', className: 'is-yellow' },
        { code: 'p', label: 'Purple', className: 'is-purple' }
    ];
    const COLOR_ORDER = COLOR_OPTIONS.map((item) => item.code);
    const MODAL_TEMPLATE = `
<div id="createDeckModal" class="modal-overlay" aria-hidden="true" inert>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="createDeckTitle">
        <h2 id="createDeckTitle">Create Deck</h2>
        <form id="createDeckForm">
            <div class="form-group">
                <label class="form-label" for="createDeckName">Deck Name*</label>
                <input id="createDeckName" class="form-input" type="text" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="createDeckCode">Deck Code*</label>
                <input id="createDeckCode" class="form-input" type="text" placeholder="BT16-064" required>
                <div class="code-examples">
                    <div class="code-example" data-code="BT24-030">BT24-030</div>
                    <div class="code-example" data-code="ST22-05">ST22-05</div>
                    <div class="code-example" data-code="EX5-001">EX5-001</div>
                    <div class="code-example" data-code="P-183">P-183</div>
                </div>
                <div id="createDeckPreview" class="modal-preview" style="display: none;">
                    <div class="deck-thumb-wrapper modal-preview-thumb">
                        <img id="createDeckPreviewImage" class="deck-thumb-image" alt="Deck preview">
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Deck Colors</label>
                <div id="createDeckColors" class="deck-colors-picker" role="group" aria-label="Deck colors"></div>
            </div>
            <div class="modal-actions">
                <button type="button" id="btnCloseCreateDeckModal" class="btn-modal-cancel">Cancel</button>
                <button type="submit" class="btn-modal-save">Create</button>
            </div>
            <div class="modal-tips">
                <h4>💡 How to find the card code:</h4>
                <ul>
                    <li>The code follows the format: <strong>SET-NUMBER</strong></li>
                    <li><strong>SET:</strong> BT16, ST22, EX5, P (promo)...</li>
                    <li><strong>NUMBER:</strong> 001 - 120 (can be 1-3 digits)</li>
                    <li><strong>Examples:</strong> BT24-030, ST22-05, EX5-001, P-183</li>
                </ul>
            </div>
        </form>
    </div>
</div>`;

    function loadTemplate() {
        const host = document.getElementById('createDeckModalHost');
        if (!host) return null;
        host.innerHTML = MODAL_TEMPLATE;
        return host.querySelector('#createDeckModal');
    }

    function isValidDeckCode(code) {
        const pattern = /^[A-Z]{1,3}\d{0,2}-\d{1,3}$/;
        return pattern.test(code);
    }

    function buildColorsCsv(selectedColors) {
        return COLOR_ORDER.filter((token) => selectedColors.has(token)).join(',');
    }

    async function checkDuplicateDeckName(supabaseUrl, headers, deckName) {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/decks?name=eq.${encodeURIComponent(deckName)}&select=id`,
            { headers }
        );
        if (!res.ok) return false;
        const rows = await res.json();
        return rows.length > 0;
    }

    async function createDeck(supabaseUrl, headers, deckName, deckCode, deckColorsCsv) {
        const imageUrl = IMAGE_BASE_URL + deckCode + '.webp';

        const deckRes = await fetch(`${supabaseUrl}/rest/v1/decks`, {
            method: 'POST',
            headers: {
                ...headers,
                Prefer: 'return=representation'
            },
            body: JSON.stringify([{ name: deckName, colors: deckColorsCsv }])
        });

        if (!deckRes.ok) {
            throw new Error('Error creating deck');
        }

        const createdDeck = (await deckRes.json())[0];
        const imageRes = await fetch(`${supabaseUrl}/rest/v1/deck_images`, {
            method: 'POST',
            headers,
            body: JSON.stringify([{ deck_id: createdDeck.id, image_url: imageUrl }])
        });

        if (!imageRes.ok) {
            await fetch(`${supabaseUrl}/rest/v1/decks?id=eq.${createdDeck.id}`, {
                method: 'DELETE',
                headers
            });
            throw new Error('Error saving deck image');
        }
    }

    window.initCreateDeckModal = async function initCreateDeckModal(config) {
        const { supabaseUrl, headers, onCreated } = config || {};
        if (!supabaseUrl || !headers) return;

        const modal = loadTemplate();
        if (!modal) return;

        const openBtn = document.getElementById('btnOpenCreateDeckModal');
        const closeBtn = document.getElementById('btnCloseCreateDeckModal');
        const form = document.getElementById('createDeckForm');
        const codeInput = document.getElementById('createDeckCode');
        const nameInput = document.getElementById('createDeckName');
        const codeExamples = document.querySelectorAll('.code-example');
        const preview = document.getElementById('createDeckPreview');
        const previewImage = document.getElementById('createDeckPreviewImage');
        const colorsContainer = document.getElementById('createDeckColors');

        let lastFocused = null;
        const selectedColors = new Set();

        const renderColorButtons = () => {
            if (!colorsContainer) return;
            colorsContainer.innerHTML = COLOR_OPTIONS.map(
                (option) => `
                    <button
                        type="button"
                        class="deck-color-dot ${option.className}${selectedColors.has(option.code) ? ' is-selected' : ''}"
                        data-color-code="${option.code}"
                        aria-label="${option.label}"
                        aria-pressed="${selectedColors.has(option.code) ? 'true' : 'false'}"
                        title="${option.label}"
                    ></button>
                `
            ).join('');
        };

        const updatePreview = () => {
            if (!codeInput || !preview || !previewImage) return;
            const code = codeInput.value.trim().toUpperCase();

            if (!isValidDeckCode(code)) {
                preview.style.display = 'none';
                previewImage.removeAttribute('src');
                return;
            }

            const imageUrl = IMAGE_BASE_URL + code + '.webp';
            previewImage.src = imageUrl;
            preview.style.display = 'flex';
        };

        const closeModal = () => {
            const active = document.activeElement;
            if (active && modal.contains(active) && typeof active.blur === 'function') {
                active.blur();
            }
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.setAttribute('inert', '');
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        };

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                lastFocused = document.activeElement;
                if (nameInput) nameInput.value = '';
                if (codeInput) codeInput.value = '';
                selectedColors.clear();
                renderColorButtons();
                if (preview) preview.style.display = 'none';
                if (previewImage) previewImage.removeAttribute('src');
                modal.classList.add('active');
                modal.setAttribute('aria-hidden', 'false');
                modal.removeAttribute('inert');
                if (nameInput) nameInput.focus();
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (codeInput) {
            codeInput.addEventListener('input', () => {
                codeInput.value = codeInput.value.toUpperCase();
                updatePreview();
            });
        }

        if (previewImage && preview) {
            previewImage.addEventListener('error', () => {
                preview.style.display = 'none';
            });
            previewImage.addEventListener('load', () => {
                if (previewImage.getAttribute('src')) {
                    preview.style.display = 'flex';
                }
            });
        }

        if (codeExamples.length && codeInput) {
            codeExamples.forEach((example) => {
                example.addEventListener('click', () => {
                    const code = example.getAttribute('data-code') || '';
                    codeInput.value = code;
                    codeInput.dispatchEvent(new Event('input'));
                    codeInput.focus();
                    example.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        example.style.transform = 'translateY(-2px)';
                    }, 100);
                });
            });
        }

        if (colorsContainer) {
            colorsContainer.addEventListener('click', (event) => {
                const button = event.target.closest('[data-color-code]');
                if (!button) return;
                const code = String(button.getAttribute('data-color-code') || '').toLowerCase();
                if (!COLOR_ORDER.includes(code)) return;
                if (selectedColors.has(code)) selectedColors.delete(code);
                else selectedColors.add(code);
                renderColorButtons();
            });
            renderColorButtons();
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const deckName = (nameInput?.value || '').trim();
                const deckCode = (codeInput?.value || '').trim().toUpperCase();
                const deckColorsCsv = buildColorsCsv(selectedColors);

                if (!deckName || !deckCode) {
                    alert('Please fill in all required fields.');
                    return;
                }

                if (!isValidDeckCode(deckCode)) {
                    alert('Invalid deck code. Use format like BT16-064.');
                    return;
                }

                const isDuplicate = await checkDuplicateDeckName(supabaseUrl, headers, deckName);
                if (isDuplicate) {
                    alert(`A deck named "${deckName}" already exists.`);
                    return;
                }

                try {
                    await createDeck(supabaseUrl, headers, deckName, deckCode, deckColorsCsv);
                    closeModal();
                    if (typeof onCreated === 'function') await onCreated();
                } catch (err) {
                    console.error(err);
                    alert('Error creating deck. Please try again.');
                }
            });
        }
    };
})();
