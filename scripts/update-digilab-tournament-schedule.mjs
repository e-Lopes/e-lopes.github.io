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
try {
    await client.connect();
    await client.query(
        readFileSync(
            'database/migrations/20261005030000_digilab_tournaments_every_six_hours.sql',
            'utf8'
        )
    );
    const { rows } = await client.query(
        "select jobname, schedule, active from cron.job where jobname = 'digilab-background-sync'"
    );
    if (rows.length !== 1 || rows[0].schedule !== '0 4,10,16,22 * * *' || !rows[0].active)
        throw new Error('Não foi possível confirmar o agendamento ativo.');
    console.log(JSON.stringify(rows[0]));
} finally {
    await client.end();
}
