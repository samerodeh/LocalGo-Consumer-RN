from fastapi.testclient import TestClient

from app.main import app
from app.postgrest import bearer_from, headers, jwt_sub


def test_health_reports_service_configuration_without_secrets():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert set(response.json()) == {"ok", "supabaseConfigured", "pushConfigured", "goerConfigured"}


def test_bearer_and_jwt_helpers_parse_valid_values(driver_token):
    assert bearer_from(f"Bearer {driver_token}") == driver_token
    assert bearer_from("Token abc") is None
    assert jwt_sub(driver_token) == "driver-123"
    assert jwt_sub("not-a-jwt") is None


def test_postgrest_headers_forward_the_caller_token(monkeypatch):
    monkeypatch.setattr("app.postgrest.config.SUPABASE_ANON_KEY", "anon-key")

    result = headers("caller-token", prefer="return=minimal")

    assert result["apikey"] == "anon-key"
    assert result["Authorization"] == "Bearer caller-token"
    assert result["Prefer"] == "return=minimal"
