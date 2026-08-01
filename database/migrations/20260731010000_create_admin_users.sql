begin;

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    display_name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    created_by uuid null references auth.users(id) on delete set null
);

comment on table public.admin_users is
    'Allowlist de usuários do Supabase Auth autorizados a acessar o Admin do DigiStats.';
comment on column public.admin_users.user_id is
    'Identificador do usuário correspondente em auth.users.';
comment on column public.admin_users.display_name is
    'Nome exibido no Admin e usado na auditoria das operações.';
comment on column public.admin_users.username is
    'Identificador curto e único usado na tela de login do Admin.';

alter table public.admin_users
    drop constraint if exists admin_users_username_format;

alter table public.admin_users
    add constraint admin_users_username_format
    check (username = lower(username) and username ~ '^[a-z0-9_-]{3,40}$');

alter table public.admin_users enable row level security;

drop policy if exists "Admin users read own membership" on public.admin_users;
create policy "Admin users read own membership"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

revoke all on table public.admin_users from anon, authenticated;
grant select (user_id, username, display_name, created_at) on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;

insert into public.admin_users (user_id, username, display_name)
select
    auth_user.id,
    seed.username,
    seed.display_name
from (
    values
        ('braga@admin.digistats.local', 'braga', 'Marcio Braga'),
        ('fujisawa@admin.digistats.local', 'fujisawa', 'Lukas Fujisawa'),
        ('fonseca@admin.digistats.local', 'fonseca', 'Matheus Fonseca'),
        ('fortes@admin.digistats.local', 'fortes', 'Carlos Fortes'),
        ('lopes@admin.digistats.local', 'lopes', 'Eduardo Lopes')
) as seed(email, username, display_name)
join auth.users as auth_user on lower(auth_user.email) = seed.email
on conflict (user_id) do update
set
    username = excluded.username,
    display_name = excluded.display_name;

commit;
