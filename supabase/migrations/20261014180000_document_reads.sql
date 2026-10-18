-- M3 milestone 3 (M3 D-5, D-8): the quiet limit of 6 document reads per user.

-- ⭐ One row per user: how many documents the AI has read for him.
-- RLS on and NO policies: nobody can read or change a row directly, not even
-- his own. The only way in is the function below.
create table if not exists public.document_reads (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.document_reads enable row level security;

-- ⭐ The counter. Same pattern as delete_my_account: auth.uid() comes from his
-- login token, so it only ever counts the person who called it.
--   consume = false → just ask how many are left (before the upload ticket)
--   consume = true  → use one, if any are left (before the AI reads)
-- Returns { user_id, allowed, left }. The insert-or-update is one statement,
-- so two reads at the same moment cannot both take the last one.
create or replace function public.document_read(consume boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  lim constant int := 6;
  n int;
begin
  if me is null then
    raise exception 'not logged in';
  end if;

  if consume then
    insert into public.document_reads as d (user_id, used)
    values (me, 1)
    on conflict (user_id) do update
      set used = d.used + 1, updated_at = now()
      where d.used < lim
    returning used into n;
    -- No row returned: the update was refused because he is at the limit.
    if n is null then
      return jsonb_build_object('user_id', me, 'allowed', false, 'left', 0);
    end if;
    return jsonb_build_object('user_id', me, 'allowed', true, 'left', lim - n);
  end if;

  select used into n from public.document_reads where user_id = me;
  n := coalesce(n, 0);
  return jsonb_build_object('user_id', me, 'allowed', n < lim, 'left', greatest(lim - n, 0));
end;
$$;

revoke all on function public.document_read(boolean) from public, anon;
grant execute on function public.document_read(boolean) to authenticated;

-- Second lock: the site's roles get no table rights at all, so the table
-- cannot even be asked for. RLS would already return nothing.
revoke all on table public.document_reads from anon, authenticated;
