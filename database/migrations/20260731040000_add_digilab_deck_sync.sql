begin;

create table if not exists public.digilab_deck_sync (
    digilab_deck_slug text primary key,
    digilab_deck_name text,
    deck_id uuid not null references public.decks(id) on update cascade on delete restrict,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint digilab_deck_sync_slug_not_blank
        check (btrim(digilab_deck_slug) <> '')
);

comment on table public.digilab_deck_sync is
    'Mapeamento persistente entre o slug de deck do DigiLab e decks.id no DigiStats.';

alter table public.digilab_deck_sync enable row level security;
revoke all on table public.digilab_deck_sync from public, anon, authenticated;
grant select, insert, update, delete on table public.digilab_deck_sync to service_role;

create or replace function public.import_digilab_tournament_transaction(
    p_digilab_tournament_id bigint,
    p_digilab_url text,
    p_tournament jsonb,
    p_results jsonb,
    p_player_mappings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_existing_tournament_id bigint;
    v_saved jsonb;
    v_tournament_id bigint;
    v_mapping jsonb;
    v_result jsonb;
    v_updated_results integer := 0;
    v_rows_updated integer := 0;
begin
    if p_digilab_tournament_id is null or p_digilab_tournament_id <= 0 then
        raise exception 'ID DigiLab invalido.' using errcode = '22023';
    end if;

    if p_results is null or jsonb_typeof(p_results) <> 'array' then
        raise exception 'Resultados invalidos.' using errcode = '22023';
    end if;

    if p_player_mappings is null or jsonb_typeof(p_player_mappings) <> 'array' then
        raise exception 'Mapeamentos de jogadores invalidos.' using errcode = '22023';
    end if;

    select tournament_id
    into v_existing_tournament_id
    from public.tournament_digilab_sync
    where digilab_tournament_id = p_digilab_tournament_id
      and status = 'matched'
    limit 1
    for update;

    for v_mapping in
        select item from jsonb_array_elements(p_player_mappings) as source(item)
    loop
        if nullif(btrim(v_mapping->>'digilab_player_slug'), '') is null
           or nullif(v_mapping->>'player_id', '') is null then
            raise exception 'Mapeamento de jogador incompleto.' using errcode = '22023';
        end if;

        insert into public.digilab_player_sync (
            digilab_player_slug,
            digilab_player_name,
            player_id,
            updated_at
        ) values (
            btrim(v_mapping->>'digilab_player_slug'),
            nullif(btrim(v_mapping->>'digilab_player_name'), ''),
            (v_mapping->>'player_id')::uuid,
            timezone('utc', now())
        )
        on conflict (digilab_player_slug) do update
        set
            digilab_player_name = excluded.digilab_player_name,
            player_id = excluded.player_id,
            updated_at = timezone('utc', now());
    end loop;

    for v_result in
        select item from jsonb_array_elements(p_results) as source(item)
    loop
        if nullif(btrim(v_result->>'digilab_deck_slug'), '') is not null
           and nullif(v_result->>'deck_id', '') is not null then
            insert into public.digilab_deck_sync (
                digilab_deck_slug,
                digilab_deck_name,
                deck_id,
                updated_at
            ) values (
                btrim(v_result->>'digilab_deck_slug'),
                nullif(btrim(v_result->>'digilab_deck_name'), ''),
                (v_result->>'deck_id')::uuid,
                timezone('utc', now())
            )
            on conflict (digilab_deck_slug) do update
            set
                digilab_deck_name = excluded.digilab_deck_name,
                deck_id = excluded.deck_id,
                updated_at = timezone('utc', now());
        end if;
    end loop;

    if v_existing_tournament_id is not null then
        for v_result in
            select item from jsonb_array_elements(p_results) as source(item)
        loop
            update public.tournament_results
            set
                deck_id = coalesce(nullif(v_result->>'deck_id', '')::uuid, deck_id),
                match_points = coalesce(
                    nullif(v_result->>'match_points', '')::integer,
                    match_points
                )
            where tournament_id = v_existing_tournament_id
              and player_id = (v_result->>'player_id')::uuid;
            get diagnostics v_rows_updated = row_count;
            v_updated_results := v_updated_results + v_rows_updated;
        end loop;

        update public.tournament_digilab_sync
        set
            last_checked_at = timezone('utc', now()),
            comparison_summary = coalesce(comparison_summary, '{}'::jsonb) ||
                jsonb_build_object(
                    'source', 'digilab_reverse_sync',
                    'results_updated', v_updated_results
                )
        where tournament_id = v_existing_tournament_id;

        return jsonb_build_object(
            'tournament_id', v_existing_tournament_id,
            'digilab_tournament_id', p_digilab_tournament_id,
            'results_count', jsonb_array_length(p_results),
            'results_updated', v_updated_results,
            'reused', true
        );
    end if;

    v_saved := public.save_tournament_transaction(
        null,
        p_tournament,
        p_results,
        '[]'::jsonb
    );
    v_tournament_id := (v_saved->>'tournament_id')::bigint;

    update public.tournament
    set rounds = nullif(p_tournament->>'rounds', '')::smallint
    where id = v_tournament_id;

    insert into public.tournament_digilab_sync (
        tournament_id,
        digilab_tournament_id,
        digilab_url,
        status,
        verified_at,
        last_checked_at,
        last_error_code,
        comparison_summary
    ) values (
        v_tournament_id,
        p_digilab_tournament_id,
        p_digilab_url,
        'matched',
        timezone('utc', now()),
        timezone('utc', now()),
        null,
        jsonb_build_object(
            'source', 'digilab_reverse_import',
            'results_count', jsonb_array_length(p_results)
        )
    );

    return jsonb_build_object(
        'tournament_id', v_tournament_id,
        'digilab_tournament_id', p_digilab_tournament_id,
        'results_count', jsonb_array_length(p_results),
        'reused', false
    );
end;
$$;

revoke all on function public.import_digilab_tournament_transaction(
    bigint, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.import_digilab_tournament_transaction(
    bigint, text, jsonb, jsonb, jsonb
) to service_role;

commit;
