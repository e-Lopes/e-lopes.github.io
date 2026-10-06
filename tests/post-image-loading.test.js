const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loader(fail) {
    const attempts = [];
    const api = vm.runInNewContext(
        fs.readFileSync('shared/posts/renderer.js', 'utf8').replace(/export /g, '') +
            '\n({ loadPostPortrait })',
        {
            window: { APP_CONFIG: { SUPABASE_URL: 'https://storage.example' } },
            setTimeout,
            clearTimeout,
            Image: class {
                set src(value) {
                    attempts.push(value);
                    assert.equal(this.crossOrigin, 'anonymous');
                    Promise.resolve().then(() => (fail(value) ? this.onerror() : this.onload()));
                }
            }
        }
    );
    return { api, attempts };
}

test('posts preserve the registered image when it loads for canvas', async () => {
    const { api, attempts } = loader(() => false);
    const src = 'https://digimon.digilab.cards/api/card/ST23-09.jpg';
    assert.ok(await api.loadPostPortrait(src));
    assert.deepEqual(attempts, [src]);
});

test('posts fall back to card storage when the registered image fails CORS', async () => {
    const { api, attempts } = loader((src) => src.includes('digilab.cards'));
    assert.ok(await api.loadPostPortrait('https://digimon.digilab.cards/api/card/ST23-09.jpg'));
    assert.deepEqual(attempts, [
        'https://digimon.digilab.cards/api/card/ST23-09.jpg',
        'https://storage.example/storage/v1/object/public/deck-images/ST23-09.webp'
    ]);
});

test('failed portraits can be retried and absent portraits make no requests', async () => {
    const { api, attempts } = loader(() => true);
    assert.equal(await api.loadPostPortrait(''), null);
    assert.equal(await api.loadPostPortrait('https://example.com/custom.png'), null);
    assert.equal(await api.loadPostPortrait('https://example.com/custom.png'), null);
    assert.equal(attempts.length, 2);
});
