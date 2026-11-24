"""
============================================================================
THE FLOW: ask(request, token, deps) -> response
============================================================================

One question, start to finish (CONTRACT.md section 3, "The flow"):

  1. login + daily limit     no token -> no_login. PEEK at the count
                             (consume=false): over 20 -> limit, nothing spent
  2. strip_ids               passport/ID/phone numbers cut from question + history
  3. rewrite + classify      small Claude call (Haiku): official wording,
                             other_person?, off_topic?
  4. other_person            fixed warm reply. His road and items are never
                             touched, so they cannot leak into it.
  5. which items he may see  case: his road's ids (+ his own visa profile,
                             category rule, and the "about" items)
                             general: every step, document and clock (each
                             labelled with its route) + items marked general
  6. search                  original + rewritten question (Voyage + pgvector)
  7. off-topic gate (D-220)  ONLY if the classifier said off_topic AND no hit
                             is strong -> not_sure, Claude's answer call is
                             never made
  8. answer call             Claude Sonnet with SYSTEM_PROMPT, returns JSON.
                             In case mode each item is the version the engine
                             filtered for him (no lines meant for others).
  9. check the JSON          sources are built from OUR items, from the ids
                             Claude used that were really in the hits. An id
                             Claude made up is dropped. not_sure is always our
                             fixed reply. A promise or an eligibility verdict
                             in the answer turns it into not_sure.
 10. count the question      consume=true, only now that he gets a real reply.

Nothing is stored. The question text is never logged. Any failure of an
outside service becomes status "unavailable" (never a stack trace), and an
"unavailable" never uses up one of his 20 questions.

WHY `Deps`: every outside call (Supabase, the TS API, Voyage, Claude) is one
function in this small bundle. The real server passes the real functions;
tests pass fakes that record calls. That is how a test can PROVE "the answer
call was never made" without spending a cent.
"""

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field, field_validator

from app import budget, prompt
from app.knowledge import cached_items
from app.privacy import strip_ids
from app.road import his_view, road_item_ids, road_summary, step_title

log = logging.getLogger("byg.assistant")

ANSWER_MODEL = "claude-sonnet-5-5"
REWRITE_MODEL = "claude-haiku-5-5"

# D-220: the gate that skips the answer call. It needs BOTH the classifier's
# off_topic flag AND every hit below this similarity with no keyword match.
# So a borderline question ("something about 89?") still reaches Claude, and
# Claude decides whether the items answer it. Tuned on the REAL index with
# tests/live/test_retrieval.py (2026-11-23, voyage-3.5, 80 items):
#   off-topic questions, best similarity:   0.226 to 0.360
#   on-topic questions, best similarity:    0.449 to 0.732 (lowest: "where do
#                                           I get photographed", Hebrew)
# 0.40 sits in the gap, ~0.04 clear of each side. 0.35 (the first guess) let
# the shakshuka question through at 0.360. And the gate only ever acts when
# the classifier ALSO said off_topic, so a real question near 0.40 still
# reaches Claude unless Haiku misreads it too.
OFF_TOPIC_MIN_SIMILARITY = 0.40

# ts_rank never returns exactly 0: a row with NO keyword match still gets a
# floor of about 1e-20 (and partial word overlap gets a real-looking score,
# which search.really_matches zeroes). Until migration 20261123130000 is
# applied, "> 0" would count every row as a keyword match and the gate above
# would never fire. Anything at or below this is "no keyword match".
KEYWORD_MATCH_MIN = 1e-6

MAX_QUESTION_CHARS = 800  # the web caps at 800 too
MAX_HISTORY_ITEMS = 12  # more than this in one request is refused (422)
MAX_HISTORY_TURNS = 6  # of what is accepted, only the last 6 are used
MAX_TURN_CHARS = 800
MAX_PROFILE_BYTES = 20_000  # a real profile is ~1KB; anything near 20KB is junk

# ─────────────────────────────────────────────────────────────────────────────
# Request / response shapes (CONTRACT.md "HTTP")
# ─────────────────────────────────────────────────────────────────────────────


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    # max_length: FastAPI answers 422 before any of our code runs.
    text: str = Field(max_length=MAX_TURN_CHARS)


class AskRequest(BaseModel):
    # max_length makes FastAPI answer 422 before any of our code runs, so an
    # over-long question can never reach Claude.
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    lang: Literal["he", "en"] = "he"
    mode: Literal["case", "general"] = "case"
    profile: dict[str, Any] | None = None
    today: str | None = None
    step_id: str | None = None
    history: list[Turn] = Field(default_factory=list, max_length=MAX_HISTORY_ITEMS)

    @field_validator("profile")
    @classmethod
    def _profile_not_huge(cls, v: dict | None) -> dict | None:
        # WHY: the profile is forwarded to the TS API. A 5MB body would cost
        # us time and memory for nothing. The message names no value, so a
        # 422 never echoes what he sent.
        if v is not None and len(json.dumps(v, ensure_ascii=False).encode("utf-8")) > MAX_PROFILE_BYTES:
            raise ValueError("profile too large")
        return v


Status = Literal["answered", "not_sure", "other_person", "limit", "unavailable", "no_login"]


@dataclass
class Deps:
    quota: Callable[..., dict]  # (token, consume) -> {"status", "allowed", "left"}
    get_road: Callable[..., dict]  # (profile, today) -> engine Result
    search: Callable[..., list]  # (question, rewritten, allowed_ids, include_general, k) -> [Hit]
    rewrite: Callable[..., dict]  # (question, lang, history) -> {"rewritten", "other_person", "off_topic"}
    answer: Callable[..., str]  # (system, messages) -> raw JSON text from Claude


def _reply(status: Status, lang: str, answer: str | None = None, sources: list | None = None) -> dict:
    return {
        "status": status,
        "answer": answer if answer is not None else prompt.fixed(status, lang),
        "sources": sources or [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# His profile: the document fields go to the engine and nowhere else
# ─────────────────────────────────────────────────────────────────────────────

# The numbers and names printed on his documents (packages/engine/src/profile.ts).
# The engine needs them to notice a mismatch (the renewed-passport trap), so
# get_road receives the profile as sent. Nothing else in this service may see
# them: not Claude, not Voyage, not a log.
ROAD_ONLY_FIELDS = (
    "form_89_number",
    "form_89_passport_number",
    "passport_number",
    "passport_name_latin",
    "form_89_name_latin",
)


def public_profile(profile: dict | None) -> dict:
    """The profile without the document numbers and names."""
    return {k: v for k, v in (profile or {}).items() if k not in ROAD_ONLY_FIELDS}


# ─────────────────────────────────────────────────────────────────────────────
# Hits: read the real Hit dataclass from app.search (or a plain dict in a test)
# ─────────────────────────────────────────────────────────────────────────────


def _get(h: Any, name: str, default: Any = None) -> Any:
    return h.get(name, default) if isinstance(h, dict) else getattr(h, name, default)


# ─────────────────────────────────────────────────────────────────────────────
# Which items he may see
# ─────────────────────────────────────────────────────────────────────────────

# Fallback if items.json is missing in a deploy: the four about items today.
_ABOUT_FALLBACK = ["about:what_it_is", "about:not_government", "about:what_you_get", "about:how_to_start"]


def _about_ids() -> list[str]:
    """The "about BeforeYouGo" item ids, read from the generated items.json."""
    ids = [i["id"] for i in cached_items() if i.get("kind") == "about"]
    return ids or _ABOUT_FALLBACK


ABOUT_IDS = _about_ids()


def general_allowed_ids() -> list[str]:
    """General mode (finding 8): every step, document and clock, of both routes.

    WHY: "what is the control test?" before he has a road is a fair question,
    and the control test is not marked general (it applies to some people
    only). Each item reaches Claude labelled with its route and applies_when,
    and the prompt forbids saying it applies to him. Visa profiles, category
    rules, about items and always-true conditions come in as `general`.
    """
    return [i["id"] for i in cached_items() if i.get("kind") in ("step", "document", "clock")]


def case_allowed_ids(result: dict) -> list[str]:
    """Case mode (Amendment 2): his road + HIS visa profile + HIS category rule + about items.

    Visa profiles and category rules are marked general in items.json, so with
    include_general=false only the two that are his get in. Another visa
    type's rules can never be searched in case mode.
    """
    ids = road_item_ids(result)
    visa = (result.get("facts") or {}).get("visa_type")
    if visa and visa != "unknown":
        ids.append(f"visa_profile:{visa}")
    cat = (result.get("diagnosis") or {}).get("nohal_category")
    if cat and cat != "unknown":
        ids.append(f"category_rule:{cat}")
    ids.extend(ABOUT_IDS)
    return list(dict.fromkeys(ids))


# ─────────────────────────────────────────────────────────────────────────────
# Checking what Claude returned
# ─────────────────────────────────────────────────────────────────────────────


def _parse_answer(raw: str) -> dict | None:
    """Validate Claude's JSON. Anything off -> None (the caller says not_sure)."""
    try:
        text = raw.strip()
        # Tolerate a ```json fence even though the schema should prevent it.
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        data = json.loads(text)
    except (ValueError, AttributeError):
        return None
    if not isinstance(data, dict):
        return None
    status = data.get("status")
    answer = data.get("answer")
    used = data.get("used_ids", [])
    if status not in ("answered", "not_sure", "other_person"):
        return None
    if not isinstance(answer, str) or not answer.strip():
        return None
    if not isinstance(used, list) or not all(isinstance(u, str) for u in used):
        return None
    return {"status": status, "answer": answer.strip(), "used_ids": used}


def _sources(used_ids: list[str], hits_by_id: dict[str, Any]) -> list[dict]:
    """Sources come from OUR items, never from Claude's text (CONTRACT step 7)."""
    out: list[dict] = []
    seen: set[tuple] = set()
    for item_id in used_ids:
        payload = _get(hits_by_id[item_id], "payload") or {}
        for s in payload.get("sources") or []:
            citation = s.get("citation") or s.get("claim")  # Amendment 1
            key = (citation, s.get("url"))
            if not citation or key in seen:
                continue
            seen.add(key)
            out.append({"citation": citation, "url": s.get("url"), "last_verified_at": s.get("last_verified_at")})
    return out


# The runtime guard (finding 6). The prompt already forbids these; this is the
# check that does not depend on Claude obeying. A match turns the whole answer
# into the fixed not_sure: we never try to "fix" a sentence, we drop it.
_FORBIDDEN = (
    # en: an eligibility verdict
    "not eligible", "ineligible", "you cannot get a licence", "you can't get a licence",
    "you will be rejected", "you'll be rejected",
    # en: a promise
    "you will pass", "you'll pass", "you will fail", "you'll fail", "guaranteed", "guarantee",
    "you are all set", "you're all set", "will be approved", "no problem",
    # he: an eligibility verdict
    "אינך זכאי", "לא זכאי", "אינו זכאי", "אין לך זכאות",
    # he: a promise
    "תעבור בטוח", "בטוח תעבור", "בטוח שתעבור", "מובטח", "תעבור את המבחן", "אין בעיה",
)
# Safe, negated or open phrasing that contains a forbidden piece. Removed
# BEFORE the check, so "it is not guaranteed" or "whether you will pass"
# (both what we WANT Claude to say) are not mistaken for a promise.
_SAFE = (
    re.compile(r"\b(?:not|no|nothing(?: here)?(?: is)?|never|cannot|can't|isn't|is not)\s+(?:be\s+)?guarantee\w*"),
    re.compile(r"\b(?:whether|if)\s+you(?:\s+will|'ll)\s+pass"),
    re.compile(r"\b(?:whether|if)\s+you(?:\s+are|'re)\s+(?:not\s+)?eligible"),
    re.compile(r"(?:לא|אינו|אינה|אין)\s+מובטח\w*"),
    re.compile(r"אין\s+הבטחה"),
    re.compile(r"האם\s+תעבור"),
)


def breaks_the_rules(answer: str) -> bool:
    """True when the answer promises an outcome or judges eligibility."""
    text = answer.lower().replace("’", "'")
    for safe in _SAFE:
        text = safe.sub(" ", text)
    return any(bad in text for bad in _FORBIDDEN)


# ─────────────────────────────────────────────────────────────────────────────
# The flow
# ─────────────────────────────────────────────────────────────────────────────


def _quota_status(q: dict, lang: str) -> dict | None:
    """None when he may go on; otherwise the reply to send instead."""
    if q.get("status") == "no_login":
        return _reply("no_login", lang)
    if q.get("status") != "ok":
        return _reply("unavailable", lang)
    if not q.get("allowed"):
        return _reply("limit", lang)
    return None


def ask(req: AskRequest, token: str | None, deps: Deps) -> dict:
    lang = prompt.question_lang(req.question, req.lang)
    # One clock for the whole question (budget.py): every outside call below
    # gets at most what is left of it.
    budget.start()

    # 1. Login + limit. No token -> stop before anything is counted or sent.
    if not token:
        return _reply("no_login", lang)
    try:
        # PEEK only (finding 14): if Claude or Voyage is down, he must not
        # lose one of his 20 questions for an "unavailable".
        stop = _quota_status(deps.quota(token, False), lang)
    except Exception:  # noqa: BLE001  a quota bug must not become a 500
        return _reply("unavailable", lang)
    if stop:
        return stop

    try:
        reply = _answer(req, lang, deps)
        # D-237: small talk is free. It never reaches the counter.
        if reply.pop("_free", False):
            return reply
    except Exception as e:  # noqa: BLE001
        # Claude / Voyage (MissingKey, EmbedUnavailable) / Supabase
        # (SearchUnavailable) / the TS API / out of time / a bug: all the
        # same to him. Only the error's TYPE is logged: never the question,
        # never the message (it could hold a URL with a key, or his text).
        log.warning("ask failed: %s", type(e).__name__)
        return _reply("unavailable", lang)

    # 10. Count it, now that he gets a real reply. WHY here and not before
    # the answer call: counting first would charge him for an "unavailable"
    # when Claude fails. The cost: two tabs both at question 19 can both
    # reach Claude, and the second one then gets "limit" instead of the
    # answer (the counter itself is atomic, so he never gets past 20).
    try:
        stop = _quota_status(deps.quota(token, True), lang)
    except Exception:  # noqa: BLE001
        return _reply("unavailable", lang)
    return stop or reply


def _answer(req: AskRequest, lang: str, deps: Deps) -> dict:
    # 2. Privacy first. From here on only the cleaned text exists.
    question = strip_ids(req.question)
    history = [
        {"role": t.role, "text": strip_ids(t.text[:MAX_TURN_CHARS])} for t in req.history[-MAX_HISTORY_TURNS:]
    ]

    # 3. Rewrite + classify. The rewrite is Claude's text built from his
    # words, so it is cleaned too before it goes to Voyage (finding 16).
    rw = deps.rewrite(question, lang, history)
    rewritten = strip_ids(str(rw.get("rewritten") or "")) or None

    # 3b. Not a question at all ("thanks", "hi"): a short warm line we wrote,
    # no search, no answer call, no sources, and it is not counted (D-237).
    kind = rw.get("small_talk")
    if kind in prompt.SMALL_TALK:
        return {**_reply("answered", lang, prompt.small_talk(kind, lang), []), "_free": True}

    # 4. Someone else's case: a fixed reply. Done BEFORE the road is fetched,
    # so his items cannot end up in it, and it costs no answer call.
    if rw.get("other_person"):
        return _reply("other_person", lang)

    # 5. What he may see. A case question with no profile is answered in
    # general mode: we cannot invent a road for him. The profile goes to
    # get_road as sent (the engine compares his document numbers); nothing
    # else here ever reads it.
    has_profile = bool(public_profile(req.profile))
    mode = req.mode if (req.mode == "general" or has_profile) else "general"
    result: dict | None = None
    if mode == "case":
        result = deps.get_road(req.profile, req.today)
        allowed, include_general = case_allowed_ids(result), False
    else:
        allowed, include_general = general_allowed_ids(), True

    # 6. Search.
    hits = deps.search(question, rewritten, allowed, include_general, k=6)

    # Belt and braces: whatever search returned, keep only what he may see.
    allowed_set = set(allowed)

    def permitted(h: Any) -> bool:
        if _get(h, "id") in allowed_set:
            return True
        return include_general and bool((_get(h, "payload") or {}).get("general"))

    hits = [h for h in hits if permitted(h)]

    if not hits:
        return _reply("not_sure", lang)

    # 7. Off-topic gate (D-220).
    if rw.get("off_topic"):
        strong = any(
            (_get(h, "similarity") or 0) >= OFF_TOPIC_MIN_SIMILARITY
            or (_get(h, "keyword_rank") or 0) > KEYWORD_MATCH_MIN
            for h in hits
        )
        if not strong:
            return _reply("not_sure", lang)

    # 8. The answer call. In case mode each item is rendered with the
    # engine's own filtered version for him (finding 1).
    hits_by_id = {_get(h, "id"): h for h in hits}
    items = [
        prompt.render_item(
            i,
            _get(h, "payload") or {},
            lang,
            mode=mode,
            his=his_view(result, i, lang) if result is not None else None,
        )
        for i, h in hits_by_id.items()
    ]
    focus = None
    if mode == "case" and req.step_id and result is not None:
        title = step_title(result, req.step_id, lang)
        if title is not None:  # only a step that is really on his road
            focus = (req.step_id, title)
    system, messages = prompt.build_messages(
        question=question,
        lang=lang,
        mode=mode,
        road_text=road_summary(result, lang) if result is not None else None,
        focus_step=focus,
        items=items,
        history=history,
    )
    parsed = _parse_answer(deps.answer(system, messages))

    # 9. Check it.
    if parsed is None:
        return _reply("not_sure", lang)
    if parsed["status"] == "other_person":
        return _reply("other_person", lang)
    if parsed["status"] == "not_sure":
        # Always OUR fixed words (finding 2): Claude's own "not sure" text
        # could still carry a guess, a wrong number or a wrong place to go.
        return _reply("not_sure", lang)

    used = [u for u in dict.fromkeys(parsed["used_ids"]) if u in hits_by_id]
    if not used:
        # "Answered" but every id it cited was invented (or none given): we
        # cannot show where a single fact came from, so we do not show it.
        return _reply("not_sure", lang)
    if breaks_the_rules(parsed["answer"]):
        # A promise or an eligibility verdict slipped past the prompt.
        log.warning("answer dropped by the rules guard")
        return _reply("not_sure", lang)
    return _reply("answered", lang, parsed["answer"], _sources(used, hits_by_id))


# ─────────────────────────────────────────────────────────────────────────────
# The real Claude calls (tests never reach these)
# ─────────────────────────────────────────────────────────────────────────────

_client = None


def _anthropic():
    """One client, created on first use. The key comes from the environment
    (main.py loads the repo-root .env) and is never printed or logged."""
    global _client
    if _client is None:
        import anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        # No retries: a retry doubles the wait, and the whole question has
        # 25 seconds (budget.py). Each call passes its own timeout below.
        _client = anthropic.Anthropic(timeout=budget.ANSWER_S, max_retries=0)
    return _client


def _text_of(response) -> str:
    if getattr(response, "stop_reason", None) == "refusal":
        return ""  # -> unparsable -> not_sure
    return "".join(b.text for b in response.content if getattr(b, "type", None) == "text")


def claude_rewrite(question: str, lang: str, history: list[dict]) -> dict:
    """Small call: official wording + the two flags. JSON is enforced by the schema."""
    system, messages = prompt.build_rewrite_messages(question, history)
    response = _anthropic().messages.create(
        model=REWRITE_MODEL,
        max_tokens=2000,
        system=system,
        messages=messages,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": prompt.REWRITE_SCHEMA}},
        timeout=budget.timeout(budget.REWRITE_S),
    )
    try:
        data = json.loads(_text_of(response))
        return {
            "rewritten": str(data.get("rewritten") or ""),
            "other_person": data.get("other_person") is True,
            "off_topic": data.get("off_topic") is True,
            "small_talk": str(data.get("small_talk") or "none"),
        }
    except ValueError:
        # A garbled rewrite is not worth failing the question over: search
        # with the original words and let the answer call judge.
        return {"rewritten": "", "other_person": False, "off_topic": False, "small_talk": "none"}


def claude_answer(system: str, messages: list[dict]) -> str:
    """The answer call. Returns Claude's raw text; ask() validates it."""
    response = _anthropic().beta.messages.create(
        model=ANSWER_MODEL,
        max_tokens=4000,
        # The system prompt is identical on every request, so it is cached.
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": prompt.ANSWER_SCHEMA}},
        # If Sonnet's safety filter declines (rare, but a question about
        # visas and status could trip it), Anthropic retries on a fallback
        # model inside the same call instead of returning nothing.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        # Keep time back so the question can still be counted afterwards.
        timeout=budget.timeout(budget.ANSWER_S, reserve=budget.COUNT_RESERVE_S),
    )
    return _text_of(response)


def real_deps() -> Deps:
    # Imported here, not at the top, so the tests (which fake search) never
    # need Voyage or Supabase settings just to import this file.
    from app.quota import check_quota
    from app.road import get_road
    from app.search import search

    return Deps(quota=check_quota, get_road=get_road, search=search, rewrite=claude_rewrite, answer=claude_answer)
