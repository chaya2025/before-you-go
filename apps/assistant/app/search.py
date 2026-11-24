"""search(): find the engine items that answer a question, on HIS road only.

This is the R in RAG (retrieval-augmented generation): before Claude writes a
word, we fetch the few sourced rules that matter, and Claude may only explain
those. It never answers from its own memory of Israeli law.

Three ideas, in order:
1. Hybrid search. The database scores each item two ways at once: by meaning
   (vectors, see embed.py) and by exact words (keyword rank). Meaning finds
   "renew my visa" under "extend residence permit"; keywords find "89" or
   "176", which a meaning-vector blurs. See match_knowledge in the migration.
2. Two questions. We search his own words AND Claude's rewrite in official
   wording, then keep the best score per item. People ask in their words, the
   rules are written in the ministry's.
3. Linked items. A step that needs form 89 links to form 89. If the step is a
   top hit, the document comes along, so the answer is complete.

The safety line, everywhere: allowed_ids. In case mode that is the list of ids
the engine put on his road. Nothing outside it is ever returned, except
`general` items when the caller asks for them. That is how the chat can never
tell him about a rule the engine decided does not apply to him. The database
enforces it, and this file checks again, so one bug is not enough to leak.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

import httpx

from app import budget
from app.embed import EmbedUnavailable, embed
from app.ingest import build_content

# The same weight the SQL uses: meaning leads, an exact keyword nudges.
KEYWORD_WEIGHT = 0.3
# How many top hits get their linked items added, and how many links at most.
LINK_FROM_TOP = 3
MAX_LINKED = 4


class SearchUnavailable(RuntimeError):
    """Supabase could not be reached or answered with an error."""


@dataclass
class Hit:
    id: str
    payload: dict
    similarity: float = 0.0
    keyword_rank: float = 0.0
    # None = found by the search itself. Otherwise the id of the hit it was linked from.
    via: str | None = None
    score: float = field(init=False)

    def __post_init__(self) -> None:
        self.score = self.similarity + KEYWORD_WEIGHT * self.keyword_rank


# ── the outside calls (tests replace these) ──────────────────────────────────


def _supabase() -> tuple[str, dict]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise SearchUnavailable("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set")
    # The publishable key is public and read-only here (RLS allows SELECT only).
    return url.rstrip("/"), {"apikey": key, "Content-Type": "application/json"}


def _request(method: str, url: str, headers: dict, **kw) -> list[dict]:
    try:
        r = httpx.request(method, url, headers=headers, timeout=budget.timeout(budget.SEARCH_S), **kw)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        raise SearchUnavailable(f"Supabase request failed ({type(e).__name__}, status {status})") from None


def rpc_match(
    embedding: list[float],
    query_text: str,
    allowed_ids: list[str],
    include_general: bool,
    match_count: int,
) -> list[dict]:
    """Calls match_knowledge. Returns rows of {id, payload, similarity, keyword_rank}."""
    base, headers = _supabase()
    return _request(
        "POST",
        f"{base}/rest/v1/rpc/match_knowledge",
        headers,
        json={
            "query_embedding": embedding,
            "query_text": query_text,
            "allowed_ids": allowed_ids,
            "include_general": include_general,
            "match_count": match_count,
        },
    )


def fetch_by_ids(ids: list[str]) -> list[dict]:
    """Reads items by id. Returns rows of {id, general, payload}."""
    if not ids:
        return []
    base, headers = _supabase()
    # Ids hold ':' and '.', so each one is quoted inside the PostgREST list.
    quoted = ",".join('"' + i.replace('"', "") + '"' for i in ids)
    return _request(
        "GET",
        f"{base}/rest/v1/knowledge_chunks",
        headers,
        params={"select": "id,general,payload", "id": f"in.({quoted})"},
    )


# ── is a keyword match real? ─────────────────────────────────────────────────

# Words the way Postgres's 'simple' parser splits them: runs of letters and
# digits (Hebrew included), lowercased. Underscore and punctuation split.
_WORD = re.compile(r"[^\W_]+")


def _words(text: str) -> set[str]:
    return set(_WORD.findall((text or "").lower()))


def really_matches(query_text: str, payload: dict) -> bool:
    """True only when EVERY word of the question is in the item's indexed text.

    WHY (checker finding 3, seen on the live index): plainto_tsquery joins the
    question's words with AND, but ts_rank still gives a score for PARTIAL
    overlap, and a ~1e-20 floor for none. So an off-topic question sharing
    "a" or "for" with an item looked like a keyword match, and the off-topic
    gate could never fire. Migration 20261123130000 fixes it in SQL
    (`case when tsv @@ query`); this is the same check done here, so search is
    right before and after that migration runs. The indexed text is rebuilt
    with ingest.build_content, the very function that wrote it.
    """
    q = _words(query_text)
    return bool(q) and q <= _words(build_content(payload))


# ── the fallback when Voyage cannot answer ───────────────────────────────────


def fetch_general() -> list[dict]:
    """Every general item (about, visa profiles...). Rows of {id, general, payload}."""
    base, headers = _supabase()
    return _request(
        "GET", f"{base}/rest/v1/knowledge_chunks", headers,
        params={"select": "id,general,payload", "general": "eq.true"},
    )


# Words too short to mean anything on their own ("a", "of", "של" is 3 but common).
_MIN_WORD = 3
_STOP = {"the", "and", "for", "what", "how", "can", "does", "with", "של", "את", "מה", "איך", "האם", "אני", "לי"}


def word_search(
    queries: list[str],
    allowed_list: list[str],
    include_general: bool,
    k: int,
    fetch_fn: Callable[[list[str]], list[dict]],
    fetch_general_fn: Callable[[], list[dict]] | None,
) -> list[Hit]:
    """Ranks the allowed items by how many of the question's words they contain.

    Weaker than meaning search (it misses "drive to work" vs "licence validity"),
    but it only ever looks at the same items he is allowed to see, so it can
    never widen what reaches Claude. An item needs at least half of the
    question's meaningful words to count; none at all means no hits, and the
    caller answers "not sure".
    """
    allowed = set(allowed_list)
    rows = fetch_fn(allowed_list) if allowed_list else []
    if include_general:
        rows = rows + (fetch_general_fn or fetch_general)()
    # Form and regulation numbers ("89", "216") are short but are the most exact
    # words a question can have, so digits always count.
    words = {w for q in queries for w in _words(q) if (w.isdigit() or len(w) >= _MIN_WORD) and w not in _STOP}
    if not words:
        return []
    best: dict[str, Hit] = {}
    for row in rows:
        payload = row.get("payload") or {}
        general = row.get("general", payload.get("general", False))
        if not _permitted(row.get("id", ""), general, allowed, include_general):
            continue
        share = len(words & _words(build_content(payload))) / len(words)
        if share >= 0.5:
            best[row["id"]] = Hit(row["id"], payload, 0.0, share)
    return sorted(best.values(), key=lambda h: h.keyword_rank, reverse=True)[:k]


# ── the search ───────────────────────────────────────────────────────────────


def _permitted(item_id: str, general: bool, allowed: set[str], include_general: bool) -> bool:
    return item_id in allowed or (include_general and bool(general))


def search(
    question: str,
    rewritten: str | None,
    allowed_ids: Iterable[str],
    include_general: bool,
    k: int = 6,
    *,
    embed_fn: Callable[[list[str], str], list[list[float]]] = embed,
    match_fn: Callable[..., list[dict]] = rpc_match,
    fetch_fn: Callable[[list[str]], list[dict]] = fetch_by_ids,
    fetch_general_fn: Callable[[], list[dict]] | None = None,
) -> list[Hit]:
    """Top k hits for the question, best first, then up to MAX_LINKED linked items.

    Raises EmbedUnavailable / SearchUnavailable when Voyage or Supabase is down;
    the caller turns that into status "unavailable".
    """
    allowed_list = list(dict.fromkeys(allowed_ids))
    allowed = set(allowed_list)
    if not allowed and not include_general:
        return []  # nothing he is allowed to see: no point paying for a search

    queries = [question]
    if rewritten and rewritten.strip() and rewritten.strip() != question.strip():
        queries.append(rewritten)
    try:
        vectors = embed_fn(queries, "query")
    except EmbedUnavailable:
        # Voyage is down or rate-limited (free tier: ~3 requests a minute).
        # Search the SAME allowed items by their words instead of failing.
        return word_search(queries, allowed_list, include_general, k, fetch_fn, fetch_general_fn)

    best: dict[str, Hit] = {}
    for text, vec in zip(queries, vectors):
        for row in match_fn(vec, text, allowed_list, include_general, k):
            payload = row.get("payload") or {}
            # Check again here, so a wrong database function cannot leak an item.
            if not _permitted(row["id"], payload.get("general", False), allowed, include_general):
                continue
            keyword = float(row.get("keyword_rank") or 0)
            if keyword and not really_matches(text, payload):
                keyword = 0.0
            hit = Hit(row["id"], payload, float(row.get("similarity") or 0), keyword)
            if row["id"] not in best or hit.score > best[row["id"]].score:
                best[row["id"]] = hit

    top = sorted(best.values(), key=lambda h: h.score, reverse=True)[:k]

    # Linked items of the strongest hits. Out-of-road links are dropped BEFORE
    # fetching when general items are off, so they are never even read.
    have = {h.id for h in top}
    wanted: dict[str, str] = {}  # linked id -> the hit it came from
    for h in top[:LINK_FROM_TOP]:
        for link in h.payload.get("links", []):
            if link in have or link in wanted:
                continue
            if link not in allowed and not include_general:
                continue
            wanted[link] = h.id
    if not wanted:
        return top

    linked: list[Hit] = []
    for row in fetch_fn(list(wanted)):
        payload = row.get("payload") or {}
        general = row.get("general", payload.get("general", False))
        if row.get("id") not in wanted or not _permitted(row["id"], general, allowed, include_general):
            continue
        linked.append(Hit(row["id"], payload, via=wanted[row["id"]]))
        if len(linked) >= MAX_LINKED:
            break
    return top + linked
