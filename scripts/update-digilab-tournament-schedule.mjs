import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw new Error('SUPABASE_DB_URL ausente.');
const target = new URL(connectionString);
if (process.argv.includes('--transaction-pooler')) target.port = '6543';
const client = new Client({
    connectionString: target.href,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});
try {
    await client.connect();
    await client.query(
        readFileSync(
            'database/migrations/20261006010000_digilab_tournaments_hourly.sql',
            'utf8'
        )
    );
    const { rows } = await client.query(
        "select jobname, schedule, active from cron.job where jobname = 'digilab-background-sync'"
    );
    if (rows.length !== 1 || rows[0].schedule !== '0 * * * *' || !rows[0].active)
        throw new Error('Não foi possível confirmar o agendamento ativo.');
    console.log(JSON.stringify(rows[0]));
} finally {
    await client.end();
}
