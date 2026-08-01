import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-digilab-verify-token'
};
const DIGILAB_API_URL = 'https://api.digilab.cards';
const DIGILAB_SITE_URL = 'https://digilab.cards';
const DIGILAB_SCENE = 'curitiba';
type JsonRecord = Record<string, any>;

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

    let input: JsonRecord;
    try {
        input = await req.json();
    } catch {
        return json({ error: 'JSON inválido.' }, 400);
    }
    const externalId = Number(input.digilab_tournament_id);
    if (!Number.isSafeInteger(externalId) || externalId <= 0) {
        return json({ error: 'digilab_tournament_id deve ser um inteiro positivo.' }, 400);
    }
    const targetTournamentId = input.target_tournament_id
        ? Number(input.target_tournament_id)
        : null;
    if (
        targetTournamentId !== null &&
        (!Number.isSafeInteger(targetTournamentId) || targetTournamentId <= 0)
    ) {
        return json({ error: 'target_tournament_id deve ser um inteiro positivo.' }, 400);
    }

    try {
        const detail = await digilabGet(apiKey, `/api/tournament/${externalId}`);
        const tournament = detail?.tournament || {};
        const standings = Array.isArray(detail?.standings) ? detail.standings : [];
        const dnfs = Array.isArray(detail?.dnfs) ? detail.dnfs : [];
        if (normalize(tournament.scene?.slug) !== normalize(DIGILAB_SCENE)) {
            return json({ error: 'O torneio não pertence à scene Curitiba.' }, 422);
        }
        if (dnfs.length) return json({ error: 'Torneios com DNF exigem revisão manual.' }, 422);
        if (!standings.length || Number(tournament.player_count) !== standings.length) {
            return json({ error: 'Standings incompletos para importação automática.' }, 422);
        }
        if (standings.some((row: JsonRecord) => !row.player?.slug)) {
            return json({ error: 'Jogador anônimo exige revisão manual.' }, 422);
        }

        const resolution = await resolveImport(
            supabase,
            tournament,
            standings,
            Array.isArray(input.player_mappings) ? input.player_mappings : [],
            Array.isArray(input.deck_mappings) ? input.deck_mappings : []
        );
        if (!resolution.store?.store_id || !resolution.format?.format_id) {
            return json({ error: 'Loja ou formato local não resolvido.', resolution }, 422);
        }
        const unresolved = resolution.players.filter((player: JsonRecord) => !player.player_id);
        if (unresolved.length) {
            return json(
                { error: 'Existem jogadores sem de-para.', unresolved_players: unresolved },
                422
            );
        }
        const playerIds = resolution.players.map((player: JsonRecord) => player.player_id);
        if (new Set(playerIds).size !== playerIds.length) {
            return json(
                { error: 'Dois jogadores DigiLab apontam para a mesma pessoa local.' },
                422
            );
        }
        const unresolvedDecks = resolution.decks.filter(
            (deck: JsonRecord) => deck.digilab_deck_slug && !deck.deck_id
        );
        if (unresolvedDecks.length) {
            return json(
                { error: 'Existem decks sem de-para.', unresolved_decks: unresolvedDecks },
                422
            );
        }

        const sortedStandings = [...standings].sort(
            (left, right) => Number(left.placement) - Number(right.placement)
        );
        const resolvedBySlug = new Map(
            resolution.players.map((player: JsonRecord) => [player.digilab_player_slug, player])
        );
        const resolvedDeckBySlug = new Map(
            resolution.decks.map((deck: JsonRecord) => [deck.digilab_deck_slug, deck])
        );
        const results = sortedStandings.map((standing: JsonRecord) => ({
            placement: Number(standing.placement),
            player_id: resolvedBySlug.get(standing.player.slug)?.player_id,
            deck_id: standing.deck?.slug
                ? resolvedDeckBySlug.get(standing.deck.slug)?.deck_id || null
                : null,
            digilab_deck_slug: standing.deck?.slug || null,
            digilab_deck_name: standing.deck?.name || null,
            match_points: deriveMatchPoints(standing.record)
        }));
        const tournamentName = String(
            input.tournament_name || mapDigilabTournamentName(tournament.event_type)
        )
            .trim()
            .slice(0, 120);
        const payload = {
            store_id: resolution.store.store_id,
            tournament_date: tournament.date,
            tournament_name: tournamentName || 'Torneio DigiLab',
            total_players: standings.length,
            instagram_link: null,
            format_id: resolution.format.format_id,
            rounds: tournament.rounds ?? null
        };
        const mappings = resolution.players.map((player: JsonRecord) => ({
            digilab_player_slug: player.digilab_player_slug,
            digilab_player_name: player.digilab_player_name,
            player_id: player.player_id
        }));
        if (targetTournamentId) {
            const { data: target, error: targetError } = await supabase
                .from('tournament')
                .select('id,tournament_date,store_id')
                .eq('id', targetTournamentId)
                .maybeSingle();
            if (targetError || !target) {
                return json({ error: 'Torneio DigiStats escolhido não encontrado.' }, 404);
            }
            if (
                String(target.tournament_date) !== String(payload.tournament_date) ||
                String(target.store_id) !== String(payload.store_id)
            ) {
                return json(
                    {
                        error: 'A reconciliação exige a mesma data e loja nos dois torneios.'
                    },
                    422
                );
            }
        }
        const rpcName = targetTournamentId
            ? 'reconcile_digilab_tournament_results'
            : 'import_digilab_tournament_transaction';
        const rpcArgs: JsonRecord = {
            p_digilab_tournament_id: externalId,
            p_digilab_url: `${DIGILAB_SITE_URL}/tournament/${externalId}`,
            p_tournament: payload,
            p_results: results,
            p_player_mappings: mappings
        };
        if (targetTournamentId) rpcArgs.p_tournament_id = targetTournamentId;
        const { data, error } = await supabase.rpc(rpcName, rpcArgs);
        if (error) throw new Error(error.message);
        return json({ ok: true, request_count: 1, ...data });
    } catch (error) {
        if (error instanceof DigilabHttpError) {
            return json(
                {
                    error: 'Não foi possível consultar o DigiLab.',
                    digilab_status: error.status,
                    retry_after: error.retryAfter
                },
                error.status === 429 ? 429 : 502,
                error.retryAfter ? { 'Retry-After': error.retryAfter } : undefined
            );
        }
        return json(
            { error: error instanceof Error ? error.message : 'Falha na importação.' },
            500
        );
    }
});

async function resolveImport(
    supabase: any,
    tournament: JsonRecord,
    standings: JsonRecord[],
    manualMappings: JsonRecord[],
    manualDeckMappings: JsonRecord[]
) {
    const slugs = standings.map((row) => String(row.player.slug));
    const deckSlugs = standings.map((row) => String(row.deck?.slug || '').trim()).filter(Boolean);
    const [
        playersResult,
        mappingsResult,
        storesResult,
        formatsResult,
        decksResult,
        deckMappingsResult
    ] = await Promise.all([
        supabase.from('players').select('id,name,digilab_name'),
        supabase
            .from('digilab_player_sync')
            .select('digilab_player_slug,player_id')
            .in('digilab_player_slug', slugs),
        supabase.from('stores').select('id,name'),
        supabase.from('formats').select('id,code,is_default,is_active'),
        supabase.from('decks').select('id,name'),
        deckSlugs.length
            ? supabase
                  .from('digilab_deck_sync')
                  .select('digilab_deck_slug,deck_id')
                  .in('digilab_deck_slug', deckSlugs)
            : Promise.resolve({ data: [], error: null })
    ]);
    if (
        playersResult.error ||
        mappingsResult.error ||
        storesResult.error ||
        formatsResult.error ||
        decksResult.error ||
        deckMappingsResult.error
    ) {
        throw new Error('Falha ao resolver o de-para local.');
    }
    const players = playersResult.data || [];
    const playersById = new Map(players.map((player: JsonRecord) => [player.id, player]));
    const persisted = new Map(
        (mappingsResult.data || []).map((row: JsonRecord) => [
            row.digilab_player_slug,
            row.player_id
        ])
    );
    const manual = new Map(
        manualMappings.map((row: JsonRecord) => [
            String(row.digilab_player_slug || ''),
            String(row.player_id || '')
        ])
    );
    const resolvedPlayers = standings.map((standing: JsonRecord) => {
        const slug = String(standing.player.slug);
        const name = String(standing.player.name || '');
        const selectedId = manual.get(slug) || persisted.get(slug);
        const selected = playersById.get(selectedId);
        if (selected) {
            return {
                digilab_player_slug: slug,
                digilab_player_name: name,
                player_id: selected.id,
                player_name: selected.name,
                status: manual.has(slug) ? 'manual' : 'mapped'
            };
        }
        const exact = players.filter(
            (player: JsonRecord) =>
                normalize(player.digilab_name) === normalize(name) ||
                normalize(player.name) === normalize(name)
        );
        return {
            digilab_player_slug: slug,
            digilab_player_name: name,
            player_id: exact.length === 1 ? exact[0].id : null,
            player_name: exact.length === 1 ? exact[0].name : null,
            status: exact.length === 1 ? 'exact_name' : exact.length > 1 ? 'ambiguous' : 'unmatched'
        };
    });
    const decks = decksResult.data || [];
    const decksById = new Map(decks.map((deck: JsonRecord) => [deck.id, deck]));
    const persistedDecks = new Map(
        (deckMappingsResult.data || []).map((row: JsonRecord) => [
            row.digilab_deck_slug,
            row.deck_id
        ])
    );
    const manualDecks = new Map(
        manualDeckMappings.map((row: JsonRecord) => [
            String(row.digilab_deck_slug || ''),
            String(row.deck_id || '')
        ])
    );
    const resolvedDecks = standings.map((standing: JsonRecord) => {
        const slug = String(standing.deck?.slug || '').trim();
        const name = String(standing.deck?.name || '').trim();
        if (!slug && !name) {
            return {
                digilab_deck_slug: null,
                digilab_deck_name: null,
                deck_id: null,
                deck_name: null,
                status: 'not_informed'
            };
        }
        const selectedId = manualDecks.get(slug) || persistedDecks.get(slug);
        const selected = decksById.get(selectedId);
        if (selected) {
            return {
                digilab_deck_slug: slug,
                digilab_deck_name: name,
                deck_id: selected.id,
                deck_name: selected.name,
                status: manualDecks.has(slug) ? 'manual' : 'mapped'
            };
        }
        const exact = decks.filter((deck: JsonRecord) => normalize(deck.name) === normalize(name));
        return {
            digilab_deck_slug: slug || null,
            digilab_deck_name: name || null,
            deck_id: exact.length === 1 ? exact[0].id : null,
            deck_name: exact.length === 1 ? exact[0].name : null,
            status: exact.length === 1 ? 'exact_name' : exact.length > 1 ? 'ambiguous' : 'unmatched'
        };
    });
    const stores = (storesResult.data || []).filter(
        (store: JsonRecord) => normalize(store.name) === normalize(tournament.store?.name)
    );
    const formats = (formatsResult.data || []).filter((format: JsonRecord) => format.is_active);
    const exactFormats = formats.filter(
        (format: JsonRecord) => normalizeFormat(format.code) === normalizeFormat(tournament.format)
    );
    const format =
        exactFormats.length === 1
            ? exactFormats[0]
            : formats.find((item: JsonRecord) => item.is_default);
    return {
        players: resolvedPlayers,
        decks: resolvedDecks,
        store: stores.length === 1 ? { store_id: stores[0].id, store_name: stores[0].name } : null,
        format: format ? { format_id: format.id, format_code: format.code } : null
    };
}

function deriveMatchPoints(record: JsonRecord | null | undefined) {
    const wins = Number(record?.wins);
    const ties = Number(record?.ties);
    return Number.isSafeInteger(wins) && Number.isSafeInteger(ties) ? wins * 3 + ties : null;
}

function mapDigilabTournamentName(eventType: unknown) {
    const raw = String(eventType || '').trim();
    const normalized = raw
        .toLocaleLowerCase('en-US')
        .replace(/[\s-]+/g, '_');
    const names: Record<string, string> = {
        locals: 'Semanal',
        evo_cup: 'Evo Cup'
    };
    return names[normalized] || 'Semanal';
}

class DigilabHttpError extends Error {
    status: number;
    retryAfter: string | null;
    constructor(status: number, message: string, retryAfter: string | null) {
        super(message);
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

async function digilabGet(apiKey: string, path: string) {
    const response = await fetch(`${DIGILAB_API_URL}${path}`, {
        headers: { 'X-API-Key': apiKey }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new DigilabHttpError(
            response.status,
            typeof body?.error === 'string' ? body.error : 'Erro DigiLab.',
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

function normalizeFormat(value: unknown) {
    return String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json' }
    });
}
