import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-digilab-verify-token'
};
const DIGILAB_API_URL = 'https://api.digilab.cards';
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
type JsonRecord = Record<string, any>;

class DigilabHttpError extends Error {
    status: number;
    retryAfter: string | null;

    constructor(status: number, message: string, retryAfter: string | null = null) {
        super(message);
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

    const apiKey = Deno.env.get('DIGILAB_API_KEY');
    const verifyToken = Deno.env.get('DIGILAB_VERIFY_TOKEN') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!apiKey || !supabaseUrl || !serviceRoleKey) {
        return json({ error: 'Integração DigiLab não configurada.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    if (!(await authorizeRequest(req, supabase, verifyToken))) {
        return json({ error: 'Não autorizado.' }, 401);
    }

    let input: JsonRecord = {};
    try {
        input = await req.json();
    } catch {
        return json({ error: 'JSON inválido.' }, 400);
    }

    const action = String(input.action || 'list');
    try {
        if (action === 'sync') {
            const synced = await syncCatalog(supabase, apiKey);
            const catalog = await loadCatalog(supabase);
            return json({ ok: true, ...synced, ...catalog });
        }
        if (action === 'map') {
            await mapArchetype(supabase, input, false);
            return json({ ok: true, ...(await loadCatalog(supabase)) });
        }
        if (action === 'create') {
            await mapArchetype(supabase, input, true);
            return json({ ok: true, ...(await loadCatalog(supabase)) });
        }
        if (action === 'map_exact_names') {
            const bulk = await mapExactNames(supabase);
            return json({ ok: true, bulk, ...(await loadCatalog(supabase)) });
        }
        if (action === 'list') {
            return json({ ok: true, ...(await loadCatalog(supabase)) });
        }
        return json({ error: 'Ação inválida.' }, 400);
    } catch (error) {
        if (error instanceof DigilabHttpError) {
            return json(
                {
                    error: error.status === 429 ? 'Limite do DigiLab atingido.' : error.message,
                    digilab_status: error.status,
                    retry_after: error.retryAfter
                },
                error.status === 429 ? 429 : 502,
                error.retryAfter ? { 'Retry-After': error.retryAfter } : undefined
            );
        }
        return json(
            { error: error instanceof Error ? error.message : 'Falha no catálogo de decks.' },
            500
        );
    }
});

async function mapExactNames(supabase: any) {
    const [catalogResult, mappingsResult, decksResult, resultsResult] = await Promise.all([
        supabase
            .from('digilab_deck_catalog')
            .select('digilab_archetype_id,slug,name')
            .eq('is_active', true),
        supabase.from('digilab_deck_sync').select('digilab_deck_slug'),
        supabase.from('decks').select('id,name'),
        supabase.from('tournament_results').select('deck_id')
    ]);
    if (
        catalogResult.error ||
        mappingsResult.error ||
        decksResult.error ||
        resultsResult.error
    ) {
        throw new Error('Falha ao comparar os nomes dos arquétipos.');
    }

    const usedDeckIds = new Set(
        (resultsResult.data || []).map((result: JsonRecord) => String(result.deck_id))
    );
    const decksByName = new Map<string, JsonRecord[]>();
    for (const deck of decksResult.data || []) {
        if (!usedDeckIds.has(String(deck.id))) continue;
        const key = normalize(deck.name);
        if (!key) continue;
        decksByName.set(key, [...(decksByName.get(key) || []), deck]);
    }
    const mappedSlugs = new Set(
        (mappingsResult.data || []).map((mapping: JsonRecord) =>
            normalize(mapping.digilab_deck_slug)
        )
    );
    const now = new Date().toISOString();
    const rows: JsonRecord[] = [];
    let ambiguous = 0;
    for (const catalog of catalogResult.data || []) {
        if (mappedSlugs.has(normalize(catalog.slug))) continue;
        const matches = decksByName.get(normalize(catalog.name)) || [];
        if (matches.length === 1) {
            rows.push({
                digilab_archetype_id: catalog.digilab_archetype_id,
                digilab_deck_slug: catalog.slug,
                digilab_deck_name: catalog.name,
                deck_id: matches[0].id,
                updated_at: now
            });
        } else if (matches.length > 1) {
            ambiguous += 1;
        }
    }

    if (rows.length > 0) {
        const { error } = await supabase
            .from('digilab_deck_sync')
            .upsert(rows, { onConflict: 'digilab_deck_slug' });
        if (error) throw new Error(`Falha ao salvar os vínculos automáticos: ${error.message}`);
    }
    return { mapped: rows.length, ambiguous };
}

async function syncCatalog(supabase: any, apiKey: string) {
    const rows: JsonRecord[] = [];
    let page = 1;
    let totalPages = 1;
    do {
        const query = new URLSearchParams({
            format: 'all',
            group_by: 'archetype',
            page: String(page),
            per_page: String(PAGE_SIZE),
            sort: 'entries',
            sort_dir: 'desc'
        });
        const response = await digilabGet(apiKey, `/api/meta?${query}`);
        rows.push(...(Array.isArray(response?.data) ? response.data : []));
        const reportedTotalPages = positiveInteger(
            response?.pagination?.total_pages,
            1,
            1,
            Number.MAX_SAFE_INTEGER
        );
        if (reportedTotalPages > MAX_PAGES) {
            throw new Error(
                `O catálogo possui ${reportedTotalPages} páginas; o limite seguro é ${MAX_PAGES}.`
            );
        }
        totalPages = reportedTotalPages;
        page += 1;
    } while (page <= totalPages);

    const catalogRows = rows.map(toCatalogRow).filter(Boolean) as JsonRecord[];
    const families = new Map<string, JsonRecord>();
    for (const row of catalogRows) {
        if (row.family_slug && row.family_name) {
            families.set(normalize(row.family_slug), {
                slug: row.family_slug,
                name: row.family_name,
                is_active: true,
                updated_at: new Date().toISOString()
            });
        }
    }

    if (families.size > 0) {
        const { error } = await supabase
            .from('deck_families')
            .upsert([...families.values()], { onConflict: 'slug' });
        if (error) throw new Error(`Falha ao salvar famílias: ${error.message}`);
    }

    const now = new Date().toISOString();
    if (catalogRows.length > 0) {
        const { error } = await supabase.from('digilab_deck_catalog').upsert(
            catalogRows.map((row) => ({ ...row, is_active: true, last_seen_at: now })),
            { onConflict: 'digilab_archetype_id' }
        );
        if (error) throw new Error(`Falha ao salvar catálogo: ${error.message}`);
    }

    return {
        request_count: totalPages,
        fetched_archetypes: catalogRows.length,
        fetched_families: families.size
    };
}

function toCatalogRow(row: JsonRecord) {
    const id = Number(row.archetype_id);
    const slug = String(row.slug || '').trim();
    const name = String(row.archetype_name || '').trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !slug || !name) return null;
    return {
        digilab_archetype_id: id,
        slug,
        name,
        family_slug: cleanText(row.family_slug),
        family_name: cleanText(row.family_name),
        primary_color: cleanText(row.primary_color),
        secondary_color: cleanText(row.secondary_color),
        display_card_id: cleanText(row.display_card_id),
        total_entries: nullableInteger(row.entries),
        firsts: nullableInteger(row.firsts),
        pilots: nullableInteger(row.pilots),
        raw_payload: row
    };
}

async function loadCatalog(supabase: any) {
    const [catalogResult, mappingsResult, decksResult, familiesResult, resultsResult] =
        await Promise.all([
        supabase
            .from('digilab_deck_catalog')
            .select(
                'digilab_archetype_id,slug,name,family_slug,family_name,primary_color,secondary_color,display_card_id,total_entries,is_active,last_seen_at'
            )
            .order('total_entries', { ascending: false, nullsFirst: false })
            .order('name'),
        supabase.from('digilab_deck_sync').select('digilab_archetype_id,digilab_deck_slug,deck_id'),
        supabase
            .from('decks')
            .select(
                'id,name,slug,family_id,primary_color,secondary_color,display_card_id,is_active'
            )
            .order('name'),
        supabase.from('deck_families').select('id,name,slug,is_active').order('name'),
        supabase.from('tournament_results').select('deck_id')
    ]);
    if (
        catalogResult.error ||
        mappingsResult.error ||
        decksResult.error ||
        familiesResult.error ||
        resultsResult.error
    ) {
        throw new Error('Falha ao carregar o catálogo comparado.');
    }

    const decks = decksResult.data || [];
    const families = familiesResult.data || [];
    const decksById = new Map(decks.map((deck: JsonRecord) => [deck.id, deck]));
    const familyById = new Map(families.map((family: JsonRecord) => [family.id, family]));
    const usedDeckIds = new Set(
        (resultsResult.data || []).map((result: JsonRecord) => String(result.deck_id))
    );
    const mappingBySlug = new Map(
        (mappingsResult.data || []).map((mapping: JsonRecord) => [
            mapping.digilab_deck_slug,
            mapping
        ])
    );

    const data = (catalogResult.data || []).map((item: JsonRecord) => {
        const mapping = mappingBySlug.get(item.slug);
        const mappedDeck = mapping ? decksById.get(mapping.deck_id) : null;
        const exact = decks.filter(
            (deck: JsonRecord) => normalize(deck.name) === normalize(item.name)
        );
        const suggestedDeck = mappedDeck || (exact.length === 1 ? exact[0] : null);
        const family = suggestedDeck?.family_id
            ? familyById.get(suggestedDeck.family_id)
            : families.find(
                  (candidate: JsonRecord) =>
                      normalize(candidate.slug) === normalize(item.family_slug)
              ) || null;
        return {
            ...item,
            used_in_digistats: suggestedDeck
                ? usedDeckIds.has(String(suggestedDeck.id))
                : false,
            status: mappedDeck ? 'mapped' : exact.length === 1 ? 'exact_name' : 'unmapped',
            local_deck: suggestedDeck
                ? {
                      deck_id: suggestedDeck.id,
                      deck_name: suggestedDeck.name,
                      family_id: suggestedDeck.family_id || null
                  }
                : null,
            local_family: family
                ? { family_id: family.id, family_name: family.name, family_slug: family.slug }
                : null
        };
    });

    return {
        data,
        deck_options: decks.map((deck: JsonRecord) => ({
            deck_id: deck.id,
            deck_name: deck.name,
            family_id: deck.family_id || null
        })),
        family_options: families.map((family: JsonRecord) => ({
            family_id: family.id,
            family_name: family.name,
            family_slug: family.slug
        })),
        counts: data.reduce(
            (counts: JsonRecord, row: JsonRecord) => {
                counts[row.status] = (counts[row.status] || 0) + 1;
                return counts;
            },
            { mapped: 0, exact_name: 0, unmapped: 0 }
        )
    };
}

async function mapArchetype(supabase: any, input: JsonRecord, createDeck: boolean) {
    const archetypeId = Number(input.digilab_archetype_id);
    if (!Number.isSafeInteger(archetypeId) || archetypeId <= 0) {
        throw new Error('Arquétipo DigiLab inválido.');
    }
    const { data: catalog, error: catalogError } = await supabase
        .from('digilab_deck_catalog')
        .select(
            'digilab_archetype_id,slug,name,family_slug,family_name,primary_color,secondary_color,display_card_id'
        )
        .eq('digilab_archetype_id', archetypeId)
        .maybeSingle();
    if (catalogError || !catalog) throw new Error('Arquétipo DigiLab não encontrado no catálogo.');

    const family = await resolveFamily(supabase, catalog, input.family_id);
    let deck: JsonRecord | null = null;
    if (createDeck) {
        const { data, error } = await supabase
            .from('decks')
            .insert({
                name: catalog.name,
                slug: catalog.slug,
                family_id: family?.id || null,
                primary_color: catalog.primary_color,
                secondary_color: catalog.secondary_color,
                display_card_id: catalog.display_card_id,
                is_active: true
            })
            .select('id,name,slug,family_id')
            .single();
        if (error) throw new Error(`Não foi possível criar o arquétipo local: ${error.message}`);
        deck = data;
    } else {
        const deckId = String(input.deck_id || '');
        const { data, error } = await supabase
            .from('decks')
            .select('id,name,slug,family_id,primary_color,secondary_color,display_card_id')
            .eq('id', deckId)
            .maybeSingle();
        if (error || !data) throw new Error('Deck local não encontrado.');
        deck = data;
        const { error: updateError } = await supabase
            .from('decks')
            .update({
                slug: deck.slug || catalog.slug,
                family_id: input.family_id || deck.family_id || family?.id || null,
                primary_color: deck.primary_color || catalog.primary_color,
                secondary_color: deck.secondary_color || catalog.secondary_color,
                display_card_id: deck.display_card_id || catalog.display_card_id
            })
            .eq('id', deck.id);
        if (updateError) throw new Error(`Falha ao atualizar o deck local: ${updateError.message}`);
    }

    const { error: mappingError } = await supabase.from('digilab_deck_sync').upsert(
        {
            digilab_archetype_id: archetypeId,
            digilab_deck_slug: catalog.slug,
            digilab_deck_name: catalog.name,
            deck_id: deck.id,
            updated_at: new Date().toISOString()
        },
        { onConflict: 'digilab_deck_slug' }
    );
    if (mappingError) throw new Error(`Falha ao salvar o de-para: ${mappingError.message}`);
}

async function resolveFamily(supabase: any, catalog: JsonRecord, requestedFamilyId: unknown) {
    if (requestedFamilyId) {
        const { data, error } = await supabase
            .from('deck_families')
            .select('id,name,slug')
            .eq('id', String(requestedFamilyId))
            .maybeSingle();
        if (error || !data) throw new Error('Família local não encontrada.');
        return data;
    }
    if (!catalog.family_slug) return null;
    const { data, error } = await supabase
        .from('deck_families')
        .select('id,name,slug')
        .eq('slug', catalog.family_slug)
        .maybeSingle();
    if (error) throw new Error('Falha ao resolver a família local.');
    return data;
}

async function digilabGet(apiKey: string, path: string) {
    let response: Response;
    try {
        response = await fetch(`${DIGILAB_API_URL}${path}`, {
            headers: { 'X-API-Key': apiKey }
        });
    } catch {
        throw new DigilabHttpError(0, 'Falha de rede ao consultar o DigiLab.');
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new DigilabHttpError(
            response.status,
            typeof body?.error === 'string' ? body.error : `DigiLab HTTP ${response.status}`,
            response.headers.get('retry-after')
        );
    }
    return body;
}

async function authorizeRequest(req: Request, supabase: any, verifyToken: string) {
    const operatorToken = req.headers.get('x-digilab-verify-token') || '';
    if (verifyToken && (await secretsMatch(operatorToken, verifyToken))) return true;
    const match = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) return false;
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data?.user?.id) return false;
    const { data: admin, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();
    return !adminError && Boolean(admin);
}

async function secretsMatch(provided: string, expected: string) {
    if (!provided || !expected) return false;
    const encoder = new TextEncoder();
    const [leftHash, rightHash] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(provided)),
        crypto.subtle.digest('SHA-256', encoder.encode(expected))
    ]);
    const left = new Uint8Array(leftHash);
    const right = new Uint8Array(rightHash);
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
}

function normalize(value: unknown) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function cleanText(value: unknown) {
    const text = String(value || '').trim();
    return text || null;
}

function nullableInteger(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function positiveInteger(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json' }
    });
}
