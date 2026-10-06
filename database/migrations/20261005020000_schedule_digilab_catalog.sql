begin;
select cron.unschedule(jobid) from cron.job where jobname='digilab-catalog-sync';
-- Refresh the registry 15 minutes before tournament imports (Brasília time).
select cron.schedule('digilab-catalog-sync','45 3,9,15,21 * * *',$job$
    select net.http_post(
        url := (select regexp_replace(decrypted_secret,'/[^/]+$','/digilab-deck-catalog') from vault.decrypted_secrets where name='digilab_background_sync_url' limit 1),
        headers := jsonb_build_object('Content-Type','application/json','x-digilab-background-token',(select decrypted_secret from vault.decrypted_secrets where name='digilab_background_sync_token' limit 1)),
        body := '{"action":"sync"}'::jsonb,
        timeout_milliseconds := 120000
    );
$job$);
commit;
