"""Environment configuration. All values come from backend/.env (gitignored)
or the process environment; every feature degrades gracefully when its key is
absent, mirroring the apps' demo-mode philosophy."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _env(name: str) -> str:
    """Read an env var, stripping surrounding whitespace.

    The strip matters in hosted environments: keys are pasted into a dashboard
    field by hand, and a trailing space or newline rides along invisibly. These
    values go straight into PostgREST's `apikey` / `Authorization` headers
    (postgrest.py), so a single stray character turns every request into a 401
    that surfaces as an opaque 502 — while `/health` still cheerfully reports
    `supabaseConfigured: true`, because the value is merely non-empty.
    """
    return (os.getenv(name) or "").strip()


def _env_int(name: str, default: int) -> int:
    try:
        return int(_env(name))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(_env(name))
    except ValueError:
        return default


SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")

# ── Goer (the multi-agent ordering chatbot) ───────────────────────────────────
# Groq serves the agents; `llama-3.1-8b-instant` is fast enough that a turn can
# run the guard, the router, and a specialist back to back without the chat
# feeling sluggish.
GROQ_API_KEY = _env("GROQ_API_KEY")
GOER_MODEL = _env("GOER_MODEL") or "llama-3.1-8b-instant"
GOER_TEMPERATURE = _env_float("GOER_TEMPERATURE", 0.4)
GOER_MAX_TOKENS = _env_int("GOER_MAX_TOKENS", 700)
# Conversation turns handed to the model. Kept short deliberately: the live
# cart/tip/address state is rebuilt into every system prompt, so old turns add
# latency more than context.
GOER_MAX_HISTORY = _env_int("GOER_MAX_HISTORY", 12)
# Where ChromaDB persists the menu/FAQ embeddings. Blank uses app/goer/chroma_db.
CHROMA_PATH = _env("CHROMA_PATH")

# ── Stripe (checkout) ─────────────────────────────────────────────────────────
# The secret key must never reach the client bundle — the app only ever sees
# the publishable key, handed to it by POST /payments/intent. The webhook
# secret is separate from both and comes from the endpoint's own settings page.
STRIPE_SECRET_KEY = _env("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = _env("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = _env("STRIPE_WEBHOOK_SECRET")

SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)
GOER_CONFIGURED = bool(GROQ_API_KEY)
# Checkout needs both halves of the pair: the secret to create the intent, the
# publishable to let the app's PaymentSheet talk to Stripe directly.
STRIPE_CONFIGURED = bool(STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY)
