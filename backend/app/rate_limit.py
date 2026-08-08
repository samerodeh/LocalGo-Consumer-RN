"""Best-effort in-process sliding-window rate limiter — the direct port of the
one the goer-chat edge function used. Resets on restart; production wants a
durable counter (Postgres/Redis)."""

import time

WINDOW_SECONDS = 60.0
MAX_REQUESTS_PER_WINDOW = 20

_hits: dict[str, list[float]] = {}


def rate_limited(key: str) -> bool:
    now = time.monotonic()
    recent = [t for t in _hits.get(key, []) if now - t < WINDOW_SECONDS]
    recent.append(now)
    _hits[key] = recent
    return len(recent) > MAX_REQUESTS_PER_WINDOW
