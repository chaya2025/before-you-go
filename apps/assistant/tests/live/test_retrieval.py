"""
LIVE retrieval test: the REAL index (Supabase knowledge_chunks, Voyage
voyage-3.5) answers everyday questions with the right item. Checker finding 3.

    pytest -m live tests/live/test_retrieval.py -s

What it proves, with real numbers printed:
  1. 15 questions worded the way real users ask (Hebrew and English, short,
     casual, no official terms) find the item that answers them in the top 5,
     for at least 13 of the 15.
       - 10 in CASE mode on a real road: the a5-converter fixture run through
         the engine itself (engine_road.ts), so the allowed ids are exactly
         what a live user with that profile would get.
       - 5 in GENERAL mode (no road).
  2. 5 off-topic questions all fall below the off-topic gate
     (OFF_TOPIC_MIN_SIMILARITY in app/answer.py) with no keyword match, so
     the gate would stop them before the answer call.

Only the user's own words are searched here, NOT the Haiku rewrite: this is
the harder case (the real flow also searches the rewrite in official wording,
which can only help).

COST AND RATE LIMIT: Voyage's free tier allows ~3 requests a minute, so all 20
questions go to Voyage in ONE embed call (embed() takes a list). The 20
searches then call Supabase only, each with its question's ready vector.

KEYWORD RANK, BEFORE AND AFTER THE SQL FIX: until migration
20261123130000_match_knowledge_keyword_fix.sql is applied, match_knowledge
returns a ts_rank score for rows that do NOT match the whole question: a
~1e-20 floor for no overlap, and a real-looking score for PARTIAL overlap
("a", "for"). The first run of this test showed exactly that: the shakshuka
question "matched" four items. search() now checks the full match itself
(search.really_matches: every word of the question in the item's indexed
text, the same as SQL's `tsv @@ plainto_tsquery`), and answer.py also treats
anything at or below KEYWORD_MATCH_MIN as no match. So the keyword column
this test reads means the same thing before and after the migration.

Skipped when VOYAGE_API_KEY, SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[4]  # repo root, where .env lives

try:  # this laptop needs the Windows certificate store for TLS
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env", override=False)

from app.answer import KEYWORD_MATCH_MIN, OFF_TOPIC_MIN_SIMILARITY, case_allowed_ids, general_allowed_ids  # noqa: E402
from app.embed import embed  # noqa: E402
from app.search import search  # noqa: E402

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(
        not all(os.environ.get(k) for k in ("VOYAGE_API_KEY", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY")),
        reason="VOYAGE_API_KEY / SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set",
    ),
]

TOP = 5
NEED = 13

# (mode, question, ids that answer it: any one of them in the top 5 counts)
ON_TOPIC = [
    # ── case mode, the a5-converter road ────────────────────────────────────
    ("case", "כמה זמן מותר לי לנהוג עם הרישיון הצרפתי שלי בארץ?", ["clock:clock.foreign_driving"]),
    ("case", "how long do i have to switch my license to an israeli one", ["clock:clock.conversion_window"]),
    ("case", "צריך לתרגם את הרישיון אצל נוטריון?", ["step:cv.translation", "document:doc.translation"]),
    ("case", "what papers do i bring on the day at the licensing office", ["step:cv.attend"]),
    ("case", "איך קובעים תור למשרד הרישוי?", ["step:cv.book_appointment"]),
    ("case", "where do i get the paper from my country that shows when i got my licence", ["document:doc.record"]),
    ("case", "איפה מצטלמים בשביל הרישיון?", ["step:cv.photo"]),
    ("case", "the report of my trips in and out of israel, where do i get it", ["step:cv.entry_exit_form", "document:doc.entry_exit_form"]),
    ("case", "הרישיון לא הגיע בדואר, מה עושים?", ["step:duplicate.online", "step:cv.receive"]),
    ("case", "does my visa have to stay valid the whole time?", ["condition:cc.visa_valid"]),
    # ── general mode, no road ────────────────────────────────────────────────
    ("general", "מה זה מבחן שליטה?", ["step:cv.control_test"]),
    ("general", "do i need driving lessons if i never had a license", ["step:fz.lessons"]),
    ("general", "מה זה הטופס הלבן 89 ואיפה מוציאים אותו?", ["document:doc.form_89", "step:cv.doc_89", "step:fz.doc_89"]),
    ("general", "is this a government website?", ["about:not_government"]),
    ("general", "מה ההגבלות על נהג חדש?", ["step:fz.new_driver", "clock:clock.accompaniment"]),
]

OFF_TOPIC = [
    "What's a good recipe for shakshuka?",
    "מי ינצח בבחירות הבאות?",
    "how do I fix a python import error",
    "מה מזג האוויר מחר בתל אביב?",
    "recommend a good series to watch tonight",
]


def _a5_road() -> dict:
    """The real engine Result for the a5-converter fixture."""
    npx = shutil.which("npx")
    if not npx:
        pytest.skip("npx not found (needed to run the engine)")
    out = subprocess.run(
        [npx, "tsx", "apps/assistant/tests/live/engine_road.ts", "packages/engine/fixtures/a5-converter.json", "2026-11-23"],
        cwd=ROOT,
        capture_output=True,
        timeout=120,
        check=True,
    )
    return json.loads(out.stdout.decode("utf-8"))


def _keyword_match(h) -> bool:
    return h.keyword_rank > KEYWORD_MATCH_MIN


@pytest.fixture(scope="module")
def vectors() -> dict[str, list[float]]:
    questions = [q for _, q, _ in ON_TOPIC] + OFF_TOPIC
    vecs = embed(questions, "query")  # ONE Voyage request for all 20
    return dict(zip(questions, vecs))


def _search(question: str, vec: list[float], allowed: list[str], include_general: bool):
    hits = search(question, None, allowed, include_general, k=6, embed_fn=lambda texts, t: [vec])
    return [h for h in hits if h.via is None]  # ranked hits only, not linked extras


def test_everyday_questions_find_the_right_item(vectors):
    road_allowed = case_allowed_ids(_a5_road())
    general = general_allowed_ids()
    found = 0
    print(f"\n{'ok':3} {'rank':4} {'top sim':7}  question")
    for mode, q, want in ON_TOPIC:
        allowed, incl = (road_allowed, False) if mode == "case" else (general, True)
        if mode == "case":
            assert all(w in road_allowed for w in want), f"test bug: {want} not on the a5 road"
        hits = _search(q, vectors[q], allowed, incl)
        ranked = [h.id for h in hits]
        rank = next((i + 1 for i, hid in enumerate(ranked) if hid in want), None)
        ok = rank is not None and rank <= TOP
        found += ok
        top_sim = hits[0].similarity if hits else 0.0
        print(f"{'Y' if ok else 'N':3} {str(rank or '-'):4} {top_sim:.3f}    [{mode}] {q}")
        if not ok:
            print(f"      wanted {want}, got {ranked[:TOP]}")
    print(f"right item in top {TOP}: {found}/{len(ON_TOPIC)}")
    assert found >= NEED


def test_off_topic_questions_fall_below_the_gate(vectors):
    general = general_allowed_ids()
    print(f"\ngate OFF_TOPIC_MIN_SIMILARITY = {OFF_TOPIC_MIN_SIMILARITY}")
    rows = []
    for q in OFF_TOPIC:
        hits = _search(q, vectors[q], general, True)
        top_sim = max((h.similarity for h in hits), default=0.0)
        kw = [h.id for h in hits if _keyword_match(h)]
        rows.append((q, top_sim, kw))
        print(f"top sim {top_sim:.3f}  keyword matches {kw}  {q}")
    print(f"highest off-topic similarity: {max(r[1] for r in rows):.3f}")
    # All printed first, then checked, so one run shows every number.
    for q, top_sim, kw in rows:
        assert top_sim < OFF_TOPIC_MIN_SIMILARITY, q
        assert not kw, q
