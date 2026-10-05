const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { Response } = globalThis;

function worker() {
    const listeners = {}, stored = new Map(), requests = [];
    const cache = {
        async match(request) { return stored.get(request.url || request); },
        async put(request, response) { stored.set(request.url || request, response); }
    };
    vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
        URL, Response,
        self: { location: { origin: 'https://site.test' }, addEventListener(name, callback) { listeners[name] = callback; } },
        caches: { async open() { return cache; } },
        async fetch(request) { requests.push(request.url); return new Response('release'); }
    });
    return {
        requests,
        async get(path, destination = 'script') {
            let result;
            listeners.fetch({ request: { url: `https://site.test${path}`, method: 'GET', destination }, respondWith(response) { result = response; } });
            return (await result).text();
        }
    };
}

test('versioned assets reuse their cache while a new release fetches a new file', async () => {
    const site = worker();
    await site.get('/module.js?v=one');
    await site.get('/module.js?v=one');
    await site.get('/module.js?v=two');
    assert.equal(site.requests.length, 2);
});

test('unversioned scripts and release manifests continue checking for updates', async () => {
    const site = worker();
    for (const path of ['/config.js', '/demo-v2/microfrontends.json?v=one']) {
        await site.get(path, path.endsWith('one') ? '' : 'script');
        await site.get(path, path.endsWith('one') ? '' : 'script');
    }
    assert.equal(site.requests.length, 4);
});

test('hashed build files reuse the cache', async () => {
    const site = worker();
    await site.get('/demo-v2/app-shell/assets/index-12345678.js');
    await site.get('/demo-v2/app-shell/assets/index-12345678.js');
    assert.equal(site.requests.length, 1);
    await site.get('/demo-v2/mfe/shared/react-12345678.mjs');
    await site.get('/demo-v2/mfe/shared/react-12345678.mjs');
    assert.equal(site.requests.length, 2);
});
