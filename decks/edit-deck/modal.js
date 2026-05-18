(function () {
    const IMAGE_BASE_URL = 'https://images.digimoncard.io/images/cards/';
    const LEGACY_IMAGE_BASE_URL = 'https://deckbuilder.egmanevents.com/card_images/digimon/';
    const FANDOM_BASE_URL = 'https://digimoncardgame.fandom.com/wiki/Special:FilePath/';
    const COLOR_OPTIONS = [
        { code: 'r', label: 'Red', className: 'is-red' },
        { code: 'u', label: 'Blue', className: 'is-blue' },
        { code: 'y', label: 'Yellow', className: 'is-yellow' },
        { code: 'g', label: 'Green', className: 'is-green' },
        { code: 'b', label: 'Black', className: 'is-black' },
        { code: 'p', label: 'Purple', className: 'is-purple' },
        { code: 'w', label: 'White', className: 'is-white' }
    ];
    const COLOR_ORDER = COLOR_OPTIONS.map((item) => item.code);
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
            <div class="form-group">
                <label class="form-label">Deck Colors</label>
                <div id="editDeckColors" class="deck-colors-picker" role="group" aria-label="Deck colors"></div>
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
        const pattern = /^(?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3}$/;
        return pattern.test(code);
    }

    function extractCodeFromUrl(url) {
        if (!url) return '';
        const match = url.match(/\/([A-Z0-9-]+)\.webp$/);
        return match ? match[1] : '';
    }

    function normalizeColorsCsv(value) {
        const set = new Set(
            String(value || '')
                .split(',')
                .map((token) => token.trim().toLowerCase())
                .filter((token) => COLOR_ORDER.includes(token))
        );
        return COLOR_ORDER.filter((token) => set.has(token));
    }

    function buildColorsCsv(selectedColors) {
        return COLOR_ORDER.filter((token) => selectedColors.has(token)).join(',');
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

    async function fetchCardImageBlob(src) {
        let blob;
        try {
            const res = await fetch(src);
            if (!res.ok) return null;
            blob = await res.blob();
        } catch { return null; }
        return new Promise((resolve) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                try {
                    const check = document.createElement('canvas');
                    check.width = 8; check.height = 8;
                    check.getContext('2d').drawImage(img, 0, 0, 8, 8);
                    const { data } = check.getContext('2d').getImageData(0, 0, 8, 8);
                    let r = 0, g = 0, b = 0;
                    const px = data.length / 4;
                    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
                    if ((r / px) > 245 && (g / px) > 245 && (b / px) > 245) { resolve(null); return; }
                    const cv = document.createElement('canvas');
                    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
                    cv.getContext('2d').drawImage(img, 0, 0);
                    cv.toBlob((webpBlob) => resolve(webpBlob || blob), 'image/webp', 0.92);
                } catch { resolve(blob); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    async function uploadDeckImageToStorage(supabaseUrl, headers, deckCode) {
        const candidates = [
            `https://digimoncardgame.fandom.com/wiki/Special:FilePath/${deckCode}-Sample.png`,
            `${IMAGE_BASE_URL}${deckCode}.webp`,
            `${IMAGE_BASE_URL}${deckCode}.jpg`,
            `${LEGACY_IMAGE_BASE_URL}${deckCode}.webp`,
        ];
        let blob = null;
        for (const src of candidates) {
            console.log(`[deck-image] tentando: ${src}`);
            blob = await fetchCardImageBlob(src);
            if (blob) { console.log(`[deck-image] sucesso: ${src} (${blob.size} bytes)`); break; }
            else console.warn(`[deck-image] falhou: ${src}`);
        }
        if (!blob) { console.error(`[deck-image] nenhuma fonte funcionou para ${deckCode}`); return null; }
        const uploadRes = await fetch(
            `${supabaseUrl}/storage/v1/object/deck-images/${encodeURIComponent(deckCode)}.webp`,
            {
                method: 'POST',
                headers: {
                    apikey: headers.apikey,
                    Authorization: headers.Authorization,
                    'Content-Type': blob.type || 'image/webp',
                    'x-upsert': 'true',
                },
                body: blob,
            }
        );
        if (!uploadRes.ok) return null;
        return `${supabaseUrl}/storage/v1/object/public/deck-images/${encodeURIComponent(deckCode)}.webp`;
    }

    async function updateDeck(supabaseUrl, headers, deckId, deckName, deckCode, deckColorsCsv) {
        const storedUrl = await uploadDeckImageToStorage(supabaseUrl, headers, deckCode);
        const imageUrl = storedUrl || (IMAGE_BASE_URL + deckCode + '.webp');

        const deckRes = await fetch(
            `${supabaseUrl}/rest/v1/decks?id=eq.${encodeURIComponent(deckId)}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ name: deckName, colors: deckColorsCsv })
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
        const colorsContainer = document.getElementById('editDeckColors');

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

        const setSelectedColorsFromCsv = (csvValue) => {
            selectedColors.clear();
            normalizeColorsCsv(csvValue).forEach((code) => selectedColors.add(code));
            renderColorButtons();
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

        const updatePreview = () => {
            if (!codeInput || !preview || !previewImage) return;
            const code = codeInput.value.trim().toUpperCase();
            if (!isValidDeckCode(code)) {
                preview.style.display = 'none';
                previewImage.removeAttribute('src');
                return;
            }
            previewImage.src = FANDOM_BASE_URL + code + '-Sample.png';
            preview.style.display = 'flex';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (codeInput) {
            codeInput.addEventListener('input', () => {
                codeInput.value = codeInput.value.toUpperCase();
                updatePreview();
            });
        }

        if (previewImage && preview) {
            previewImage.addEventListener('error', () => {
                const src = previewImage.getAttribute('src') || '';
                if (src.startsWith(FANDOM_BASE_URL)) {
                    const code = src.slice(FANDOM_BASE_URL.length).replace(/-Sample\.png$/, '');
                    previewImage.src = IMAGE_BASE_URL + code + '.webp';
                } else if (src.startsWith(IMAGE_BASE_URL)) {
                    const code = src.slice(IMAGE_BASE_URL.length).replace(/\.webp$/, '');
                    previewImage.src = LEGACY_IMAGE_BASE_URL + code + '.webp';
                } else {
                    preview.style.display = 'none';
                }
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
                const deckId = idInput?.value || '';
                const deckName = (nameInput?.value || '').trim();
                const deckCode = (codeInput?.value || '').trim().toUpperCase();
                const deckColorsCsv = buildColorsCsv(selectedColors);

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
                    await updateDeck(supabaseUrl, headers, deckId, deckName, deckCode, deckColorsCsv);
                    closeModal();
                    if (typeof onUpdated === 'function') await onUpdated();
                } catch (err) {
                    console.error(err);
                    alert('Error updating deck. Please try again.');
                }
            });
        }

        window.openEditDeckModal = function openEditDeckModal(deckId, deckName, imageUrl, deckColors) {
            lastFocused = document.activeElement;
            if (idInput) idInput.value = deckId || '';
            if (nameInput) nameInput.value = deckName || '';
            if (codeInput) codeInput.value = extractCodeFromUrl(imageUrl || '');
            setSelectedColorsFromCsv(deckColors || '');
            updatePreview();
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            modal.removeAttribute('inert');
            if (nameInput) nameInput.focus();
        };
    };
})();
