from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.main import app
from app.routers import orders


class Response:
    def __init__(self, status_code: int, body=None, text: str = ""):
        self.status_code = status_code
        self._body = [] if body is None else body
        self.text = text

    def json(self):
        return self._body


VALID_ORDER = {
    "restaurant_name": "Al Taib",
    "restaurant_address": "123 Main St",
    "customer_name": "Ada Lovelace",
    "dropoff_address": "1510 De Maisonneuve Ouest",
    "latitude": 45.496339,
    "longitude": -73.578666,
    "subtotal": 20,
    "delivery_fee": 5,
    "tip": 2,
    "total": 27,
    "items": [{"name": "Chicken shawarma", "quantity": 2}],
}


def test_place_order_rejects_an_unverified_delivery_location(monkeypatch):
    monkeypatch.setattr(orders.config, "SUPABASE_CONFIGURED", True)
    response = TestClient(app).post("/orders", json={**VALID_ORDER, "latitude": 0, "longitude": 0})

    assert response.status_code == 422
    assert response.json()["detail"] == "The delivery address has no verified location."


def test_place_order_publishes_a_normalized_dispatch_row(monkeypatch):
    post = AsyncMock(return_value=Response(201))
    notify = AsyncMock()
    monkeypatch.setattr(orders.config, "SUPABASE_CONFIGURED", True)
    monkeypatch.setattr(orders.client, "post", post)
    monkeypatch.setattr(orders, "send_notification", notify)

    response = TestClient(app).post("/orders", json={**VALID_ORDER, "id": "order-123"})

    assert response.status_code == 200
    assert response.json() == {"id": "order-123"}
    row = post.await_args.kwargs["json"]
    assert row["id"] == "order-123"
    assert row["item_count"] == 2
    assert row["items"] == ["2× Chicken shawarma"]
    assert row["order_total"] == 27
    notify.assert_awaited_once()


def test_driver_feed_requires_a_signed_in_driver(monkeypatch):
    monkeypatch.setattr(orders.config, "SUPABASE_CONFIGURED", True)

    response = TestClient(app).get("/orders/feed")

    assert response.status_code == 401
    assert response.json()["detail"] == "A signed-in driver token is required"


def test_driver_feed_maps_database_rows_and_private_status(monkeypatch, driver_token):
    monkeypatch.setattr(orders.config, "SUPABASE_CONFIGURED", True)
    monkeypatch.setattr(orders.client, "get", AsyncMock(side_effect=[
        Response(200, [{
            "id": "order-1", "order_number": "#LG-1", "restaurant_name": "Al Taib",
            "restaurant_address": "123 Main", "customer_name": "Ada", "dropoff_address": "1510 De Maisonneuve",
            "item_count": 2, "order_total": "27.00", "distance_km": "2.5", "accepted_by": "driver-123",
            "customer_id": "customer-123", "created_at": "2026-01-01T00:00:00Z", "items": ["2× Shawarma"],
        }]),
        Response(200, [{"order_id": "order-1", "status": "accepted", "updated_at": "2026-01-01T00:01:00Z"}]),
    ]))

    response = TestClient(app).get("/orders/feed", headers={"Authorization": f"Bearer {driver_token}"})

    assert response.status_code == 200
    assert response.json()["orders"] == [{
        "id": "order-1", "orderNumber": "#LG-1", "restaurantName": "Al Taib", "restaurantAddress": "123 Main",
        "customerName": "Ada", "dropoffAddress": "1510 De Maisonneuve", "itemCount": 2, "orderTotal": 27.0,
        "distanceKm": 2.5, "status": "accepted", "statusUpdatedAt": "2026-01-01T00:01:00Z",
        "acceptedBy": "driver-123", "customerId": "customer-123", "createdAt": "2026-01-01T00:00:00Z", "items": ["2× Shawarma"],
    }]
