"""Server-side authoritative pricing.

The app's cart math (`src/store/cartStore.ts`) is a *display* convenience. Once
real money is involved it cannot be trusted: anything the client sends is
attacker-controlled, so a tampered build could otherwise order $200 of food for
fifty cents. Every charged amount is recomputed here from the backend's own
menu copy, and the client's totals are ignored entirely.

Mirrors the app's rules exactly:
    subtotal = sum(price * quantity)
    delivery = $5 flat, or $0 on an empty cart
    total    = subtotal + delivery + tip
No tax is applied — the app doesn't charge any either. See PRICING NOTE below.

All money here is **integer cents**. Floats never touch an amount that gets
charged; `ordersStore` already stores cents for the same reason, and Stripe
takes minor units anyway.
"""

import json
from dataclasses import dataclass
from pathlib import Path

CURRENCY = "cad"

# Mirrors DELIVERY_FEE in src/store/cartStore.ts. Keep the two in sync — a
# mismatch shows the user one number and charges them another.
DELIVERY_FEE_CENTS = 500

# Sanity bounds. Not business rules, just refusal to build an absurd charge out
# of a malformed or malicious request.
MAX_TIP_CENTS = 20_000  # $200
MAX_QUANTITY = 99  # matches OrderItem.quantity in routers/orders.py
MAX_LINES = 50
MAX_TOTAL_CENTS = 100_000  # $1000

# Committed price list, generated from src/data/menu.ts by
# scripts/build_menu_prices.py. Re-run that script after editing menu.ts, and
# commit the result, or checkout reprices against stale numbers.
#
# Deliberately NOT Goer's app/goer/data/menu.json, which this used to read.
# That file is a large derived artifact belonging to an optional subsystem, and
# it was untracked — so a deploy would have shipped a backend that could price
# nothing and 422 every checkout. It also only covers Al Taib, which would have
# made every Chateau Kabab order unpriceable.
_MENU_PATH = Path(__file__).resolve().parent / "menu_prices.json"


class PricingError(ValueError):
    """A quote could not be produced from the request as given."""


def _load_prices() -> dict[str, int]:
    """item id -> price in cents. Empty dict if the menu file is unreadable."""
    try:
        raw = json.loads(_MENU_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[pricing] menu unavailable ({type(exc).__name__}: {exc})")
        return {}

    prices: dict[str, int] = {}
    for entry in raw:
        item_id = entry.get("id")
        cents = entry.get("price_cents")
        if not item_id or cents is None:
            continue
        # Already integer cents — the float→cents rounding happens once, at
        # generation time, so no float ever reaches a charged amount.
        prices[str(item_id)] = int(cents)
    return prices


PRICES: dict[str, int] = _load_prices()

# Fail closed. Payments must never fall back to client-supplied prices, so the
# router refuses to issue an intent at all when this is False.
MENU_LOADED = bool(PRICES)


@dataclass(frozen=True)
class QuoteLine:
    item_id: str
    name: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int


@dataclass(frozen=True)
class Quote:
    lines: list[QuoteLine]
    subtotal_cents: int
    delivery_fee_cents: int
    tip_cents: int
    total_cents: int
    currency: str = CURRENCY

    def as_metadata(self) -> dict[str, str]:
        """Stripe metadata values must be strings, <=500 chars, <=50 keys.

        This breakdown is written onto the PaymentIntent at creation time and
        read back in POST /orders, so the recorded order always reflects what
        was actually charged rather than what the client claims.
        """
        return {
            "subtotal_cents": str(self.subtotal_cents),
            "delivery_fee_cents": str(self.delivery_fee_cents),
            "tip_cents": str(self.tip_cents),
            "total_cents": str(self.total_cents),
            "item_count": str(sum(line.quantity for line in self.lines)),
        }


_NAMES: dict[str, str] = {}


def name_for(item_id: str) -> str:
    if not _NAMES:
        try:
            raw = json.loads(_MENU_PATH.read_text(encoding="utf-8"))
            for entry in raw:
                key = str(entry.get("id", ""))
                if key:
                    _NAMES[key] = str(entry.get("name") or key)
        except (OSError, json.JSONDecodeError):
            pass
    return _NAMES.get(item_id, item_id)


def quote(items: list[tuple[str, int]], tip_cents: int) -> Quote:
    """Price a cart from item ids and quantities alone.

    `items` is [(item_id, quantity)]. Raises PricingError on anything that
    can't be priced — an unknown id means the client's menu has drifted from
    the backend's, and guessing a price there would be worse than failing.
    """
    if not MENU_LOADED:
        raise PricingError("The menu is unavailable, so orders can't be priced right now.")
    if not items:
        raise PricingError("Your cart is empty.")
    if len(items) > MAX_LINES:
        raise PricingError("That's too many distinct items for one order.")
    if tip_cents < 0:
        raise PricingError("A tip can't be negative.")
    if tip_cents > MAX_TIP_CENTS:
        raise PricingError("That tip is larger than we can process.")

    lines: list[QuoteLine] = []
    seen: set[str] = set()
    for item_id, quantity in items:
        if item_id in seen:
            raise PricingError(f"Duplicate cart line for {item_id}.")
        seen.add(item_id)

        if quantity < 1 or quantity > MAX_QUANTITY:
            raise PricingError(f"Invalid quantity for {item_id}.")

        unit = PRICES.get(item_id)
        if unit is None:
            raise PricingError(f"{item_id} is no longer on the menu.")

        lines.append(
            QuoteLine(
                item_id=item_id,
                name=name_for(item_id),
                quantity=quantity,
                unit_price_cents=unit,
                line_total_cents=unit * quantity,
            )
        )

    subtotal = sum(line.line_total_cents for line in lines)
    delivery = DELIVERY_FEE_CENTS if lines else 0
    total = subtotal + delivery + tip_cents

    if total <= 0:
        raise PricingError("That order comes to nothing payable.")
    if total > MAX_TOTAL_CENTS:
        raise PricingError("That order is larger than we can process.")

    return Quote(
        lines=lines,
        subtotal_cents=subtotal,
        delivery_fee_cents=delivery,
        tip_cents=tip_cents,
        total_cents=total,
    )


# PRICING NOTE — no sales tax is calculated anywhere in this product. The app
# has never charged it and this module deliberately does not invent it. For a
# real Montreal food-delivery business GST (5%) + QST (9.975%) would apply, and
# adding it means changing the app's cart display and this module together.
