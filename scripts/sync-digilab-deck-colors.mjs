// Refresh the official DigiLab catalog using the existing server-side API key.
// Install the temporary PostgreSQL driver with:
// npm.cmd install --prefix .tmp/digilab-tools --no-save --no-package-lock pg
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw new Error('SUPABASE_DB_URL is missing.');
const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});
try {
    await client.connect();
    const secret = (
        await client.query(
            "select decrypted_secret from vault.decrypted_secrets where name='digilab_background_sync_token' limit 1"
        )
    ).rows[0]?.decrypted_secret;
    const url = readFileSync('config/supabase.js', 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
    if (!secret || !url) throw new Error('DigiLab server integration is unavailable.');
    const response = await fetch(`${url}/functions/v1/digilab-deck-catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-digilab-background-token': secret },
        body: JSON.stringify({ action: 'sync' }),
        signal: AbortSignal.timeout(120000)
    });
    const body = await response.json();
    if (!response.ok)
        throw new Error(
            `Catalog: HTTP ${response.status}. ${String(body.error || '').replaceAll(secret, '[redacted]')}`
        );
    console.log(
        JSON.stringify({
            archetypes: body.fetched_archetypes,
            families: body.fetched_families,
            images: body.images,
            requests: body.request_count
        })
    );
} catch (error) {
    console.error(String(error.message).replaceAll(connectionString, '[redacted]'));
    process.exitCode = 1;
} finally {
    await client.end();
}
