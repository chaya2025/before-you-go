"""
The HTTP layer in app/main.py: the contract's status codes, CORS, the Lambda
handler, and "nothing ugly ever reaches the browser".
"""
import pytest
from fastapi.testclient import TestClient

from answer_fakes import Recorder
from app import main

BODY = {"question": "Where do I get form 89?", "lang": "en", "mode": "case", "profile": {"x": 1}}
AUTH = {"Authorization": "Bearer user-token"}


def client_with(rec: Recorder) -> TestClient:
    main.app.dependency_overrides[main.get_deps] = rec.deps
    return TestClient(main.app, raise_server_exceptions=False)


def teardown_function():
    main.app.dependency_overrides.clear()


def test_answered_over_http():
    rec = Recorder()
    res = client_with(rec).post("/api/v1/ask", json=BODY, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["status"] == "answered"
    assert rec.calls["quota"] == [("user-token", False), ("user-token", True)]


def test_no_token_is_no_login_and_200():
    rec = Recorder()
    res = client_with(rec).post("/api/v1/ask", json=BODY)
    assert res.status_code == 200
    assert res.json()["status"] == "no_login"
    assert rec.calls["answer"] == []


def test_malformed_bearer_is_no_login():
    res = client_with(Recorder()).post("/api/v1/ask", json=BODY, headers={"Authorization": "Token abc"})
    assert res.json()["status"] == "no_login"


def test_over_limit_is_limit_and_200():
    rec = Recorder(quota={"status": "ok", "allowed": False, "left": 0})
    res = client_with(rec).post("/api/v1/ask", json=BODY, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["status"] == "limit"


def test_claude_down_is_unavailable_200_no_trace():
    rec = Recorder(answer_raises=RuntimeError("secret internal detail sk-ant-xyz"))
    res = client_with(rec).post("/api/v1/ask", json=BODY, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["status"] == "unavailable"
    assert "sk-ant" not in res.text and "Traceback" not in res.text


def test_a_bug_anywhere_is_still_unavailable_200():
    # Even a bug outside ask()'s own try/except (here: the deps factory
    # itself blows up) must not show a stack trace.
    def broken():
        raise ValueError("bug")

    main.app.dependency_overrides[main.get_deps] = broken
    res = TestClient(main.app, raise_server_exceptions=False).post("/api/v1/ask", json=BODY, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["status"] == "unavailable"
    assert "bug" not in res.text


def test_health():
    res = TestClient(main.app).get("/api/v1/ask/health")
    assert res.status_code == 200 and res.json() == {"status": "ok"}


def test_cors_allows_local_web_only():
    c = TestClient(main.app)
    pre = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}
    ok = c.options("/api/v1/ask", headers={"Origin": "http://localhost:5173", **pre})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    ok2 = c.options("/api/v1/ask", headers={"Origin": "http://127.0.0.1:5173", **pre})
    assert ok2.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
    bad = c.options("/api/v1/ask", headers={"Origin": "https://evil.example", **pre})
    assert "access-control-allow-origin" not in bad.headers


def test_lambda_handler_is_exported():
    from mangum import Mangum

    assert isinstance(main.handler, Mangum)


# ---- length cap and expired tokens --------------------------------------------------

def test_question_over_800_chars_is_422_and_never_reaches_claude():
    rec = Recorder()
    res = client_with(rec).post("/api/v1/ask", json=dict(BODY, question="x" * 801), headers=AUTH)
    assert res.status_code == 422
    assert rec.calls["quota"] == [] and rec.calls["rewrite"] == [] and rec.calls["answer"] == []


def test_question_of_exactly_800_chars_is_fine():
    res = client_with(Recorder()).post("/api/v1/ask", json=dict(BODY, question="x" * 800), headers=AUTH)
    assert res.status_code == 200


def test_more_than_six_history_turns_are_trimmed_not_refused():
    rec = Recorder()
    hist = [{"role": "user", "text": f"t{i}"} for i in range(9)]
    res = client_with(rec).post("/api/v1/ask", json=dict(BODY, history=hist), headers=AUTH)
    assert res.status_code == 200
    assert [h["text"] for h in rec.calls["rewrite"][0]["history"]] == ["t3", "t4", "t5", "t6", "t7", "t8"]


import httpx  # noqa: E402

from app import quota  # noqa: E402


@pytest.mark.parametrize(
    "status, body",
    [(401, '{"message":"JWT expired"}'), (403, "forbidden"), (400, '{"message":"not logged in"}')],
)
def test_expired_or_invalid_token_is_no_login_200(monkeypatch, status, body):
    # The REAL check_quota, with Supabase's answer faked at the httpx level.
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.setattr(quota.httpx, "post", lambda *a, **kw: httpx.Response(status, text=body))
    rec = Recorder()
    deps = rec.deps()
    deps.quota = quota.check_quota
    main.app.dependency_overrides[main.get_deps] = lambda: deps
    res = TestClient(main.app, raise_server_exceptions=False).post("/api/v1/ask", json=BODY, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["status"] == "no_login"
    assert rec.calls["answer"] == []


def test_supabase_down_is_unavailable(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")

    def down(*a, **kw):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(quota.httpx, "post", down)
    assert quota.check_quota("tok") == {"status": "unavailable"}


def test_quota_ok_reads_allowed_and_left(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    seen = {}

    def ok(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json)
        return httpx.Response(200, json={"user_id": "u", "allowed": True, "left": 7})

    monkeypatch.setattr(quota.httpx, "post", ok)
    assert quota.check_quota("tok", True) == {"status": "ok", "allowed": True, "left": 7}
    assert seen["url"].endswith("/rest/v1/rpc/ask_question")
    assert seen["headers"]["Authorization"] == "Bearer tok"
    assert seen["json"] == {"consume": True}


# ---- checker findings 13 + 15 (2026-11-23) ------------------------------------------

def test_f13_oversized_profile_is_422_and_never_echoes_it():
    rec = Recorder()
    profile = {"passport_number": "Q7788990", "junk": "x" * 20_001}
    res = client_with(rec).post("/api/v1/ask", json=dict(BODY, profile=profile), headers=AUTH)
    assert res.status_code == 422
    assert "Q7788990" not in res.text and "xxxxxxxx" not in res.text
    assert rec.calls["quota"] == []


def test_f13_too_much_history_is_422_without_echo():
    rec = Recorder()
    hist = [{"role": "user", "text": "my passport Q7788990"}] * 13
    res = client_with(rec).post("/api/v1/ask", json=dict(BODY, history=hist), headers=AUTH)
    assert res.status_code == 422
    assert "Q7788990" not in res.text


def test_f13_a_long_history_turn_is_422():
    res = client_with(Recorder()).post(
        "/api/v1/ask", json=dict(BODY, history=[{"role": "user", "text": "x" * 801}]), headers=AUTH
    )
    assert res.status_code == 422


def test_f15_a_bug_is_unavailable_with_cors_and_is_not_re_raised():
    def broken():
        raise ValueError("bug with secret detail")

    main.app.dependency_overrides[main.get_deps] = broken
    # raise_server_exceptions=True: if anything re-raised the error, TestClient
    # would raise here instead of returning a response.
    c = TestClient(main.app, raise_server_exceptions=True)
    res = c.post("/api/v1/ask", json=BODY, headers={**AUTH, "Origin": "http://localhost:5173"})
    assert res.status_code == 200
    assert res.json()["status"] == "unavailable"
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "secret detail" not in res.text
