const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextEncoder } = require('node:util');

function makeSession(fetch) {
    const storage = new Map();
    const sandbox = {
        fetch,
        crypto: webcrypto,
        TextEncoder,
        URLSearchParams,
        window: {
            APP_CONFIG: { SUPABASE_URL: 'https://example.com', SUPABASE_ANON_KEY: 'public-key' },
            createSupabaseHeaders: (extra) => ({ apikey: 'public-key', ...extra })
        },
        sessionStorage: {
            getItem: (key) => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key)
        }
    };
    vm.runInNewContext(
        fs.readFileSync('shared/data/admin-session.js', 'utf8') + '\nthis.api = adminSession;',
        sandbox
    );
    return sandbox.api;
}
function authorized(api) {
    api.session = {
        user: { id: 'admin' },
        access_token: 'access',
        refresh_token: 'refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
    };
}

test('V2 store save never sends a write when membership is rejected', async () => {
    const calls = [];
    const api = makeSession(async (url, options) => {
        calls.push({ url, options });
        return { ok: false, json: async () => [] };
    });
    authorized(api);
    await assert.rejects(api.saveStore('store', 'New name'), /não autorizado/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, undefined);
    assert.match(calls[0].url, /admin_users/);
});

test('V2 store save verifies membership then writes with the user token', async () => {
    const calls = [];
    const api = makeSession(async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            json: async () =>
                url.includes('admin_users')
                    ? [{ user_id: 'admin' }]
                    : [{ id: 'store', name: 'New name' }]
        };
    });
    authorized(api);
    const store = await api.saveStore('store', '  New name  ');
    assert.equal(store.name, 'New name');
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer access');
    assert.equal(calls[1].options.headers.Prefer, 'return=representation');
    assert.equal(JSON.parse(calls[1].options.body).name, 'New name');
});

test('V2 store save rejects an empty RLS response and requires a session', async () => {
    const api = makeSession(async (url) => ({
        ok: true,
        json: async () => (url.includes('admin_users') ? [{ user_id: 'admin' }] : [])
    }));
    await assert.rejects(api.saveStore('store', 'New name'), /Entre para continuar/);
    authorized(api);
    await assert.rejects(api.saveStore('store', 'New name'), /permissão administrativa/);
});

test('V2 rejects another user membership and clears an earlier privileged profile', async () => {
    const api = makeSession(async () => ({
        ok: true,
        json: async () => [{ user_id: 'another-user' }]
    }));
    authorized(api);
    api.profile = { user_id: 'admin' };
    await assert.rejects(api.verify(), /não autorizado/);
    assert.equal(api.profile, null);
    assert.equal(api.session, null);
});
