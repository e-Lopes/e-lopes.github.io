begin;
create table if not exists public.card_portrait_settings (
    card_code text primary key check (card_code ~ '^(BT[0-9]{1,2}|EX[0-9]{1,2}|ST[0-9]{1,2}|RB[0-9]{1,2}|AD[0-9]{1,2}|LM|P)-[0-9]{1,3}$'),
    center_x double precision not null default 0.5 check (center_x between 0 and 1),
    offset_y double precision not null default 0 check (offset_y between -1 and 1),
    zoom double precision not null default 2.3 check (zoom between 1 and 5),
    updated_at timestamptz not null default now()
);
alter table public.card_portrait_settings enable row level security;
grant select on public.card_portrait_settings to anon, authenticated;
grant insert, update, delete on public.card_portrait_settings to authenticated;
grant all on public.card_portrait_settings to service_role;
drop policy if exists "Public read portraits" on public.card_portrait_settings;
create policy "Public read portraits" on public.card_portrait_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage portraits" on public.card_portrait_settings;
create policy "Admins manage portraits" on public.card_portrait_settings for all to authenticated
using (exists (select 1 from public.admin_users where user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
drop trigger if exists card_portrait_updated_at on public.card_portrait_settings;
create trigger card_portrait_updated_at before update on public.card_portrait_settings
for each row execute function public.set_updated_at();
insert into public.card_portrait_settings(card_code, center_x) values ('BT24-101', 220.0 / 430)
on conflict (card_code) do nothing;
commit;
