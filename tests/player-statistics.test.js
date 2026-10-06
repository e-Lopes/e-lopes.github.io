const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const sandbox = {};
const source = stripTypeScriptTypes(
    fs.readFileSync('frontend/apps/workspace/player-statistics.ts', 'utf8')
).replace(/export /g, '');
vm.runInNewContext(source + '\nthis.calculate = playerStatistics;', sandbox);

test('player statistics exclude unknown placements and unknown decks without dropping events', () => {
    const result = sandbox.calculate([
        {
            id: 1,
            tournament_id: 1,
            placement: 1,
            tournament_date: '2026-09-01',
            deck: { name: 'Glowing Dawn' },
            store: { name: 'Meruru' }
        },
        {
            id: 2,
            tournament_id: 2,
            placement: 3,
            tournament_date: '2026-09-02',
            deck: { name: 'Glowing Dawn' },
            store: { name: 'Meruru' }
        },
        { id: 3, tournament_id: 3, placement: 0, tournament_date: '2026-09-03' },
        {
            id: 4,
            tournament_id: 4,
            placement: 5,
            tournament_date: '2026-09-04',
            deck: { name: 'Saiyu Warriors' },
            store: { name: 'Gladiators' }
        }
    ]);
    assert.equal(result.events, 4);
    assert.equal(result.titles, 1);
    assert.equal(result.top3, 2);
    assert.equal(result.averagePlacement, 3);
    assert.equal(result.stores, 2);
    assert.equal(result.first, '2026-09-01');
    assert.equal(result.recent, '2026-09-04');
    assert.equal(result.decks[0].count, 2);
});

test('empty history and duplicate tournament results do not inflate event counts', () => {
    assert.equal(sandbox.calculate([]).averagePlacement, null);
    assert.equal(sandbox.calculate([]).events, 0);
    assert.equal(
        sandbox.calculate([
            { id: 1, tournament_id: 8, placement: 2 },
            { id: 1, tournament_id: 8, placement: 2 }
        ]).events,
        1
    );
});
