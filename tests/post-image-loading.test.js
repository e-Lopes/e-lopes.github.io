const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('BT24-101 portrait centers on x=220 and preserves the crop of other cards', () => {
    const paintPortrait = vm.runInNewContext(
        fs.readFileSync('shared/posts/renderer.js', 'utf8').replace(/export /g, '') +
            '\npaintPortrait',
        {
            window: {
                cardPortraits: {
                    get: (src) => ({
                        center_x: /\bBT24-101(?=[._/?#]|$)/i.test(src) ? 220 / 430 : 0.5,
                        offset_y: 0,
                        zoom: 2.3
                    })
                }
            }
        }
    );
    for (const [src, center] of [
        ['https://digimon.digilab.cards/api/card/BT24-101.jpg?s=m&v=2', 220 / 430],
        ['https://storage.example/deck-images/digilab/BT24-101.webp', 220 / 430],
        ['https://storage.example/deck-images/BT24-1010.webp', 0.5],
        ['https://storage.example/deck-images/ST23-09.webp', 0.5]
    ]) {
        for (const sourceWidth of [430, 860]) {
            let draw;
            const ctx = new Proxy(
                {},
                {
                    get: (_, key) =>
                        key === 'drawImage'
                            ? (...args) => {
                                  draw = args;
                              }
                            : () => {},
                    set: () => true
                }
            );
            paintPortrait(
                ctx,
                { src, width: sourceWidth, height: (sourceWidth * 601) / 430 },
                540,
                650,
                185,
                'gold',
                'JU'
            );
            const [, left, , width] = draw;
            assert.ok(Math.abs((540 - left) / width - center) < 1e-12, src);
        }
    }
});

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
