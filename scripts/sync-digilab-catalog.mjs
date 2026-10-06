import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('../.tmp/digilab-tools/node_modules/pg');
const connectionString = readFileSync('.env', 'utf8')
    .match(/^SUPABASE_DB_URL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw new Error('SUPABASE_DB_URL ausente.');
const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});
const normalize = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
const codes = { red: 'r', blue: 'u', yellow: 'y', green: 'g', black: 'b', purple: 'p', white: 'w' };
const storageBase = readFileSync('config/supabase.js', 'utf8').match(
    /SUPABASE_URL:\s*'([^']+)'/
)?.[1];
if (!storageBase) throw new Error('Supabase Storage ausente.');
if (process.argv.includes('--apply'))
    throw new Error(
        'Use node scripts/sync-digilab-deck-colors.mjs para sincronizar catálogo e imagens pelo servidor.'
    );
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('.tmp/digilab-colors', { recursive: true });

try {
    await client.connect();
    await client.query('begin');
    await client.query(
        'lock table public.decks,public.deck_images,public.digilab_deck_sync,public.deck_families,public.digilab_deck_catalog in share row exclusive mode'
    );
    const decks = (await client.query('select * from public.decks order by name')).rows;
    const catalog = (await client.query('select * from public.digilab_deck_catalog order by name'))
        .rows;
    const mappings = (await client.query('select * from public.digilab_deck_sync')).rows;
    const images = (await client.query('select * from public.deck_images')).rows;
    const families = (await client.query('select * from public.deck_families')).rows;
    const latest = catalog.reduce(
        (max, row) => (row.last_seen_at.toISOString() > max ? row.last_seen_at.toISOString() : max),
        ''
    );
    const current = catalog.filter((row) => row.last_seen_at.toISOString() === latest);
    if (current.length < 200 || Date.now() - new Date(latest).getTime() > 3600000)
        throw new Error('Atualize o catálogo completo pela API antes de sincronizar.');
    const used = new Set();
    const plan = current.map((remote) => {
        const linked = mappings.find((row) => row.digilab_deck_slug === remote.slug);
        const exact = decks.filter((row) => normalize(row.name) === normalize(remote.name));
        const linkedDeck = linked ? decks.find((row) => row.id === linked.deck_id) : undefined;
        const deck =
            exact.length === 1
                ? exact[0]
                : linkedDeck &&
                    !current.some(
                        (other) =>
                            other.slug !== remote.slug &&
                            normalize(other.name) === normalize(linkedDeck.name)
                    )
                  ? linkedDeck
                  : undefined;
        if (!linked && exact.length > 1) throw new Error(`Correspondência ambígua: ${remote.name}`);
        if (deck && used.has(deck.id))
            throw new Error(`Dois arquétipos usam o mesmo ID local: ${remote.name}`);
        if (deck) used.add(deck.id);
        const primary = remote.primary_color;
        const secondary = remote.secondary_color;
        const colors = [primary, secondary].filter(Boolean).map((value) => codes[normalize(value)]);
        if (colors.some((color) => !color))
            throw new Error(`Cor desconhecida no catálogo: ${remote.name}`);
        if (remote.display_card_id && !/^[A-Z0-9]+-\d+$/.test(remote.display_card_id))
            throw new Error(`Carta inválida: ${remote.name}`);
        return {
            id: deck?.id || null,
            before: deck || null,
            remote,
            colors: [...new Set(colors)].join(','),
            image: remote.display_card_id
                ? `${storageBase}/storage/v1/object/public/deck-images/digilab/${remote.display_card_id}.jpg`
                : null
        };
    });
    const archived = decks.filter((row) => !used.has(row.id));
    const summary = {
        source: 'DigiLab API',
        source_updated_at: latest,
        archetypes: current.length,
        existing: plan.filter((row) => row.id).length,
        create: plan.filter((row) => !row.id).length,
        rename: plan
            .filter((row) => row.before && row.before.name !== row.remote.name)
            .map((row) => ({ before: row.before.name, after: row.remote.name })),
        historical: archived.map((row) => ({ id: row.id, name: row.name })),
        families: new Set(current.map((row) => row.family_slug).filter(Boolean)).size
    };
    writeFileSync(
        '.tmp/digilab-colors/catalog-preview.json',
        JSON.stringify({ summary, plan }, null, 2)
    );
    if (process.argv.includes('--verify')) {
        for (const row of plan) {
            const deck = row.before;
            const family = families.find((family) => family.id === deck?.family_id);
            if (
                !deck ||
                !deck.is_active ||
                deck.name !== row.remote.name ||
                deck.slug !== row.remote.slug ||
                deck.colors !== row.colors ||
                deck.primary_color !== row.remote.primary_color ||
                deck.secondary_color !== row.remote.secondary_color ||
                deck.display_card_id !== row.remote.display_card_id ||
                (family?.slug || null) !== row.remote.family_slug
            )
                throw new Error(`Divergência no catálogo: ${row.remote.name}`);
            if (
                row.image &&
                !images.some(
                    (image) =>
                        image.deck_id === row.id &&
                        ['jpg', 'webp', 'png'].some(
                            (extension) =>
                                image.image_url ===
                                `${storageBase}/storage/v1/object/public/deck-images/digilab/${row.remote.display_card_id}.${extension}`
                        )
                )
            )
                throw new Error(`Imagem divergente: ${row.remote.name}`);
            if (
                !mappings.some(
                    (mapping) =>
                        mapping.digilab_deck_slug === row.remote.slug && mapping.deck_id === row.id
                )
            )
                throw new Error(`Vínculo divergente: ${row.remote.name}`);
        }
        if (archived.some((deck) => deck.is_active))
            throw new Error('Cadastros históricos ativos.');
        await client.query('rollback');
        const publicConfig = readFileSync('config/supabase.js', 'utf8');
        const url = publicConfig.match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
        const key = publicConfig.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)?.[1];
        const glowing = plan.find((row) => row.remote.slug === 'glowing-dawn');
        const query = new URLSearchParams({
            select: 'id,tournament_id,deck_id,player_id,placement,deck:decks(*,deck_images(image_url)),player:players(name),decklists(id)',
            deck_id: `eq.${glowing.id}`,
            limit: '1'
        });
        const response = await fetch(`${url}/rest/v1/tournament_results?${query}`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`Consulta pública do Metagame: HTTP ${response.status}`);
        const result = (await response.json())[0];
        if (result?.deck?.colors !== 'g,b' || !result.deck.deck_images?.length)
            throw new Error('Metadados do Glowing Dawn indisponíveis na consulta pública.');
        console.log(
            JSON.stringify({
                verified: true,
                active: plan.length,
                historical: archived.length,
                glowingDawn: {
                    colors: result.deck.colors,
                    card: result.deck.display_card_id,
                    images: result.deck.deck_images.length
                },
                publicMetagameRead: true
            })
        );
    } else if (!process.argv.includes('--apply')) {
        await client.query('rollback');
        console.log(JSON.stringify(summary, null, 2));
    } else {
        mkdirSync('backup/decks', { recursive: true });
        const backup = `backup/decks/digilab-catalog-${stamp}.json`;
        writeFileSync(
            backup,
            JSON.stringify(
                { saved_at: new Date().toISOString(), decks, images, mappings, families, catalog },
                null,
                2
            )
        );
        await client.query('update public.decks set slug=null where id=any($1::uuid[])', [
            plan.filter((row) => row.id).map((row) => row.id)
        ]);
        for (const row of plan) {
            let familyId = null;
            if (row.remote.family_slug) {
                familyId = (
                    await client.query(
                        'insert into public.deck_families(name,slug,is_active) values($1,$2,true) on conflict(slug) do update set name=excluded.name,is_active=true returning id',
                        [row.remote.family_name, row.remote.family_slug]
                    )
                ).rows[0].id;
            }
            const values = [
                row.remote.name,
                row.remote.slug,
                row.colors,
                row.remote.primary_color,
                row.remote.secondary_color,
                row.remote.display_card_id,
                familyId
            ];
            if (row.id)
                await client.query(
                    'update public.decks set name=$1,slug=$2,colors=$3,primary_color=$4,secondary_color=$5,display_card_id=$6,family_id=$7,is_active=true where id=$8',
                    [...values, row.id]
                );
            else
                row.id = (
                    await client.query(
                        'insert into public.decks(name,slug,colors,primary_color,secondary_color,display_card_id,family_id,is_active) values($1,$2,$3,$4,$5,$6,$7,true) returning id',
                        values
                    )
                ).rows[0].id;
            await client.query(
                'insert into public.digilab_deck_sync(digilab_deck_slug,digilab_deck_name,deck_id) values($1,$2,$3) on conflict(digilab_deck_slug) do update set digilab_deck_name=excluded.digilab_deck_name,deck_id=excluded.deck_id,updated_at=now()',
                [row.remote.slug, row.remote.name, row.id]
            );
            if (row.image) {
                const updated = await client.query(
                    'update public.deck_images set image_url=$1 where deck_id=$2',
                    [row.image, row.id]
                );
                if (!updated.rowCount)
                    await client.query(
                        'insert into public.deck_images(deck_id,image_url) values($1,$2)',
                        [row.id, row.image]
                    );
            }
        }
        if (archived.length)
            await client.query('update public.decks set is_active=false where id=any($1::uuid[])', [
                archived.map((row) => row.id)
            ]);
        await client.query(
            'update public.digilab_deck_catalog set is_active=(last_seen_at=$1::timestamptz)',
            [latest]
        );
        const active = (await client.query('select * from public.decks where is_active=true')).rows;
        if (active.length !== current.length)
            throw new Error('Quantidade de arquétipos ativos divergente.');
        for (const row of plan) {
            const deck = active.find((deck) => deck.id === row.id);
            if (
                !deck ||
                deck.name !== row.remote.name ||
                deck.slug !== row.remote.slug ||
                deck.colors !== row.colors ||
                deck.primary_color !== row.remote.primary_color ||
                deck.secondary_color !== row.remote.secondary_color ||
                deck.display_card_id !== row.remote.display_card_id
            )
                throw new Error(`Verificação falhou: ${row.remote.name}`);
        }
        await client.query('commit');
        const report = {
            ...summary,
            verified: true,
            backup,
            applied_at: new Date().toISOString(),
            ids_preserved: summary.existing
        };
        writeFileSync(
            'backup/decks/digilab-catalog-latest-report.json',
            JSON.stringify(report, null, 2)
        );
        console.log(JSON.stringify(report, null, 2));
    }
} catch (error) {
    await client.query('rollback').catch(() => {});
    console.error(String(error.message).replaceAll(connectionString, '[redacted]'));
    process.exitCode = 1;
} finally {
    await client.end();
}
