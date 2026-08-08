"""Goer chat proxy — the FastAPI port of the old `goer-chat` Supabase edge
function: a thin, secure SSE pass-through to the Anthropic Messages API. The
ANTHROPIC_API_KEY lives only in the backend env; the mobile client sends
{system, messages, tools} and receives the raw Anthropic event stream. Tools
execute client-side (the cart is on-device state), so this stays stateless."""

import json

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .. import config
from ..postgrest import bearer_from, jwt_sub
from ..rate_limit import rate_limited

router = APIRouter()

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ALLOWLIST = ["claude-haiku-4-5", "claude-sonnet-4-6"]
MAX_TOKENS_CAP = 2048
MAX_MESSAGES = 40
MAX_BODY_BYTES = 100_000


def _error(status: int, message: str) -> JSONResponse:
    # Same error envelope the edge function used, so the app's stream parser
    # surfaces it identically.
    return JSONResponse(status_code=status, content={"type": "error", "error": {"message": message}})


def _caller_key(request: Request) -> str:
    sub = jwt_sub(bearer_from(request.headers.get("authorization")))
    if sub:
        return sub
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/goer/chat")
async def goer_chat(request: Request):
    if not config.ANTHROPIC_API_KEY:
        return _error(500, "ANTHROPIC_API_KEY is not configured")

    if rate_limited(_caller_key(request)):
        return _error(429, "Slow down — try again in a minute.")

    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        return _error(400, "Request too large")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return _error(400, "Invalid JSON")
    if not isinstance(body, dict):
        return _error(400, "Invalid JSON")

    messages = body.get("messages")
    if not isinstance(messages, list) or len(messages) == 0:
        return _error(400, "messages[] required")

    model = body.get("model")
    try:
        max_tokens = int(body.get("max_tokens") or 1024)
    except (TypeError, ValueError):
        max_tokens = 1024

    payload = {
        "model": model if isinstance(model, str) and model in MODEL_ALLOWLIST else config.GOER_MODEL,
        "max_tokens": min(max_tokens, MAX_TOKENS_CAP),
        "messages": messages[-MAX_MESSAGES:],
        "tools": body.get("tools") if isinstance(body.get("tools"), list) else [],
        "stream": True,
    }
    if isinstance(body.get("system"), str):
        payload["system"] = body["system"]

    # Open the upstream stream before answering so a non-200 can be reported
    # as a clean JSON error instead of a broken SSE stream.
    client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0))
    upstream_request = client.build_request(
        "POST",
        ANTHROPIC_URL,
        headers={
            "x-api-key": config.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
    )
    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        await client.aclose()
        return _error(502, f"Upstream unreachable: {exc}")

    if upstream.status_code != 200:
        detail = (await upstream.aread()).decode(errors="replace")[:500]
        print(f"[goer-chat] upstream error {upstream.status_code} {detail}")
        await upstream.aclose()
        await client.aclose()
        return _error(502, f"Upstream error ({upstream.status_code})")

    async def pipe():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        pipe(),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache"},
    )
