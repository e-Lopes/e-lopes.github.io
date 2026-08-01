begin;

-- Earlier DigiLab imports stored the external event_type verbatim. The DigiStats
-- tournament form only recognizes its own display values, so those rows appeared
-- without a selected tournament type when edited.
update public.tournament as tournament
set tournament_name = case
    when tournament.tournament_name is null
         or btrim(tournament.tournament_name) = '' then 'Semanal'
    when lower(btrim(tournament.tournament_name)) = 'locals' then 'Semanal'
    when lower(btrim(tournament.tournament_name)) in ('evo_cup', 'evo cup', 'evo-cup')
        then 'Evo Cup'
    else tournament.tournament_name
end
from public.tournament_digilab_sync as sync
where sync.tournament_id = tournament.id
  and sync.status = 'matched'
  and (
      tournament.tournament_name is null
      or btrim(tournament.tournament_name) = ''
      or lower(btrim(tournament.tournament_name)) in (
          'locals',
          'evo_cup',
          'evo cup',
          'evo-cup'
      )
  );

commit;
