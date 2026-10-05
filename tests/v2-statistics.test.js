const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../shared/data/statistics.js');

test('statistics keep partial tournaments out of title conversion denominators', () => {
    const result = (name, deck, placement) => ({ name, deck, placement, image: '' });
    const analysis = analyze([
        {
            results: [
                result('A', 'Red', 1),
                result('B', 'Red', 2),
                result('C', 'Blue', 3),
                result('D', 'Green', 4)
            ]
        },
        { results: [result('A', 'Red', 2), result('C', 'Blue', 4)] }
    ]);
    assert.deepEqual(
        analysis.decks.find((row) => row.name === 'Red'),
        { name: 'Red', image: '', count: 3, titles: 1, top3: 3, eligible: 2 }
    );
    assert.equal(analysis.decks.find((row) => row.name === 'Blue').eligible, 1);
    assert.deepEqual(
        analysis.players.map((row) => row.name),
        ['A', 'C', 'B', 'D']
    );
    assert.equal(analysis.players.find((row) => row.name === 'D').top3, 0);
});

test('statistics handle missing winners, sparse standings and empty samples', () => {
    assert.deepEqual(analyze([]), { decks: [], players: [] });
    const analysis = analyze([
        { results: [{ name: 'A', deck: 'Blue', placement: 5, image: 'art.webp' }] }
    ]);
    assert.equal(analysis.decks[0].eligible, 0);
    assert.equal(analysis.decks[0].titles, 0);
    assert.equal(analysis.decks[0].top3, 0);
    assert.equal(analysis.decks[0].image, 'art.webp');
});
