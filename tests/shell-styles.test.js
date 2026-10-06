const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function setup() {
    const links = [];
    const sandbox = {
        URL,
        document: {
            createElement: () => ({
                dataset: {},
                remove() {
                    this.removed = true;
                }
            }),
            head: { append: (link) => links.push(link) }
        }
    };
    const source = stripTypeScriptTypes(
        fs.readFileSync('frontend/shell/styles.ts', 'utf8')
    ).replace(/export /g, '');
    vm.runInNewContext(source + '\nthis.load = loadStylesheet;', sandbox);
    return {
        links,
        load: (version = 'build-a') =>
            sandbox.load('meta.css', version, (path) => `https://site.test/${path}`)
    };
}

test('concurrent navigation waits for the same stylesheet to finish', async () => {
    const { links, load } = setup();
    const first = load();
    const second = load();
    assert.equal(first, second);
    assert.equal(links.length, 1);
    let ready = false;
    second.then(() => {
        ready = true;
    });
    await Promise.resolve();
    assert.equal(ready, false);
    links[0].onload();
    await second;
    assert.equal(ready, true);
});

test('failed stylesheet can be retried and each build has its own cache URL', async () => {
    const { links, load } = setup();
    const failed = load();
    const rejection = assert.rejects(failed, /Falha ao carregar/);
    links[0].onerror();
    await rejection;
    assert.equal(links[0].removed, true);
    const retry = load();
    links[1].onload();
    await retry;
    const nextBuild = load('build-b');
    assert.equal(links[2].href, 'https://site.test/meta.css?v=build-b');
    assert.notEqual(links[1].href, links[2].href);
    links[2].onload();
    await nextBuild;
});
