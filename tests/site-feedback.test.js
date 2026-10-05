const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function service(response) {
    const calls = [];
    const context = {
        URL,
        AbortController,
        setTimeout,
        clearTimeout,
        location: { href: 'https://site.test/?player=Nome&token=privado#overview' },
        navigator: { userAgent: 'Browser' },
        window: {
            APP_CONFIG: { SUPABASE_URL: 'https://api.test' },
            APP_VERSION: '2026.10.05.3',
            createSupabaseHeaders: () => ({ apikey: 'public' })
        },
        fetch: async (url, options) => {
            calls.push({ url, options });
            return response;
        }
    };
    const source = stripTypeScriptTypes(
        fs.readFileSync('frontend/shell/feedback-service.ts', 'utf8')
    ).replace(/export /g, '');
    vm.runInNewContext(source + '\nthis.send=sendFeedback', context);
    return { send: context.send, calls };
}
const feedback = {
    type: 'bug',
    message: '  Erro ao abrir torneio  ',
    email: '',
    website: '',
    id: 'request',
    openedAt: 10
};
test('feedback uses the existing endpoint and excludes URL query data', async () => {
    const api = service({ ok: true, json: async () => ({ ok: true }) });
    await api.send(feedback);
    assert.equal(api.calls[0].url, 'https://api.test/functions/v1/send-feedback');
    const body = JSON.parse(api.calls[0].options.body);
    assert.equal(body.feedback_type, 'bug');
    assert.equal(body.message, 'Erro ao abrir torneio');
    assert.equal(body.contact_email, null);
    assert.equal(body.page_url, 'https://site.test/#overview');
});
test('feedback surfaces server errors instead of showing false success', async () => {
    const api = service({ ok: false, json: async () => ({ error: 'Envio indisponível' }) });
    await assert.rejects(api.send(feedback), /Envio indisponível/);
});
