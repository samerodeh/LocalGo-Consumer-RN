from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.main import app
from app.routers import goer


def test_goer_chat_requires_an_api_key(monkeypatch):
    monkeypatch.setattr(goer.config, "ANTHROPIC_API_KEY", "")

    response = TestClient(app).post("/goer/chat", json={"messages": [{"role": "user", "content": "Hello"}]})

    assert response.status_code == 500
    assert response.json()["error"]["message"] == "ANTHROPIC_API_KEY is not configured"


def test_goer_chat_validates_messages_before_contacting_anthropic(monkeypatch):
    monkeypatch.setattr(goer.config, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(goer, "rate_limited", lambda _key: False)
    send = AsyncMock()
    monkeypatch.setattr("httpx.AsyncClient.send", send)

    response = TestClient(app).post("/goer/chat", json={"messages": []})

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "messages[] required"
    send.assert_not_awaited()


def test_goer_chat_rate_limits_before_contacting_anthropic(monkeypatch):
    monkeypatch.setattr(goer.config, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(goer, "rate_limited", lambda _key: True)

    response = TestClient(app).post("/goer/chat", json={"messages": [{"role": "user", "content": "Hello"}]})

    assert response.status_code == 429
    assert response.json()["error"]["message"] == "Slow down — try again in a minute."
