const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function setup(fetch = async () => ({ ok: true, json: async () => [] })) {
    return vm.runInNewContext(
        stripTypeScriptTypes(fs.readFileSync('frontend/apps/studio/caption.ts', 'utf8'))
            .replace(/^import .*$/gm, '')
            .replace(/export /g, '') + '\n({ buildPodiumCaption, loadStandingsUrl })',
        {
            fetch,
            URLSearchParams,
            window: {
                APP_CONFIG: { SUPABASE_URL: 'https://storage.test' },
                createSupabaseHeaders: () => ({ apikey: 'public' })
            }
        }
    );
}
const event = {
    isoDate: '2026-10-05',
    store: 'Taverna Game House',
    format: 'EX13',
    players: 7,
    podium: [
        { deck: 'Jupitermon', name: 'Ana' },
        { deck: 'Data Squad Ravemon', name: 'Bia' },
        { deck: 'Vulcanusmon', name: 'Caio' }
    ]
};
test('podium caption reproduces the approved message using tournament data', () => {
    assert.equal(
        setup().buildPodiumCaption(event, 'https://digimon.digilab.cards/tournament/10374'),
        '🇧🇷 5 Oct 2026 — Taverna Game House\nEX13 · 7 players\n\n🥇 Jupitermon\n🥈 Data Squad Ravemon\n🥉 Vulcanusmon\n\nFull standings:\nhttps://digimon.digilab.cards/tournament/10374\n\n#DigimonTCG #EX13 #DigimonCWB'
    );
});
test('captions handle missing places, singular counts and tournaments without decks or links', () => {
    const caption = setup().buildPodiumCaption({
        ...event,
        isoDate: '2027-01-01',
        format: 'BT24',
        players: 1,
        deckless: true,
        podium: [event.podium[0], null, null]
    });
    assert.match(caption, /1 Jan 2027/);
    assert.match(caption, /BT24 · 1 player\n/);
    assert.match(caption, /🥇 Ana/);
    assert.doesNotMatch(caption, /🥈|🥉|Full standings|Jupitermon|#EX13/);
    assert.match(caption, /#BT24/);
});
test('standings links use the external ID rather than the local tournament ID', async () => {
    const signal = new AbortController().signal;
    const api = setup(async (url, options) => {
        const params = new URL(url).searchParams;
        assert.equal(params.get('tournament_id'), 'eq.213');
        assert.equal(options.signal, signal);
        return { ok: true, json: async () => [{ digilab_tournament_id: 10374 }] };
    });
    assert.equal(
        await api.loadStandingsUrl('213', signal),
        'https://digimon.digilab.cards/tournament/10374'
    );
    assert.equal(await setup().loadStandingsUrl('213', signal), '');
    await assert.rejects(setup(async () => ({ ok: false })).loadStandingsUrl('213', signal));
});
