begin;

drop policy if exists "Admins insert stores" on public.stores;
create policy "Admins insert stores"
on public.stores
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = auth.uid()
    )
);

drop policy if exists "Admins update stores" on public.stores;
create policy "Admins update stores"
on public.stores
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = auth.uid()
    )
);

drop policy if exists "Admins delete stores" on public.stores;
create policy "Admins delete stores"
on public.stores
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = auth.uid()
    )
);

grant insert, update, delete on table public.stores to authenticated;

commit;
