-- M6 "Ask your case": fix keyword_rank in match_knowledge (checker finding 3).
--
-- THE BUG: ts_rank never returns exactly 0. A row with no matching word gets a
-- tiny floor (about 1e-20), and a row sharing only SOME words ("a", "for")
-- gets a real-looking score, even though plainto_tsquery needs ALL the words.
-- The chat's off-topic gate (D-220) asks "did ANY hit match a keyword?", so
-- on the live index "a good recipe for shakshuka" matched four items and the
-- gate could never fire.
--
-- THE FIX: keyword_rank is ts_rank only when the row really matches
-- (tsv @@ query), and a clean 0 otherwise. Same for the ordering nudge.
-- Same signature, same return columns, same grants: nothing that calls it
-- changes. Python's search.really_matches does the same check client-side,
-- so the chat is correct before and after this runs.
--
-- Run by hand in the Supabase SQL editor (not applied automatically).

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
    (case when k.tsv @@ plainto_tsquery('simple', coalesce(query_text, ''))
          then ts_rank(k.tsv, plainto_tsquery('simple', coalesce(query_text, '')))
          else 0 end)::float as keyword_rank
  from public.knowledge_chunks k
  -- ⚠️ The safety line, unchanged: only items on HIS road (allowed_ids), or
  -- general items when the caller asks for them.
  where k.embedding is not null
    and (k.id = any(coalesce(allowed_ids, '{}'::text[])) or (include_general and k.general))
  -- Meaning leads; a REAL keyword match nudges an item up. Written out in
  -- full: Postgres cannot use an output alias inside an ORDER BY expression.
  order by
    (1 - (k.embedding <=> query_embedding))
      + 0.3 * (case when k.tsv @@ plainto_tsquery('simple', coalesce(query_text, ''))
                    then ts_rank(k.tsv, plainto_tsquery('simple', coalesce(query_text, '')))
                    else 0 end) desc
  limit greatest(1, least(coalesce(match_count, 6), 50));
$$;

grant execute on function public.match_knowledge(vector, text, text[], boolean, int) to anon, authenticated;
