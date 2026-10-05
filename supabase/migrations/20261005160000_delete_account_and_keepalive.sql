-- M1 milestone 4 (D-152, D-164).

-- ⭐ "Delete my account". The site holds only the public key, which cannot
-- touch auth.users, so the delete runs here with the owner's rights. It is
-- locked to the caller: auth.uid() comes from his login token, so it can only
-- ever delete the person who called it. cases and profiles go with it
-- (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not logged in';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ⭐ The weekly ping. A free project pauses after 7 days with no database
-- activity; this is the smallest real query. It reads nothing and returns 1.
create or replace function public.keepalive()
returns int
language sql
stable
security invoker
set search_path = ''
as $$ select 1 $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
