const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const source = readFileSync('supabase/functions/import-digilab-tournament/index.ts', 'utf8');
const helper = source.slice(
    source.indexOf('async function createMissingRegistrations('),
    source.indexOf('async function ensureDigilabFormat(')
);
const normalize = source.slice(
    source.indexOf('function normalize(value:'),
    source.indexOf('function normalizeFormat(')
);
const context = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(helper + normalize), context);

function database(players = [], decks = []) {
    const tables = { players, decks };
    const inserted = [];
    return {
        inserted,
        from(table) {
            return {
                select: async () => ({ data: tables[table], error: null }),
                insert(values) {
                    const row = { id: `${table}-${tables[table].length}`, ...values };
                    tables[table].push(row);
                    inserted.push({ table, values });
                    return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
                }
            };
        }
    };
}
function unresolved(kind, name, slug = name) {
    return { [`digilab_${kind}_name`]: name, [`digilab_${kind}_slug`]: slug, status: 'unmatched' };
}

test('registers players and reuses a newly created deck across standings without a Deck Code', async () => {
    const db = database();
    const resolution = {
        players: [unresolved('player', 'Ana')],
        decks: [unresolved('deck', 'Rosemon'), unresolved('deck', 'Rosemon')]
    };
    await context.createMissingRegistrations(db, resolution);
    assert.equal(db.inserted.length, 2);
    assert.equal(resolution.decks[0].deck_id, resolution.decks[1].deck_id);
    assert.deepEqual(JSON.parse(JSON.stringify(db.inserted[1].values)), {
        name: 'Rosemon',
        is_active: true
    });
    assert.equal(db.inserted[0].values.bandai_id, null);
    assert.equal(db.inserted[0].values.digilab_name, 'Ana');
    await context.createMissingRegistrations(db, resolution);
    assert.equal(db.inserted.length, 2);
});

test('reuses normalized names and DigiLab aliases, preserving explicit mappings', async () => {
    const db = database(
        [{ id: 'p1', name: 'Outro nome', digilab_name: 'João' }],
        [{ id: 'd1', name: 'ROSEMON' }]
    );
    const resolution = {
        players: [unresolved('player', 'joao')],
        decks: [
            unresolved('deck', ' Rosemon '),
            { ...unresolved('deck', 'Manual'), deck_id: 'manual' }
        ]
    };
    await context.createMissingRegistrations(db, resolution);
    assert.equal(resolution.players[0].player_id, 'p1');
    assert.equal(resolution.decks[0].deck_id, 'd1');
    assert.equal(resolution.decks[1].deck_id, 'manual');
    assert.equal(db.inserted.length, 0);
});

test('does not create ambiguous or unnamed registrations', async () => {
    const db = database(
        [],
        [
            { id: 'd1', name: 'Rosemon' },
            { id: 'd2', name: 'ROSEMON' }
        ]
    );
    const resolution = {
        players: [
            unresolved('player', ' '),
            { ...unresolved('player', 'Ana'), status: 'ambiguous' }
        ],
        decks: [unresolved('deck', 'rosemon')]
    };
    await context.createMissingRegistrations(db, resolution);
    assert.equal(resolution.decks[0].status, 'ambiguous');
    assert.equal(db.inserted.length, 0);
});
