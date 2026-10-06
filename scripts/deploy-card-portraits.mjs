import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw Error('SUPABASE_DB_URL ausente.');
const target = new URL(connectionString);
target.port = '6543';
const client = new Client({
    connectionString: target.href,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});
try {
    await client.connect();
    await client.query(
        readFileSync('database/migrations/20261006020000_card_portrait_settings.sql', 'utf8')
    );
    const { rows } = await client.query(
        "select card_code,center_x,offset_y,zoom from public.card_portrait_settings where card_code='BT24-101'"
    );
    console.log(JSON.stringify({ settings: rows }));
} finally {
    await client.end();
}
