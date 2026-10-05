const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, orderFormats, compareFormatCodes } = require('../shared/data/tournaments.js');
const { analyze } = require('../shared/data/statistics.js');
const { formatLabel } = require('../shared/data/tournaments.js');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('Format labels use product name followed by code and preserve Special Booster versions', () => {
    const formats = [
        { code: 'EX13', name: 'Chivalrous XIII' },
        { code: 'RSB2.0', name: 'Release Special Booster 2.0' },
        { code: 'RSB2.5', name: 'Release Special Booster 2.5' },
        { code: 'BT14', name: 'BT14' }
    ];
    assert.equal(formatLabel('EX13', formats), 'Chivalrous XIII - EX13');
    assert.equal(formatLabel('RSB2.0', formats), 'Release Special Booster 2.0 - RSB2.0');
    assert.equal(formatLabel('RSB2.5', formats), 'Release Special Booster 2.5 - RSB2.5');
    assert.equal(formatLabel('BT14', formats), 'BT14');
    assert.equal(formatLabel('UNKNOWN', formats), 'UNKNOWN');
    const source = readFileSync('torneios/list-tournaments/script.js', 'utf8');
    const fn = source.slice(
        source.indexOf('function normalizeFormatCode('),
        source.indexOf('function getDefaultTournamentFormatCode(')
    );
    const sandbox = {};
    vm.runInNewContext(fn, sandbox);
    assert.equal(sandbox.normalizeFormatCode('RSB2.0'), 'RSB2.0');
    assert.equal(sandbox.normalizeFormatCode('RSB2.5'), 'RSB2.5');
    assert.equal(sandbox.normalizeFormatCode('BT-26'), 'BT26');
});

test('Formats follow creation date, including names that do not sort chronologically', () => {
    const formats = [
        { id: 30, code: 'BT26', created_at: '2026-09-01T00:00:00Z' },
        { id: 20, code: 'CUSTOM', created_at: '2026-10-01T00:00:00Z' },
        { id: 21, code: 'EXTRA', created_at: '2026-10-01T00:00:00Z' }
    ];
    assert.deepEqual(
        orderFormats(formats).map((row) => row.code),
        ['EXTRA', 'CUSTOM', 'BT26']
    );
    assert.deepEqual(
        ['BT26', 'CUSTOM', 'EXTRA', 'OLD'].sort((a, b) => compareFormatCodes(a, b, formats)),
        ['EXTRA', 'CUSTOM', 'BT26', 'OLD']
    );
    assert.equal(formats[0].code, 'BT26');
});

test('Release Event keeps player results without inventing decks or adding deck statistics', () => {
    const [event] = normalize({
        stores: [{ id: 1, name: 'Loja' }],
        formats: [{ id: 1, code: 'BT26' }],
        tournaments: [
            {
                id: 1,
                store_id: 1,
                format_id: 1,
                tournament_date: '2026-09-01',
                tournament_name: 'release_event',
                total_players: 8
            }
        ],
        results: [
            {
                tournament_id: 1,
                placement: 1,
                player: 'Matheus',
                deck: 'Unused',
                image_url: 'https://example.com/card.webp'
            }
        ]
    });
    assert.equal(event.title, 'Release Event');
    assert.equal(event.deckless, true);
    assert.equal(event.winner.name, 'Matheus');
    assert.equal(event.winner.deck, '');
    assert.equal(event.winner.image, '');
    const statistics = analyze([event]);
    assert.equal(statistics.decks.length, 0);
    assert.equal(statistics.players[0].titles, 1);
});
