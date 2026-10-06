const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

test('Admin history escapes remote content and disables retry for processing rows', () => {
    const source = readFileSync('admin/script.js', 'utf8');
    const body = source.slice(
        source.indexOf('function renderDigilabSyncHistory('),
        source.indexOf('async function loadDigilabInventory(')
    );
    const overview = {};
    const context = vm.createContext({
        document: { getElementById: () => overview },
        escapeAdminHtml: (value) =>
            String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    });
    vm.runInContext(body, context);
    const host = {};
    context.renderDigilabSyncHistory(host, {
        runs: [
            {
                status: 'failed',
                source: 'scheduled',
                error: '<script>bad</script>',
                summary: { imported: 2 }
            }
        ],
        pending: [{ digilab_tournament_id: 3, status: 'processing', last_error: '<img>' }],
        events: [
            {
                digilab_tournament_id: 3,
                outcome: 'retry',
                details: { error: '<script>bad</script>' }
            }
        ]
    });
    assert.ok(!host.innerHTML.includes('<script>'));
    assert.ok(host.innerHTML.includes('&lt;script&gt;'));
    assert.match(host.innerHTML, /data-admin-action="digilab-retry"[^>]+disabled/);
    assert.match(overview.innerHTML, /Falhou/);
    assert.match(overview.innerHTML, /Pendências<\/span><strong>1/);
    context.renderDigilabSyncHistory(host, {});
    assert.match(overview.innerHTML, /Sem registro/);
});

test('preview resolves new formats without mutating the database', async () => {
    const source = readFileSync('supabase/functions/preview-digilab-import/index.ts', 'utf8');
    const helper = source.slice(
        source.indexOf('async function resolveImportContext('),
        source.indexOf('async function loadSyncRows(')
    );
    const normalize = source.slice(
        source.indexOf('function normalize(value:'),
        source.indexOf('function json(')
    );
    const context = vm.createContext({});
    vm.runInContext(stripTypeScriptTypes(helper + normalize), context);
    const tables = {
        players: [],
        decks: [],
        stores: [{ id: 'store', name: 'Store' }],
        formats: [],
        digilab_player_sync: [],
        digilab_deck_sync: []
    };
    const db = {
        from: (table) => ({
            select: () => ({
                order: async () => ({ data: tables[table] }),
                in: async () => ({ data: tables[table] }),
                then: (resolve) => resolve({ data: tables[table] })
            })
        })
    };
    const result = await context.resolveImportContext(
        db,
        { store: { name: 'Store' }, format: 'BT-99' },
        []
    );
    assert.equal(result.format.status, 'auto_create');
    assert.equal(result.format.format_id, null);
    tables.formats.push({ id: 'default', code: 'EX12', is_active: true, is_default: true });
    const missing = await context.resolveImportContext(
        db,
        { store: { name: 'Store' }, format: null },
        []
    );
    assert.equal(missing.format.status, 'unmatched');
    assert.equal(missing.format.format_id, null);
});
