begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.digilab_background_imports (
    digilab_tournament_id bigint primary key check (digilab_tournament_id > 0),
    tournament_id bigint null references public.tournament(id) on delete set null,
    status text not null default 'pending'
        check (status in ('pending', 'processing', 'needs_review', 'retry', 'imported')),
    event_date date null,
    store_name text null,
    format text null,
    player_count integer null check (player_count is null or player_count >= 0),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    first_seen_at timestamptz not null default timezone('utc', now()),
    last_attempt_at timestamptz null,
    next_attempt_at timestamptz not null default timezone('utc', now()),
    imported_at timestamptz null,
    last_error text null,
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_digilab_background_imports_due
    on public.digilab_background_imports (status, next_attempt_at, first_seen_at);

drop trigger if exists trg_digilab_background_imports_updated_at
    on public.digilab_background_imports;
create trigger trg_digilab_background_imports_updated_at
    before update on public.digilab_background_imports
    for each row execute function public.set_updated_at();

alter table public.digilab_background_imports enable row level security;
revoke all on public.digilab_background_imports from anon, authenticated;
grant all on public.digilab_background_imports to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'digilab-background-sync';

select cron.schedule(
    'digilab-background-sync',
    '*/15 * * * *',
    $cron$
    select net.http_post(
        url := (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'digilab_background_sync_url'
            limit 1
        ),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-digilab-background-token', (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'digilab_background_sync_token'
                limit 1
            )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
    $cron$
);

commit;
