import base64
import json

import pytest


def jwt_for(sub: str) -> str:
    """An unsigned JWT-shaped string for testing parsing only.

    The application forwards real JWTs to Supabase, where signature validation
    happens. These tests exercise only the local, best-effort subject parser.
    """
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"{header}.{payload}.signature"


@pytest.fixture
def driver_token() -> str:
    return jwt_for("driver-123")
