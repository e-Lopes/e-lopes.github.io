import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw new Error('SUPABASE_DB_URL ausente.');
const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});
const phase = process.argv[2];
try {
    await client.connect();
    if (phase === 'database') {
        await client.query(
            readFileSync('database/migrations/20261005010000_automate_digilab_catalog.sql', 'utf8')
        );
        console.log('Rotina atômica e permissões aplicadas.');
    } else if (phase === 'format-guard') {
        await client.query(
            readFileSync(
                'database/migrations/20261005040000_require_digilab_tournament_format.sql',
                'utf8'
            )
        );
        console.log('Importações sem formato oficial exigem revisão.');
    } else if (phase === 'sync') {
        const { rows } = await client.query(
            "select name,decrypted_secret from vault.decrypted_secrets where name in ('digilab_background_sync_url','digilab_background_sync_token')"
        );
        const secrets = Object.fromEntries(rows.map((row) => [row.name, row.decrypted_secret]));
        const url = secrets.digilab_background_sync_url?.replace(
            /\/[^/]+$/,
            '/digilab-deck-catalog'
        );
        if (!url || !secrets.digilab_background_sync_token)
            throw new Error('Configuração de sincronização ausente.');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-digilab-background-token': secrets.digilab_background_sync_token
            },
            body: JSON.stringify({ action: 'sync' }),
            signal: AbortSignal.timeout(120000)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
        console.log(
            JSON.stringify({
                archetypes: result.archetypes,
                created: result.created,
                updated: result.updated,
                archived: result.archived,
                formats: result.formats,
                formats_created: result.formats_created,
                formats_updated: result.formats_updated,
                request_count: result.request_count
            })
        );
    } else if (phase === 'schedule') {
        const { rows } = await client.query(
            'select status from public.digilab_catalog_sync_runs order by started_at desc limit 1'
        );
        if (rows[0]?.status !== 'completed')
            throw new Error('Sincronização manual deve concluir antes de ativar o agendamento.');
        await client.query(
            readFileSync('database/migrations/20261005020000_schedule_digilab_catalog.sql', 'utf8')
        );
        console.log('Agendamento do catálogo aplicado.');
    } else if (phase === 'verify') {
        const { rows } = await client.query(`select
            (select count(*) from decks where is_active) as active_decks,
            (select count(*) from digilab_deck_catalog where is_active) as source_decks,
            (select count(*) from digilab_deck_catalog c left join digilab_deck_sync m on m.digilab_archetype_id=c.digilab_archetype_id left join decks d on d.id=m.deck_id left join deck_families f on f.id=d.family_id where c.is_active and (d.id is null or d.name is distinct from c.name or d.slug is distinct from c.slug or d.primary_color is distinct from c.primary_color or d.secondary_color is distinct from c.secondary_color or d.display_card_id is distinct from c.display_card_id or f.slug is distinct from c.family_slug or not d.is_active)) as mismatches,
            (select count(*) from formats) as formats`);
        console.log(JSON.stringify(rows[0]));
        console.log(
            JSON.stringify(
                (
                    await client.query(
                        "select jobname,schedule,active from cron.job where jobname in ('digilab-catalog-sync','digilab-background-sync') order by jobname"
                    )
                ).rows
            )
        );
        console.log(
            JSON.stringify(
                (
                    await client.query(
                        'select status,summary,error from digilab_catalog_sync_runs order by started_at desc limit 1'
                    )
                ).rows
            )
        );
    } else throw new Error('Use database, sync, schedule ou verify.');
} finally {
    await client.end();
}
