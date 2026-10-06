begin;

create table if not exists public.digilab_catalog_sync_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null default 'running' check (status in ('running','completed','failed')),
    summary jsonb,
    error text
);
alter table public.digilab_catalog_sync_runs enable row level security;
revoke all on public.digilab_catalog_sync_runs from public, anon, authenticated;
grant all on public.digilab_catalog_sync_runs to service_role;

-- Stable DigiLab IDs preserve local IDs when an archetype is renamed.
-- Older manual mappings may use a retired slug while the canonical slug already
-- has its own local deck. Keep both local decks and attach the ID to the current one.
update public.digilab_deck_sync m set digilab_archetype_id=null
from public.digilab_deck_catalog c
where m.digilab_archetype_id=c.digilab_archetype_id and m.digilab_deck_slug<>c.slug
  and exists(select 1 from public.digilab_deck_sync current_mapping where current_mapping.digilab_deck_slug=c.slug);
update public.digilab_deck_sync m set digilab_archetype_id=c.digilab_archetype_id
from public.digilab_deck_catalog c
where m.digilab_deck_slug=c.slug and m.digilab_archetype_id is null;

create or replace function public.apply_digilab_catalog_snapshot(p_decks jsonb, p_formats jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
    r record; resolved_id uuid; family_id_value uuid; codes text; color_name text;
    used_ids uuid[] := array[]::uuid[]; source_ids bigint[];
    created_count integer:=0; archived_count integer:=0;
    formats_created integer:=0; formats_updated integer:=0; previous_count integer;
    existing_format_id bigint; release_time timestamptz; timestamp_value timestamptz:=now();
begin
    if not pg_try_advisory_xact_lock(hashtext('digilab-catalog-sync')) then
        raise exception 'Sincronização de catálogo já em andamento';
    end if;
    if jsonb_typeof(p_decks) is distinct from 'array' or jsonb_array_length(p_decks)=0
       or jsonb_typeof(p_formats) is distinct from 'array' or jsonb_array_length(p_formats)=0 then
        raise exception 'Catálogo ou formatos incompletos';
    end if;
    select count(*) into previous_count from public.digilab_deck_catalog where is_active;
    if previous_count>0 and jsonb_array_length(p_decks)<previous_count*0.8 then
        raise exception 'Queda inesperada no catálogo; dados anteriores preservados';
    end if;
    create temporary table digilab_snapshot_plan (
        external_id bigint primary key, slug text unique not null, name text unique not null,
        family_slug text, family_name text, primary_color text, secondary_color text,
        display_card_id text, total_entries integer, firsts integer, pilots integer,
        raw_payload jsonb, local_id uuid unique
    ) on commit drop;
    insert into digilab_snapshot_plan(external_id,slug,name,family_slug,family_name,primary_color,secondary_color,display_card_id,total_entries,firsts,pilots,raw_payload)
    select digilab_archetype_id,slug,name,family_slug,family_name,primary_color,secondary_color,display_card_id,total_entries,firsts,pilots,raw_payload
    from jsonb_to_recordset(p_decks) x(digilab_archetype_id bigint,slug text,name text,family_slug text,family_name text,primary_color text,secondary_color text,display_card_id text,total_entries integer,firsts integer,pilots integer,raw_payload jsonb);
    if exists(select 1 from digilab_snapshot_plan where external_id<=0 or slug!~'^[a-z0-9-]+$' or btrim(name)='' or lower(primary_color) not in ('red','blue','yellow','green','black','purple','white') or primary_color is null or (secondary_color is not null and lower(secondary_color) not in ('red','blue','yellow','green','black','purple','white')) or (display_card_id is not null and display_card_id!~'^[A-Z0-9]+-[0-9]+$')) then
        raise exception 'Arquétipo inválido';
    end if;
    -- Resolve every identity before changing any names or slugs.
    for r in select * from digilab_snapshot_plan order by external_id loop
        resolved_id:=null;
        select m.deck_id into resolved_id from public.digilab_deck_sync m where m.digilab_archetype_id=r.external_id;
        if resolved_id is null then select m.deck_id into resolved_id from public.digilab_deck_sync m where m.digilab_deck_slug=r.slug; end if;
        if resolved_id is null then
            if (select count(*) from public.decks d where lower(btrim(d.name))=lower(btrim(r.name)))>1 then raise exception 'Nome local ambíguo: %',r.name; end if;
            select d.id into resolved_id from public.decks d where lower(btrim(d.name))=lower(btrim(r.name));
        end if;
        if resolved_id=any(used_ids) then raise exception 'Vínculo duplicado: %',r.name; end if;
        if resolved_id is null then created_count:=created_count+1; resolved_id:=gen_random_uuid(); end if;
        used_ids:=array_append(used_ids,resolved_id);
        update digilab_snapshot_plan p set local_id=resolved_id where p.external_id=r.external_id;
    end loop;
    update public.decks d set slug=null from digilab_snapshot_plan p where d.id=p.local_id and d.slug is distinct from p.slug;
    for r in select * from digilab_snapshot_plan order by external_id loop
        family_id_value:=null;
        if r.family_slug is not null then
            insert into public.deck_families(name,slug,is_active) values(r.family_name,r.family_slug,true)
            on conflict(slug) do update set name=excluded.name,is_active=true returning id into family_id_value;
        end if;
        codes:='';
        foreach color_name in array array[r.primary_color,r.secondary_color] loop
            if color_name is null then continue; end if;
            color_name:=case lower(color_name) when 'red' then 'r' when 'blue' then 'u' when 'yellow' then 'y' when 'green' then 'g' when 'black' then 'b' when 'purple' then 'p' when 'white' then 'w' end;
            if not color_name=any(string_to_array(codes,',')) then codes:=concat_ws(',',nullif(codes,''),color_name); end if;
        end loop;
        insert into public.decks(id,name,slug,colors,primary_color,secondary_color,display_card_id,family_id,is_active)
        values(r.local_id,r.name,r.slug,codes,r.primary_color,r.secondary_color,r.display_card_id,family_id_value,true)
        on conflict(id) do update set name=excluded.name,slug=excluded.slug,colors=excluded.colors,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,display_card_id=excluded.display_card_id,family_id=excluded.family_id,is_active=true;
        insert into public.digilab_deck_catalog(digilab_archetype_id,slug,name,family_slug,family_name,primary_color,secondary_color,display_card_id,total_entries,firsts,pilots,raw_payload,is_active,last_seen_at)
        values(r.external_id,r.slug,r.name,r.family_slug,r.family_name,r.primary_color,r.secondary_color,r.display_card_id,r.total_entries,r.firsts,r.pilots,coalesce(r.raw_payload,'{}'),true,timestamp_value)
        on conflict(digilab_archetype_id) do update set slug=excluded.slug,name=excluded.name,family_slug=excluded.family_slug,family_name=excluded.family_name,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,display_card_id=excluded.display_card_id,total_entries=excluded.total_entries,firsts=excluded.firsts,pilots=excluded.pilots,raw_payload=excluded.raw_payload,is_active=true,last_seen_at=excluded.last_seen_at;
        update public.digilab_deck_sync set digilab_deck_slug=r.slug,digilab_deck_name=r.name,updated_at=timestamp_value where digilab_archetype_id=r.external_id;
        insert into public.digilab_deck_sync(digilab_archetype_id,digilab_deck_slug,digilab_deck_name,deck_id)
        values(r.external_id,r.slug,r.name,r.local_id) on conflict(digilab_deck_slug) do update set digilab_archetype_id=excluded.digilab_archetype_id,digilab_deck_name=excluded.digilab_deck_name,deck_id=excluded.deck_id,updated_at=timestamp_value;
        if r.display_card_id is not null then
            update public.deck_images set image_url='https://digimon.digilab.cards/api/card/'||r.display_card_id||'.jpg' where deck_id=r.local_id;
            if not found then insert into public.deck_images(deck_id,image_url) values(r.local_id,'https://digimon.digilab.cards/api/card/'||r.display_card_id||'.jpg'); end if;
        else
            delete from public.deck_images where deck_id=r.local_id;
        end if;
    end loop;
    update public.decks set is_active=false where is_active and not(id=any(used_ids));
    get diagnostics archived_count=row_count;
    select array_agg(external_id) into source_ids from digilab_snapshot_plan;
    update public.digilab_deck_catalog set is_active=false where is_active and not(digilab_archetype_id=any(source_ids));
    for r in select * from jsonb_to_recordset(p_formats) x(code text,name text,release_date text) loop
        if r.code is null or btrim(r.code)='' or r.name is null or btrim(r.name)='' then raise exception 'Formato inválido'; end if;
        release_time:=case when r.release_date is null then null else r.release_date::date::timestamp at time zone 'America/Sao_Paulo' end;
        select f.id into existing_format_id from public.formats f where upper(btrim(f.code))=upper(btrim(r.code));
        if existing_format_id is null then
            insert into public.formats(code,name,created_at,is_active,is_default) values(r.code,r.name,coalesce(release_time,timestamp_value),true,false);
            formats_created:=formats_created+1;
        else
            update public.formats set name=r.name,created_at=coalesce(release_time,created_at) where id=existing_format_id;
            formats_updated:=formats_updated+1;
        end if;
    end loop;
    return jsonb_build_object('archetypes',jsonb_array_length(p_decks),'created',created_count,'updated',jsonb_array_length(p_decks)-created_count,'archived',archived_count,'formats',jsonb_array_length(p_formats),'formats_created',formats_created,'formats_updated',formats_updated);
end $$;
revoke all on function public.apply_digilab_catalog_snapshot(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_digilab_catalog_snapshot(jsonb,jsonb) to service_role;
revoke insert,update,delete on public.decks,public.deck_images,public.deck_families from anon,authenticated;
commit;
