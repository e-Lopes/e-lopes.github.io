const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-digilab-background-token'
};

const MAX_IMPORTS_PER_RUN = 8;
const REQUEST_DELAY_MS = 1300;
const REVIEW_RETRY_HOURS = 6;
const ERROR_RETRY_MINUTES = 30;
type JsonRecord = Record<string, any>;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

    const backgroundToken = Deno.env.get('DIGILAB_BACKGROUND_SYNC_TOKEN') || '';
    const providedToken = req.headers.get('x-digilab-background-token') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const verifyToken = Deno.env.get('DIGILAB_VERIFY_TOKEN') || '';
    if (!supabaseUrl || !serviceRoleKey || !verifyToken) {
        return json({ error: 'Sincronização em background não configurada.' }, 500);
    }

    const backgroundAuthorized = Boolean(
        backgroundToken && (await secretsMatch(providedToken, backgroundToken))
    );
    if (
        !backgroundAuthorized &&
        !(await isAuthorizedAdmin(req, supabaseUrl, serviceRoleKey))
    ) {
        return json({ error: 'Não autorizado.' }, 401);
    }

    let input: JsonRecord = {};
    try {
        const rawBody = await req.text();
        if (rawBody.trim()) input = JSON.parse(rawBody);
    } catch {
        return json({ error: 'Corpo da requisicao invalido.' }, 400);
    }

    const startedAt = new Date().toISOString();
    const retryReviewNow = !backgroundAuthorized && input.retry_review_now === true;
    const summary: JsonRecord = {
        discovered: 0,
        attempted: 0,
        imported: 0,
        players_created: 0,
        needs_review: 0,
        failed: 0,
        skipped: 0
    };

    try {
        await restRequest(
            supabaseUrl,
            serviceRoleKey,
            'digilab_background_imports?status=eq.imported&tournament_id=is.null',
            { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
        );

        await restRequest(
            supabaseUrl,
            serviceRoleKey,
            `digilab_background_imports?status=eq.processing&last_attempt_at=lt.${encodeURIComponent(addTime({ minutes: -30 }))}`,
            {
                method: 'PATCH',
                headers: { Prefer: 'return=minimal' },
                body: {
                    status: 'retry',
                    next_attempt_at: new Date().toISOString(),
                    last_error: 'Execução anterior interrompida; item devolvido à fila.'
                }
            }
        );

        if (retryReviewNow) {
            await restRequest(
                supabaseUrl,
                serviceRoleKey,
                'digilab_background_imports?status=eq.needs_review',
                {
                    method: 'PATCH',
                    headers: { Prefer: 'return=minimal' },
                    body: { next_attempt_at: startedAt }
                }
            );
        }

        const inventory = await callFunction(
            supabaseUrl,
            serviceRoleKey,
            verifyToken,
            'preview-digilab-import',
            { page: 1, per_page: 100 }
        );
        const newRows = (Array.isArray(inventory.data) ? inventory.data : []).filter(
            (row: JsonRecord) =>
                row.mapping_status === 'new_import' && positiveInteger(row.digilab_tournament_id)
        );

        for (const row of newRows) {
            const result = await restRequest(
                supabaseUrl,
                serviceRoleKey,
                'digilab_background_imports?on_conflict=digilab_tournament_id',
                {
                    method: 'POST',
                    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
                    body: [
                        {
                            digilab_tournament_id: Number(row.digilab_tournament_id),
                            status: 'pending',
                            event_date: row.event_date || null,
                            store_name: row.store_name || null,
                            format: row.format || null,
                            player_count: row.player_count ?? null,
                            next_attempt_at: startedAt
                        }
                    ]
                }
            );
            summary.discovered += Array.isArray(result.data) ? result.data.length : 0;
        }

        const dueRows = await restRequest(
            supabaseUrl,
            serviceRoleKey,
            `digilab_background_imports?select=digilab_tournament_id,status,attempt_count&status=in.(pending,needs_review,retry)&next_attempt_at=lte.${encodeURIComponent(startedAt)}&order=first_seen_at.asc&limit=${MAX_IMPORTS_PER_RUN}`
        );

        for (const queueRow of dueRows.data || []) {
            const externalId = Number(queueRow.digilab_tournament_id);
            summary.attempted += 1;
            await updateQueue(supabaseUrl, serviceRoleKey, externalId, {
                status: 'processing',
                attempt_count: Number(queueRow.attempt_count || 0) + 1,
                last_attempt_at: new Date().toISOString(),
                last_error: null
            });

            try {
                let preview = await callFunction(
                    supabaseUrl,
                    serviceRoleKey,
                    verifyToken,
                    'preview-digilab-import',
                    { digilab_tournament_id: externalId }
                );
                if (preview.already_linked) {
                    summary.skipped += 1;
                    await updateQueue(supabaseUrl, serviceRoleKey, externalId, {
                        status: 'imported',
                        tournament_id: Number(preview.already_linked.tournament_id) || null,
                        imported_at: new Date().toISOString(),
                        next_attempt_at: farFuture()
                    });
                } else {
                    const creatablePlayers = getAutomaticallyCreatablePlayers(preview);
                    if (creatablePlayers.length) {
                        const created = await createBackgroundPlayers(
                            supabaseUrl,
                            serviceRoleKey,
                            creatablePlayers
                        );
                        summary.players_created += created;
                        await delay(REQUEST_DELAY_MS);
                        preview = await callFunction(
                            supabaseUrl,
                            serviceRoleKey,
                            verifyToken,
                            'preview-digilab-import',
                            { digilab_tournament_id: externalId }
                        );
                    }

                    if (!preview.can_auto_import) {
                        summary.needs_review += 1;
                        await updateQueue(supabaseUrl, serviceRoleKey, externalId, {
                            status: 'needs_review',
                            last_error: describeReviewReasons(preview),
                            next_attempt_at: addTime({ hours: REVIEW_RETRY_HOURS })
                        });
                    } else {
                        await delay(REQUEST_DELAY_MS);
                        const imported = await callFunction(
                            supabaseUrl,
                            serviceRoleKey,
                            verifyToken,
                            'import-digilab-tournament',
                            { digilab_tournament_id: externalId }
                        );
                        const returnedTournamentId = positiveInteger(imported.tournament_id)
                            ? Number(imported.tournament_id)
                            : null;
                        await delay(REQUEST_DELAY_MS);
                        const confirmation = await callFunction(
                            supabaseUrl,
                            serviceRoleKey,
                            verifyToken,
                            'preview-digilab-import',
                            { digilab_tournament_id: externalId }
                        );
                        const confirmedTournamentId = positiveInteger(
                            confirmation.already_linked?.tournament_id
                        )
                            ? Number(confirmation.already_linked.tournament_id)
                            : null;
                        const importedTournamentId = confirmedTournamentId || returnedTournamentId;
                        if (!importedTournamentId || !confirmedTournamentId) {
                            throw new Error(
                                'A importação retornou sucesso, mas o vínculo do torneio não foi confirmado.'
                            );
                        }
                        summary.imported += 1;
                        await updateQueue(supabaseUrl, serviceRoleKey, externalId, {
                            status: 'imported',
                            tournament_id: importedTournamentId,
                            imported_at: new Date().toISOString(),
                            next_attempt_at: farFuture()
                        });
                    }
                }
            } catch (error) {
                summary.failed += 1;
                const functionError = error instanceof FunctionHttpError ? error : null;
                const retrySeconds = Math.max(0, Number(functionError?.retryAfter) || 0);
                await updateQueue(supabaseUrl, serviceRoleKey, externalId, {
                    status: 'retry',
                    last_error: error instanceof Error ? error.message.slice(0, 1000) : 'Falha desconhecida.',
                    next_attempt_at: retrySeconds
                        ? addTime({ seconds: retrySeconds })
                        : addTime({ minutes: ERROR_RETRY_MINUTES })
                });
                if (functionError?.status === 429) break;
            }
            await delay(REQUEST_DELAY_MS);
        }

        return json({ ok: true, started_at: startedAt, finished_at: new Date().toISOString(), ...summary });
    } catch (error) {
        return json(
            {
                ok: false,
                started_at: startedAt,
                finished_at: new Date().toISOString(),
                ...summary,
                error: error instanceof Error ? error.message : 'Falha na rotina em background.'
            },
            error instanceof FunctionHttpError && error.status === 429 ? 429 : 500,
            error instanceof FunctionHttpError && error.retryAfter
                ? { 'Retry-After': error.retryAfter }
                : undefined
        );
    }
});

class FunctionHttpError extends Error {
    status: number;
    retryAfter: string | null;

    constructor(status: number, message: string, retryAfter: string | null) {
        super(message);
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

async function callFunction(
    supabaseUrl: string,
    serviceRoleKey: string,
    verifyToken: string,
    functionName: string,
    body: JsonRecord
) {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'x-digilab-verify-token': verifyToken
        },
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new FunctionHttpError(
            response.status,
            String(payload.error || `Falha na função ${functionName}.`),
            response.headers.get('retry-after')
        );
    }
    return payload;
}

async function restRequest(
    supabaseUrl: string,
    serviceRoleKey: string,
    path: string,
    options: JsonRecord = {}
) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(String(data?.message || data?.error || `REST HTTP ${response.status}`));
    }
    return { status: response.status, data };
}

async function updateQueue(
    supabaseUrl: string,
    serviceRoleKey: string,
    externalId: number,
    values: JsonRecord
) {
    await restRequest(
        supabaseUrl,
        serviceRoleKey,
        `digilab_background_imports?digilab_tournament_id=eq.${externalId}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: values }
    );
}

function describeReviewReasons(preview: JsonRecord) {
    const reasons = [];
    const resolution = preview.import_resolution || {};
    if (!resolution.store?.store_id) reasons.push('loja sem de-para');
    if (!resolution.format?.format_id) reasons.push('formato sem de-para');
    if (resolution.unresolved_players?.length) {
        reasons.push(`${resolution.unresolved_players.length} jogador(es) sem de-para`);
    }
    if (resolution.unresolved_decks?.length) {
        reasons.push(`${resolution.unresolved_decks.length} deck(s) sem de-para`);
    }
    if (preview.local_candidates?.some((candidate: JsonRecord) => Number(candidate.score) > 0)) {
        reasons.push('possível torneio local na mesma data');
    }
    if (preview.warnings?.length) reasons.push(preview.warnings.join(', '));
    return (reasons.join(' · ') || 'revisão manual necessária').slice(0, 1000);
}

function getAutomaticallyCreatablePlayers(preview: JsonRecord) {
    const resolution = preview?.import_resolution || {};
    const unresolved = Array.isArray(resolution.unresolved_players)
        ? resolution.unresolved_players
        : [];
    const hasOtherBlocker =
        !resolution.store?.store_id ||
        !resolution.format?.format_id ||
        (Array.isArray(resolution.unresolved_decks) && resolution.unresolved_decks.length > 0) ||
        (Array.isArray(preview?.warnings) && preview.warnings.length > 0) ||
        (Array.isArray(preview?.local_candidates) &&
            preview.local_candidates.some((candidate: JsonRecord) => Number(candidate.score) > 0));
    if (!unresolved.length || hasOtherBlocker) return [];

    const uniqueBySlug = new Map<string, JsonRecord>();
    for (const player of unresolved) {
        const slug = String(player?.digilab_player_slug || '').trim();
        const name = String(player?.digilab_player_name || '').replace(/\s+/g, ' ').trim();
        if (player?.status !== 'unmatched' || !slug || !name || uniqueBySlug.has(slug)) return [];
        uniqueBySlug.set(slug, { slug, name });
    }

    const players = [...uniqueBySlug.values()];
    const normalizedNames = players.map((player) => normalizePlayerName(player.name));
    if (normalizedNames.some((name) => !name)) return [];
    if (new Set(normalizedNames).size !== normalizedNames.length) return [];
    return players;
}

async function createBackgroundPlayers(
    supabaseUrl: string,
    serviceRoleKey: string,
    players: JsonRecord[]
) {
    const response = await fetch(`${supabaseUrl}/rest/v1/players`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        },
        body: JSON.stringify(
            players.map((player) => ({
                name: player.name,
                bandai_id: null,
                bandai_nick: player.name,
                digilab_name: player.name,
                is_active: true
            }))
        )
    });
    if (response.status === 409) return 0;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(
            String(payload?.message || payload?.error || `Falha ao cadastrar jogadores (${response.status})`)
        );
    }
    return Array.isArray(payload) ? payload.length : players.length;
}

function normalizePlayerName(value: unknown) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function positiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0;
}

function addTime({ hours = 0, minutes = 0, seconds = 0 }) {
    return new Date(Date.now() + ((hours * 60 + minutes) * 60 + seconds) * 1000).toISOString();
}

function farFuture() {
    return '9999-12-31T23:59:59.999Z';
}

function delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isAuthorizedAdmin(req: Request, supabaseUrl: string, serviceRoleKey: string) {
    const match = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) return false;

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${match[1]}` }
    });
    if (!userResponse.ok) return false;
    const user = await userResponse.json().catch(() => null);
    if (!user?.id) return false;

    const adminResponse = await fetch(
        `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
        {
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            }
        }
    );
    if (!adminResponse.ok) return false;
    const admins = await adminResponse.json().catch(() => []);
    return Array.isArray(admins) && admins.length === 1;
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

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json' }
    });
}
