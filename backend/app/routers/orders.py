"""Order dispatch + driver feed — the FastAPI home of what used to be
client-side TypeScript backend logic (the consumer's `dispatch.ts` insert and
the driver's `useOrderFeed.ts` fetch/claim/status writes).

Consumer side: POST /orders validates the delivery location server-side (the
same rule the app enforces at checkout — no order without a real, geocoded
dropoff), computes the dispatch economics, and inserts the row with the anon
key. NOTE: the insert deliberately never chains a RETURNING/select — the anon
role has INSERT but no SELECT on `orders`, and PostgREST would reject the
whole statement (42501) otherwise; ids are generated here instead.

Driver side: every endpoint forwards the driver's own Supabase Auth JWT to
PostgREST, so the schema's RLS policies (broadcast read, atomic claim,
own-overlay writes) apply exactly as before.
"""

import math
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .. import config
from ..postgrest import REST_URL, bearer_from, client, headers, jwt_sub
from .notify import NotifyBody, send_notification

router = APIRouter()

ETA_MINUTES = 45

round2 = lambda n: round(n * 100) / 100  # noqa: E731


def _require_supabase() -> None:
    if not config.SUPABASE_CONFIGURED:
        raise HTTPException(503, "Supabase is not configured on the backend")


def _require_driver(authorization: str | None) -> tuple[str, str]:
    """Returns (bearer, driver uid) or raises 401. The uid is only a query
    filter — RLS on the forwarded token is the real enforcement."""
    bearer = bearer_from(authorization)
    sub = jwt_sub(bearer)
    if not bearer or not sub:
        raise HTTPException(401, "A signed-in driver token is required")
    return bearer, sub


class OrderItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=1, le=99)


class PlaceOrderBody(BaseModel):
    id: str | None = None
    restaurant_name: str = Field(min_length=1, max_length=200)
    restaurant_address: str = ""
    customer_name: str = "LocalGO Customer"
    customer_id: str | None = None
    dropoff_address: str
    latitude: float
    longitude: float
    subtotal: float = Field(ge=0)
    delivery_fee: float = Field(ge=0)
    tip: float = Field(ge=0)
    total: float = Field(ge=0)
    items: list[OrderItem] = Field(min_length=1)


def _delivery_location_problem(body: PlaceOrderBody) -> str | None:
    """Server-side twin of the app's src/lib/deliveryLocation.ts."""
    if len(body.dropoff_address.strip()) < 4:
        return "A delivery address is required to place an order."
    if not (math.isfinite(body.latitude) and math.isfinite(body.longitude)):
        return "The delivery address has no verified location."
    if body.latitude == 0 and body.longitude == 0:
        return "The delivery address has no verified location."
    if abs(body.latitude) > 90 or abs(body.longitude) > 180:
        return "The delivery address location is invalid."
    return None


@router.post("/orders")
async def place_order(body: PlaceOrderBody):
    _require_supabase()

    problem = _delivery_location_problem(body)
    if problem:
        raise HTTPException(422, problem)

    order_id = body.id or str(uuid.uuid4())
    row: dict[str, Any] = {
        "id": order_id,
        "order_number": f"#LG-{str(int(time.time() * 1000))[-4:]}",
        "restaurant_name": body.restaurant_name,
        "restaurant_address": body.restaurant_address,
        "customer_name": body.customer_name,
        "customer_id": body.customer_id,
        "dropoff_address": body.dropoff_address.strip(),
        "item_count": sum(i.quantity for i in body.items),
        "order_total": round2(body.total),
        # Placeholder — no routing in scope yet (coords are validated above
        # but the schema has no dropoff lat/lng columns).
        "distance_km": 2.5,
        "status": "available",
        "items": [f"{i.quantity}× {i.name}" for i in body.items],
    }

    res = await client.post(
        f"{REST_URL}/orders",
        headers=headers(prefer="return=minimal"),
        json=row,
    )
    if res.status_code not in (200, 201):
        print(f"[orders] insert failed {res.status_code} {res.text[:300]}")
        raise HTTPException(502, "Could not publish the order to dispatch")

    # Alert the drivers — best-effort, never fails the order.
    try:
        await send_notification(NotifyBody(orderId=order_id, kind="new_order"))
    except Exception as exc:  # noqa: BLE001
        print(f"[orders] new_order notify failed: {exc}")

    return {"id": order_id}


def _map_row(row: dict[str, Any], overlay: dict[str, Any] | None) -> dict[str, Any]:
    """snake_case DB row -> the driver app's camelCase DeliveryOrder."""
    return {
        "id": row["id"],
        "orderNumber": row["order_number"],
        "restaurantName": row["restaurant_name"],
        "restaurantAddress": row["restaurant_address"],
        "customerName": row["customer_name"],
        "dropoffAddress": row["dropoff_address"],
        "itemCount": row["item_count"],
        "orderTotal": float(row["order_total"]),
        "distanceKm": float(row["distance_km"]),
        "status": overlay["status"] if overlay else "available",
        "statusUpdatedAt": overlay["updated_at"] if overlay else None,
        "acceptedBy": row.get("accepted_by"),
        "customerId": row.get("customer_id"),
        "createdAt": row["created_at"],
        "items": row.get("items") or [],
    }


@router.get("/orders/feed")
async def order_feed(authorization: str | None = Header(default=None)):
    _require_supabase()
    bearer, driver_id = _require_driver(authorization)
    auth = headers(bearer)

    orders_res = await client.get(
        f"{REST_URL}/orders",
        headers=auth,
        params={
            "select": "*",
            # Only unclaimed orders plus the ones this driver claimed.
            "or": f"(accepted_by.is.null,accepted_by.eq.{driver_id})",
            "order": "created_at.desc",
            "limit": "100",
        },
    )
    if orders_res.status_code != 200:
        print(f"[orders] feed fetch failed {orders_res.status_code} {orders_res.text[:300]}")
        raise HTTPException(502, "Could not fetch the order feed")

    overlay_res = await client.get(
        f"{REST_URL}/driver_orders",
        headers=auth,
        params={"select": "order_id,status,updated_at", "driver_id": f"eq.{driver_id}"},
    )
    overlay_rows = overlay_res.json() if overlay_res.status_code == 200 else []
    overlay = {r["order_id"]: r for r in overlay_rows}

    return {"orders": [_map_row(r, overlay.get(r["id"])) for r in orders_res.json()]}


async def _upsert_overlay(bearer: str, driver_id: str, order_id: str, status: str, now: str) -> None:
    res = await client.post(
        f"{REST_URL}/driver_orders",
        headers=headers(bearer, prefer="resolution=merge-duplicates,return=minimal"),
        params={"on_conflict": "driver_id,order_id"},
        json={"driver_id": driver_id, "order_id": order_id, "status": status, "updated_at": now},
    )
    if res.status_code not in (200, 201, 204):
        print(f"[orders] driver_orders upsert failed {res.status_code} {res.text[:300]}")
        raise HTTPException(502, "Could not save the order status")


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, authorization: str | None = Header(default=None)):
    """Atomic claim: stamps accepted_by only while the order is unclaimed.
    Losing the race returns 409 so the app can drop the card locally."""
    _require_supabase()
    bearer, driver_id = _require_driver(authorization)
    now = datetime.now(timezone.utc).isoformat()

    res = await client.patch(
        f"{REST_URL}/orders",
        headers=headers(bearer, prefer="return=representation"),
        params={"id": f"eq.{order_id}", "accepted_by": "is.null"},
        json={
            "accepted_by": driver_id,
            "accepted_at": now,
            "eta_minutes": ETA_MINUTES,
            "delivery_status": "accepted",
        },
    )
    if res.status_code not in (200, 201):
        print(f"[orders] claim failed {res.status_code} {res.text[:300]}")
        raise HTTPException(502, "Could not claim the order")
    if not res.json():
        raise HTTPException(409, "Another driver already took this order")

    await _upsert_overlay(bearer, driver_id, order_id, "accepted", now)

    # Let the customer know — unlocks their "Chat with driver" button.
    try:
        await send_notification(NotifyBody(orderId=order_id, kind="order_accepted"))
    except Exception as exc:  # noqa: BLE001
        print(f"[orders] order_accepted notify failed: {exc}")

    return {"ok": True, "etaMinutes": ETA_MINUTES, "acceptedAt": now}


class StatusBody(BaseModel):
    status: Literal["accepted", "picked_up", "delivered", "declined"]
    # Proof photo URL (order-photos bucket): the order at pickup, or dropped at
    # the customer's location. Optional so 'accepted'/'declined' can omit it.
    photo_url: str | None = None


# Which customer-facing push fires for each driver status change, and which
# shared-orders columns mirror it so the customer's realtime feed sees progress.
_STATUS_NOTIFY = {"picked_up": "order_picked_up", "delivered": "order_delivered"}


async def _mirror_status_to_order(
    order_id: str, status: str, now: str, photo_url: str | None
) -> None:
    """Copy a driver's progress onto the shared orders row (service role, so it
    lands regardless of the driver's own RLS) — this is what the customer, who
    can't read driver_orders, actually subscribes to."""
    if not config.SUPABASE_SERVICE_ROLE_KEY:
        return
    patch: dict[str, Any] = {"delivery_status": status}
    if status == "picked_up":
        patch["picked_up_at"] = now
        if photo_url:
            patch["pickup_photo_url"] = photo_url
    elif status == "delivered":
        patch["delivered_at"] = now
        if photo_url:
            patch["dropoff_photo_url"] = photo_url
    res = await client.patch(
        f"{REST_URL}/orders",
        headers=headers(service=True, prefer="return=minimal"),
        params={"id": f"eq.{order_id}"},
        json=patch,
    )
    if res.status_code not in (200, 204):
        print(f"[orders] status mirror failed {res.status_code} {res.text[:300]}")


@router.post("/orders/{order_id}/status")
async def update_status(
    order_id: str,
    body: StatusBody,
    authorization: str | None = Header(default=None),
):
    """Everything except the accept-claim (decline / picked_up / delivered).
    Writes the driver's private overlay row, mirrors forward progress onto the
    shared orders row so the customer can follow it, and pushes the customer a
    'on the way' / 'arrived' notification."""
    _require_supabase()
    bearer, driver_id = _require_driver(authorization)
    now = datetime.now(timezone.utc).isoformat()
    await _upsert_overlay(bearer, driver_id, order_id, body.status, now)

    if body.status in ("picked_up", "delivered"):
        await _mirror_status_to_order(order_id, body.status, now, body.photo_url)
        kind = _STATUS_NOTIFY[body.status]
        try:
            await send_notification(NotifyBody(orderId=order_id, kind=kind))  # type: ignore[arg-type]
        except Exception as exc:  # noqa: BLE001
            print(f"[orders] {kind} notify failed: {exc}")

    return {"ok": True, "updatedAt": now}

