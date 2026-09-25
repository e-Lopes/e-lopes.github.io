const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');
const vm = require('node:vm');

test('scheduled routine delegates missing players and decks to the shared importer', async () => {
    let handler;
    const calls = [];
    const updates = [];
    let previews = 0;
    const context = vm.createContext({
        Deno: {
            env: { get: () => 'test-value' },
            serve: (callback) => {
                handler = callback;
            }
        },
        TextEncoder: globalThis.TextEncoder,
        Response: globalThis.Response,
        crypto: webcrypto,
        setTimeout: (callback) => callback(),
        fetch: async (url, options) => {
            calls.push(url);
            const body = options.body ? JSON.parse(options.body) : null;
            let payload = [];
            if (url.includes('/functions/v1/preview-digilab-import')) {
                if (!body.digilab_tournament_id) payload = { data: [] };
                else if (++previews === 1)
                    payload = {
                        can_auto_import: true,
                        import_resolution: {
                            unresolved_players: [
                                {
                                    status: 'unmatched',
                                    digilab_player_name: 'Ana',
                                    digilab_player_slug: 'ana'
                                }
                            ],
                            unresolved_decks: [
                                {
                                    status: 'unmatched',
                                    digilab_deck_name: 'Rosemon',
                                    digilab_deck_slug: 'rosemon'
                                }
                            ]
                        }
                    };
                else payload = { already_linked: { tournament_id: 42 } };
            } else if (url.includes('/functions/v1/import-digilab-tournament')) {
                payload = { tournament_id: 42, players_created: 1, decks_created: 1 };
            } else if (url.includes('select=digilab_tournament_id')) {
                payload = [{ digilab_tournament_id: 123, status: 'pending', attempt_count: 0 }];
            } else if (options.method === 'PATCH') updates.push(body);
            return new globalThis.Response(JSON.stringify(payload), { status: 200 });
        }
    });
    const source = readFileSync('supabase/functions/sync-new-digilab-tournaments/index.ts', 'utf8');
    vm.runInContext(stripTypeScriptTypes(source), context);
    const response = await handler(
        new globalThis.Request('https://example.com', {
            method: 'POST',
            headers: { 'x-digilab-background-token': 'test-value' },
            body: '{}'
        })
    );
    const result = await response.json();
    assert.equal(result.imported, 1);
    assert.equal(result.players_created, 1);
    assert.equal(result.decks_created, 1);
    assert.equal(result.needs_review, 0);
    assert.equal(result.failed, 0);
    assert.ok(calls.some((url) => url.includes('/functions/v1/import-digilab-tournament')));
    assert.ok(!calls.some((url) => url.includes('/rest/v1/players')));
    assert.ok(updates.some((row) => row.status === 'imported' && row.tournament_id === 42));
});
