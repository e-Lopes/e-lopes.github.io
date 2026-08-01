begin;

-- Keep the tournament type canonical even when a client sends DigiLab's slug
-- instead of the display value used by DigiStats.
create or replace function public.normalize_tournament_type_name()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    new.tournament_name := case
        when lower(btrim(new.tournament_name)) = 'locals' then 'Semanal'
        when lower(btrim(new.tournament_name)) in ('evo_cup', 'evo cup', 'evo-cup')
            then 'Evo Cup'
        else new.tournament_name
    end;

    return new;
end;
$$;

drop trigger if exists trg_tournament_normalize_type_name on public.tournament;
create trigger trg_tournament_normalize_type_name
before insert or update of tournament_name on public.tournament
for each row
execute function public.normalize_tournament_type_name();

-- Backfill every legacy alias. This deliberately does not depend on the sync
-- status, because older reverse imports may not have a complete sync row.
update public.tournament
set tournament_name = case
    when lower(btrim(tournament_name)) = 'locals' then 'Semanal'
    when lower(btrim(tournament_name)) in ('evo_cup', 'evo cup', 'evo-cup')
        then 'Evo Cup'
    else tournament_name
end
where lower(btrim(tournament_name)) in ('locals', 'evo_cup', 'evo cup', 'evo-cup');

comment on function public.normalize_tournament_type_name() is
    'Normalizes DigiLab tournament type slugs to the display values used by DigiStats.';

commit;
