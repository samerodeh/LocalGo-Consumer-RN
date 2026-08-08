"""Stripe PaymentIntent creation for checkout. The app collects card details
entirely inside Stripe's own PaymentSheet UI (nothing typed by the user ever
touches this backend); this endpoint only mints the PaymentIntent the sheet
needs to confirm. Confirmation itself happens client-side against Stripe —
there's no webhook here, matching this backend's existing trust posture of
taking client-declared order totals at face value (see orders.py)."""

import stripe
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import config

router = APIRouter()

stripe.api_key = config.STRIPE_SECRET_KEY


def _require_stripe() -> None:
    if not config.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe is not configured on the backend")


class CreateIntentBody(BaseModel):
    amount_cents: int = Field(gt=0, le=200_000)
    currency: str = "cad"


@router.post("/payments/create-intent")
async def create_intent(body: CreateIntentBody):
    _require_stripe()
    try:
        intent = stripe.PaymentIntent.create(
            amount=body.amount_cents,
            currency=body.currency,
            automatic_payment_methods={"enabled": True},
        )
    except stripe.error.StripeError as exc:  # noqa: BLE001
        raise HTTPException(502, f"Stripe error: {exc.user_message or str(exc)}") from exc

    return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}
