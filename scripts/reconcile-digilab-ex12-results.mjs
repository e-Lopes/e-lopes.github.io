import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Client } = createRequire(import.meta.url)('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)[1]
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
const normalize = (s) =>
    String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
try {
    await db.connect();
    const secrets = Object.fromEntries(
        (
            await db.query(
                "select name,decrypted_secret from vault.decrypted_secrets where name in ('digilab_background_sync_url','digilab_background_sync_token')"
            )
        ).rows.map((r) => [r.name, r.decrypted_secret])
    );
    const tournaments = (
        await db.query(
            "select t.id,t.tournament_date::text as date,s.digilab_tournament_id from tournament t join formats f on f.id=t.format_id join tournament_digilab_sync s on s.tournament_id=t.id where f.code='EX12' order by t.id"
        )
    ).rows;
    const mappings = (
        await db.query('select digilab_player_slug,player_id from digilab_player_sync')
    ).rows;
    const decks = (
        await db.query(
            'select m.digilab_deck_slug,m.deck_id,d.name from digilab_deck_sync m join decks d on d.id=m.deck_id where d.is_active'
        )
    ).rows;
    const results = (
        await db.query(
            "select r.id,r.tournament_id,r.player_id,r.deck_id,r.placement,p.name,p.digilab_name from tournament_results r join players p on p.id=r.player_id join tournament t on t.id=r.tournament_id join formats f on f.id=t.format_id where f.code='EX12'"
        )
    ).rows;
    const changes = [];
    for (const [index, event] of tournaments.entries()) {
        const response = await fetch(
            secrets.digilab_background_sync_url.replace(/\/[^/]+$/, '/digilab-deck-catalog'),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-digilab-background-token': secrets.digilab_background_sync_token
                },
                body: JSON.stringify({
                    action: 'audit_tournaments',
                    digilab_tournament_id: Number(event.digilab_tournament_id)
                }),
                signal: AbortSignal.timeout(30000)
            }
        );
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Falha na fonte');
        if (
            payload.tournament.date !== event.date ||
            payload.tournament.format !== 'EX12' ||
            !Array.isArray(payload.standings) ||
            payload.standings.length !== payload.tournament.player_count ||
            (payload.dnfs || []).length
        )
            throw new Error(`Torneio incompleto ou divergente: ${event.id}`);
        const local = results.filter((r) => r.tournament_id === event.id),
            seen = new Set();
        if (local.length !== payload.standings.length)
            throw new Error(`Número de resultados divergente: ${event.id}`);
        for (const row of payload.standings) {
            const playerId = mappings.find(
                (m) => m.digilab_player_slug === row.player?.slug
            )?.player_id;
            const matches = local.filter((r) =>
                playerId
                    ? r.player_id === playerId
                    : [r.name, r.digilab_name].some(
                          (n) => normalize(n) === normalize(row.player?.name)
                      )
            );
            const target = decks.filter((d) => d.digilab_deck_slug === row.deck?.slug);
            if (matches.length !== 1 || target.length !== 1 || seen.has(matches[0].id))
                throw new Error(
                    `Vínculo ambíguo: torneio ${event.id}, jogador ${row.player?.name}, deck ${row.deck?.name}`
                );
            const result = matches[0];
            seen.add(result.id);
            if (result.deck_id !== target[0].deck_id)
                changes.push({
                    id: result.id,
                    tournament_id: event.id,
                    previous_deck_id: result.deck_id,
                    new_deck_id: target[0].deck_id,
                    new_deck: target[0].name,
                    external_id: event.digilab_tournament_id
                });
        }
        if ((index + 1) % 10 === 0)
            console.log(`Conferidos ${index + 1}/${tournaments.length} torneios.`);
    }
    console.log(
        JSON.stringify({ tournaments: tournaments.length, corrections: changes.length, changes })
    );
    if (process.argv.includes('--apply') && changes.length) {
        mkdirSync('backup/tournaments', { recursive: true });
        const backup = `backup/tournaments/digilab-ex12-decks-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(
            backup,
            JSON.stringify({ saved_at: new Date().toISOString(), changes }, null, 2)
        );
        await db.query('begin');
        await db.query('lock table tournament_results in share row exclusive mode');
        for (const row of changes) {
            const saved = await db.query(
                'update tournament_results set deck_id=$1 where id=$2 and deck_id is not distinct from $3 returning id',
                [row.new_deck_id, row.id, row.previous_deck_id]
            );
            if (saved.rowCount !== 1) throw new Error('Resultado alterado durante a conferência');
        }
        await db.query('commit');
        console.log(JSON.stringify({ applied: changes.length, backup }));
    }
} catch (error) {
    await db.query('rollback').catch(() => {});
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await db.end();
}
