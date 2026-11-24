-- M6 "Ask your case" (CONTRACT section 2, D-214..D-229): the knowledge the chat
-- searches, the search itself, and the quiet limit of 20 questions a day.

-- pgvector: lets Postgres store a vector (a list of 1024 numbers that stands
-- for what a text MEANS) and measure how close two of them are.
create extension if not exists vector;

-- ⭐ One row per engine item (a step, a document, a clock...), copied from
-- apps/assistant/knowledge/items.json by `python -m app.ingest`.
--   content   = the words we search (he + en)
--   payload   = the full item, handed to Claude as context
--   embedding = the meaning of `content`, from Voyage voyage-3.5 (1024 dims)
--   tsv       = the same words split for keyword search, kept up to date by
--               Postgres itself. 'simple' config: no stemming, works the same
--               for Hebrew and English.
create table if not exists public.knowledge_chunks (
  id text primary key,
  kind text not null,
  engine_id text not null,
  general boolean not null default false,
  content text not null,
  payload jsonb not null,
  embedding vector(1024),
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_tsv_idx on public.knowledge_chunks using gin (tsv);

alter table public.knowledge_chunks enable row level security;

-- Public government rules, no personal data: anyone may read them.
-- No insert/update/delete policy at all, so only the secret key (local ingest)
-- can write. The site's keys cannot change what the chat knows.
drop policy if exists knowledge_chunks_read on public.knowledge_chunks;
create policy knowledge_chunks_read on public.knowledge_chunks
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on table public.knowledge_chunks from anon, authenticated;
grant select on table public.knowledge_chunks to anon, authenticated;

-- ⭐ The search. Hybrid, because each half misses what the other catches:
--   similarity   = cosine closeness of meanings (1 - distance). Finds
--                  "renew my visa" when the item says "extend residence permit".
--   keyword_rank = ts_rank on the exact words. Finds "89" or "176", which a
--                  meaning-vector blurs.
-- ⚠️ The WHERE is the safety line: only items on HIS road (allowed_ids), or
-- general items when the caller asks for them. The chat can never be handed a
-- rule that the engine did not put on his road.
-- security invoker (the default): it runs as the caller, so RLS above applies.
create or replace function public.match_knowledge(
  query_embedding vector(1024),
  query_text text,
  allowed_ids text[],
  include_general boolean,
  match_count int
)
returns table (id text, payload jsonb, similarity float, keyword_rank float)
language sql
stable
set search_path = public, extensions
as $$
  select
    k.id,
    k.payload,
    (1 - (k.embedding <=> query_embedding))::float as similarity,
    ts_rank(k.tsv, plainto_tsquery('simple', coalesce(query_text, '')))::float as keyword_rank
  from public.knowledge_chunks k
  where k.embedding is not null
    and (k.id = any(coalesce(allowed_ids, '{}'::text[])) or (include_general and k.general))
  order by
    -- Meaning leads; an exact keyword hit nudges an item up.
    (1 - (k.embedding <=> query_embedding))
      + 0.3 * ts_rank(k.tsv, plainto_tsquery('simple', coalesce(query_text, ''))) desc
  limit greatest(1, least(coalesce(match_count, 6), 50));
$$;

grant execute on function public.match_knowledge(vector, text, text[], boolean, int) to anon, authenticated;

-- ⭐ The question counter. Same pattern as document_read
-- (20261014180000_document_reads.sql): one row per user per Israeli day,
-- a COUNT only. The question text is never stored (D-222).
-- RLS on and NO policies: the only way in is the function below.
create table if not exists public.ask_questions (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ask_questions enable row level security;

--   consume = false -> just ask how many are left
--   consume = true  -> use one, if any are left
-- Returns { user_id, allowed, left }. The insert-or-update is one statement,
-- so two questions at the same moment cannot both take the last one.
-- The day is Israel's day (Asia/Jerusalem), so the limit resets at local
-- midnight, not at UTC midnight (02:00/03:00 here).
create or replace function public.ask_question(consume boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  lim constant int := 20;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  n int;
begin
  if me is null then
    raise exception 'not logged in';
  end if;

  if consume then
    insert into public.ask_questions as q (user_id, day, used)
    values (me, today, 1)
    on conflict (user_id, day) do update
      set used = q.used + 1, updated_at = now()
      where q.used < lim
    returning used into n;
    -- No row returned: the update was refused because he is at the limit.
    if n is null then
      return jsonb_build_object('user_id', me, 'allowed', false, 'left', 0);
    end if;
    return jsonb_build_object('user_id', me, 'allowed', true, 'left', lim - n);
  end if;

  select used into n from public.ask_questions where user_id = me and day = today;
  n := coalesce(n, 0);
  return jsonb_build_object('user_id', me, 'allowed', n < lim, 'left', greatest(lim - n, 0));
end;
$$;

revoke all on function public.ask_question(boolean) from public, anon;
grant execute on function public.ask_question(boolean) to authenticated;

-- Second lock: the site's roles get no table rights on the counter at all.
revoke all on table public.ask_questions from anon, authenticated;
