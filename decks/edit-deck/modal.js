(function () {
    const IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
    const MODAL_TEMPLATE = `
<div id="editDeckModal" class="modal-overlay" aria-hidden="true" inert>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="editDeckTitle">
        <h2 id="editDeckTitle">Edit Deck</h2>
        <form id="editDeckForm">
            <input id="editDeckId" type="hidden">
            <div class="form-group">
                <label class="form-label" for="editDeckName">Deck Name*</label>
                <input id="editDeckName" class="form-input" type="text" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="editDeckCode">Deck Code*</label>
                <input id="editDeckCode" class="form-input" type="text" placeholder="BT16-064" required>
                <div class="code-examples">
                    <div class="code-example" data-code="BT24-030">BT24-030</div>
                    <div class="code-example" data-code="ST22-05">ST22-05</div>
                    <div class="code-example" data-code="EX5-001">EX5-001</div>
                    <div class="code-example" data-code="P-183">P-183</div>
                </div>
                <div id="editDeckPreview" class="modal-preview" style="display: none;">
                    <div class="deck-thumb-wrapper modal-preview-thumb">
                        <img id="editDeckPreviewImage" class="deck-thumb-image" alt="Deck preview">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" id="btnCloseEditDeckModal" class="btn-modal-cancel">Cancel</button>
                <button type="submit" class="btn-modal-save">Save</button>
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
        const host = document.getElementById('editDeckModalHost');
        if (!host) return null;
        host.innerHTML = MODAL_TEMPLATE;
        return host.querySelector('#editDeckModal');
    }

    function isValidDeckCode(code) {
        const pattern = /^[A-Z]{1,3}\d{0,2}-\d{1,3}$/;
        return pattern.test(code);
    }

    function extractCodeFromUrl(url) {
        if (!url) return '';
        const match = url.match(/\/([A-Z0-9-]+)\.webp$/);
        return match ? match[1] : '';
    }

    async function checkDuplicateDeckName(supabaseUrl, headers, deckName, excludeDeckId) {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/decks?name=eq.${encodeURIComponent(deckName)}&select=id`,
            { headers }
        );
        if (!res.ok) return false;
        const rows = await res.json();
        return rows.some((r) => String(r.id) !== String(excludeDeckId));
    }

    async function updateDeck(supabaseUrl, headers, deckId, deckName, deckCode) {
        const imageUrl = IMAGE_BASE_URL + deckCode + '.webp';

        const deckRes = await fetch(
            `${supabaseUrl}/rest/v1/decks?id=eq.${encodeURIComponent(deckId)}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ name: deckName })
            }
        );
        if (!deckRes.ok) throw new Error('Error updating deck');

        const checkRes = await fetch(
            `${supabaseUrl}/rest/v1/deck_images?deck_id=eq.${encodeURIComponent(deckId)}&select=id`,
            { headers }
        );
        if (!checkRes.ok) throw new Error('Error checking deck image');
        const existing = await checkRes.json();

        if (existing.length > 0) {
            const patchRes = await fetch(
                `${supabaseUrl}/rest/v1/deck_images?deck_id=eq.${encodeURIComponent(deckId)}`,
                {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ image_url: imageUrl })
                }
            );
            if (!patchRes.ok) throw new Error('Error updating deck image');
        } else {
            const postRes = await fetch(`${supabaseUrl}/rest/v1/deck_images`, {
                method: 'POST',
                headers,
                body: JSON.stringify([{ deck_id: deckId, image_url: imageUrl }])
            });
            if (!postRes.ok) throw new Error('Error creating deck image');
        }
    }

    window.initEditDeckModal = function initEditDeckModal(config) {
        const { supabaseUrl, headers, onUpdated } = config || {};
        if (!supabaseUrl || !headers) return;

        const modal = loadTemplate();
        if (!modal) return;

        const closeBtn = document.getElementById('btnCloseEditDeckModal');
        const form = document.getElementById('editDeckForm');
        const idInput = document.getElementById('editDeckId');
        const nameInput = document.getElementById('editDeckName');
        const codeInput = document.getElementById('editDeckCode');
        const codeExamples = document.querySelectorAll('#editDeckModal .code-example');
        const preview = document.getElementById('editDeckPreview');
        const previewImage = document.getElementById('editDeckPreviewImage');

        let lastFocused = null;

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

        const updatePreview = () => {
            if (!codeInput || !preview || !previewImage) return;
            const code = codeInput.value.trim().toUpperCase();
            if (!isValidDeckCode(code)) {
                preview.style.display = 'none';
                previewImage.removeAttribute('src');
                return;
            }
            previewImage.src = IMAGE_BASE_URL + code + '.webp';
            preview.style.display = 'flex';
        };

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
                if (previewImage.getAttribute('src')) preview.style.display = 'flex';
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

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const deckId = idInput?.value || '';
                const deckName = (nameInput?.value || '').trim();
                const deckCode = (codeInput?.value || '').trim().toUpperCase();

                if (!deckId || !deckName || !deckCode) {
                    alert('Please fill in all required fields.');
                    return;
                }

                if (!isValidDeckCode(deckCode)) {
                    alert('Invalid deck code. Use format like BT16-064.');
                    return;
                }

                const isDuplicate = await checkDuplicateDeckName(
                    supabaseUrl,
                    headers,
                    deckName,
                    deckId
                );
                if (isDuplicate) {
                    alert(`A deck named "${deckName}" already exists.`);
                    return;
                }

                try {
                    await updateDeck(supabaseUrl, headers, deckId, deckName, deckCode);
                    closeModal();
                    if (typeof onUpdated === 'function') await onUpdated();
                } catch (err) {
                    console.error(err);
                    alert('Error updating deck. Please try again.');
                }
            });
        }

        window.openEditDeckModal = function openEditDeckModal(deckId, deckName, imageUrl) {
            lastFocused = document.activeElement;
            if (idInput) idInput.value = deckId || '';
            if (nameInput) nameInput.value = deckName || '';
            if (codeInput) codeInput.value = extractCodeFromUrl(imageUrl || '');
            updatePreview();
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            modal.removeAttribute('inert');
            if (nameInput) nameInput.focus();
        };
    };
})();
