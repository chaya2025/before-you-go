"""
============================================================================
THE DAILY LIMIT: 20 questions per logged-in user per day (D-222)
============================================================================

Same pattern as apps/api/src/quota.ts. The counter lives in Supabase
(`ask_question`, a security-definer function). This service holds NO
database secret: it passes HIS login token along, and Supabase works out who
he is from it. A missing or fake token is refused by Supabase itself.

The publishable key is public by design (the website ships it). It only says
WHICH project; the token says WHO.

Supabase stores a count only, never the question text (D-222).
"""

import os

import httpx

from app import budget


def check_quota(token: str | None, consume: bool = True) -> dict:
    """Ask Supabase whether this user may ask now, and count the question.

    Returns one of:
      {"status": "ok", "allowed": bool, "left": int}
      {"status": "no_login"}
      {"status": "unavailable"}
    Never raises: a quota failure is a normal state the caller handles.
    """
    if not token:
        return {"status": "no_login"}
    # Read at call time, not import time, so the .env loaded by main.py counts.
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        return {"status": "unavailable"}
    try:
        # Short cap from the shared budget (budget.py): a slow quota check
        # must not eat the time the answer itself needs.
        timeout = budget.timeout(budget.QUOTA_S)
    except budget.OutOfTime:
        return {"status": "unavailable"}
    try:
        res = httpx.post(
            f"{url.rstrip('/')}/rest/v1/rpc/ask_question",
            headers={"apikey": key, "Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"consume": consume},
            timeout=timeout,
        )
    except httpx.HTTPError:
        return {"status": "unavailable"}

    if res.status_code in (401, 403):
        return {"status": "no_login"}
    if res.status_code != 200:
        # "not logged in" raised inside the SQL function arrives as a 400.
        return {"status": "no_login"} if "not logged in" in res.text else {"status": "unavailable"}
    try:
        q = res.json()
        # An RPC returning a table comes back as a list of one row.
        if isinstance(q, list):
            q = q[0]
        return {"status": "ok", "allowed": bool(q["allowed"]), "left": int(q["left"])}
    except (ValueError, KeyError, IndexError, TypeError):
        return {"status": "unavailable"}


def bearer(header: str | None) -> str | None:
    """'Bearer abc' -> 'abc'. Anything else -> None."""
    if header and header.startswith("Bearer "):
        return header[7:].strip() or None
    return None
