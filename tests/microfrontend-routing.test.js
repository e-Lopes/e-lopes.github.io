const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function routing() {
    const events = new Map();
    const sandbox = {
        location: new URL('https://example.test/subdir/demo-v2/?format=EX12#meta'),
        URL,
        URLSearchParams,
        Event,
        history: {
            pushState(_state, _title, url) {
                sandbox.location = new URL(url);
            }
        },
        window: {
            addEventListener(name, callback) {
                events.set(name, callback);
            },
            removeEventListener(name) {
                events.delete(name);
            },
            dispatchEvent(event) {
                events.get(event.type)?.();
            },
            scrollTo() {}
        }
    };
    const source = stripTypeScriptTypes(
        fs.readFileSync('frontend/shell/routes.ts', 'utf8')
    ).replace(/export /g, '');
    vm.runInNewContext(
        source + '\nthis.routes = {readRoute,href,navigate,subscribeRoute};',
        sandbox
    );
    return sandbox;
}

test('micro-frontend navigation preserves the hosting subpath and transfers format to another area', () => {
    const app = routing();
    assert.equal(app.routes.readRoute().name, 'meta');
    let updates = 0;
    const dispose = app.routes.subscribeRoute(() => updates++);
    app.routes.navigate('tournaments', { format: 'EX12', store: '5' });
    assert.equal(app.location.pathname, '/subdir/demo-v2/');
    assert.equal(app.location.hash, '#tournaments');
    assert.equal(app.routes.readRoute().params.get('format'), 'EX12');
    assert.equal(updates, 1);
    dispose();
    app.routes.navigate('overview');
    assert.equal(updates, 1);
    assert.equal(app.location.search, '');
});

test('builder links preserve result identity and unsupported routes fall back to the overview', () => {
    const app = routing();
    const link = new URL(
        app.routes.href('builder', {
            resultId: '42',
            player: 'Álex & Renan',
            returnTournamentId: '9'
        })
    );
    assert.equal(link.searchParams.get('resultId'), '42');
    assert.equal(link.searchParams.get('player'), 'Álex & Renan');
    assert.equal(link.searchParams.get('returnTournamentId'), '9');
    app.location = new URL('https://example.test/subdir/demo-v2/#unknown');
    assert.equal(app.routes.readRoute().name, 'overview');
});
