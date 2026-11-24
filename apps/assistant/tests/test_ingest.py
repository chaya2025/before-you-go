"""ingest: items.json -> embeddings -> knowledge_chunks. All outside calls faked."""

import json

import pytest

from app import ingest

ITEM = {
    "id": "step:cv.attend",
    "kind": "step",
    "engine_id": "cv.attend",
    "general": True,
    "title": {"he": "הגעה למשרד הרישוי", "en": "Attend the licensing office"},
    "text": {"he": "להביא דרכון", "en": "Bring your passport"},
    "applies_when_text": "always",
    "sources": [
        {"citation": "נוהל ס' 3", "quote": "יש להציג דרכון", "url": None,
         "last_verified_at": "2026-11-01", "certainty": "verified"},
        {"citation": None, "quote": None, "url": None, "last_verified_at": "2026-11-01", "certainty": "first_hand"},
    ],
    "links": [],
}

FULL_ENV = {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SECRET_KEY": "sb_secret_DO_NOT_PRINT_1234",
    "VOYAGE_API_KEY": "pa-DO_NOT_PRINT_5678",
}


def write_items(tmp_path, items):
    p = tmp_path / "items.json"
    p.write_text(json.dumps({"generated_at": "2026-11-23", "engine_commit": "abc", "items": items}), encoding="utf-8")
    return p


def test_content_holds_title_text_condition_and_quotes_in_both_languages():
    c = ingest.build_content(ITEM)
    for piece in ["הגעה למשרד הרישוי", "Attend the licensing office", "להביא דרכון",
                  "Bring your passport", "always", "יש להציג דרכון", "נוהל ס' 3"]:
        assert piece in c


def test_row_carries_the_full_item_as_payload():
    r = ingest.build_row(ITEM, [0.5] * 1024)
    assert r["id"] == "step:cv.attend"
    assert r["kind"] == "step"
    assert r["engine_id"] == "cv.attend"
    assert r["general"] is True
    assert r["payload"] == ITEM
    assert len(r["embedding"]) == 1024


@pytest.mark.parametrize("missing", ["SUPABASE_SECRET_KEY", "VOYAGE_API_KEY", "SUPABASE_URL"])
def test_refuses_to_run_without_each_key(tmp_path, capsys, missing):
    env = {k: v for k, v in FULL_ENV.items() if k != missing}
    with pytest.raises(SystemExit) as e:
        ingest.main([str(write_items(tmp_path, [ITEM]))], env=env,
                    embed_fn=lambda *a: pytest.fail("embedded without keys"),
                    upsert_fn=lambda *a: pytest.fail("wrote without keys"))
    assert e.value.code != 0
    out = capsys.readouterr()
    assert missing in out.err


def test_embeds_in_batches_upserts_and_never_prints_a_key(tmp_path, capsys):
    items = [dict(ITEM, id=f"step:s{i}", engine_id=f"s{i}") for i in range(5)]
    batches, upserts, deletes = [], [], []

    def fake_embed(texts, input_type, api_key):
        assert input_type == "document"
        assert api_key == FULL_ENV["VOYAGE_API_KEY"]
        batches.append(len(texts))
        return [[0.0] * 1024 for _ in texts]

    def fake_upsert(rows, url, key):
        assert key == FULL_ENV["SUPABASE_SECRET_KEY"]
        upserts.append([r["id"] for r in rows])

    def fake_delete(keep_ids, url, key):
        deletes.append(sorted(keep_ids))

    ingest.main([str(write_items(tmp_path, items)), "--batch", "2"], env=FULL_ENV,
                embed_fn=fake_embed, upsert_fn=fake_upsert, delete_fn=fake_delete)

    assert batches == [2, 2, 1]
    assert sum(len(u) for u in upserts) == 5
    assert deletes == [sorted(i["id"] for i in items)]
    out = capsys.readouterr()
    for secret in (FULL_ENV["SUPABASE_SECRET_KEY"], FULL_ENV["VOYAGE_API_KEY"]):
        assert secret not in out.out and secret not in out.err


def test_refuses_an_embedding_of_the_wrong_size(tmp_path):
    with pytest.raises(SystemExit):
        ingest.main([str(write_items(tmp_path, [ITEM]))], env=FULL_ENV,
                    embed_fn=lambda texts, t, k: [[0.0] * 3 for _ in texts],
                    upsert_fn=lambda *a: pytest.fail("wrote a bad vector"),
                    delete_fn=lambda *a: None)


def test_dry_run_needs_no_keys_and_writes_nothing(tmp_path, capsys):
    ingest.main([str(write_items(tmp_path, [ITEM])), "--dry-run"], env={},
                embed_fn=lambda *a: pytest.fail("embedded in dry run"),
                upsert_fn=lambda *a: pytest.fail("wrote in dry run"))
    assert "1 items" in capsys.readouterr().out


def test_upsert_request_shape():
    seen = {}

    def fake_send(method, url, headers, body):
        seen.update(method=method, url=url, headers=headers, body=body)

    ingest.upsert_rows([{"id": "a"}], "https://x.supabase.co", "sk", send=fake_send)
    assert seen["method"] == "POST"
    assert seen["url"] == "https://x.supabase.co/rest/v1/knowledge_chunks?on_conflict=id"
    assert seen["headers"]["apikey"] == "sk"
    assert "merge-duplicates" in seen["headers"]["Prefer"]


def test_delete_missing_quotes_ids_with_dots_and_colons():
    seen = {}

    def fake_send(method, url, headers, body):
        seen.update(method=method, url=url)

    ingest.delete_missing(["step:cv.attend", "about:x"], "https://x.supabase.co", "sk", send=fake_send)
    assert seen["method"] == "DELETE"
    assert 'id=not.in.("about:x","step:cv.attend")' in seen["url"]


def test_real_items_json_builds_content_for_every_item():
    """The generated file from export-knowledge.ts, if present, is ingestible."""
    path = ingest.DEFAULT_ITEMS
    if not path.exists():
        pytest.skip("items.json not generated yet")
    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data["items"]:
        assert ingest.build_content(item).strip()
