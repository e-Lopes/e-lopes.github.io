#!/usr/bin/env node

/**
 * Bulk metadata sync for Digimon cards.
 *
 * What it does:
 * 1) Reads all distinct card_code from public.decklist_cards
 * 2) Fetches card metadata from https://digimoncard.io/api-public/search
 * 3) Upserts into public.cards_cache
 * 4) (Optional) updates public.decklist_cards metadata fields by card_code
 *
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_KEY (or SUPABASE_ANON_KEY)
 *
 * Optional flags:
 * - --update-decklist-cards  (also PATCH card_type/card_level/is_digi_egg in decklist_cards)
 * - --chunk=20               (API lookup chunk size)
 * - --sleep=120              (delay between API calls in ms)
 */

const DIGIMON_API_URL = 'https://digimoncard.io/api-public/search';
const DEFAULT_CHUNK = 20;
const DEFAULT_SLEEP_MS = 120;
const REST_PAGE_SIZE = 1000;

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

const argv = process.argv.slice(2);
const shouldUpdateDecklistCards = argv.includes('--update-decklist-cards');
const chunkSize = getNumericFlag('--chunk', DEFAULT_CHUNK);
const sleepMs = getNumericFlag('--sleep', DEFAULT_SLEEP_MS);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_ANON_KEY env vars.');
    process.exit(1);
}

const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function main() {
    console.log('[sync] starting...');
    console.log(`[sync] mode: ${shouldUpdateDecklistCards ? 'cache + decklist_cards' : 'cache only'}`);
    const codes = await fetchDistinctDecklistCodes();
    if (codes.length === 0) {
        console.log('[sync] no card codes found in decklist_cards.');
        return;
    }
    console.log(`[sync] distinct card codes: ${codes.length}`);

    const rowsFromApi = await fetchMetadataFromApi(codes, chunkSize, sleepMs);
    if (rowsFromApi.length === 0) {
        console.log('[sync] no metadata returned from API.');
        return;
    }
    console.log(`[sync] api rows: ${rowsFromApi.length}`);

    await upsertCardsCache(rowsFromApi);
    console.log('[sync] cards_cache upsert done.');

    if (shouldUpdateDecklistCards) {
        await patchDecklistCardsMetadata(rowsFromApi);
        console.log('[sync] decklist_cards metadata update done.');
    }

    console.log('[sync] finished.');
}

function getNumericFlag(flag, fallback) {
    const found = argv.find((arg) => arg.startsWith(`${flag}=`));
    if (!found) return fallback;
    const value = Number(found.split('=')[1]);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.trunc(value);
}

async function fetchDistinctDecklistCodes() {
    const result = new Set();
    let offset = 0;

    while (true) {
        const query = new URLSearchParams({
            select: 'card_code',
            order: 'card_code.asc',
            limit: String(REST_PAGE_SIZE),
            offset: String(offset)
        });
        const res = await fetch(`${SUPABASE_URL}/rest/v1/decklist_cards?${query.toString()}`, { headers });
        if (!res.ok) {
            throw new Error(`Failed to fetch decklist_cards: HTTP ${res.status}`);
        }
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        rows.forEach((row) => {
            const code = normalizeCode(row?.card_code || '');
            if (code) result.add(code);
        });
        if (rows.length < REST_PAGE_SIZE) break;
        offset += REST_PAGE_SIZE;
    }

    return Array.from(result);
}

async function fetchMetadataFromApi(codes, size, waitMs) {
    const out = [];
    const chunks = chunkArray(codes, size);

    for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const params = new URLSearchParams({
            card: chunk.join(','),
            limit: String(chunk.length)
        });
        const res = await fetch(`${DIGIMON_API_URL}?${params.toString()}`);
        if (!res.ok) {
            console.warn(`[sync] API chunk ${i + 1}/${chunks.length} failed: HTTP ${res.status}`);
            await sleep(waitMs);
            continue;
        }
        const rows = await res.json();
        if (Array.isArray(rows)) {
            rows.forEach((row) => {
                const code = normalizeCode(row?.id || row?.card || '');
                if (!code) return;
                out.push({
                    card_code: code,
                    id: row?.id || code,
                    name: row?.name || code,
                    pack: row?.pack || '',
                    color: row?.color || '',
                    type: row?.type || '',
                    card_payload: row || {},
                    ...deriveDecklistMetadata(row)
                });
            });
        }
        if ((i + 1) % 10 === 0 || i + 1 === chunks.length) {
            console.log(`[sync] API progress ${i + 1}/${chunks.length}`);
        }
        await sleep(waitMs);
    }

    const dedup = new Map();
    out.forEach((row) => {
        dedup.set(row.card_code, row);
    });
    return Array.from(dedup.values());
}

function deriveDecklistMetadata(row) {
    const typeNorm = normalizeType(row?.type);
    const level = normalizeLevel(row?.level);
    const isDigiEgg = typeNorm === 'digi-egg';

    let cardType = null;
    if (typeNorm === 'digi-egg') cardType = 'Digi-Egg';
    else if (typeNorm === 'digimon') cardType = 'Digimon';
    else if (typeNorm === 'tamer') cardType = 'Tamer';
    else if (typeNorm === 'option') cardType = 'Option';

    return { card_type: cardType, card_level: level, is_digi_egg: isDigiEgg };
}

function normalizeType(value) {
    const text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');
    if (text === 'digi-egg' || text === 'digitama') return 'digi-egg';
    if (text === 'digimon') return 'digimon';
    if (text === 'tamer') return 'tamer';
    if (text === 'option') return 'option';
    return '';
}

function normalizeLevel(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

async function upsertCardsCache(rows) {
    const nowIso = new Date().toISOString();
    const payload = rows.map((row) => ({
        card_code: row.card_code,
        id: row.id,
        name: row.name,
        pack: row.pack,
        color: row.color,
        type: row.type,
        card_payload: row.card_payload || {},
        updated_at: nowIso
    }));

    const chunks = chunkArray(payload, 500);
    for (let i = 0; i < chunks.length; i += 1) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cards_cache?on_conflict=card_code`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(chunks[i])
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`cards_cache upsert failed (chunk ${i + 1}/${chunks.length}): HTTP ${res.status} ${body}`);
        }
    }
}

async function patchDecklistCardsMetadata(rows) {
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const code = row.card_code;
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/decklist_cards?card_code=eq.${encodeURIComponent(code)}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    card_type: row.card_type,
                    card_level: row.card_level,
                    is_digi_egg: row.is_digi_egg
                })
            }
        );
        if (res.ok) ok += 1;
        else {
            failed += 1;
            const body = await res.text();
            console.warn(`[sync] patch failed for ${code}: HTTP ${res.status} ${body}`);
        }
        if ((i + 1) % 100 === 0 || i + 1 === rows.length) {
            console.log(`[sync] patch progress ${i + 1}/${rows.length} (ok=${ok}, failed=${failed})`);
        }
    }
}

function normalizeCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

function chunkArray(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error('[sync] fatal:', error?.message || error);
    process.exit(1);
});

