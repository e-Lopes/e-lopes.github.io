const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Buffer } = require('node:buffer');
const { Response } = globalThis;

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

test('installed app keeps its identity and uses the new name and correctly sized icons', () => {
    assert.equal(manifest.id, './');
    assert.equal(manifest.start_url, './index.html');
    assert.equal(manifest.name, 'Digimon CWB');
    assert.equal(manifest.short_name, 'Digimon CWB');
    for (const icon of manifest.icons) {
        const image = fs.readFileSync(icon.src);
        assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        assert.equal(`${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`, icon.sizes);
    }
    for (const shortcut of manifest.shortcuts) {
        const url = new URL(shortcut.url, 'https://example.test/');
        assert.equal(url.pathname, '/demo-v2/');
        assert.ok(['#tournaments', '#players', '#decks'].includes(url.hash));
    }
});

for (const online of [true, false]) {
    test(`manifest ${online ? 'updates despite an older cached name' : 'remains available offline'}`, async () => {
        const listeners = new Map();
        let fetches = 0;
        const cached = new Response(JSON.stringify({ name: 'DigiStats' }));
        vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
            self: {
                location: { origin: 'https://example.test' },
                addEventListener: (name, handler) => listeners.set(name, handler)
            },
            URL,
            Response,
            caches: { open: async () => ({ match: async () => cached, put: () => {} }) },
            fetch: async () => {
                fetches++;
                if (!online) throw Error('offline');
                return new Response(JSON.stringify({ name: 'Digimon CWB' }));
            }
        });
        let response;
        listeners.get('fetch')({
            request: {
                method: 'GET',
                url: 'https://example.test/manifest.json',
                destination: 'manifest'
            },
            respondWith: (promise) => {
                response = promise;
            }
        });
        assert.equal((await (await response).json()).name, online ? 'Digimon CWB' : 'DigiStats');
        assert.equal(fetches, 1);
    });
}
