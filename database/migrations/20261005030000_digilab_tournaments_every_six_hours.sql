begin;

do $$
declare
    sync_job bigint;
begin
    select jobid into sync_job
    from cron.job
    where jobname = 'digilab-background-sync';

    if sync_job is null then
        raise exception 'Agendamento de sincronização de torneios não encontrado.';
    end if;

    perform cron.alter_job(sync_job, schedule := '0 4,10,16,22 * * *');
end;
$$;

commit;
