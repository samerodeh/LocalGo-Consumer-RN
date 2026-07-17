"""Environment configuration. All values come from backend/.env (gitignored)
or the process environment; every feature degrades gracefully when its key is
absent, mirroring the apps' demo-mode philosophy."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or ""
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""
GOER_MODEL = os.getenv("GOER_MODEL") or "claude-haiku-4-5"

SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)
