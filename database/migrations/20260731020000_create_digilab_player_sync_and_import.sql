begin;

create table if not exists public.digilab_player_sync (
    digilab_player_slug text primary key,
    digilab_player_name text null,
    player_id uuid not null references public.players(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint digilab_player_sync_slug_not_blank
        check (btrim(digilab_player_slug) <> '')
);

create index if not exists idx_digilab_player_sync_player_id
    on public.digilab_player_sync (player_id);

alter table public.digilab_player_sync enable row level security;
revoke all on table public.digilab_player_sync from anon, authenticated;
grant all on table public.digilab_player_sync to service_role;

comment on table public.digilab_player_sync is
    'Mapeamento persistente entre o slug público do jogador no DigiLab e players.id no DigiStats.';

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
begin
    if p_digilab_tournament_id is null or p_digilab_tournament_id <= 0 then
        raise exception 'ID DigiLab invalido.' using errcode = '22023';
    end if;

    select tournament_id
    into v_existing_tournament_id
    from public.tournament_digilab_sync
    where digilab_tournament_id = p_digilab_tournament_id
      and status = 'matched'
    limit 1;

    if v_existing_tournament_id is not null then
        return jsonb_build_object(
            'tournament_id', v_existing_tournament_id,
            'digilab_tournament_id', p_digilab_tournament_id,
            'reused', true
        );
    end if;

    if p_player_mappings is null or jsonb_typeof(p_player_mappings) <> 'array' then
        raise exception 'Mapeamentos de jogadores invalidos.' using errcode = '22023';
    end if;

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
