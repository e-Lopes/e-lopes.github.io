const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('admin visibility follows verified login and resets when the session is cleared', () => {
    const events = [];
    const sandbox = {
        window: { dispatchEvent: (event) => events.push(event) },
        document: { getElementById: () => null },
        sessionStorage: { removeItem() {} },
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        }
    };
    vm.runInNewContext(
        fs.readFileSync('admin/script.js', 'utf8') +
            `
        this.show = setAdminAuthView;
        this.clear = clearAdminSession;
        this.credentials = (session, profile) => { adminAuthSession = session; adminAuthProfile = profile; };`,
        sandbox
    );
    sandbox.show(true);
    assert.equal(sandbox.window.digistatsAdminAuthenticated, false);
    sandbox.credentials(
        { access_token: 'test', user: { id: 'admin' } },
        { user_id: 'another-user' }
    );
    sandbox.show(true);
    assert.equal(sandbox.window.digistatsAdminAuthenticated, false);
    sandbox.credentials({ access_token: 'test', user: { id: 'admin' } }, { user_id: 'admin' });
    sandbox.show(true);
    assert.equal(sandbox.window.digistatsAdminAuthenticated, true);
    assert.equal(events.at(-1).type, 'digistats:admin-auth-changed');
    sandbox.clear();
    assert.equal(sandbox.window.digistatsAdminAuthenticated, false);
    assert.equal(events.at(-1).detail.authenticated, false);
});
