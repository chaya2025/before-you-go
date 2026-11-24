"""
The whole flow in app/answer.py, with every outside call faked (answer_fakes.py).
Each test is one promise from the plan / CONTRACT.md.
"""
import json

import httpx

from answer_fakes import FAKE_ROAD, FAKE_ROAD_IDS, Recorder, hit
from app.answer import OFF_TOPIC_MIN_SIMILARITY, AskRequest, ask
from app.road import road_item_ids

TOKEN = "user-token"
PASSPORT = "P12345678"


def case(question="Where do I get form 89?", **kw) -> AskRequest:
    return AskRequest(question=question, lang=kw.pop("lang", "en"), mode="case", profile={"x": 1}, **kw)


def general(question="What is BeforeYouGo?", **kw) -> AskRequest:
    return AskRequest(question=question, lang=kw.pop("lang", "en"), mode="general", **kw)


# ---- the happy path ---------------------------------------------------------

def test_answered_with_sources_from_the_used_items():
    r = Recorder()
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "answered"
    assert out["answer"].startswith("Form 89")
    assert out["sources"] == [
        {"citation": "נוהל המרת רישיון זר (doc.form_89)", "url": "https://www.gov.il/example", "last_verified_at": "2026-11-01"}
    ]
    # quota: peeked first, counted once, after the answer (finding 14)
    assert r.calls["quota"] == [(TOKEN, False), (TOKEN, True)]


def test_case_mode_searches_only_his_road():
    r = Recorder()
    ask(case(), TOKEN, r.deps())
    allowed = set(r.calls["search"][0]["allowed_ids"])
    assert FAKE_ROAD_IDS <= allowed
    # nothing from another route (fz.*) or another visa type
    assert not any(a.startswith("step:fz.") or a.startswith("visa_profile:a") for a in allowed)


def test_road_item_ids_cover_every_kind():
    blocked = dict(FAKE_ROAD, blocked={"blocker": {"id": "block.section_2a5"}})
    assert set(road_item_ids(FAKE_ROAD)) == FAKE_ROAD_IDS
    assert "blocker:block.section_2a5" in road_item_ids(blocked)


# ---- privacy: a passport number never leaves --------------------------------

def test_passport_number_never_reaches_claude_or_search():
    r = Recorder()
    req = case(
        f"my passport {PASSPORT} expired, and my id 123456782?",
        history=[{"role": "user", "text": f"earlier I said {PASSPORT}"}, {"role": "assistant", "text": "ok"}],
    )
    ask(req, TOKEN, r.deps())
    sent = r.everything_sent_out()
    assert r.calls["search"] and r.calls["rewrite"] and r.calls["answer"]  # all three really ran
    assert PASSPORT not in sent
    assert "123456782" not in sent


# ---- off-topic (D-220) ------------------------------------------------------

def test_off_topic_without_strong_hit_is_not_sure_and_never_calls_answer():
    r = Recorder(
        rewrite={"rewritten": "pasta recipe", "other_person": False, "off_topic": True},
        hits=[hit("step:cv.doc_89", similarity=OFF_TOPIC_MIN_SIMILARITY - 0.1)],
    )
    out = ask(case("how do I cook pasta?"), TOKEN, r.deps())
    assert out["status"] == "not_sure"
    assert r.calls["answer"] == []
    assert out["sources"] == []
    assert "02-6663050" in out["answer"]


def test_off_topic_flag_but_a_strong_hit_still_goes_to_claude():
    # D-220: "what if the answer is really there but it doesn't realize that?"
    r = Recorder(
        rewrite={"rewritten": "x", "other_person": False, "off_topic": True},
        hits=[hit("document:doc.form_89", similarity=OFF_TOPIC_MIN_SIMILARITY + 0.01)],
    )
    out = ask(case("weird wording about 89"), TOKEN, r.deps())
    assert len(r.calls["answer"]) == 1
    assert out["status"] == "answered"


def test_off_topic_flag_with_a_keyword_hit_still_goes_to_claude():
    r = Recorder(
        rewrite={"rewritten": "x", "other_person": False, "off_topic": True},
        hits=[hit("document:doc.form_89", similarity=0.05, keyword_rank=0.3)],
    )
    ask(case("89?"), TOKEN, r.deps())
    assert len(r.calls["answer"]) == 1


def test_low_similarity_alone_never_blocks_an_on_topic_question():
    r = Recorder(hits=[hit("document:doc.form_89", similarity=0.05)])
    ask(case("borderline question"), TOKEN, r.deps())
    assert len(r.calls["answer"]) == 1


def test_no_hits_at_all_is_not_sure_without_answer_call():
    r = Recorder(hits=[])
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "not_sure"
    assert r.calls["answer"] == []


# ---- someone else's case (D-226) --------------------------------------------

def test_other_person_never_uses_his_items():
    r = Recorder(rewrite={"rewritten": "wife licence", "other_person": True, "off_topic": False})
    out = ask(case("Can my wife convert her licence too?"), TOKEN, r.deps())
    assert out["status"] == "other_person"
    assert out["sources"] == []
    assert r.calls["search"] == []
    assert r.calls["answer"] == []
    assert r.calls["get_road"] == []
    assert "BeforeYouGo" in out["answer"]


def test_other_person_answer_is_in_hebrew_for_a_hebrew_question():
    r = Recorder(rewrite={"rewritten": "x", "other_person": True, "off_topic": False})
    out = ask(case("אשתי יכולה להמיר?", lang="en"), TOKEN, r.deps())
    assert any("֐" <= ch <= "׿" for ch in out["answer"])


def test_claude_saying_other_person_gets_the_fixed_reply_and_no_sources():
    r = Recorder(answer=json.dumps({"status": "other_person", "answer": "anything", "used_ids": ["document:doc.form_89"]}))
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "other_person"
    assert out["sources"] == []


# ---- Claude's output is checked, never trusted -------------------------------

def test_invented_id_is_dropped_from_sources():
    r = Recorder(
        answer=json.dumps(
            {"status": "answered", "answer": "ok", "used_ids": ["document:doc.form_89", "document:made_up_rule"]}
        )
    )
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "answered"
    assert [s["citation"] for s in out["sources"]] == ["נוהל המרת רישיון זר (doc.form_89)"]


def test_only_invented_ids_means_not_sure():
    r = Recorder(answer=json.dumps({"status": "answered", "answer": "trust me", "used_ids": ["document:made_up_rule"]}))
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "not_sure"
    assert out["sources"] == []
    assert "trust me" not in out["answer"]


def test_unparsable_answer_means_not_sure():
    r = Recorder(answer="Sure! Form 89 is easy.")
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "not_sure"


def test_not_sure_from_claude_always_carries_the_office_phone():
    r = Recorder(answer=json.dumps({"status": "not_sure", "answer": "The items do not say.", "used_ids": []}))
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "not_sure"
    assert "02-6663050" in out["answer"] and "*4515" in out["answer"]


# ---- failures: always "unavailable", always calm ------------------------------

def test_claude_down_is_unavailable():
    r = Recorder(answer_raises=RuntimeError("anthropic 529 overloaded"))
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "unavailable"
    assert "529" not in out["answer"]


def test_rewrite_down_is_unavailable():
    out = ask(case(), TOKEN, Recorder(rewrite_raises=RuntimeError("boom")).deps())
    assert out["status"] == "unavailable"


def test_search_down_is_unavailable():
    out = ask(case(), TOKEN, Recorder(search_raises=httpx.ConnectError("voyage down")).deps())
    assert out["status"] == "unavailable"


def test_ts_api_down_is_unavailable():
    out = ask(case(), TOKEN, Recorder(road_raises=httpx.ConnectError("api down")).deps())
    assert out["status"] == "unavailable"


def test_quota_unavailable_is_unavailable():
    out = ask(case(), TOKEN, Recorder(quota={"status": "unavailable"}).deps())
    assert out["status"] == "unavailable"


# ---- login and limit (D-222) ---------------------------------------------------

def test_no_login():
    r = Recorder(quota={"status": "no_login"})
    out = ask(case(), None, r.deps())
    assert out["status"] == "no_login"
    assert r.calls["rewrite"] == [] and r.calls["answer"] == []


def test_over_limit():
    r = Recorder(quota={"status": "ok", "allowed": False, "left": 0})
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "limit"
    assert r.calls["rewrite"] == [] and r.calls["answer"] == []


# ---- general mode (D-228) --------------------------------------------------------

def test_general_mode_never_calls_get_road_and_drops_unknown_non_general_hits():
    # Finding 8 changed general mode: every real step/document/clock is
    # allowed (labelled with its route). A non-general id that is NOT a real
    # item (here "step:made_up") is still refused.
    from app.answer import general_allowed_ids

    r = Recorder(
        hits=[hit("about:what_is_byg", general=True), hit("step:cv.doc_89"), hit("step:made_up")],
        answer=json.dumps(
            {"status": "answered", "answer": "BeforeYouGo builds your road.", "used_ids": ["about:what_is_byg", "step:made_up"]}
        ),
    )
    out = ask(general(), TOKEN, r.deps())
    assert r.calls["get_road"] == []
    s = r.calls["search"][0]
    assert s["allowed_ids"] == general_allowed_ids() and s["include_general"] is True
    sent = json.dumps(r.calls["answer"], ensure_ascii=False)
    assert "step:cv.doc_89" in sent
    assert "step:made_up" not in sent
    assert [x["citation"] for x in out["sources"]] == ["נוהל המרת רישיון זר (what_is_byg)"]


def test_case_mode_drops_hits_outside_his_road():
    # search is the other agent's code; we still refuse any hit that is neither
    # on his road nor general. Belt and braces.
    r = Recorder(hits=[hit("document:doc.form_89"), hit("step:fz.theory", general=False)])
    ask(case(), TOKEN, r.deps())
    assert "fz.theory" not in json.dumps(r.calls["answer"], ensure_ascii=False)


# ---- "ask about this step" (D-227) -----------------------------------------------

def test_step_id_reaches_the_prompt():
    r = Recorder()
    ask(case(step_id="cv.book_appointment"), TOKEN, r.deps())
    user_text = json.dumps(r.calls["answer"][0]["messages"], ensure_ascii=False)
    assert "<focus_step>" in user_text
    assert "step:cv.book_appointment" in user_text


def test_step_id_not_on_his_road_is_ignored():
    r = Recorder()
    ask(case(step_id="fz.theory"), TOKEN, r.deps())
    user_text = json.dumps(r.calls["answer"][0]["messages"], ensure_ascii=False)
    assert "<focus_step>" not in user_text


# ---- history ---------------------------------------------------------------------

def test_history_is_capped_at_six_turns():
    r = Recorder()
    hist = [{"role": "user" if i % 2 == 0 else "assistant", "text": f"turn {i}"} for i in range(10)]
    ask(case(history=hist), TOKEN, r.deps())
    sent = r.calls["rewrite"][0]["history"]
    assert len(sent) == 6 and sent[-1]["text"] == "turn 9"


# ---- contract amendments (2026-11-23) ----------------------------------------------

from app.answer import ABOUT_IDS, MAX_TURN_CHARS  # noqa: E402
from app.embed import EmbedUnavailable, MissingKey  # noqa: E402
from app.search import SearchUnavailable  # noqa: E402
import pytest  # noqa: E402


def test_case_mode_allows_his_visa_profile_category_rule_and_about_items_only():
    r = Recorder()
    ask(case(), TOKEN, r.deps())
    s = r.calls["search"][0]
    allowed = set(s["allowed_ids"])
    assert s["include_general"] is False
    assert allowed == FAKE_ROAD_IDS | {"visa_profile:b1", "category_rule:toshav_medinat_chutz"} | set(ABOUT_IDS)
    assert "about:how_to_start" in allowed


def test_another_visa_profile_never_reaches_claude_in_case_mode():
    # Even if search leaked another visa type's profile (general=True in items.json).
    r = Recorder(hits=[hit("document:doc.form_89"), hit("visa_profile:a1", general=True), hit("category_rule:oleh_chadash", general=True)])
    ask(case(), TOKEN, r.deps())
    sent = json.dumps(r.calls["answer"], ensure_ascii=False)
    assert "visa_profile:a1" not in sent and "oleh_chadash" not in sent


def test_source_falls_back_to_claim_when_no_citation():
    h = hit("document:doc.form_89")
    h.payload["sources"] = [{"claim": "Form 89 is issued by the Population Authority", "url": None, "last_verified_at": "2026-10-01"}]
    out = ask(case(), TOKEN, Recorder(hits=[h]).deps())
    assert out["sources"] == [{"citation": "Form 89 is issued by the Population Authority", "url": None, "last_verified_at": "2026-10-01"}]


@pytest.mark.parametrize("exc", [EmbedUnavailable("voyage 503"), SearchUnavailable("db down"), MissingKey("VOYAGE_API_KEY")])
def test_search_side_failures_are_unavailable(exc):
    r = Recorder(search_raises=exc)
    out = ask(case(), TOKEN, r.deps())
    assert out["status"] == "unavailable"
    assert r.calls["answer"] == []


def test_general_mode_prompt_tells_claude_to_name_the_route():
    r = Recorder(hits=[hit("step:fz.theory", general=True), hit("step:cv.eye_test", general=True)])
    ask(general("what is the eye test?"), TOKEN, r.deps())
    call = r.calls["answer"][0]
    assert "MODE: general" in call["messages"][0]["content"]
    assert "<road>" not in call["messages"][0]["content"]
    assert "name its route" in call["system"]


def test_a_history_turn_at_the_cap_passes_whole():
    # Over the cap is now refused with 422 (finding 13, test_review_fixes).
    r = Recorder()
    ask(case(history=[{"role": "user", "text": "x" * MAX_TURN_CHARS}]), TOKEN, r.deps())
    assert len(r.calls["rewrite"][0]["history"][0]["text"]) == MAX_TURN_CHARS


# ── D-237: small talk ("thanks", "hi") gets a short warm line we wrote ──────


def test_thanks_gets_our_warm_line_free_with_no_search_or_answer_call():
    r = Recorder(rewrite={"rewritten": "", "other_person": False, "off_topic": False, "small_talk": "thanks"})
    out = ask(case("אחלה תודה"), TOKEN, r.deps())
    assert out["status"] == "answered"
    assert out["answer"].startswith("בשמחה")
    assert out["sources"] == []
    assert r.calls["search"] == [] and r.calls["answer"] == [] and r.calls["get_road"] == []
    # Only the peek ran: small talk never spends one of his 20 questions.
    assert all(consume is False for _, consume in r.calls["quota"])
    assert "_free" not in out


def test_a_question_with_thanks_is_still_a_question():
    r = Recorder(rewrite={"rewritten": "fee", "other_person": False, "off_topic": False, "small_talk": "none"})
    ask(case("thanks, and how much does it cost?"), TOKEN, r.deps())
    assert r.calls["answer"] != []
    assert any(consume is True for _, consume in r.calls["quota"])


def test_an_unknown_small_talk_label_is_treated_as_a_question():
    r = Recorder(rewrite={"rewritten": "x", "other_person": False, "off_topic": False, "small_talk": "joke"})
    ask(case("tell me a joke"), TOKEN, r.deps())
    assert r.calls["search"] != []
