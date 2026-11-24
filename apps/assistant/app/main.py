"""
============================================================================
THE HTTP LAYER: POST /api/v1/ask, GET /api/v1/ask/health
============================================================================

Thin on purpose: read the token, hand the request to answer.ask, return its
dict. All the thinking lives in answer.py where it can be tested without HTTP.

Run locally:  uvicorn app.main:app --port 8001     (from apps/assistant)
On Lambda:    the handler is `app.main.handler` (Mangum turns an API Gateway
              event into an ASGI request for FastAPI, and back).

Every answer is HTTP 200 with a status inside (CONTRACT.md "HTTP"), even
"unavailable" and "no_login". WHY: the web treats a status as something to
show calmly; a 500 would look like the whole site broke. The only non-200 is
a malformed request (422), e.g. a question over 800 characters.
"""

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

# TLS: trust the Windows certificate store (this laptop needs it for Voyage,
# Supabase and Anthropic). Optional: on Lambda the package may be absent and
# Python's own certificates are used.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

# Load the repo-root .env for local runs. override=False: a real environment
# variable (Lambda's settings) always wins over the file. Values are never
# printed.
load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

from app.answer import AskRequest, Deps, ask, real_deps  # noqa: E402  (after .env)
from app.prompt import fixed  # noqa: E402
from app.quota import bearer  # noqa: E402

# Our logger never receives the question (answer.py logs error types only).
logging.basicConfig(level=logging.WARNING)

log = logging.getLogger("byg.assistant")

app = FastAPI(title="BeforeYouGo assistant", docs_url=None, redoc_url=None, openapi_url=None)


def _unavailable_body() -> dict:
    return {"status": "unavailable", "answer": fixed("unavailable", "he"), "sources": []}


class CalmFailures:
    """Last safety net: any bug becomes a calm 'unavailable' 200 (finding 15).

    WHY a middleware and not @app.exception_handler(Exception): Starlette
    handles a bare Exception in its outermost layer, OUTSIDE the CORS
    middleware. So the browser got a reply with no CORS header (it then shows
    a network error, not our calm line), and Starlette re-raised the error
    afterwards, printing a full traceback to the log. This sits INSIDE CORS
    (added before it, see below), answers, and does not re-raise. Only the
    error's type is logged.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)
        started = False

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.inner(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001
            log.warning("unhandled: %s", type(exc).__name__)
            if started:
                return  # half a reply already went out; nothing calm left to send
            await JSONResponse(_unavailable_body(), status_code=200)(scope, receive, send)


# Order matters: the middleware added LAST is the outermost. CalmFailures is
# added first so CORS wraps it and its "unavailable" carries CORS headers.
app.add_middleware(CalmFailures)

# CORS: which websites may call this from a browser. Only the local web app
# for now; the production origin is added when it is deployed (needs her yes).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)


def get_deps() -> Deps:
    """The real outside calls. Tests swap this with app.dependency_overrides."""
    return real_deps()


@app.post("/api/v1/ask")
def post_ask(
    body: AskRequest,
    deps: Deps = Depends(get_deps),
    authorization: str | None = Header(default=None),
) -> dict:
    # A plain `def` (not async): FastAPI runs it in a worker thread, so the
    # blocking httpx / anthropic calls inside never freeze the server.
    return ask(body, bearer(authorization), deps)


@app.get("/api/v1/ask/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def bad_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    """A malformed request is 422, WITHOUT echoing what was sent.

    WHY: FastAPI's default 422 copies the offending input back into the
    reply. Here that input can be his profile (passport number, name) or his
    history. Only where and what kind of problem: never the value.
    """
    detail = [{"loc": list(e.get("loc", ())), "type": e.get("type")} for e in exc.errors()]
    return JSONResponse({"detail": detail}, status_code=422)


# AWS Lambda entry point.
handler = Mangum(app, lifespan="off")
