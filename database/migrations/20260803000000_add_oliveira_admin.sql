begin;

insert into public.admin_users (user_id, username, display_name)
select
    auth_user.id,
    'oliveira',
    'Oliveira'
from auth.users as auth_user
where lower(auth_user.email) = 'oliveira@admin.digistats.local'
on conflict (user_id) do update
set
    username = excluded.username,
    display_name = excluded.display_name;

commit;
