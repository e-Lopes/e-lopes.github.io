/* global __dirname */
// Apply only the reviewed DigiLab migration before deploying its Edge Functions.
// Management API reference: https://supabase.com/docs/reference/api/v1-run-a-query
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

async function main() {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const project = process.env.SUPABASE_PROJECT_ID;
    if (!token || !/^[a-z0-9]{20}$/.test(project || '')) {
        throw new Error('Configure SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_ID.');
    }
    const query = readFileSync(
        resolve(__dirname, '../database/migrations/20260924010000_reliable_digilab_sync.sql'),
        'utf8'
    );
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: globalThis.AbortSignal.timeout(120000)
    });
    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
            `Migration DigiLab: HTTP ${response.status}. ${String(result.message || 'Consulte os logs do Supabase.').replaceAll(token, '[redacted]')}`
        );
    }
    console.log('Migration DigiLab aplicada; as funções podem ser publicadas.');
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
module.exports = { main };
