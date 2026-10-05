const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('post-preview/script.js', 'utf8');

function setup(data, fetchText = async () => '') {
    const option = {};
    const select = { querySelector: () => option };
    const context = vm.createContext({
        document: { getElementById: () => select },
        fetchDecklistTextByResultId: fetchText,
        saveSelectedPostType() {}, updateTemplateControlsVisibility() {},
        updatePostPreviewMeta() {}, updateTemplateEditorButtons() {}, drawPostCanvas() {}
    });
    vm.runInContext(`let tournamentDataForCanvas = ${JSON.stringify(data)};
        let firstPlaceDecklistAvailable = null;
        let selectedPostType = 'blank_middle';
        const POST_TYPE_OPTIONS = ['top4', 'distribution_results', 'blank_middle'];
        const BLANK_MIDDLE_DECKLIST_CACHE = new Map();
        ${source.slice(source.indexOf('function syncPostTypeSelector('), source.indexOf('function setupPostTypeControls('))}
        ${source.slice(source.indexOf('async function refreshDecklistPostAvailability('), source.indexOf('async function fetchDecklistTextByResultId('))}
        ${source.slice(source.indexOf('function parseDecklistEntriesForBlankMiddle('), source.indexOf('async function loadDeckCardImage('))}
        async function refresh() { await refreshDecklistPostAvailability(tournamentDataForCanvas); }
        function changeData(data) { tournamentDataForCanvas = data; }
    `, context);
    return { context, option, select };
}

test('Decklist is hidden and saved selection falls back when champion has no list', async () => {
    const { context, option, select } = setup({ topFour: [{ placement: 1, id: 'result-1' }] });
    await context.refresh();
    assert.equal(option.hidden, true);
    assert.equal(option.disabled, true);
    assert.equal(select.value, 'top4');
});

test('valid inline champion decklist enables Decklist without a request', async () => {
    const { context, option, select } = setup({ topFour: [{ placement: 1, decklist: '4 Agumon BT1-010' }] }, () => { throw new Error('Unexpected request'); });
    await context.refresh();
    assert.equal(option.hidden, false);
    assert.equal(select.value, 'blank_middle');
});

test('a runner-up decklist does not enable the champion Decklist post', async () => {
    const { context, option } = setup({ topFour: [{ placement: 2, decklist: '4 Agumon BT1-010' }] });
    await context.refresh();
    assert.equal(option.hidden, true);
});

test('view result id is accepted and empty responses do not prevent later recovery', async () => {
    let requests = 0;
    const { context, option } = setup({ topFour: [{ placement: 1, id: 'result-1' }] }, async (id) => {
        assert.equal(id, 'result-1');
        return ++requests === 1 ? 'https://example.test/decklist' : '4 Agumon BT1-010';
    });
    await context.refresh();
    assert.equal(option.hidden, true);
    await context.refresh();
    assert.equal(option.hidden, false);
    assert.equal(requests, 2);
});

test('late decklist response from previous tournament does not change current availability', async () => {
    let resolve;
    const { context, option } = setup({ topFour: [{ placement: 1, id: 'old-result' }] }, () => new Promise((done) => { resolve = done; }));
    const pending = context.refresh();
    context.changeData({ topFour: [{ placement: 1 }] });
    await context.refresh();
    resolve('4 Agumon BT1-010');
    await pending;
    assert.equal(option.hidden, true);
});

test('distribution renders deck counts and percentages without standings', async () => {
    const text = [];
    const canvas = new Proxy({
        fillText: (value) => text.push(String(value)),
        measureText: (value) => ({ width: String(value).length * 10 })
    }, { get: (target, key) => target[key] ?? (() => {}) });
    const context = vm.createContext({
        getCombinedDistributionPieState: () => ({}),
        drawRoundedRect() {},
        loadImage: async () => null,
        loadDeckCardImage: async () => null
    });
    vm.runInContext(`let lastDistributionPieRenderState = null;
        ${source.slice(source.indexOf('function fitPostText('), source.indexOf('async function drawTrophyBadge('))}
        ${source.slice(source.indexOf('function buildDeckPieDataForCanvas('), source.indexOf('function getPieStorageKey('))}
        ${source.slice(source.indexOf('function getMiddlePanelRect('), source.indexOf('async function drawBlankMiddleContent('))}
    `, context);
    await context.drawDistributionAndResultsContent(canvas, 1080, 1350, {
        allResults: [
            { placement: 1, player: 'Victor', deck: 'Vulcanusmon' },
            { placement: 2, player: 'Ana', deck: 'Virus Busters' },
            { placement: 3, player: 'Bruno', deck: 'Virus Busters' }
        ]
    }, {});
    assert.ok(text.includes('Vulcanusmon'));
    assert.ok(text.includes('Virus Busters'));
    assert.ok(text.includes('1 · 33%'));
    assert.ok(text.includes('2 · 67%'));
    assert.ok(text.includes('3 participações · 2 decks'));
    assert.ok(!text.includes('Victor'));
    assert.ok(!text.includes('CLASSIFICAÇÃO'));
});
