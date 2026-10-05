const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('Release migration corrects dates and names, preserves links and uses an explicit timezone', async () => {
    const db = new PGlite();
    const migration = readFileSync(
        'database/migrations/20261005000000_correct_format_release_dates.sql',
        'utf8'
    );
    const expected = {
        BT14: '2023-11-17',
        'RSB2.0': '2024-11-01',
        'RSB2.5': '2025-02-28',
        BT21: '2025-04-25',
        BT22: '2025-07-25',
        EX10: '2025-09-19',
        BT23: '2025-10-24',
        BT24: '2026-01-23',
        EX11: '2026-02-13',
        AD01: '2026-03-27',
        BT25: '2026-05-22',
        EX12: '2026-07-03',
        BT26: '2026-09-04',
        EX13: '2026-10-02'
    };
    try {
        await db.exec(`set timezone = 'Asia/Tokyo';
            create table public.formats (
                id bigint generated always as identity primary key,
                code text unique not null, name text,
                created_at timestamptz not null default now(),
                is_active boolean not null default true,
                is_default boolean not null default false,
                background_path text
            );
            create unique index one_default on formats(is_default) where is_default;
            create table public.tournament (id bigint primary key, format_id bigint references public.formats(id));`);
        for (const code of [...Object.keys(expected), 'CUSTOM']) {
            await db.query(
                `insert into formats(code,name,created_at,is_active,is_default,background_path)
                values ($1,$1,'2026-10-05T18:00:00Z',$2,$3,'keep.webp')`,
                [code, code !== 'BT14', code === 'EX13']
            );
        }
        await db.exec('insert into tournament select id,id from formats');
        const before = (
            await db.query(
                'select id,code,is_active,is_default,background_path from formats order by id'
            )
        ).rows;
        await db.exec(migration);
        const result = (
            await db.query(`select code,
            to_char(created_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') as local_date,
            to_char(created_at at time zone 'UTC','HH24:MI:SS') as utc_time
            from formats where code <> 'CUSTOM'`)
        ).rows;
        assert.equal(result.length, 14);
        for (const row of result) {
            assert.equal(row.local_date, expected[row.code], row.code);
            assert.equal(row.utc_time, '03:00:00', row.code);
        }
        assert.deepEqual(
            (
                await db.query(
                    'select id,code,is_active,is_default,background_path from formats order by id'
                )
            ).rows,
            before
        );
        assert.equal(
            (
                await db.query("select created_at from formats where code='CUSTOM'")
            ).rows[0].created_at.toISOString(),
            '2026-10-05T18:00:00.000Z'
        );
        assert.equal(
            (
                await db.query(
                    'select count(*)::int as total from tournament join formats on formats.id=tournament.format_id'
                )
            ).rows[0].total,
            15
        );
        const first = (await db.query('select * from formats order by id')).rows;
        assert.equal(first.find((row) => row.code === 'EX13').name, 'Chivalrous XIII');
        assert.equal(first.find((row) => row.code === 'BT23').name, "Hackers' Slumber");
        assert.equal(
            first.find((row) => row.code === 'RSB2.0').name,
            'Release Special Booster 2.0'
        );
        assert.equal(
            first.find((row) => row.code === 'RSB2.5').name,
            'Release Special Booster 2.5'
        );
        assert.equal(first.find((row) => row.code === 'CUSTOM').name, 'CUSTOM');
        assert.ok(
            !first.some((row) => row.code === 'EX09'),
            'A missing researched format must not be inserted'
        );
        await db.exec(migration);
        assert.deepEqual((await db.query('select * from formats order by id')).rows, first);
        assert.equal(
            (
                await db.query(
                    'select code from formats where code <> $1 order by created_at desc limit 1',
                    ['CUSTOM']
                )
            ).rows[0].code,
            'EX13'
        );
        await db.exec("insert into formats(code,name) values ('EX09','EX09')");
        await db.exec(migration);
        assert.deepEqual(
            (
                await db.query(`select name,
            to_char(created_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') as release_date
            from formats where code='EX09'`)
            ).rows,
            [{ name: 'Versus Monsters', release_date: '2025-06-26' }]
        );
    } finally {
        await db.close();
    }
});
