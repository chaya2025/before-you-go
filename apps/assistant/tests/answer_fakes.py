"""
Fakes for the answer-service tests. No network, no money.

WHY FAKES: the real flow calls Supabase, the TS API, Voyage and Claude. A unit
test that hit them would be slow, cost money, and fail when the wifi does. So
every outside call sits behind one function in `Deps`, and here we hand in
small stand-ins that (a) return what we choose and (b) remember how they were
called, so a test can prove "Claude was never called" or "the passport number
never reached search".
"""

import json

from app.answer import Deps
from app.search import Hit


def T(he: str, en: str) -> dict:
    return {"he": he, "en": en}


# A small but realistic engine Result, shaped like packages/engine/src/result.ts.
FAKE_ROAD = {
    "facts": {"visa_type": "b1"},
    "diagnosis": {
        "track": "conversion",
        "nohal_category": "toshav_medinat_chutz",
        "has_teudat_zehut": False,
        "grade_ceiling": None,
        "exemption": "unknown",
    },
    "blocked": None,
    "urgent": [
        {
            "id": "urgent.visa_expiring_soon",
            "severity": "advisory",
            "title": T("הוויזה פגה בקרוב", "Your visa expires soon"),
            "consequence": T("כדאי לחדש במקביל", "Worth renewing in parallel"),
            "action": T("לחדש במשרד הפנים", "Renew at the Population Authority"),
        }
    ],
    "roadmap": [
        {
            "step": {"id": "cv.doc_89", "title": T("להוציא טופס 89", "Get form 89")},
            "state": "do_now",
            "documents": [{"id": "doc.passport", "name": T("דרכון", "Passport")}],
        },
        {
            "step": {"id": "cv.book_appointment", "title": T("לקבוע תור", "Book an appointment")},
            "state": "waiting_on",
            "documents": [{"id": "doc.form_89", "name": T("טופס 89", "Form 89")}],
        },
    ],
    "clocks": [
        {
            "clock": {"id": "clock.conversion_window", "name": T("חלון ההמרה", "Conversion window")},
            "status": "running",
            "deadline": "2027-03-01",
            "days_left": 98,
        }
    ],
    "readiness": {
        "verdict": "gaps",
        "headline": T("חסר לך טופס 89", "You are missing form 89"),
        "ready": [{"id": "doc.passport", "title": T("דרכון", "Passport")}],
        "mismatched": [],
        "missing": [{"id": "doc.form_89", "title": T("טופס 89", "Form 89")}],
        "unconfirmed": [],
        "first_action": {
            "step_id": "cv.doc_89",
            "title": T("להוציא טופס 89", "Get form 89"),
            "action": T("לפנות למשרד הפנים", "Go to the Population Authority"),
            "why": T("בלעדיו אין תור", "No appointment without it"),
        },
        "steps_done": 0,
        "steps_total": 2,
    },
    "standing_conditions": [{"id": "cc.visa_valid", "name": T("ויזה בתוקף", "Valid visa")}],
}

# What road_item_ids(FAKE_ROAD) must come to. case_allowed_ids adds his visa
# profile, his category rule and the about items on top (Amendment 2).
FAKE_ROAD_IDS = {
    "step:cv.doc_89",
    "step:cv.book_appointment",
    "document:doc.passport",
    "document:doc.form_89",
    "clock:clock.conversion_window",
    "condition:cc.visa_valid",
}


def item(id_: str, general: bool = False, citation: str = "נוהל המרת רישיון זר") -> dict:
    kind, engine_id = id_.split(":", 1)
    return {
        "id": id_,
        "kind": kind,
        "engine_id": engine_id,
        "general": general,
        "title": T(f"כותרת {engine_id}", f"Title {engine_id}"),
        "text": T(f"טקסט {engine_id}", f"Text {engine_id}"),
        "applies_when_text": "conversion route",
        "sources": [
            {
                "citation": f"{citation} ({engine_id})",
                "quote": "...",
                "url": "https://www.gov.il/example",
                "last_verified_at": "2026-11-01",
                "certainty": "verified",
            }
        ],
        "links": [],
    }


def hit(id_: str, similarity: float = 0.7, general: bool = False, keyword_rank: float = 0.0) -> Hit:
    # The real Hit from app.search (Amendment 5), so a change to it breaks these tests.
    return Hit(id_, item(id_, general), similarity, keyword_rank)


DEFAULT_HITS = [hit("document:doc.form_89", 0.72), hit("step:cv.doc_89", 0.65)]


class Recorder:
    """Builds a Deps whose every function records its calls."""

    def __init__(
        self,
        *,
        quota=None,
        quota_consume=None,
        road=None,
        hits=None,
        rewrite=None,
        answer=None,
        answer_raises: Exception | None = None,
        rewrite_raises: Exception | None = None,
        search_raises: Exception | None = None,
        road_raises: Exception | None = None,
    ):
        self.calls: dict[str, list] = {"quota": [], "get_road": [], "search": [], "rewrite": [], "answer": []}
        self._quota = quota or {"status": "ok", "allowed": True, "left": 19}
        # What the count (consume=True) says, when a test wants it to differ
        # from the peek (consume=False). Default: the same answer.
        self._quota_consume = quota_consume
        self._road = road if road is not None else FAKE_ROAD
        self._hits = hits if hits is not None else DEFAULT_HITS
        self._rewrite = rewrite or {"rewritten": "official wording", "other_person": False, "off_topic": False}
        self._answer = answer or json.dumps(
            {"status": "answered", "answer": "Form 89 comes from the Population Authority.", "used_ids": ["document:doc.form_89"]}
        )
        self._answer_raises = answer_raises
        self._rewrite_raises = rewrite_raises
        self._search_raises = search_raises
        self._road_raises = road_raises

    def quota(self, token, consume=True):
        self.calls["quota"].append((token, consume))
        if consume and self._quota_consume is not None:
            return self._quota_consume
        return self._quota

    def get_road(self, profile, today=None):
        self.calls["get_road"].append((profile, today))
        if self._road_raises:
            raise self._road_raises
        return self._road

    def search(self, question, rewritten, allowed_ids, include_general, k=6):
        self.calls["search"].append(
            {"question": question, "rewritten": rewritten, "allowed_ids": list(allowed_ids), "include_general": include_general, "k": k}
        )
        if self._search_raises:
            raise self._search_raises
        return self._hits

    def rewrite(self, question, lang, history):
        self.calls["rewrite"].append({"question": question, "lang": lang, "history": history})
        if self._rewrite_raises:
            raise self._rewrite_raises
        return self._rewrite

    def answer(self, system, messages):
        self.calls["answer"].append({"system": system, "messages": messages})
        if self._answer_raises:
            raise self._answer_raises
        return self._answer

    def deps(self) -> Deps:
        return Deps(quota=self.quota, get_road=self.get_road, search=self.search, rewrite=self.rewrite, answer=self.answer)

    def everything_sent_out(self) -> str:
        """Every string that left 'the server' to Claude or search, as one blob."""
        return json.dumps(
            {k: v for k, v in self.calls.items() if k in ("search", "rewrite", "answer")}, ensure_ascii=False
        )


# A fuller conversion road, used by the prompt-case tests (free and live).
# Every id here exists in app/data/items.json. Titles are kept short; the
# items themselves carry the real text.
CONVERSION_ROAD = {
    **FAKE_ROAD,
    "roadmap": [
        {"step": {"id": "cv.doc_89", "title": T("להוציא טופס 89", "Get form 89")}, "state": "do_now",
         "documents": [{"id": "doc.passport"}, {"id": "doc.visa"}]},
        {"step": {"id": "cv.translation", "title": T("תרגום הרישיון", "Translate the licence")}, "state": "do_now",
         "documents": [{"id": "doc.translation"}, {"id": "doc.foreign_license"}]},
        {"step": {"id": "cv.eye_test", "title": T("בדיקת ראייה", "Eye test")}, "state": "do_now", "documents": []},
        {"step": {"id": "cv.book_appointment", "title": T("לקבוע תור", "Book an appointment")}, "state": "waiting_on",
         "documents": [{"id": "doc.form_89"}]},
        {"step": {"id": "cv.attend", "title": T("להגיע ללשכה", "Attend the office")}, "state": "later", "documents": []},
        {"step": {"id": "cv.control_test", "title": T("מבחן שליטה", "Control test")}, "state": "uncertain", "documents": []},
    ],
}
