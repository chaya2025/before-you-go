-- =============================================================================
-- M1 milestone 2: saved cases and profiles (D-145, D-150, D-152)
-- =============================================================================
--
-- ⭐ Save the INPUTS, not the result (D-118). A case holds what the person
-- answered and which steps he ticked. Every visit re-runs the engine on these
-- with today's date, so deadlines are always current and a rule fix reaches
-- every saved case by itself.
--
-- ⭐ RLS (Row Level Security) is the whole lock (D-145). The site talks to the
-- database directly with the public key, so these policies are the only thing
-- standing between one user and another user's immigration status. Every
-- policy says the same thing: a row is yours only if its user_id is you.
-- The attack test (apps/web/src/rls.attack.test.ts) proves it from outside.

-- ── profiles: one row per user. Only the language, for now (D-152). ──────────
create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  lang       text not null default 'he' check (lang in ('he', 'en')),
  updated_at timestamptz not null default now()
);

-- ── cases: several per account (family, D-152); the screens show the newest. ──
create table public.cases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  process      text not null default 'driving_license',
  answers      jsonb not null default '{}'::jsonb,
  done         text[] not null default '{}',
  -- When he last said "these answers are right". The screen shows it; M3's
  -- stale-answer checks start from it.
  confirmed_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- ⚠️ The second lock. The site already strips these before saving, but the
  -- database refuses them too, so a bug in the site can never store a
  -- passport number or a name. The engine only ever COMPARES them; on a return
  -- visit those checks honestly read "not checked yet" until he types them again.
  constraint cases_no_document_numbers check (
    not (answers ?| array[
      'passport_number', 'form_89_number', 'form_89_passport_number',
      'passport_name_latin', 'form_89_name_latin'
    ])
    and not coalesce((answers -> 'foreign_license') ? 'name_latin', false)
  )
);

create index cases_user_newest on public.cases (user_id, updated_at desc);

-- updated_at moves on every change, so "newest case" means something.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── The lock ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.cases enable row level security;

-- `(select auth.uid())` rather than `auth.uid()`: same answer, but Postgres
-- works it out once per query instead of once per row.
create policy "own profile: read"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile: create" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile: change" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own cases: read"   on public.cases for select to authenticated using ((select auth.uid()) = user_id);
create policy "own cases: create" on public.cases for insert to authenticated with check ((select auth.uid()) = user_id);
-- `with check` too: without it, he could move his own row onto someone else's id.
create policy "own cases: change" on public.cases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own cases: delete" on public.cases for delete to authenticated using ((select auth.uid()) = user_id);

-- Logged-out visitors get nothing at all, not even an empty answer.
revoke all on public.profiles, public.cases from anon;
