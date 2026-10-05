const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function setup(fetch = async () => ({ ok: true, json: async () => [] })) {
    const sandbox = {
        fetch,
        URLSearchParams,
        window: {
            APP_CONFIG: { SUPABASE_URL: 'https://api.test' },
            createSupabaseHeaders: () => ({ Authorization: 'session' })
        }
    };
    const source = stripTypeScriptTypes(
        fs.readFileSync('frontend/apps/dashboard/metagame-model.ts', 'utf8')
    )
        .replace(/^import.*$/gm, '')
        .replace(/export /g, '');
    vm.runInNewContext(
        source +
            '\nthis.api={analyzeMeta,currentFormat,eventType,readMeta,overviewFourWeeks,createMetaCache}',
        sandbox
    );
    return sandbox.api;
}
const event = (id, players, deckless = false) => ({
    id,
    players,
    deckless,
    isoDate: '2026-10-02',
    results: [],
    format: 'BT26'
});
const result = (eventId, placement, deck = 'd1') => ({
    id: `${eventId}-${placement}`,
    tournament_id: eventId,
    placement,
    deck_id: deck,
    player_id: 'p' + placement,
    deck: deck ? { name: 'Same display name' } : null,
    player: { name: 'Player ' + placement },
    decklists: []
});

test('metagame separates deck popularity, distinct players and eligible Top 4', () => {
    const records = [
        ...Array.from({ length: 8 }, (_, i) => result('large', i + 1)),
        ...Array.from({ length: 4 }, (_, i) => result('small', i + 1)),
        result('release', 1, null)
    ];
    const model = setup().analyzeMeta(
        [event('large', 8), event('small', 4), event('release', 1, true)],
        records
    );
    assert.equal(model.results.length, 13);
    assert.equal(model.known.length, 12);
    assert.equal(model.deckExpected, 12);
    assert.equal(model.decks[0].players.size, 8);
    assert.equal(model.decks[0].titles, 2);
    assert.equal(model.decks[0].eligible, 12);
    assert.equal(model.decks[0].top4, 4);
    assert.equal(model.decks[0].topEligible, 8);
});
test('partial or invalid standings never inflate conversion and duplicate rows are ignored', () => {
    const rows = [result('partial', 1), result('partial', 2), result('partial', 1)];
    const model = setup().analyzeMeta([event('partial', 8)], rows);
    assert.equal(model.known.length, 2);
    assert.equal(model.complete.size, 0);
    assert.equal(model.decks[0].titles, 0);
    assert.equal(model.decks[0].eligible, 0);
    const duplicatePlayer = [result('invalid', 1), { ...result('invalid', 2), player_id: 'p1' }];
    assert.equal(setup().analyzeMeta([event('invalid', 2)], duplicatePlayer).complete.size, 0);
});
test('deck IDs keep identical names separate and missing decks remain in coverage', () => {
    const model = setup().analyzeMeta(
        [event('a', 3)],
        [result('a', 1), result('a', 2, 'd2'), result('a', 3, null)]
    );
    assert.equal(model.decks.length, 2);
    assert.equal(model.known.length, 2);
    assert.equal(model.deckExpected, 3);
    assert.equal(model.players.length, 3);
    assert.equal(setup().analyzeMeta([], []).decks.length, 0);
});
test('current format appears only with a registered tournament and otherwise falls back to latest data', () => {
    assert.equal(
        setup().currentFormat([{ code: 'BT27', is_default: true }], [event('old', 8)]),
        'BT26'
    );
    assert.equal(setup().eventType('regulation_battle'), 'Regulation Battle');
    assert.equal(setup().eventType('Semanal'), 'Locals');
});
test('analysis reads all pages and passes cancellation and session headers', async () => {
    const calls = [],
        signal = {};
    const api = setup(async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            json: async () =>
                calls.length === 1
                    ? Array.from({ length: 500 }, (_, i) => ({ id: i }))
                    : [{ id: 501 }]
        };
    });
    assert.equal((await api.readMeta({}, signal)).length, 501);
    assert.ok(calls[1].url.includes('offset=500'));
    assert.equal(calls[0].options.signal, signal);
    assert.equal(calls[0].options.headers.Authorization, 'session');
});

test('overview highlights cover four calendar weeks and keep only the selected format', () => {
    const events = [
        { ...event('latest', 8), isoDate: '2026-10-02' },
        { ...event('boundary', 8), isoDate: '2026-09-07' },
        { ...event('old', 8), isoDate: '2026-09-06' },
        { ...event('other', 8), isoDate: '2026-09-28', format: 'EX12' }
    ];
    const range = setup().overviewFourWeeks(events, 'BT26');
    assert.equal(range.start, '2026-09-07');
    assert.equal(range.end, '2026-10-04');
    assert.equal(range.events.map((e) => e.id).join(','), 'latest,boundary');
    assert.equal(setup().overviewFourWeeks([], 'BT26').events.length, 0);
});

test('meta cache reuses completed and pending reads and refreshes for a new data version', async () => {
    const cache = setup().createMetaCache();
    let calls = 0,
        resolve;
    const load = () => {
        calls++;
        return new Promise((done) => {
            resolve = done;
        });
    };
    const first = cache.load(1, load),
        second = cache.load(1, load);
    assert.equal(first, second);
    assert.equal(calls, 1);
    const records = [{ id: 'a' }];
    resolve(records);
    assert.equal(await first, records);
    assert.equal(cache.peek(1), records);
    assert.equal(await cache.load(1, load), records);
    assert.equal(calls, 1);
    assert.equal(cache.peek(2), null);
    await cache.load(2, async () => {
        calls++;
        return [];
    });
    assert.equal(calls, 2);
});
test('meta cache allows retries after a failed request', async () => {
    const cache = setup().createMetaCache();
    await assert.rejects(
        cache.load(1, async () => {
            throw Error('offline');
        })
    );
    assert.equal(cache.peek(1), null);
    const rows = await cache.load(1, async () => [{ id: 'retry' }]);
    assert.equal(rows[0].id, 'retry');
});
