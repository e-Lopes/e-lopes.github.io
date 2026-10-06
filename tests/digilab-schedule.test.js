const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('tournament countdown matches every hour in Brasília, including midnight rollover', () => {
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
    for (let hour = 0; hour < 24; hour++) {
        const now = new Date(`2026-10-05T${String(hour).padStart(2, '0')}:00:00-03:00`).getTime();
        assert.equal(sandbox.start(now), now);
        assert.equal(sandbox.start(now - 1), now - 60 * 60 * 1000);
        assert.equal(sandbox.start(now + 35 * 1000), now);
    }
    assert.equal(
        new Date(sandbox.start(new Date('2026-10-06T00:59:59-03:00').getTime())).toISOString(),
        '2026-10-06T03:00:00.000Z'
    );
});
