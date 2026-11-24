"""python -m app.ingest: load the engine's knowledge into Supabase.

    items.json  ->  one searchable text per item  ->  Voyage vectors  ->  knowledge_chunks

Run locally only, after export-knowledge.ts regenerates items.json. It writes
with SUPABASE_SECRET_KEY, the one key allowed to change what the chat knows,
so it never runs on Lambda and the key never leaves the repo root .env.

    python -m app.ingest               # the real thing
    python -m app.ingest --dry-run     # count and preview, no keys, no writes
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import httpx

from app.embed import DIMS, embed

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
DEFAULT_ITEMS = HERE / "data" / "items.json"
REQUIRED = ("SUPABASE_URL", "SUPABASE_SECRET_KEY", "VOYAGE_API_KEY")
# Voyage accepts big batches; small ones keep each request well under its limits.
DEFAULT_BATCH = 32

Send = Callable[[str, str, dict, object], None]


# ── what gets embedded ───────────────────────────────────────────────────────


def build_content(item: dict) -> str:
    """The text that is embedded and keyword-indexed for one item.

    Both languages go into one text, so a Hebrew question and an English one
    both find it. The source quotes go in too: people often ask in the words of
    the regulation itself.
    """
    parts: list[str] = []
    for lang in ("he", "en"):
        # .get: search.py also calls this on rows it reads back, and must not
        # crash on a partial one. A real item always has both.
        parts.append((item.get("title") or {}).get(lang, ""))
        parts.append((item.get("text") or {}).get(lang, ""))
    if item.get("applies_when_text"):
        parts.append(f"Applies when: {item['applies_when_text']}")
    for s in item.get("sources", []):
        for key in ("citation", "quote"):
            if s.get(key):
                parts.append(s[key])
    return "\n".join(p for p in parts if p)


def build_row(item: dict, embedding: list[float]) -> dict:
    return {
        "id": item["id"],
        "kind": item["kind"],
        "engine_id": item["engine_id"],
        "general": bool(item.get("general", False)),
        "content": build_content(item),
        "payload": item,  # the full item: what Claude reads as context
        "embedding": embedding,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── the outside calls (tests replace these) ──────────────────────────────────


def _send(method: str, url: str, headers: dict, body: object) -> None:
    try:
        r = httpx.request(method, url, headers=headers, json=body, timeout=60.0)
        r.raise_for_status()
    except httpx.HTTPError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        # The response body helps (a bad column name), and holds no key.
        detail = getattr(getattr(e, "response", None), "text", "")[:300]
        raise RuntimeError(f"Supabase {method} failed (status {status}): {detail}") from None


def _headers(key: str) -> dict:
    # Secret keys go in `apikey` only; they are not JWTs, so no Bearer header.
    return {"apikey": key, "Content-Type": "application/json"}


def upsert_rows(rows: list[dict], url: str, key: str, send: Send = _send) -> None:
    """Insert or replace by id, so running ingest twice is safe."""
    headers = _headers(key) | {"Prefer": "resolution=merge-duplicates,return=minimal"}
    send("POST", f"{url.rstrip('/')}/rest/v1/knowledge_chunks?on_conflict=id", headers, rows)


def delete_missing(keep_ids: list[str], url: str, key: str, send: Send = _send) -> None:
    """Removes rows whose item no longer exists in the engine, so a deleted
    rule can never be found by the chat again."""
    quoted = ",".join(f'"{i}"' for i in sorted(keep_ids))
    headers = _headers(key) | {"Prefer": "return=minimal"}
    send("DELETE", f"{url.rstrip('/')}/rest/v1/knowledge_chunks?id=not.in.({quoted})", headers, None)


# ── the run ──────────────────────────────────────────────────────────────────


def _fail(msg: str) -> None:
    print(f"ingest: {msg}", file=sys.stderr)
    raise SystemExit(1)


def main(
    argv: list[str] | None = None,
    *,
    env: dict | None = None,
    embed_fn: Callable[[list[str], str, str], list[list[float]]] | None = None,
    upsert_fn: Callable[[list[dict], str, str], None] = upsert_rows,
    delete_fn: Callable[[list[str], str, str], None] = delete_missing,
) -> None:
    p = argparse.ArgumentParser(prog="python -m app.ingest")
    p.add_argument("items", nargs="?", default=str(DEFAULT_ITEMS))
    p.add_argument("--batch", type=int, default=DEFAULT_BATCH)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)

    if env is None:
        # Keys live in the repo root .env (gitignored). Tests pass env directly.
        from dotenv import load_dotenv

        load_dotenv(REPO_ROOT / ".env")
        env = dict(os.environ)

    data = json.loads(Path(args.items).read_text(encoding="utf-8"))
    items = data["items"]
    print(f"ingest: {len(items)} items from engine commit {data.get('engine_commit', '?')}")

    if args.dry_run:
        for item in items[:3]:
            # Ids and lengths only: Hebrew crashes a Windows console's default encoding.
            print(f"  {item['id']}: {len(build_content(item))} chars")
        print("ingest: dry run, nothing embedded or written")
        return

    missing = [name for name in REQUIRED if not env.get(name)]
    if missing:
        _fail(
            f"refusing to run, missing {', '.join(missing)}. "
            "Add them to the repo root .env (never commit it). Nothing was written."
        )

    url, secret, voyage = env["SUPABASE_URL"], env["SUPABASE_SECRET_KEY"], env["VOYAGE_API_KEY"]
    do_embed = embed_fn or (lambda texts, t, k: embed(texts, t, api_key=k))

    # Embed everything first, write after: a Voyage failure halfway leaves the
    # database exactly as it was.
    rows: list[dict] = []
    for start in range(0, len(items), max(1, args.batch)):
        batch = items[start : start + args.batch]
        vectors = do_embed([build_content(i) for i in batch], "document", voyage)
        if len(vectors) != len(batch) or any(len(v) != DIMS for v in vectors):
            _fail(f"Voyage returned vectors of the wrong count or size (expected {DIMS}). Nothing was written.")
        rows.extend(build_row(i, v) for i, v in zip(batch, vectors))
        print(f"ingest: embedded {len(rows)}/{len(items)}")

    for start in range(0, len(rows), max(1, args.batch)):
        upsert_fn(rows[start : start + args.batch], url, secret)
    delete_fn([i["id"] for i in items], url, secret)
    print(f"ingest: done, {len(rows)} chunks in knowledge_chunks")


if __name__ == "__main__":
    main()
