"""search(): hybrid retrieval over knowledge_chunks, fenced to his road.

Every outside call (Voyage, Supabase) is replaced by a fake here, so these
tests cost nothing and run with no keys.
"""

import pytest

from app import embed as embed_mod
from app.search import Hit, search

# A tiny fake knowledge base: id -> (general, links)
DB = {
    "step:cv.attend": (False, ["document:doc.form_89", "document:doc.passport"]),
    "document:doc.form_89": (False, ["step:fz.doc_89"]),
    "document:doc.passport": (False, []),
    "step:fz.doc_89": (False, []),
    "about:what_it_is": (True, []),
    "step:secret.other_road": (False, []),  # never on this person's road
}


def payload(i):
    general, links = DB[i]
    return {"id": i, "general": general, "links": links, "title": {"he": i, "en": i}}


class FakeDB:
    """Pretends to be Supabase. Records every call so tests can inspect them."""

    def __init__(self, rows_by_query=None, leak=False):
        self.rows_by_query = rows_by_query or {}
        self.leak = leak  # misbehave: return rows outside allowed_ids
        self.match_calls = []
        self.fetch_calls = []

    def match(self, embedding, query_text, allowed_ids, include_general, match_count):
        self.match_calls.append((query_text, list(allowed_ids), include_general, match_count))
        rows = self.rows_by_query.get(query_text, [])
        if not self.leak:
            rows = [r for r in rows if r["id"] in allowed_ids or (include_general and DB[r["id"]][0])]
        return rows

    def fetch(self, ids):
        self.fetch_calls.append(list(ids))
        return [{"id": i, "general": DB[i][0], "payload": payload(i)} for i in ids if i in DB]


def row(i, sim, kw=0.0):
    return {"id": i, "payload": payload(i), "similarity": sim, "keyword_rank": kw}


def fake_embed(texts, input_type):
    assert input_type == "query"
    return [[0.1] * 1024 for _ in texts]


def run(db, question="q", rewritten="r", allowed=None, include_general=False, k=6):
    return search(
        question,
        rewritten,
        allowed if allowed is not None else ["step:cv.attend", "document:doc.form_89", "step:fz.doc_89"],
        include_general,
        k=k,
        embed_fn=fake_embed,
        match_fn=db.match,
        fetch_fn=db.fetch,
    )


def test_searches_both_the_original_and_the_rewritten_question():
    db = FakeDB({"q": [row("step:cv.attend", 0.8)], "r": [row("document:doc.form_89", 0.7)]})
    hits = run(db)
    assert [c[0] for c in db.match_calls] == ["q", "r"]
    assert {h.id for h in hits} >= {"step:cv.attend", "document:doc.form_89"}
    assert all(isinstance(h, Hit) for h in hits)


def test_merges_by_id_and_keeps_the_best_score():
    db = FakeDB({"q": [row("step:cv.attend", 0.5)], "r": [row("step:cv.attend", 0.9)]})
    hits = [h for h in run(db) if h.via is None]
    assert len(hits) == 1
    assert hits[0].similarity == pytest.approx(0.9)


def test_keyword_rank_breaks_ties():
    # "form 89": both words are in the item's text, so it is a real keyword match.
    db = FakeDB({"form 89": [row("step:cv.attend", 0.7), row("document:doc.form_89", 0.7, kw=0.5)]})
    hits = [h for h in run(db, question="form 89", rewritten=None) if h.via is None]
    assert hits[0].id == "document:doc.form_89"
    assert hits[0].keyword_rank == pytest.approx(0.5)


def test_partial_word_overlap_is_not_a_keyword_match():
    # Checker finding 3, seen live: ts_rank scores PARTIAL overlap ("a",
    # "for") even when the question as a whole does not match. Until the SQL
    # fix runs, search() checks the full match itself: every word of the
    # question must be in the item's indexed text, or the rank is 0.
    q = "a good recipe for form"
    db = FakeDB({q: [row("document:doc.form_89", 0.2, kw=0.06)]})
    hits = run(db, question=q, rewritten=None)
    assert hits[0].keyword_rank == 0.0
    assert hits[0].score == pytest.approx(0.2)


def test_floor_rank_without_a_match_becomes_zero():
    db = FakeDB({"pasta": [row("step:cv.attend", 0.1, kw=1e-20)]})
    assert run(db, question="pasta", rewritten=None)[0].keyword_rank == 0.0


def test_adds_linked_items_only_if_allowed():
    # step:cv.attend links to doc.form_89 (allowed) and doc.passport (NOT allowed)
    db = FakeDB({"q": [row("step:cv.attend", 0.9)]})
    hits = run(db, rewritten=None, allowed=["step:cv.attend", "document:doc.form_89"])
    ids = [h.id for h in hits]
    assert "document:doc.form_89" in ids
    assert "document:doc.passport" not in ids
    linked = next(h for h in hits if h.id == "document:doc.form_89")
    assert linked.via == "step:cv.attend"
    # The forbidden one is not even fetched.
    assert all("document:doc.passport" not in c for c in db.fetch_calls)


def test_an_item_not_in_allowed_ids_is_never_returned_even_if_the_db_leaks_it():
    """The safety line. Even if the database function were wrong and handed
    back another person's road, search() drops it."""
    db = FakeDB(
        {
            "q": [row("step:secret.other_road", 0.99), row("step:cv.attend", 0.5)],
            "r": [row("about:what_it_is", 0.95)],
        },
        leak=True,
    )
    hits = run(db, allowed=["step:cv.attend"], include_general=False)
    ids = {h.id for h in hits}
    assert "step:secret.other_road" not in ids
    assert "about:what_it_is" not in ids  # general, but general was not asked for
    assert "step:cv.attend" in ids


def test_general_items_come_in_only_when_include_general():
    db = FakeDB({"q": [row("about:what_it_is", 0.9)]})
    assert [h.id for h in run(db, rewritten=None, allowed=[], include_general=True)] == ["about:what_it_is"]
    db2 = FakeDB({"q": [row("about:what_it_is", 0.9)]}, leak=True)
    assert run(db2, rewritten=None, allowed=[], include_general=False) == []


def test_general_linked_item_allowed_in_general_mode_but_not_a_scoped_one():
    DB["about:how_to_start"] = (True, [])
    DB["about:what_it_is"] = (True, ["about:how_to_start", "step:secret.other_road"])
    try:
        db = FakeDB({"q": [row("about:what_it_is", 0.9)]})
        ids = [h.id for h in run(db, rewritten=None, allowed=[], include_general=True)]
        assert "about:how_to_start" in ids
        assert "step:secret.other_road" not in ids
    finally:
        DB["about:what_it_is"] = (True, [])
        del DB["about:how_to_start"]


def test_nothing_to_search_makes_no_calls():
    db = FakeDB()

    def boom(*a, **kw):
        raise AssertionError("should not embed")

    assert search("q", "r", [], False, embed_fn=boom, match_fn=db.match, fetch_fn=db.fetch) == []
    assert db.match_calls == []


def test_k_limits_primary_hits():
    rows = [row("step:cv.attend", 0.9), row("document:doc.form_89", 0.8), row("step:fz.doc_89", 0.7)]
    db = FakeDB({"q": rows})
    hits = [h for h in run(db, rewritten=None, k=2) if h.via is None]
    assert [h.id for h in hits] == ["step:cv.attend", "document:doc.form_89"]


def test_same_rewritten_question_is_searched_once():
    db = FakeDB({"q": [row("step:cv.attend", 0.9)]})
    run(db, question="q", rewritten="q")
    assert len(db.match_calls) == 1


def test_embed_refuses_without_a_key(monkeypatch):
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
    with pytest.raises(embed_mod.MissingKey) as e:
        embed_mod.embed(["x"], "query")
    assert "VOYAGE_API_KEY" in str(e.value)


def test_embed_sends_model_and_input_type_and_orders_by_index(monkeypatch):
    seen = {}

    def fake_post(url, headers, body):
        seen.update(url=url, headers=headers, body=body)
        # Voyage may return rows in any order; index says which text each is.
        return {"data": [{"index": 1, "embedding": [2.0]}, {"index": 0, "embedding": [1.0]}]}

    out = embed_mod.embed(["a", "b"], "document", api_key="k-test", post=fake_post)
    assert out == [[1.0], [2.0]]
    assert seen["url"] == "https://api.voyageai.com/v1/embeddings"
    assert seen["body"]["model"] == "voyage-3.5"
    assert seen["body"]["input_type"] == "document"
    assert seen["body"]["output_dimension"] == 1024
    assert seen["headers"]["Authorization"] == "Bearer k-test"


def test_embed_rejects_a_bad_input_type():
    with pytest.raises(ValueError):
        embed_mod.embed(["a"], "passage", api_key="k", post=lambda *a: {})


# ── Voyage down or rate-limited: fall back to exact words (2026-11-23) ───────
# WHY: Voyage's free tier allows ~3 requests a minute. A live run hit that and
# the whole chat said "unavailable". The engine's road does not depend on
# Voyage, so a meaning search that cannot run should degrade to a word search
# over the SAME allowed items, never fail the question and never widen it.


def _voyage_down(texts, input_type):
    raise embed_mod.EmbedUnavailable("Voyage request failed (HTTPStatusError, status 429)")


def run_down(db, question, allowed=None, include_general=False, general_rows=None):
    return search(
        question,
        None,
        allowed if allowed is not None else ["step:cv.attend", "document:doc.form_89", "step:fz.doc_89"],
        include_general,
        embed_fn=_voyage_down,
        match_fn=db.match,
        fetch_fn=db.fetch,
        fetch_general_fn=lambda: general_rows or [],
    )


def test_voyage_down_falls_back_to_word_search_over_allowed_items_only():
    db = FakeDB()
    hits = run_down(db, "attend cv")
    assert [h.id for h in hits][:1] == ["step:cv.attend"]
    assert db.match_calls == []  # no meaning search was attempted
    assert all(h.id in {"step:cv.attend", "document:doc.form_89", "step:fz.doc_89"} for h in hits)
    assert "step:secret.other_road" not in {h.id for h in hits}


def test_voyage_down_with_no_shared_words_returns_nothing():
    db = FakeDB()
    assert run_down(db, "shakshuka recipe") == []


def test_voyage_down_general_mode_also_searches_general_rows():
    db = FakeDB()
    about = {"id": "about:what_it_is", "general": True, "payload": payload("about:what_it_is")}
    hits = run_down(db, "about", allowed=[], include_general=True, general_rows=[about])
    assert [h.id for h in hits] == ["about:what_it_is"]


def test_voyage_down_case_mode_never_reads_general_rows():
    db = FakeDB()
    called = []
    search("about what it is", None, ["step:cv.attend"], False, embed_fn=_voyage_down,
           match_fn=db.match, fetch_fn=db.fetch, fetch_general_fn=lambda: called.append(1) or [])
    assert called == []
