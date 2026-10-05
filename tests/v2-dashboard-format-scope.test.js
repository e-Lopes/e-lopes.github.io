const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const liveData = require('../shared/data/tournaments.js');
const resultStatistics = require('../shared/data/statistics.js');

test('Overview and Metagame include only results of tournaments registered in the selected format', () => {
    const events = liveData.normalize({
        stores: [{ id: 1, name: 'Loja' }],
        formats: [
            { id: 12, code: 'EX12' },
            { id: 25, code: 'BT25' }
        ],
        tournaments: [
            { id: 1, store_id: 1, format_id: 12, tournament_date: '2026-07-03', total_players: 1 },
            { id: 2, store_id: 1, format_id: 25, tournament_date: '2026-07-04', total_players: 1 },
            { id: 3, store_id: 1, tournament_date: '2026-07-05', total_players: 1 }
        ],
        results: [
            { tournament_id: 1, placement: 1, player: 'A', deck: 'Deck EX12', format_code: 'BT25' },
            { tournament_id: 2, placement: 1, player: 'B', deck: 'Deck BT25', format_code: 'EX12' },
            {
                tournament_id: 3,
                placement: 1,
                player: 'C',
                deck: 'Sem formato',
                format_code: 'EX12'
            }
        ]
    });
    assert.equal(events.find((event) => event.id === '3').format, 'Não informado');
    const elements = new Map();
    const field = (id) => {
        if (!elements.has(id))
            elements.set(id, { value: '', innerHTML: '', textContent: '', selectedOptions: [] });
        return elements.get(id);
    };
    const context = vm.createContext({
        liveData,
        resultStatistics,
        escapeHtml: (value) => String(value),
        document: { getElementById: field }
    });
    vm.runInContext(fs.readFileSync('demo-v2/dashboard.js', 'utf8'), context);
    context.events = events;
    vm.runInContext(
        'siteData.events = events; filterTournaments = () => {}; renderAdmin = () => {};',
        context
    );
    for (const [format, included, excluded] of [
        ['EX12', 'Deck EX12', 'Deck BT25'],
        ['BT25', 'Deck BT25', 'Deck EX12']
    ]) {
        field('overviewFormat').value = format;
        field('metaFormat').value = format;
        context.renderDashboard();
        assert.match(field('overviewDecks').innerHTML, new RegExp(included));
        assert.ok(!field('overviewDecks').innerHTML.includes(excluded));
        assert.match(field('metaRows').innerHTML, new RegExp(included));
        assert.ok(!field('metaRows').innerHTML.includes(excluded));
        assert.ok(!field('metaRows').innerHTML.includes('Sem formato'));
        assert.equal(field('metaSample').textContent, '1 resultados · 1 torneios');
    }
});
