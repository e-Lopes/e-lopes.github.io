create or replace function public.reconcile_digilab_tournament_results(
    p_tournament_id bigint,
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
    v_result jsonb;
    v_mapping jsonb;
    v_result_id uuid;
    v_locked_tournament_id bigint;
    v_added integer := 0;
    v_updated integer := 0;
begin
    if p_tournament_id is null or p_tournament_id <= 0 then
        raise exception 'ID do torneio DigiStats invalido.' using errcode = '22023';
    end if;
    if p_digilab_tournament_id is null or p_digilab_tournament_id <= 0 then
        raise exception 'ID DigiLab invalido.' using errcode = '22023';
    end if;
    if p_results is null or jsonb_typeof(p_results) <> 'array' then
        raise exception 'Resultados invalidos.' using errcode = '22023';
    end if;
    select id
    into v_locked_tournament_id
    from public.tournament
    where id = p_tournament_id
    for update;
    if v_locked_tournament_id is null then
        raise exception 'Torneio DigiStats nao encontrado.' using errcode = 'P0002';
    end if;

    for v_mapping in
        select item from jsonb_array_elements(p_player_mappings) as source(item)
    loop
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
        if nullif(v_result->>'player_id', '') is null
           or nullif(v_result->>'deck_id', '') is null
           or coalesce((v_result->>'placement')::integer, 0) <= 0 then
            raise exception 'Resultado incompleto para reconciliacao.' using errcode = '22023';
        end if;

        if nullif(btrim(v_result->>'digilab_deck_slug'), '') is not null then
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

        select id
        into v_result_id
        from public.tournament_results
        where tournament_id = p_tournament_id
          and player_id = (v_result->>'player_id')::uuid
        order by created_at
        limit 1
        for update;

        if v_result_id is null then
            insert into public.tournament_results (
                tournament_id,
                store_id,
                tournament_date,
                total_players,
                placement,
                deck_id,
                player_id,
                match_points
            ) values (
                p_tournament_id,
                (p_tournament->>'store_id')::uuid,
                (p_tournament->>'tournament_date')::date,
                (p_tournament->>'total_players')::smallint,
                (v_result->>'placement')::smallint,
                (v_result->>'deck_id')::uuid,
                (v_result->>'player_id')::uuid,
                nullif(v_result->>'match_points', '')::integer
            );
            v_added := v_added + 1;
        else
            update public.tournament_results
            set
                store_id = (p_tournament->>'store_id')::uuid,
                tournament_date = (p_tournament->>'tournament_date')::date,
                total_players = (p_tournament->>'total_players')::smallint,
                placement = (v_result->>'placement')::smallint,
                deck_id = (v_result->>'deck_id')::uuid,
                match_points = nullif(v_result->>'match_points', '')::integer
            where id = v_result_id;
            v_updated := v_updated + 1;
        end if;
        v_result_id := null;
    end loop;

    update public.tournament
    set
        total_players = (p_tournament->>'total_players')::smallint,
        rounds = nullif(p_tournament->>'rounds', '')::smallint
    where id = p_tournament_id;

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
        p_tournament_id,
        p_digilab_tournament_id,
        p_digilab_url,
        'matched',
        timezone('utc', now()),
        timezone('utc', now()),
        null,
        jsonb_build_object(
            'source', 'admin_digilab_reconciliation',
            'results_added', v_added,
            'results_updated', v_updated,
            'positions_replaced', true
        )
    )
    on conflict (tournament_id) do update
    set
        digilab_tournament_id = excluded.digilab_tournament_id,
        digilab_url = excluded.digilab_url,
        status = 'matched',
        verified_at = excluded.verified_at,
        last_checked_at = excluded.last_checked_at,
        last_error_code = null,
        comparison_summary = excluded.comparison_summary;

    return jsonb_build_object(
        'tournament_id', p_tournament_id,
        'digilab_tournament_id', p_digilab_tournament_id,
        'results_count', jsonb_array_length(p_results),
        'results_added', v_added,
        'results_updated', v_updated,
        'positions_replaced', true,
        'reused', true
    );
end;
$$;

revoke all on function public.reconcile_digilab_tournament_results(
    bigint, bigint, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.reconcile_digilab_tournament_results(
    bigint, bigint, text, jsonb, jsonb, jsonb
) to service_role;

comment on function public.reconcile_digilab_tournament_results(
    bigint, bigint, text, jsonb, jsonb, jsonb
) is 'Completa e corrige resultados de um torneio local escolhido usando standings revisados do DigiLab.';
