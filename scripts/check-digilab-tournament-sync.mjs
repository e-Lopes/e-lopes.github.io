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
const client = new Client({ connectionString: target.href, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
try {
    await client.connect();
    for (const [label, query] of Object.entries({
        schedule: "select jobid, jobname, schedule, active from cron.job where jobname = 'digilab-background-sync'",
        cron: "select status, return_message, start_time, end_time from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'digilab-background-sync') order by start_time desc limit 6",
        runs: 'select * from public.digilab_sync_runs order by started_at desc limit 6',
        queue: 'select status, count(*) from public.digilab_background_imports group by status',
        events: 'select outcome, details, created_at from public.digilab_sync_events order by id desc limit 8'
    })) {
        console.log(JSON.stringify({ [label]: (await client.query(query)).rows }));
    }
} finally {
    await client.end();
}
