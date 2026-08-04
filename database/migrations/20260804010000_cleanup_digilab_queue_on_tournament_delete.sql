begin;

-- A queue row only has meaning while its imported DigiStats tournament exists.
-- Cascading the delete prevents an orphaned `imported` status from blocking a
-- later discovery of the same DigiLab tournament.
alter table public.digilab_background_imports
    drop constraint if exists digilab_background_imports_tournament_id_fkey;

alter table public.digilab_background_imports
    add constraint digilab_background_imports_tournament_id_fkey
    foreign key (tournament_id)
    references public.tournament(id)
    on delete cascade;

delete from public.digilab_background_imports
where status = 'imported'
  and tournament_id is null;

commit;
