"""embed(): turn texts into vectors with Voyage.

What a vector is here: a list of 1024 numbers that stands for what a text
MEANS. Two texts about the same thing ("renew my visa", "extend the residence
permit") get vectors that point in nearly the same direction, even with no
words in common. That is what lets the chat find the right rule for a question
worded nothing like the rule.

Why input_type matters: Voyage embeds a short question and a long rule slightly
differently ("query" vs "document") so the two land close together. Items are
embedded as "document" once at ingest; questions as "query" on every ask.
"""

from __future__ import annotations

import os
from typing import Callable

import httpx

from app import budget

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-3.5"
DIMS = 1024  # must match vector(1024) in the knowledge_chunks migration

Post = Callable[[str, dict, dict], dict]


class MissingKey(RuntimeError):
    """A required key is not set. The message names the variable, never a value."""


class EmbedUnavailable(RuntimeError):
    """Voyage could not be reached or answered with an error."""


def _post(url: str, headers: dict, body: dict) -> dict:
    """The one real network call. Tests pass their own `post` instead."""
    try:
        r = httpx.post(url, headers=headers, json=body, timeout=budget.timeout(budget.VOYAGE_S))
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        # Only the type and status, never the request (it carries the key).
        status = getattr(getattr(e, "response", None), "status_code", None)
        raise EmbedUnavailable(f"Voyage request failed ({type(e).__name__}, status {status})") from None


def embed(
    texts: list[str],
    input_type: str,
    *,
    api_key: str | None = None,
    post: Post | None = None,
) -> list[list[float]]:
    """Returns one vector per text, in the same order as `texts`."""
    if input_type not in ("document", "query"):
        raise ValueError("input_type must be 'document' or 'query'")
    if not texts:
        return []
    key = api_key or os.environ.get("VOYAGE_API_KEY")
    if not key:
        raise MissingKey("VOYAGE_API_KEY is not set. Add it to the repo root .env.")

    data = (post or _post)(
        VOYAGE_URL,
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {"input": texts, "model": MODEL, "input_type": input_type, "output_dimension": DIMS},
    )
    # Voyage tags each vector with the position of its text. Sort by it rather
    # than trusting the order the list arrives in.
    rows = sorted(data["data"], key=lambda d: d["index"])
    if len(rows) != len(texts):
        raise EmbedUnavailable(f"Voyage returned {len(rows)} vectors for {len(texts)} texts")
    return [row["embedding"] for row in rows]
