const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('portrait settings resolve card codes and update CSS and canvas with the same crop', async () => {
    const window = {
        APP_CONFIG: { SUPABASE_URL: 'https://storage.test' },
        createSupabaseHeaders: () => ({}),
        dispatchEvent() {}
    };
    const sandbox = {
        window,
        Event: class {},
        fetch: async () => ({
            ok: true,
            json: async () => [
                { card_code: 'BT24-101', center_x: 220 / 430, offset_y: 0.05, zoom: 3 }
            ]
        })
    };
    vm.runInNewContext(fs.readFileSync('shared/data/card-portraits.js', 'utf8'), sandbox);
    const api = window.cardPortraits;
    await api.load();
    const src = 'https://storage.test/deck-images/digilab/bt24-101.jpg?v=2';
    assert.equal(api.get(src).center_x, 220 / 430);
    assert.equal(api.get('BT24-1010.jpg').center_x, 0.5);
    assert.equal(api.get('EX13-001.jpg').zoom, 2.3);
    assert.match(api.style(api.get(src)).transform, /^scale\(3\) translate\(-1\.162790/);
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
    const paint = vm.runInNewContext(
        fs.readFileSync('shared/posts/renderer.js', 'utf8').replace(/export /g, '') +
            '\npaintPortrait',
        { window }
    );
    paint(ctx, { src, width: 430, height: 601 }, 540, 665, 185, 'gold', 'JU');
    const [, left, top, width, height] = draw;
    assert.ok(Math.abs((540 - left) / width - 220 / 430) < 1e-12);
    assert.equal(width, 370 * 3);
    assert.ok(Math.abs(top - (665 - 185 - ((601 * 370) / 430) * 0.2 * 2 - height * 0.05)) < 1e-10);
});

test('portrait migration preserves saved crops and restricts writes to allowlisted admins', async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite();
    try {
        await db.exec(`create role anon; create role authenticated; create role service_role;
            create schema auth;
            create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
            grant usage on schema auth to authenticated;
            create table public.admin_users(user_id uuid primary key);
            grant select on public.admin_users to authenticated;
            insert into admin_users values ('00000000-0000-0000-0000-000000000001');
            create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end;$$;`);
        const migration = fs.readFileSync(
            'database/migrations/20261006020000_card_portrait_settings.sql',
            'utf8'
        );
        await db.exec(migration);
        assert.ok(
            Math.abs(
                (
                    await db.query(
                        "select center_x from card_portrait_settings where card_code='BT24-101'"
                    )
                ).rows[0].center_x -
                    220 / 430
            ) < 1e-12
        );
        await db.exec('set role anon');
        assert.equal((await db.query('select * from card_portrait_settings')).rows.length, 1);
        await assert.rejects(db.exec('update card_portrait_settings set zoom=3'));
        await db.exec(
            "reset role; set role authenticated; set test.actor='00000000-0000-0000-0000-000000000002'"
        );
        await assert.rejects(
            db.exec("insert into card_portrait_settings(card_code) values ('EX13-001')")
        );
        assert.equal(
            (await db.query('update card_portrait_settings set zoom=3 returning *')).rows.length,
            0
        );
        await db.exec("set test.actor='00000000-0000-0000-0000-000000000001'");
        await db.exec("update card_portrait_settings set zoom=3 where card_code='BT24-101'");
        await db.exec(
            "insert into card_portrait_settings(card_code,center_x) values ('EX13-001',0.6)"
        );
        await assert.rejects(db.exec('update card_portrait_settings set zoom=0'));
        await db.exec('reset role');
        await db.exec(migration);
        assert.equal(
            (await db.query("select zoom from card_portrait_settings where card_code='BT24-101'"))
                .rows[0].zoom,
            3
        );
    } finally {
        await db.close();
    }
});
