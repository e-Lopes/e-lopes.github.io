const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('tournament countdown matches 01h, 07h, 13h and 19h Brasília, including midnight rollover', () => {
    const source = readFileSync('torneios/list-tournaments/script.js', 'utf8');
    const start = source.indexOf('function getDigilabCycleStart(');
    const end = source.indexOf('\nfunction ', start + 1);
    const constants = source
        .match(/^const DIGILAB_BACKGROUND_(?:INTERVAL|OFFSET)_MS[^\n]+/gm)
        .join('\n');
    const sandbox = {};
    vm.runInNewContext(
        constants + '\n' + source.slice(start, end) + '\nthis.start=getDigilabCycleStart;',
        sandbox
    );
    for (const hour of [1, 7, 13, 19]) {
        const now = new Date(`2026-10-05T${String(hour).padStart(2, '0')}:00:00-03:00`).getTime();
        assert.equal(sandbox.start(now), now);
        assert.equal(sandbox.start(now - 1), now - 6 * 60 * 60 * 1000);
        assert.equal(sandbox.start(now + 35 * 1000), now);
    }
    assert.equal(
        new Date(sandbox.start(new Date('2026-10-06T00:59:59-03:00').getTime())).toISOString(),
        '2026-10-05T22:00:00.000Z'
    );
});
