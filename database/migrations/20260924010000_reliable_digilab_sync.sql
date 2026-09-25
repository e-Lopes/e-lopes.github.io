begin;

-- Read-only normalization shared by all registrations in the transaction.
create or replace function public.digilab_normalize(p_value text)
returns text language sql immutable parallel safe as $$
    select btrim(regexp_replace(
        regexp_replace(normalize(lower(coalesce(p_value, '')), NFKD), U&'[\0300-\036f]', '', 'g'),
        '[^a-z0-9]+', ' ', 'g'));
$$;

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
        select id into v_format from public.formats where is_active and is_default order by id limit 1;
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
revoke all on function public.sync_digilab_tournament_atomic(bigint,jsonb,jsonb,jsonb,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.sync_digilab_tournament_atomic(bigint,jsonb,jsonb,jsonb,jsonb,bigint) to service_role;

create table if not exists public.digilab_sync_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(), finished_at timestamptz,
    status text not null default 'running' check(status in ('running','completed','failed','interrupted')),
    source text not null check(source in ('scheduled','admin')),
    summary jsonb not null default '{}', error text
);
create table if not exists public.digilab_sync_events (
    id bigint generated always as identity primary key,
    run_id uuid not null references public.digilab_sync_runs(id) on delete cascade,
    digilab_tournament_id bigint not null,
    created_at timestamptz not null default now(),
    outcome text not null check(outcome in ('imported','updated','unchanged','needs_review','retry')),
    details jsonb not null default '{}'
);
create index if not exists digilab_sync_events_run on public.digilab_sync_events(run_id, id desc);
create table if not exists public.digilab_sync_state (
    id boolean primary key default true check(id),
    next_page integer not null default 2 check(next_page >= 2),
    run_id uuid references public.digilab_sync_runs(id), lease_until timestamptz
);
insert into public.digilab_sync_state(id) values(true) on conflict do nothing;
alter table public.digilab_background_imports add column if not exists claim_run_id uuid references public.digilab_sync_runs(id);
alter table public.digilab_background_imports add column if not exists lease_until timestamptz;
alter table public.digilab_sync_runs enable row level security;
alter table public.digilab_sync_events enable row level security;
alter table public.digilab_sync_state enable row level security;
revoke all on public.digilab_sync_runs, public.digilab_sync_events, public.digilab_sync_state from public, anon, authenticated;
grant all on public.digilab_sync_runs, public.digilab_sync_events, public.digilab_sync_state to service_role;
grant usage, select on sequence public.digilab_sync_events_id_seq to service_role;

create or replace function public.start_digilab_sync_run(p_source text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_state public.digilab_sync_state%rowtype; v_id uuid;
begin
    select * into v_state from public.digilab_sync_state where id for update;
    if v_state.lease_until > now() then return jsonb_build_object('busy', true, 'run_id', v_state.run_id); end if;
    update public.digilab_sync_runs set status = 'interrupted', finished_at = now(), error = 'Execucao interrompida; fila liberada para nova tentativa.'
      where id = v_state.run_id and status = 'running';
    insert into public.digilab_sync_runs(source) values(p_source) returning id into v_id;
    update public.digilab_sync_state set run_id = v_id, lease_until = now() + interval '5 minutes' where id;
    return jsonb_build_object('run_id', v_id, 'next_page', v_state.next_page, 'busy', false);
end;
$$;

create or replace function public.claim_digilab_sync_item(p_run_id uuid, p_external_id bigint default null)
returns setof public.digilab_background_imports language plpgsql security definer set search_path = public, pg_temp as $$
begin
    if not exists(select 1 from public.digilab_sync_state where id and run_id = p_run_id and lease_until > now()) then
        raise exception 'Execucao expirada.';
    end if;
    return query with candidate as (
        select q.digilab_tournament_id from public.digilab_background_imports q
        where (p_external_id is null or q.digilab_tournament_id = p_external_id)
          and ((q.status in ('pending','needs_review','retry','imported') and q.next_attempt_at <= now())
               or (q.status = 'processing' and q.lease_until < now()))
        order by q.next_attempt_at, q.first_seen_at for update skip locked limit 1
    ) update public.digilab_background_imports q set status = 'processing', claim_run_id = p_run_id,
        lease_until = now() + interval '5 minutes', last_attempt_at = now(), attempt_count = q.attempt_count + 1, last_error = null
      from candidate c where q.digilab_tournament_id = c.digilab_tournament_id returning q.*;
end;
$$;

create or replace function public.finish_digilab_sync_run(p_run_id uuid, p_summary jsonb, p_error text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
    update public.digilab_sync_runs set finished_at = now(), status = case when p_error is null then 'completed' else 'failed' end,
        summary = p_summary, error = p_error where id = p_run_id and status = 'running';
    update public.digilab_sync_state set lease_until = null where id and run_id = p_run_id;
end;
$$;
create or replace function public.finish_digilab_sync_item(
    p_run_id uuid, p_external_id bigint, p_outcome text, p_details jsonb,
    p_next_attempt timestamptz, p_tournament_id bigint default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
    update public.digilab_background_imports set
        status = case when p_outcome in ('imported','updated','unchanged') then 'imported' else p_outcome end,
        tournament_id = coalesce(p_tournament_id, tournament_id),
        imported_at = case when p_outcome in ('imported','updated','unchanged') then now() else imported_at end,
        last_error = p_details->>'error', next_attempt_at = p_next_attempt,
        claim_run_id = null, lease_until = null
    where digilab_tournament_id = p_external_id and claim_run_id = p_run_id;
    if not found then raise exception 'Reserva da fila expirada.'; end if;
    insert into public.digilab_sync_events(run_id, digilab_tournament_id, outcome, details)
      values(p_run_id, p_external_id, p_outcome, p_details);
end;
$$;
revoke all on function public.finish_digilab_sync_item(uuid,bigint,text,jsonb,timestamptz,bigint) from public, anon, authenticated;
grant execute on function public.finish_digilab_sync_item(uuid,bigint,text,jsonb,timestamptz,bigint) to service_role;
revoke all on function public.start_digilab_sync_run(text), public.claim_digilab_sync_item(uuid,bigint), public.finish_digilab_sync_run(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.start_digilab_sync_run(text), public.claim_digilab_sync_item(uuid,bigint), public.finish_digilab_sync_run(uuid,jsonb,text) to service_role;

-- Recover rows left processing by the previous worker, which had no lease.
update public.digilab_background_imports set status = 'retry', next_attempt_at = now()
where status = 'processing' and lease_until is null;
commit;
