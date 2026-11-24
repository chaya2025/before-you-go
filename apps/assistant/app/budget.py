"""
The time budget for one question.

WHY: API Gateway gives up on a request after ~29 seconds, and a person staring
at a spinner gives up sooner. One question makes up to seven outside calls in a
row (quota, road, rewrite, Voyage, search, answer, count). Each has its own
short cap below, but seven caps added up would still pass 29s. So ask() starts
one clock of TOTAL_S, and every outside call takes as its timeout the smaller
of its own cap and the time still left. When the clock runs out, the next call
raises OutOfTime, which answer.py turns into "unavailable" (and the question is
not counted).

The clock is a contextvar: each request has its own, even when several run at
once in FastAPI's worker threads. With no clock started (a script, a test that
calls one function), each call just uses its own cap.
"""

import contextvars
import time

TOTAL_S = 28.0  # the whole question, worst case. Real answers take 15-20s; API Gateway stops at 30s
QUOTA_S = 5.0  # Supabase ask_question (peek and count)
ROAD_S = 8.0  # the TS API's /readiness
VOYAGE_S = 8.0  # one embed call
SEARCH_S = 8.0  # match_knowledge / linked items
REWRITE_S = 6.0  # the small Haiku call
ANSWER_S = 20.0  # the Sonnet answer call (live runs: 10-15s)
# Kept free after the answer call so the question can still be counted.
COUNT_RESERVE_S = 2.0
# Below this there is no point starting a call: it could not finish.
MIN_CALL_S = 0.5


class OutOfTime(RuntimeError):
    """The question's time budget is used up."""


_deadline: contextvars.ContextVar[float | None] = contextvars.ContextVar("byg_deadline", default=None)


def start(total: float = TOTAL_S) -> None:
    """Start the clock for one question."""
    _deadline.set(time.monotonic() + total)


def timeout(cap: float, reserve: float = 0.0) -> float:
    """Seconds this call may take: its own cap, or what is left, whichever is smaller.

    `reserve` keeps that many seconds back for calls that must still happen
    after this one.
    """
    deadline = _deadline.get()
    if deadline is None:
        return cap
    left = deadline - time.monotonic() - reserve
    if left < MIN_CALL_S:
        raise OutOfTime()
    return min(cap, left)


def reset() -> None:
    """Stop the clock (tests use this so one test's clock never leaks into the next)."""
    _deadline.set(None)
