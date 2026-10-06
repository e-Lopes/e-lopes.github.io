begin;

-- Never classify historical events using the current local default format.
create or replace function public.sync_digilab_tournament_atomic(
    p_external_id bigint, p_tournament jsonb, p_standings jsonb,
    p_player_mappings jsonb default '[]', p_deck_mappings jsonb default '[]',
    p_target_id bigint default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_row jsonb; v_results jsonb := '[]'; v_mappings jsonb := '[]'; v_payload jsonb;
    v_saved jsonb; v_existing public.tournament%rowtype;
    v_target bigint; v_linked bigint; v_store uuid; v_format bigint;
    v_player uuid; v_deck uuid; v_ids uuid[]; v_name text; v_slug text;
    v_format_code text; v_players integer := 0; v_decks integer := 0;
    v_result_id uuid; v_old_deck uuid; v_old_points integer;
    v_count integer; v_updated integer := 0; v_added integer := 0;
begin
    if p_external_id is null or p_external_id <= 0 or
       jsonb_typeof(p_standings) is distinct from 'array' or
       jsonb_typeof(p_player_mappings) is distinct from 'array' or
       jsonb_typeof(p_deck_mappings) is distinct from 'array' then
        raise exception 'Dados DigiLab invalidos.' using errcode = '22023';
    end if;
    v_count := jsonb_array_length(p_standings);
    if v_count = 0 or v_count <> (p_tournament->>'player_count')::integer then
        raise exception 'Classificacao incompleta.' using errcode = '22023';
    end if;
    -- Serialize registration across imports, including differently spelled names.
    -- This is a short DB transaction; no external request runs under these locks.
    perform pg_advisory_xact_lock(724092401);
    lock table public.players, public.decks, public.formats in share row exclusive mode;
    select tournament_id into v_linked from public.tournament_digilab_sync
      where digilab_tournament_id = p_external_id and status = 'matched' for update;
    if p_target_id is not null and v_linked is not null and p_target_id <> v_linked then
        raise exception 'DigiLab ja vinculado a outro torneio.' using errcode = '22023';
    end if;
    v_target := coalesce(p_target_id, v_linked);
    select array_agg(id) into v_ids from public.stores
      where public.digilab_normalize(name) = public.digilab_normalize(p_tournament#>>'{store,name}');
    if coalesce(cardinality(v_ids), 0) <> 1 then
        raise exception 'Loja sem correspondente unico.' using errcode = '22023';
    end if;
    v_store := v_ids[1];
    if v_target is not null then
        select * into v_existing from public.tournament where id = v_target for update;
        if not found or v_existing.store_id <> v_store or
           v_existing.tournament_date <> (p_tournament->>'date')::date then
            raise exception 'A sincronizacao exige a mesma data e loja.' using errcode = '22023';
        end if;
        if exists(select 1 from public.tournament_digilab_sync where tournament_id = v_target
                  and digilab_tournament_id is not null and digilab_tournament_id <> p_external_id) then
            raise exception 'Torneio local ja vinculado a outro DigiLab.' using errcode = '22023';
        end if;
    elsif exists(select 1 from public.tournament where store_id = v_store
                 and tournament_date = (p_tournament->>'date')::date) then
        raise exception 'Possivel torneio local na mesma data; revise o vinculo.' using errcode = '22023';
    end if;

    v_format_code := btrim(coalesce(p_tournament->>'format', ''));
    if regexp_replace(upper(v_format_code), '[^A-Z0-9]', '', 'g') <> '' then
        select id into v_format from public.formats
          where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') =
                regexp_replace(upper(v_format_code), '[^A-Z0-9]', '', 'g')
          order by (code = v_format_code) desc, id limit 1;
        if v_format is null then
            insert into public.formats(code, name, is_active, is_default)
              values(v_format_code, v_format_code, true, false) returning id into v_format;
        else
            update public.formats set is_active = true where id = v_format;
        end if;
    else
        raise exception 'Formato DigiLab ausente; revise o torneio em vez de usar o formato padrao.' using errcode = '22023';
    end if;
    if v_format is null then raise exception 'Formato nao resolvido.' using errcode = '22023'; end if;

    for v_row in select value from jsonb_array_elements(p_standings) order by (value->>'placement')::integer loop
        v_player := null; v_deck := null; v_result_id := null; v_old_deck := null; v_old_points := null;
        v_slug := nullif(btrim(v_row#>>'{player,slug}'), '');
        v_name := btrim(coalesce(v_row#>>'{player,name}', ''));
        if v_slug is null or public.digilab_normalize(v_name) = '' then
            raise exception 'Jogador anonimo exige revisao.' using errcode = '22023';
        end if;
        select nullif(value->>'player_id', '')::uuid into v_player
          from jsonb_array_elements(p_player_mappings) where value->>'digilab_player_slug' = v_slug limit 1;
        if v_player is null then
            select player_id into v_player from public.digilab_player_sync where digilab_player_slug = v_slug;
        end if;
        if v_player is null then
            select array_agg(id) into v_ids from public.players where
              public.digilab_normalize(name) = public.digilab_normalize(v_name) or
              public.digilab_normalize(digilab_name) = public.digilab_normalize(v_name);
            if cardinality(v_ids) > 1 then raise exception 'Jogador ambiguo: %', v_name using errcode = '22023'; end if;
            v_player := v_ids[1];
            if v_player is null then
                insert into public.players(name, bandai_nick, digilab_name, bandai_id, is_active)
                  values(v_name, v_name, v_name, null, true) returning id into v_player;
                v_players := v_players + 1;
            end if;
        end if;
        if not exists(select 1 from public.players where id = v_player) then
            raise exception 'Mapeamento de jogador invalido.' using errcode = '22023';
        end if;
        if exists(select 1 from jsonb_array_elements(v_results) where value->>'player_id' = v_player::text) then
            raise exception 'Dois jogadores apontam para a mesma pessoa.' using errcode = '22023';
        end if;
        v_mappings := v_mappings || jsonb_build_array(jsonb_build_object(
            'digilab_player_slug', v_slug, 'digilab_player_name', v_name, 'player_id', v_player));

        v_slug := nullif(btrim(v_row#>>'{deck,slug}'), '');
        v_name := btrim(coalesce(v_row#>>'{deck,name}', ''));
        if v_slug is not null or v_name <> '' then
            if v_slug is null then raise exception 'Deck sem slug.' using errcode = '22023'; end if;
            select nullif(value->>'deck_id', '')::uuid into v_deck
              from jsonb_array_elements(p_deck_mappings) where value->>'digilab_deck_slug' = v_slug limit 1;
            if v_deck is null then
                select deck_id into v_deck from public.digilab_deck_sync where digilab_deck_slug = v_slug;
            end if;
            if v_deck is null then
                if public.digilab_normalize(v_name) = '' then
                    raise exception 'Deck sem nome.' using errcode = '22023';
                end if;
                select array_agg(id) into v_ids from public.decks
                  where public.digilab_normalize(name) = public.digilab_normalize(v_name);
                if cardinality(v_ids) > 1 then raise exception 'Deck ambiguo: %', v_name using errcode = '22023'; end if;
                v_deck := v_ids[1];
                if v_deck is null then
                    insert into public.decks(name, is_active) values(v_name, true) returning id into v_deck;
                    v_decks := v_decks + 1;
                end if;
            end if;
            if not exists(select 1 from public.decks where id = v_deck) then
                raise exception 'Mapeamento de deck invalido.' using errcode = '22023';
            end if;
        end if;
        if v_target is not null then
            select id, deck_id, match_points into v_result_id, v_old_deck, v_old_points
              from public.tournament_results where tournament_id = v_target and player_id = v_player for update;
        end if;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
            'id', v_result_id, 'player_id', v_player, 'deck_id', coalesce(v_deck, v_old_deck),
            'placement', (v_row->>'placement')::integer,
            'digilab_deck_slug', v_slug, 'digilab_deck_name', nullif(v_name, ''),
            'match_points', coalesce((v_row#>>'{record,wins}')::integer * 3 + (v_row#>>'{record,ties}')::integer, v_old_points)));
    end loop;
    if exists(select 1 from jsonb_array_elements(v_results) with ordinality as r(value, pos)
              where (value->>'placement')::integer is distinct from pos::integer) then
        raise exception 'Colocacoes incompletas ou empatadas exigem revisao.' using errcode = '22023';
    end if;
    if v_target is not null and exists(
        select 1 from public.tournament_results r where r.tournament_id = v_target and not exists(
            select 1 from jsonb_array_elements(v_results) where value->>'player_id' = r.player_id::text)) then
        raise exception 'Jogadores locais ausentes no DigiLab; revise antes de remover resultados.' using errcode = '22023';
    end if;
    v_payload := jsonb_build_object('store_id', v_store, 'tournament_date', p_tournament->>'date',
        'tournament_name', coalesce(v_existing.tournament_name, nullif(p_tournament->>'tournament_name', ''), 'Semanal'),
        'total_players', v_count, 'format_id', v_format, 'instagram_link', v_existing.instagram_link,
        'rounds', p_tournament->'rounds');
    if v_target is not null then
        select count(*) into v_added from jsonb_array_elements(v_results) r where nullif(r->>'id', '') is null;
        select count(*) into v_updated from jsonb_array_elements(v_results) r
          join public.tournament_results t on t.id = nullif(r->>'id', '')::uuid
          where t.deck_id is distinct from nullif(r->>'deck_id', '')::uuid
             or t.match_points is distinct from nullif(r->>'match_points', '')::integer
             or t.placement is distinct from (r->>'placement')::integer;
        perform public.save_tournament_transaction(v_target, v_payload, v_results, '[]');
        update public.tournament set rounds = coalesce(nullif(p_tournament->>'rounds', '')::smallint, rounds) where id = v_target;
        insert into public.tournament_digilab_sync(tournament_id, digilab_tournament_id, digilab_url, status, verified_at)
          values(v_target, p_external_id, 'https://digilab.cards/tournament/' || p_external_id, 'matched', now())
          on conflict(tournament_id) do update set
            digilab_tournament_id = excluded.digilab_tournament_id, digilab_url = excluded.digilab_url,
            status = 'matched', verified_at = excluded.verified_at, last_error_code = null;
    end if;
    -- Existing RPC persists the mappings and link in this same transaction.
    v_saved := public.import_digilab_tournament_transaction(p_external_id,
        'https://digilab.cards/tournament/' || p_external_id, v_payload, v_results, v_mappings);
    return v_saved || jsonb_build_object('players_created', v_players, 'decks_created', v_decks,
        'results_updated', v_updated, 'results_added', v_added, 'reused', v_target is not null,
        'tournament_updated', v_target is not null and (
            v_existing.format_id is distinct from v_format or v_existing.total_players is distinct from v_count or
            v_existing.rounds is distinct from coalesce(nullif(p_tournament->>'rounds', '')::smallint, v_existing.rounds)));
end;
$$;

commit;
