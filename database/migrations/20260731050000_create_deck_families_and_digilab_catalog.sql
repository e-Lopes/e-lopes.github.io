begin;

create table if not exists public.deck_families (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint deck_families_name_not_blank check (btrim(name) <> ''),
    constraint deck_families_slug_not_blank check (btrim(slug) <> ''),
    constraint deck_families_name_unique unique (name),
    constraint deck_families_slug_unique unique (slug)
);

create unique index if not exists deck_families_name_key
    on public.deck_families (lower(btrim(name)));
create unique index if not exists deck_families_slug_key
    on public.deck_families (lower(btrim(slug)));

alter table public.decks
    add column if not exists family_id uuid references public.deck_families(id)
        on update cascade on delete set null,
    add column if not exists slug text,
    add column if not exists primary_color text,
    add column if not exists secondary_color text,
    add column if not exists display_card_id text,
    add column if not exists is_active boolean not null default true;

create unique index if not exists decks_slug_key
    on public.decks (lower(btrim(slug)))
    where slug is not null and btrim(slug) <> '';
create index if not exists idx_decks_family_id on public.decks (family_id);

create table if not exists public.digilab_deck_catalog (
    digilab_archetype_id bigint primary key,
    slug text not null,
    name text not null,
    family_slug text,
    family_name text,
    primary_color text,
    secondary_color text,
    display_card_id text,
    total_entries integer,
    firsts integer,
    pilots integer,
    is_active boolean not null default true,
    first_seen_at timestamptz not null default timezone('utc', now()),
    last_seen_at timestamptz not null default timezone('utc', now()),
    raw_payload jsonb not null default '{}'::jsonb,
    constraint digilab_deck_catalog_slug_not_blank check (btrim(slug) <> ''),
    constraint digilab_deck_catalog_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists digilab_deck_catalog_slug_key
    on public.digilab_deck_catalog (lower(btrim(slug)));
create index if not exists idx_digilab_deck_catalog_family_slug
    on public.digilab_deck_catalog (family_slug);

create table if not exists public.digilab_deck_sync (
    digilab_deck_slug text primary key,
    digilab_deck_name text,
    deck_id uuid not null references public.decks(id) on update cascade on delete restrict,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint digilab_deck_sync_slug_not_blank check (btrim(digilab_deck_slug) <> '')
);

alter table public.digilab_deck_sync
    add column if not exists digilab_archetype_id bigint
        references public.digilab_deck_catalog(digilab_archetype_id)
        on update cascade on delete set null;

create unique index if not exists digilab_deck_sync_archetype_key
    on public.digilab_deck_sync (digilab_archetype_id)
    where digilab_archetype_id is not null;

alter table public.deck_families enable row level security;
alter table public.digilab_deck_catalog enable row level security;
alter table public.digilab_deck_sync enable row level security;

revoke all on table public.deck_families from public, anon, authenticated;
grant select on table public.deck_families to anon, authenticated;
grant select, insert, update, delete on table public.deck_families to service_role;

revoke all on table public.digilab_deck_catalog from public, anon, authenticated;
grant select, insert, update, delete on table public.digilab_deck_catalog to service_role;

revoke all on table public.digilab_deck_sync from public, anon, authenticated;
grant select, insert, update, delete on table public.digilab_deck_sync to service_role;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'deck_families'
          and policyname = 'Public read deck families'
    ) then
        create policy "Public read deck families"
            on public.deck_families for select
            using (true);
    end if;
end;
$$;

comment on table public.deck_families is
    'Famílias canônicas de arquétipos; um deck específico pode pertencer a uma família.';
comment on table public.digilab_deck_catalog is
    'Espelho auditável do catálogo de arquétipos e famílias retornado pelo DigiLab.';
comment on column public.decks.family_id is
    'Família opcional do arquétipo específico armazenado em decks.';

create or replace view public.v_deck_family_stats
with (security_invoker = true)
as
with base as (
    select
        coalesce(df.id, d.id) as family_id,
        coalesce(df.name, d.name) as family_name,
        (df.id is not null) as has_explicit_family,
        d.id as deck_id,
        tr.placement,
        case
            when tr.placement = 1 then 15
            when tr.placement = 2 then 10
            when tr.placement = 3 then 7
            when tr.placement = 4 then 5
            else 0
        end as placement_points
    from public.tournament_results tr
    join public.decks d on d.id = tr.deck_id
    left join public.deck_families df on df.id = d.family_id
)
select
    family_id,
    family_name as family,
    bool_or(has_explicit_family) as has_explicit_family,
    count(distinct deck_id) as archetype_count,
    count(*) as entries,
    sum(case when placement = 1 then 1 else 0 end) as titles,
    sum(case when placement <= 4 then 1 else 0 end) as top4_total,
    round(avg(placement::numeric), 2) as avg_placement,
    min(placement) as best_finish,
    max(placement) as worst_finish,
    sum(placement_points) as ranking_points,
    round(
        100.0 * sum(case when placement = 1 then 1 else 0 end)::numeric /
        nullif(count(*), 0),
        2
    ) as title_rate_percent,
    round(
        100.0 * sum(case when placement <= 4 then 1 else 0 end)::numeric /
        nullif(count(*), 0),
        2
    ) as top4_rate_percent,
    dense_rank() over (
        order by
            sum(placement_points) desc,
            sum(case when placement = 1 then 1 else 0 end) desc,
            count(*) desc
    ) as performance_rank
from base
group by family_id, family_name
order by performance_rank, family;

grant select on public.v_deck_family_stats to anon, authenticated, service_role;

comment on view public.v_deck_family_stats is
    'Estatísticas agregadas por família; decks ainda sem família permanecem como grupos próprios.';

commit;
