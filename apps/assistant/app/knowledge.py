"""
Where the engine's knowledge items live, and one place that reads them.

WHY INSIDE THE PACKAGE (app/data/items.json): the Lambda zip is built
from the `app` package. A file outside it (the old apps/assistant/knowledge/)
would silently be left behind, and general mode would lose its list of steps.
pyproject.toml also declares it as package data for the same reason.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("byg.assistant")

ITEMS_PATH = Path(__file__).resolve().parent / "data" / "items.json"


def load_items() -> list[dict]:
    """Every item in items.json, or [] when the file is missing or broken.

    A missing file is logged by error TYPE only: never the path or message,
    which on Lambda could show the deploy layout.
    """
    try:
        return json.loads(ITEMS_PATH.read_text(encoding="utf-8"))["items"]
    except (OSError, ValueError, KeyError) as e:
        log.warning("items.json unavailable, using fallback: %s", type(e).__name__)
        return []


@lru_cache(maxsize=1)
def cached_items() -> tuple[dict, ...]:
    """Read once per process. Tuple so nobody can change the cached list."""
    return tuple(load_items())
