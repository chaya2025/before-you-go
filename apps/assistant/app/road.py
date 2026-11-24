"""
============================================================================
HIS ROAD: get_road, road_item_ids, road_summary
============================================================================

WHY WE FETCH THE ROAD OURSELVES. The browser could send us "his road", but
then anyone could send a made-up road and get answers about rules that do not
apply to him. So the browser sends the same PROFILE it already sends to
/api/v1/readiness, and we ask the real engine (the TS API) for the result.
The engine decides; this service only explains.

WHY road_item_ids. The knowledge base holds every rule (~90 items). Only the
ones on HIS road may be searched in case mode, so a rule for a different visa
type can never reach Claude. The ids here use the same "kind:engine_id" form
as app/data/items.json (see CONTRACT.md section 1).
"""

import os

import httpx

from app import budget


def get_road(profile: dict, today: str | None = None) -> dict:
    """POST the profile to {BYG_API_BASE}/api/v1/readiness and return the engine Result.

    Raises on any failure (no base URL, network, non-200). answer.py turns a
    raise into status "unavailable".
    """
    base = os.environ.get("BYG_API_BASE")
    if not base:
        raise RuntimeError("BYG_API_BASE is not set")
    body = dict(profile)
    if today:
        body["today"] = today
    # The TS API is our own service, so a short cap is fair (budget.ROAD_S):
    # if it has not answered by then, it is down and he gets "unavailable".
    res = httpx.post(f"{base.rstrip('/')}/api/v1/readiness", json=body, timeout=budget.timeout(budget.ROAD_S))
    res.raise_for_status()
    return res.json()


def road_item_ids(result: dict) -> list[str]:
    """Every knowledge-item id on his road: steps, documents, clocks, blocker, conditions."""
    ids: list[str] = []

    def add(kind: str, engine_id: str | None) -> None:
        if engine_id:
            ids.append(f"{kind}:{engine_id}")

    for rs in result.get("roadmap") or []:
        add("step", (rs.get("step") or {}).get("id"))
        # A step carries the documents it needs.
        for doc in rs.get("documents") or []:
            add("document", doc.get("id"))

    # Readiness item ids ARE document ids (result.ts: "The document id").
    readiness = result.get("readiness") or {}
    for bucket in ("ready", "mismatched", "missing", "unconfirmed"):
        for it in readiness.get(bucket) or []:
            add("document", it.get("id"))

    for cs in result.get("clocks") or []:
        add("clock", (cs.get("clock") or {}).get("id"))

    blocked = result.get("blocked")
    if blocked:
        add("blocker", (blocked.get("blocker") or {}).get("id"))

    for cc in result.get("standing_conditions") or []:
        add("condition", cc.get("id"))

    # NOTE: urgent[].id ("urgent.visa_expiring_soon") is not a knowledge-item
    # kind in the contract, so it cannot be searched. Its text still reaches
    # Claude through road_summary below.

    # dict.fromkeys = remove duplicates but keep the order.
    return list(dict.fromkeys(ids))


def _t(text: dict | None, lang: str) -> str:
    """Pick the right language from a {"he": ..., "en": ...} pair."""
    if not text:
        return ""
    return text.get(lang) or text.get("en") or text.get("he") or ""


def road_summary(result: dict, lang: str) -> str:
    """His road as short plain text for Claude, built ONLY from the engine Result.

    PRIVACY: the Result never holds a value he typed (the API's `npm run
    audit` asserts that), so no passport or 89 number can be in this text.
    Each step and document is tagged with its item id, so Claude can tell
    which item in <items> belongs to which part of his road.
    """
    L: list[str] = []
    d = result.get("diagnosis") or {}
    L.append(f"ROUTE: {d.get('track', 'unknown')}")
    # Who he is, as the engine decided it (finding 1): so Claude never has to
    # guess whether he holds a teudat zehut or which category he is in.
    L.extend(his_facts(result, lang))

    blocked = result.get("blocked")
    if blocked:
        b = blocked.get("blocker") or {}
        L.append(f"HELD UP BY: [blocker:{b.get('id')}] {_t(b.get('title'), lang)}")
        L.append(f"  {_t(b.get('explanation'), lang)}")
        return "\n".join(L)

    for u in result.get("urgent") or []:
        L.append(f"NOTICE [{u.get('severity')}]: {_t(u.get('title'), lang)}. {_t(u.get('action'), lang)}")

    r = result.get("readiness") or {}
    if r:
        L.append(f"WHERE HE STANDS: {_t(r.get('headline'), lang)}")
        names = {
            "ready": "has and in order",
            "mismatched": "has, but it will NOT be accepted",
            "missing": "does not have yet",
            "unconfirmed": "not asked about yet",
        }
        for bucket, label in names.items():
            items = r.get(bucket) or []
            if items:
                parts = ", ".join(f"[document:{i.get('id')}] {_t(i.get('title'), lang)}" for i in items)
                L.append(f"DOCUMENTS he {label}: {parts}")
        fa = r.get("first_action")
        if fa:
            L.append(f"FIRST THING TO DO: [step:{fa.get('step_id')}] {_t(fa.get('title'), lang)}")
        L.append(f"PROGRESS: {r.get('steps_done', 0)} of {r.get('steps_total', 0)} steps done")

    steps = result.get("roadmap") or []
    if steps:
        L.append("HIS STEPS, IN ORDER:")
        for rs in steps:
            s = rs.get("step") or {}
            L.append(f"- [step:{s.get('id')}] {_t(s.get('title'), lang)} ({rs.get('state')})")

    for cs in result.get("clocks") or []:
        c = cs.get("clock") or {}
        extra = f", {cs['days_left']} days left" if cs.get("days_left") is not None else ""
        L.append(f"CLOCK: [clock:{c.get('id')}] {_t(c.get('name'), lang)}: {cs.get('status')}{extra}")

    for cc in result.get("standing_conditions") or []:
        L.append(f"KEEP TRUE THE WHOLE WAY: [condition:{cc.get('id')}] {_t(cc.get('name'), lang)}")

    return "\n".join(L)


def step_title(result: dict, step_id: str, lang: str) -> str | None:
    """The title of one step on his road, or None when the step is not on it."""
    for rs in result.get("roadmap") or []:
        s = rs.get("step") or {}
        if s.get("id") == step_id:
            return _t(s.get("title"), lang)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# What the engine knows about HIM (checker finding 1)
# ─────────────────────────────────────────────────────────────────────────────

# Copied into <road> so Claude knows who it is talking to and never guesses
# (e.g. "has a teudat zehut"). ONLY yes/no, category and count values: the
# Result never holds a number he typed, and nothing listed here is a document
# number or a name. Anything not listed is left out on purpose.
_DIAGNOSIS_FACTS = ("track", "nohal_category", "has_teudat_zehut", "requested_class", "requested_class_status", "exemption")
_FACTS = (
    "visa_type",
    "visa_valid_now",
    "months_until_visa_expiry",
    "passport_valid_now",
    "passport_89_number_match",
    "passport_89_name_match",
    "holds_form_89",
    "foreign_license_kind",
    "foreign_license_valid",
    "foreign_license_years",
    "held_class",
    "has_record_document",
    "months_since_anchor",
    "age_years",
)


def _val(v) -> str:
    if v is True:
        return "true"
    if v is False:
        return "false"
    return str(v)


def his_facts(result: dict, lang: str) -> list[str]:
    """His diagnosis and facts as 'name: value' lines, from the engine Result only."""
    d = result.get("diagnosis") or {}
    f = result.get("facts") or {}
    lines = ["HIS FACTS (decided by the engine, never contradict them):"]
    for k in _DIAGNOSIS_FACTS:
        if k in d:
            lines.append(f"- {k}: {_val(d[k])}")
    for k in _FACTS:
        if k in f and k not in d:
            lines.append(f"- {k}: {_val(f[k])}")
    gc = d.get("grade_ceiling")
    if gc:
        lines.append(f"- grade_ceiling: {gc.get('from')}-{gc.get('to')}")
    if d.get("ceiling_explanation"):
        lines.append(f"- about the grade ceiling: {_t(d['ceiling_explanation'], lang)}")
    for t in d.get("extra_requirements") or []:
        lines.append(f"- extra requirement for him: {_t(t, lang)}")
    if d.get("caveat"):
        lines.append(f"- caveat for him: {_t(d['caveat'], lang)}")
    return lines


def his_view(result: dict, item_id: str, lang: str) -> dict | None:
    """What the engine Result says about ONE item for HIM, or None.

    WHY: an item in items.json is written for everyone, so a step lists every
    checklist line with an "[only when ...]" scope. The engine has already
    filtered those for him (RoadmapStep.checklist / .notes, and the readiness
    detail for a document). Claude gets the filtered version, so a line that
    does not apply to him never reaches it.
    """
    kind, _, engine_id = item_id.partition(":")
    if kind == "step":
        for rs in result.get("roadmap") or []:
            if (rs.get("step") or {}).get("id") == engine_id:
                return {
                    "state": rs.get("state"),
                    "checklist": [_t(c, lang) for c in rs.get("checklist") or []],
                    "notes": [_t(n, lang) for n in rs.get("notes") or []],
                    "documents": [doc.get("id") for doc in rs.get("documents") or []],
                }
        return None
    if kind == "document":
        r = result.get("readiness") or {}
        for bucket in ("ready", "mismatched", "missing", "unconfirmed"):
            for it in r.get(bucket) or []:
                if it.get("id") == engine_id:
                    out = {"his_copy": bucket, "detail": _t(it.get("detail"), lang)}
                    if it.get("action"):
                        out["action"] = _t(it["action"], lang)
                    if it.get("note"):
                        out["note"] = _t(it["note"], lang)
                    return out
        return None
    return None
