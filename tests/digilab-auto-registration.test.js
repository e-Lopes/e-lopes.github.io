const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
let db;
const read = (name) => readFileSync(`database/migrations/${name}.sql`, 'utf8');
before(async () => {
    db = new PGlite();
    await db.exec(`set timezone = 'UTC'; create role anon; create role authenticated; create role service_role;
        create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;`);
    await db.exec(readFileSync('database/schema.sql', 'utf8'));
    await db.exec(`create table formats(id bigint generated always as identity primary key, code text unique, name text,
        is_active boolean default true, is_default boolean default false);
        alter table tournament add column format_id bigint references formats(id), add column rounds smallint;
        alter table tournament_results add column match_points integer;
        create table tournament_ocr_files(tournament_id bigint, batch_id uuid, storage_path text, original_name text, mime_type text, size_bytes bigint);
        insert into stores(name) values ('Test Store');`);
    await db.exec(read('20260725200000_transactional_tournament_save'));
    await db.exec(read('20260731000000_create_tournament_digilab_sync'));
    // Only the mapping table from this historical migration; newer import RPC below supersedes its function.
    const playerMigration = read('20260731020000_create_digilab_player_sync_and_import');
    await db.exec(
        playerMigration.slice(0, playerMigration.indexOf('create or replace function')) +
            '\ncommit;'
    );
    await db.exec(read('20260731040000_add_digilab_deck_sync'));
    const queue = read('20260803010000_background_digilab_import');
    await db.exec(
        queue.slice(queue.indexOf('create table'), queue.indexOf('select cron.unschedule'))
    );
    await db.exec(read('20260924010000_reliable_digilab_sync'));
});
after(async () => {
    if (db) await db.close();
});
const standing = (name, placement, deck = 'Rosemon') => ({
    player: { name, slug: name.toLowerCase() },
    deck: { name: deck, slug: deck.toLowerCase() },
    placement,
    record: { wins: 1, ties: 0 }
});
async function sync(id, rows, date = '2026-09-24', overrides = {}) {
    const tournament = {
        player_count: rows.length,
        store: { name: 'Test Store' },
        date,
        format: 'BT-99',
        tournament_name: 'Semanal',
        ...overrides
    };
    const result = await db.query('select sync_digilab_tournament_atomic($1,$2,$3) as result', [
        id,
        tournament,
        rows
    ]);
    return result.rows[0].result;
}

test('atomic import creates players, one shared deck and format; rerun reuses everything', async () => {
    const rows = [standing('Ana', 1), standing('Bruno', 2)];
    const first = await sync(1, rows);
    assert.equal(first.players_created, 2);
    assert.equal(first.decks_created, 1);
    const second = await sync(1, rows);
    assert.equal(second.tournament_id, first.tournament_id);
    assert.equal(second.players_created, 0);
    assert.equal(second.decks_created, 0);
    assert.equal(second.results_updated, 0);
    assert.equal((await db.query('select count(*)::int as n from formats')).rows[0].n, 1);
});

test('linked sync corrects placement, points and deck while preserving result IDs and decklists', async () => {
    await db.exec(
        "update tournament_results set decklist = 'KEEP-ME' where player_id = (select id from players where name = 'Ana')"
    );
    const previous = (
        await db.query(
            "select id from tournament_results where player_id = (select id from players where name = 'Ana')"
        )
    ).rows[0].id;
    const rows = [
        standing('Bruno', 1),
        { ...standing('Ana', 2, 'Medusamon'), record: { wins: 0, ties: 1 } }
    ];
    const saved = await sync(1, rows);
    assert.equal(saved.results_updated, 2);
    const result = (
        await db.query(
            'select placement, match_points, decklist from tournament_results where id = $1',
            [previous]
        )
    ).rows[0];
    assert.deepEqual(result, { placement: 2, match_points: 1, decklist: 'KEEP-ME' });
});

test('late validation failure rolls back players, decks and format together', async () => {
    await assert.rejects(
        sync(
            2,
            [standing('New A', 1, 'Rollback deck'), standing('New B', 1, 'Rollback deck')],
            '2026-09-23',
            { format: 'ROLLBACK' }
        ),
        /Colocacoes/
    );
    assert.equal(
        (await db.query("select count(*)::int as n from players where name like 'New %'")).rows[0]
            .n,
        0
    );
    assert.equal(
        (await db.query("select count(*)::int as n from decks where name = 'Rollback deck'"))
            .rows[0].n,
        0
    );
    assert.equal(
        (await db.query("select count(*)::int as n from formats where code = 'ROLLBACK'")).rows[0]
            .n,
        0
    );
});

test('normalized names reuse registrations and missing local players require review', async () => {
    const saved = await sync(3, [standing('ANA', 1, 'ROSEMON')], '2026-09-22');
    assert.equal(saved.players_created, 0);
    assert.equal(saved.decks_created, 0);
    await assert.rejects(sync(1, [standing('Ana', 1)]), /Jogadores locais ausentes/);
});

test('ambiguous names are never merged automatically', async () => {
    await db.exec(
        "insert into players(name,digilab_name) values ('Same Name','Same Name'), ('Same-Name','Same-Name')"
    );
    await assert.rejects(sync(4, [standing('same name', 1)], '2026-09-21'), /ambiguo/);
});

test('run reservation, queue claims, expiry recovery and item history are atomic', async () => {
    const first = (await db.query("select start_digilab_sync_run('scheduled') as run")).rows[0].run;
    const second = (await db.query("select start_digilab_sync_run('admin') as run")).rows[0].run;
    assert.equal(second.busy, true);
    await db.exec('insert into digilab_background_imports(digilab_tournament_id) values(100)');
    const claim = (await db.query('select * from claim_digilab_sync_item($1)', [first.run_id]))
        .rows;
    assert.equal(claim.length, 1);
    assert.equal(
        (await db.query('select * from claim_digilab_sync_item($1)', [first.run_id])).rows.length,
        0
    );
    await db.query(
        "select finish_digilab_sync_item($1,100,'needs_review',$2,now()+interval '6 hours')",
        [first.run_id, { error: 'Review me' }]
    );
    assert.equal(
        (await db.query('select count(*)::int as n from digilab_sync_events')).rows[0].n,
        1
    );
    await assert.rejects(
        db.query("select finish_digilab_sync_item($1,100,'retry','{}',now())", [first.run_id]),
        /expirada/
    );
    await db.exec("update digilab_sync_state set lease_until = now()-interval '1 second'");
    const next = (await db.query("select start_digilab_sync_run('admin') as run")).rows[0].run;
    assert.equal(next.busy, false);
    assert.equal(
        (await db.query('select status from digilab_sync_runs where id=$1', [first.run_id])).rows[0]
            .status,
        'interrupted'
    );
    await db.query("select finish_digilab_sync_run($1,'{}',null)", [next.run_id]);
});

test('migration can be applied again without erasing data', async () => {
    await db.exec(read('20260924010000_reliable_digilab_sync'));
    assert.equal(
        (await db.query('select count(*)::int as n from digilab_sync_events')).rows[0].n,
        1
    );
});

test('expired item claims are recovered and their former owner cannot finish them', async () => {
    const first = (await db.query("select start_digilab_sync_run('scheduled') as run")).rows[0].run;
    await db.exec(
        'insert into digilab_background_imports(digilab_tournament_id, next_attempt_at) values(101, now())'
    );
    await db.query('select * from claim_digilab_sync_item($1,101)', [first.run_id]);
    await db.exec(
        "update digilab_sync_state set lease_until = now()-interval '1 second'; update digilab_background_imports set lease_until = now()-interval '1 second' where digilab_tournament_id=101"
    );
    const next = (await db.query("select start_digilab_sync_run('admin') as run")).rows[0].run;
    const claim = (await db.query('select * from claim_digilab_sync_item($1,101)', [next.run_id]))
        .rows;
    assert.equal(claim[0].claim_run_id, next.run_id);
    await assert.rejects(
        db.query("select finish_digilab_sync_item($1,101,'retry','{}',now())", [first.run_id]),
        /expirada/
    );
    await db.query("select finish_digilab_sync_item($1,101,'retry','{}',now())", [next.run_id]);
    await db.query("select finish_digilab_sync_run($1,'{}',null)", [next.run_id]);
});

test('adding a participant and changing only tournament metadata are reported', async () => {
    const result = await sync(3, [standing('ANA', 1), standing('Extra', 2)], '2026-09-22', {
        rounds: 4,
        format: 'BT-100'
    });
    assert.equal(result.results_added, 1);
    assert.equal(result.tournament_updated, true);
    assert.equal(result.players_created, 1);
    const metadata = await sync(3, [standing('ANA', 1), standing('Extra', 2)], '2026-09-22', {
        rounds: 5,
        format: 'BT-100'
    });
    assert.equal(metadata.results_updated, 0);
    assert.equal(metadata.tournament_updated, true);
});

test('database functions and history are inaccessible to anonymous callers', async () => {
    await db.exec('set role anon');
    try {
        await assert.rejects(db.query('select * from digilab_sync_runs'), /permission denied/);
        await assert.rejects(
            db.query("select start_digilab_sync_run('admin')"),
            /permission denied/
        );
        await assert.rejects(
            db.query("select sync_digilab_tournament_atomic(10,'{}','[]')"),
            /permission denied/
        );
    } finally {
        await db.exec('reset role');
    }
});
