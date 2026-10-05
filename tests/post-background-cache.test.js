const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createLoader(get) {
    const source = fs.readFileSync(path.join(process.cwd(), 'post-preview/script.js'), 'utf8');
    const start = source.indexOf('async function loadFormatBackgroundMap()');
    const end = source.indexOf('async function syncBackgroundWithTournamentFormat', start);
    let now = 1000;
    const context = vm.createContext({
        window: { supabaseApi: { get } },
        Date: { now: () => now },
        normalizeFormatCode: (value) => value,
        normalizeFormatMapKey: (value) => value,
        buildPublicBucketObjectUrl: (_bucket, value) => value,
        FORMAT_BG_BUCKET: 'post-backgrounds'
    });
    vm.runInContext(`let formatBackgroundMapPromise = null;
        let formatBackgroundMapLoadedAt = 0;
        const FORMAT_BACKGROUND_CACHE_TTL_MS = 60000;
        ${source.slice(start, end)}`, context);
    return { load: () => context.loadFormatBackgroundMap(), advance: () => { now += 60000; } };
}

test('backgrounds share in-flight requests and refresh after cache expiration', async () => {
    let requests = 0;
    const loader = createLoader(async () => {
        requests++;
        return { ok: true, json: async () => [{ code: 'BT24', background_url: `image-${requests}` }] };
    });
    const [first, concurrent] = await Promise.all([loader.load(), loader.load()]);
    assert.equal(requests, 1);
    assert.equal(first.byCode.BT24, concurrent.byCode.BT24);
    await loader.load();
    assert.equal(requests, 1);
    loader.advance();
    assert.equal((await loader.load()).byCode.BT24, 'image-2');
    assert.equal(requests, 2);
});

test('failed background requests can be retried without waiting for expiration', async () => {
    let requests = 0;
    const loader = createLoader(async () => {
        requests++;
        return { ok: requests > 1, status: 503, json: async () => [{ code: 'BT24', background_url: 'recovered' }] };
    });
    assert.equal((await loader.load()).options.length, 0);
    assert.equal((await loader.load()).byCode.BT24, 'recovered');
    assert.equal(requests, 2);
});
