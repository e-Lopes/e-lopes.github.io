import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Client } = createRequire(import.meta.url)('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw new Error('SUPABASE_DB_URL ausente.');
const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
const normalize = (value) =>
    String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
try {
    await db.connect();
    const secrets = Object.fromEntries(
        (
            await db.query(
                "select name,decrypted_secret from vault.decrypted_secrets where name in ('digilab_background_sync_url','digilab_background_sync_token')"
            )
        ).rows.map((r) => [r.name, r.decrypted_secret])
    );
    const source = [];
    let pages = 1,
        total = 0,
        meta;
    for (let page = 1; page <= pages; page++) {
        const response = await fetch(
            secrets.digilab_background_sync_url.replace(/\/[^/]+$/, '/digilab-deck-catalog'),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-digilab-background-token': secrets.digilab_background_sync_token
                },
                body: JSON.stringify({ action: 'audit_tournaments', page }),
                signal: AbortSignal.timeout(30000)
            }
        );
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Falha na auditoria');
        if (page === 1) {
            pages = payload.pagination.total_pages;
            total = payload.pagination.total;
            meta = payload.meta;
        }
        if (
            !Number.isInteger(pages) ||
            pages < 1 ||
            pages > 20 ||
            payload.pagination.total_pages !== pages ||
            payload.pagination.total !== total ||
            !Array.isArray(payload.data)
        )
            throw new Error('Paginação incompleta');
        source.push(...payload.data);
    }
    if (source.length !== total || new Set(source.map((r) => r.tournament_id)).size !== total)
        throw new Error('Inventário incompleto ou duplicado');
    const formats = (await db.query('select id,code from formats')).rows;
    const locals = (
        await db.query(
            'select t.id,t.tournament_date::text as date,t.format_id,f.code,s.digilab_tournament_id from tournament t join tournament_digilab_sync s on s.tournament_id=t.id left join formats f on f.id=t.format_id where s.digilab_tournament_id is not null'
        )
    ).rows;
    const changes = [];
    for (const row of source) {
        const local = locals.find((t) => Number(t.digilab_tournament_id) === row.tournament_id);
        if (!local) continue;
        if (local.date !== row.event_date)
            throw new Error(`Data divergente no torneio ${local.id}`);
        if (!normalize(row.format)) continue;
        const matches = formats.filter((f) => normalize(f.code) === normalize(row.format));
        if (matches.length !== 1) throw new Error(`Formato não resolvido: ${row.format}`);
        if (local.format_id !== matches[0].id)
            changes.push({ ...local, new_format_id: matches[0].id, new_code: matches[0].code });
    }
    console.log(
        JSON.stringify({
            source_tournaments: source.length,
            corrections: changes.length,
            by_previous_format: changes.reduce(
                (counts, row) => ({ ...counts, [row.code]: (counts[row.code] || 0) + 1 }),
                {}
            ),
            source_EX12: meta?.stats
        })
    );
    if (process.argv.includes('--apply') && changes.length) {
        mkdirSync('backup/tournaments', { recursive: true });
        const backup = `backup/tournaments/digilab-format-corrections-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(
            backup,
            JSON.stringify({ saved_at: new Date().toISOString(), changes }, null, 2)
        );
        await db.query('begin');
        await db.query('lock table tournament in share row exclusive mode');
        for (const row of changes) {
            const result = await db.query(
                'update tournament set format_id=$1 where id=$2 and format_id is not distinct from $3 returning id',
                [row.new_format_id, row.id, row.format_id]
            );
            if (result.rowCount !== 1) throw new Error('Torneio alterado durante a correção');
        }
        await db.query('commit');
        console.log(JSON.stringify({ applied: changes.length, backup }));
    }
    const stats = (
        await db.query(
            "select count(distinct r.deck_id) as decks,count(r.id) as entries,count(r.id) filter(where d.name='Glowing Dawn') as glowing_dawn,count(r.id) filter(where d.name='Sakuyamon') as sakuyamon from tournament t join formats f on f.id=t.format_id join tournament_results r on r.tournament_id=t.id join decks d on d.id=r.deck_id where f.code='EX12' and lower(t.tournament_name) not in ('release event','pre-release')"
        )
    ).rows[0];
    console.log(JSON.stringify({ local_EX12: stats }));
} catch (error) {
    await db.query('rollback').catch(() => {});
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await db.end();
}
