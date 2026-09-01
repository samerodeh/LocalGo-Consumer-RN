"""Pydantic models for the Goer chat API, and the `AgentPlan` every specialist
returns.

Goer's cart lives on the phone (zustand), not in a server-side table, so a chat
request carries a snapshot of it and the reply carries back the tool calls the
client should run. That is the one place this design departs from SufraAI —
whose agents read and write the user's cart in SQLite directly — and it is what
keeps the app's checkout invariant intact: the server can *ask* for a
confirmation card, never for an order.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

AgentId = Literal["concierge", "cart", "checkout", "tracker", "dietary", "recommendation"]

AGENT_IDS: tuple[str, ...] = (
    "concierge",
    "cart",
    "checkout",
    "tracker",
    "dietary",
    "recommendation",
)


class CartLineIn(BaseModel):
    itemId: str
    name: str = ""
    quantity: int = 1
    unitPrice: float = 0.0


class TipIn(BaseModel):
    kind: Literal["percent", "amount"] = "percent"
    value: float = 18


class AddressIn(BaseModel):
    id: str = ""
    label: str = ""
    addressLine: str = ""
    isDefault: bool = False


class OrderIn(BaseModel):
    """One past order, as the phone's ordersStore knows it (money in cents)."""

    id: str = ""
    restaurantName: str = ""
    status: str = ""
    placedAt: str = ""
    totalCents: int = 0
    items: list[CartLineIn] = Field(default_factory=list)


class DietaryProfileIn(BaseModel):
    halal: bool = False
    vegan: bool = False
    vegetarian: bool = False
    allergies: list[str] = Field(default_factory=list)


class GoerContext(BaseModel):
    """The live app state a turn is answered against."""

    firstName: str = ""
    languagePreference: str = "auto"
    cart: list[CartLineIn] = Field(default_factory=list)
    restaurantId: str | None = None
    subtotal: float = 0.0
    deliveryFee: float = 0.0
    tip: TipIn = Field(default_factory=TipIn)
    addresses: list[AddressIn] = Field(default_factory=list)
    selectedAddressId: str | None = None
    orders: list[OrderIn] = Field(default_factory=list)
    dietaryProfile: DietaryProfileIn = Field(default_factory=DietaryProfileIn)

    # ── Prompt-facing views ──────────────────────────────────────────────────

    def selected_address(self) -> AddressIn | None:
        if self.selectedAddressId:
            for address in self.addresses:
                if address.id == self.selectedAddressId:
                    return address
        for address in self.addresses:
            if address.isDefault:
                return address
        return self.addresses[0] if self.addresses else None

    def tip_amount(self) -> float:
        if self.tip.kind == "amount":
            return round(max(0.0, self.tip.value), 2)
        return round(self.subtotal * self.tip.value / 100, 2)

    def tip_label(self) -> str:
        if self.tip.kind == "amount":
            return f"${self.tip_amount():.2f}"
        return f"{self.tip.value:g}% (${self.tip_amount():.2f})"

    def total(self) -> float:
        return round(self.subtotal + self.deliveryFee + self.tip_amount(), 2)

    def cart_text(self) -> str:
        if not self.cart:
            return "empty"
        return ", ".join(
            f"{line.quantity}x {line.name or line.itemId} (${line.unitPrice * line.quantity:.2f})"
            for line in self.cart
        )

    def profile_dict(self) -> dict:
        """Shaped like SufraAI's user profile so the shared dietary helpers fit."""
        return {
            "languagePreference": self.languagePreference,
            "dietaryProfile": self.dietaryProfile.model_dump(),
        }

    def live_state(self) -> str:
        """The block appended to every system prompt — Goer's ground truth."""
        address = self.selected_address()
        lines = [
            f"Customer: {self.firstName or 'guest'}.",
            f"Cart: {self.cart_text()}.",
        ]
        if self.cart:
            lines.append(
                f"Subtotal ${self.subtotal:.2f}, delivery fee ${self.deliveryFee:.2f}, "
                f"tip {self.tip_label()}, total ${self.total():.2f}."
            )
        lines.append(
            "Delivery address: "
            + (
                f"{address.label or 'saved address'} — {address.addressLine}"
                if address
                else "none saved (the user must add one on the Address screen before checkout)"
            )
        )
        if self.orders:
            latest = self.orders[0]
            lines.append(
                f"Most recent order: {latest.restaurantName or 'Al Taib'}, status {latest.status}, "
                f"${latest.totalCents / 100:.2f}, placed {latest.placedAt}."
            )
        else:
            lines.append("Order history: none yet.")
        return "\n".join(lines)


class ChatRequest(BaseModel):
    """`POST /goer/chat` body. Mirrors SufraAI's `llm_response` schema, plus the
    on-device context Goer needs."""

    message: str
    history: list[dict] = Field(default_factory=list)
    user_id: str = "guest"
    context: GoerContext = Field(default_factory=GoerContext)
    # Who answered last. Used for sticky routing when the classifier is
    # unsure, and by the client to decide whether to draw a handoff divider.
    active_agent: str = "concierge"


class ChatResponse(BaseModel):
    response: str
    agent: str
    actions: list[dict] = Field(default_factory=list)
    quick_replies: list[str] = Field(default_factory=list)
    language: str = "en"
    blocked: bool = False


# ── Agent plans ───────────────────────────────────────────────────────────────

@dataclass
class AgentPlan:
    """What a specialist decided, before any prose is generated.

    Splitting "what to do" from "what to say" is SufraAI's order-agent pattern
    generalised: the agent first extracts structured intent (a JSON-only model
    call), resolves it against the menu, and only then writes a reply with the
    outcome already in the prompt. It also means the reply can stream while the
    actions are already settled.
    """

    agent: str
    system: str = ""
    actions: list[dict] = field(default_factory=list)
    quick_replies: list[str] = field(default_factory=list)
    # Set to skip the reply model call entirely (guard blocks, hard errors,
    # deterministic answers).
    reply: str | None = None


def action(tool: str, **input_: Any) -> dict:
    """A client-side tool call. `tool` must name an executor in
    `src/goer/tools/executors.ts`."""
    return {"tool": tool, "input": input_}
