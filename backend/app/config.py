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


SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
ANTHROPIC_API_KEY = _env("ANTHROPIC_API_KEY")
GOER_MODEL = _env("GOER_MODEL") or "claude-haiku-4-5"

SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)
