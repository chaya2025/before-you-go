"""
LIVE tests: the real Claude (Haiku rewrite + Sonnet answer). They cost money,
so they never run by default. Run on purpose:

    pytest -m live -k smoke          one question, two small calls (~1 cent)
    pytest -m live                   all 15 prompt cases (~30 calls)

Skipped when ANTHROPIC_API_KEY is missing.

WHAT IS REAL AND WHAT IS NOT: Claude is real, and so are the knowledge items
(read straight from app/data/items.json). Search is NOT used: each case says
which items a good search would find (`hit_ids`), and we hand Claude exactly
those. That tests the PROMPT on its own. Search quality has its own tests.
"""
import json
import os
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

from answer_fakes import CONVERSION_ROAD  # noqa: E402
from app.answer import AskRequest, Deps, ask, claude_answer, claude_rewrite  # noqa: E402
from app.search import Hit  # noqa: E402
from test_prompt_cases import CASES, FORBIDDEN  # noqa: E402

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="ANTHROPIC_API_KEY not set"),
]

_ITEMS = {
    i["id"]: i
    for i in json.loads((ROOT / "apps" / "assistant" / "app" / "data" / "items.json").read_text(encoding="utf-8"))["items"]
}


def _run(case: dict) -> tuple[dict, dict]:
    calls = {"answer": 0}
    ids = case["hit_ids"] or ["step:cv.attend"]
    sim = 0.1 if not case["hit_ids"] else 0.6  # off-topic: a weak, irrelevant hit

    def answer(system, messages):
        calls["answer"] += 1
        return claude_answer(system, messages)

    deps = Deps(
        quota=lambda token, consume=True: {"status": "ok", "allowed": True, "left": 10},
        get_road=lambda profile, today=None: CONVERSION_ROAD,
        search=lambda *a, **kw: [Hit(i, _ITEMS[i], sim, 0.0) for i in ids],
        rewrite=claude_rewrite,
        answer=answer,
    )
    req = AskRequest(question=case["question"], lang=case["lang"], mode="case", profile={"x": 1})
    return ask(req, "live-test-token", deps), calls


def _is_hebrew(text: str) -> bool:
    return any("֐" <= ch <= "׿" for ch in text)


def _check(case: dict, out: dict, calls: dict) -> None:
    # Printed so a human can READ the answers (pytest -s). Only our test
    # questions are printed, never a real user's.
    print(f"\n[{case['id']}] {out['status']}: {out['answer']}\n  sources: {[s['citation'] for s in out['sources']]}")
    assert out["status"] != "unavailable", "Claude call failed"
    low = out["answer"].lower()
    for bad in FORBIDDEN:
        assert bad not in low, f"forbidden phrase: {bad}"
    assert _is_hebrew(out["answer"]) == (case["lang"] == "he"), "replied in the wrong language"

    kind = case["kind"]
    if kind == "off_topic":
        assert out["status"] == "not_sure"
        assert calls["answer"] == 0, "off-topic must not reach the answer call"
    elif kind in ("genuine", "worried"):
        assert out["status"] == "answered"
        assert out["sources"], "an answer must carry a source"
    else:  # traps: refusing to overrule / confirm / promise is fine either way
        assert out["status"] in ("answered", "not_sure")


def test_smoke_one_real_question():
    case = CASES[0]
    out, calls = _run(case)
    _check(case, out, calls)


@pytest.mark.parametrize("case", CASES[1:], ids=lambda c: c["id"])
def test_live_prompt_case(case):
    out, calls = _run(case)
    _check(case, out, calls)
