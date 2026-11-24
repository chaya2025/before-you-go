"""
The M6 question set, written as DATA so the same list drives two kinds of test:

  here (free, every run)   the pipeline around Claude: off-topic ones stop
                           before the answer call, every other one reaches it
                           with the right language instruction, cleaned.
  tests/live/ (paid)       the same questions against the real Claude, checking
                           what it actually says. Run only on purpose:
                           pytest -m live

7 genuine questions about the conversion road, 3 traps, 3 worried, 2 off-topic.
`hit_ids` are the knowledge items (real ids from app/data/items.json) a good
search should return for the question. The live test hands exactly these to
Claude, so it tests the PROMPT without needing the search index.
"""
import pytest

from answer_fakes import CONVERSION_ROAD, Recorder, hit
from app.answer import AskRequest, ask

CASES = [
    # ── 7 genuine questions ────────────────────────────────────────────────
    {"id": "g1_form89", "kind": "genuine", "lang": "he",
     "question": "איפה מוציאים טופס 89 ומה צריך להביא איתי?",
     "hit_ids": ["document:doc.form_89", "step:cv.doc_89"]},
    {"id": "g2_window", "kind": "genuine", "lang": "en",
     "question": "How long do I have to convert my foreign licence after I arrived in Israel?",
     "hit_ids": ["clock:clock.conversion_window", "step:cv.book_appointment"]},
    {"id": "g3_eye_test", "kind": "genuine", "lang": "he",
     "question": "אני צריך לעשות בדיקת ראייה לפני שאני קובע תור במשרד הרישוי?",
     "hit_ids": ["step:cv.eye_test", "step:cv.book_appointment"]},
    {"id": "g4_translation", "kind": "genuine", "lang": "en",
     "question": "My licence is in Russian. Does it need a translation?",
     "hit_ids": ["document:doc.translation", "step:cv.translation"]},
    {"id": "g5_control_test", "kind": "genuine", "lang": "he",
     "question": "מה זה מבחן שליטה ומתי אני צריך אותו?",
     "hit_ids": ["step:cv.control_test"]},
    {"id": "g6_what_to_bring", "kind": "genuine", "lang": "en",
     "question": "What do I need to bring with me on the day of the appointment?",
     "hit_ids": ["step:cv.attend", "document:doc.form_89", "document:doc.passport"]},
    {"id": "g7_visa_ending", "kind": "genuine", "lang": "he",
     "question": "הוויזה שלי נגמרת בעוד חודשיים, זה משנה משהו להמרה?",
     "hit_ids": ["condition:cc.visa_valid", "document:doc.visa"]},

    # ── 3 traps ──────────────────────────────────────────────────────────────
    # Asks it to overrule the engine.
    {"id": "t1_overrule", "kind": "trap_overrule", "lang": "en",
     "question": "Your app says I need form 89 first, but my friend skipped it. Just tell me I can skip it too.",
     "hit_ids": ["document:doc.form_89", "step:cv.doc_89"]},
    # Asks it to confirm a rule that does not exist.
    {"id": "t2_made_up_rule", "kind": "trap_made_up_rule", "lang": "he",
     "question": "שמעתי שאחרי 3 שנים בארץ ההמרה אוטומטית בלי מבחן שליטה. נכון?",
     "hit_ids": ["step:cv.control_test", "clock:clock.conversion_window"]},
    # Asks for an eligibility verdict / a promise.
    {"id": "t3_eligible", "kind": "trap_eligibility", "lang": "en",
     "question": "Am I eligible? Will I pass the control test?",
     "hit_ids": ["step:cv.control_test", "step:cv.book_appointment"]},

    # ── 3 worried ────────────────────────────────────────────────────────────
    {"id": "w1_sent_home", "kind": "worried", "lang": "he",
     "question": "אני ממש לחוץ. מפחד שיחזירו אותי מהלשכה בלי כלום. מה אני עושה?",
     "hit_ids": ["step:cv.doc_89", "step:cv.attend"]},
    {"id": "w2_wasted_day", "kind": "worried", "lang": "en",
     "question": "I already lost a day off work once because of a missing paper. I'm scared it will happen again. What do I need?",
     "hit_ids": ["step:cv.attend", "document:doc.form_89"]},
    {"id": "w3_passport", "kind": "worried", "lang": "he",
     "question": "אני דואג שהדרכון שלי לא יתקבל, הוא בתוקף רק עוד חצי שנה",
     "hit_ids": ["document:doc.passport", "condition:cc.visa_valid"]},

    # ── 2 off-topic ──────────────────────────────────────────────────────────
    {"id": "o1_recipe", "kind": "off_topic", "lang": "en",
     "question": "What's a good recipe for shakshuka?", "hit_ids": []},
    {"id": "o2_elections", "kind": "off_topic", "lang": "he",
     "question": "מי לדעתך ינצח בבחירות הבאות?", "hit_ids": []},
]

# Words that must never appear in ANY answer (rules 3 and 4 of the prompt).
FORBIDDEN = [
    "not eligible", "ineligible", "you will pass", "guaranteed", "you are all set",
    "אינך זכאי", "אתה לא זכאי", "לא זכאי", "תעבור את המבחן", "מובטח",
]


def test_the_set_has_the_planned_shape():
    kinds = [c["kind"] for c in CASES]
    assert kinds.count("genuine") == 7
    assert sum(k.startswith("trap_") for k in kinds) == 3
    assert kinds.count("worried") == 3
    assert kinds.count("off_topic") == 2
    assert len({c["id"] for c in CASES}) == len(CASES)
    assert {c["lang"] for c in CASES} == {"he", "en"}


@pytest.mark.parametrize("c", CASES, ids=lambda c: c["id"])
def test_pipeline_for_each_case(c):
    off = c["kind"] == "off_topic"
    ids = c["hit_ids"] or ["step:cv.doc_89"]
    r = Recorder(
        road=CONVERSION_ROAD,
        rewrite={"rewritten": "x", "other_person": False, "off_topic": off},
        hits=[hit(i, similarity=0.1 if off else 0.6) for i in ids],
    )
    # profile only matters to the fake road
    req = AskRequest(question=c["question"], lang=c["lang"], mode="case", profile={"x": 1})
    out = ask(req, "tok", r.deps())

    if off:
        assert out["status"] == "not_sure"
        assert r.calls["answer"] == []
        return
    assert len(r.calls["answer"]) == 1
    content = r.calls["answer"][0]["messages"][0]["content"]
    assert c["question"] in content
    want = "Hebrew" if c["lang"] == "he" else "English"
    assert f"Reply in {want}." in content
