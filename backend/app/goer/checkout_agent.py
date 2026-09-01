"""Checkout — tip, delivery address, and the confirmation card.

The one agent with a safety invariant to protect: it can ask the app to *stage*
a confirmation card, and nothing more. Placing the order is the Confirm button's
job (`goerStore.confirmStagedOrder` -> `placeOrder`), the same pipeline the Cart
screen uses. The prompt says so, and the plan is incapable of expressing
anything stronger — there is no "place order" action for the model to reach for.
"""

from __future__ import annotations

from .agent_utilities import llm_json
from .prompts import build_system
from .schemas import AgentPlan, GoerContext, action

TIP_PRESETS = (0, 15, 18, 20, 25)

BRIEF = """You are CHECKOUT. Get the order over the line: confirm the tip, make sure a delivery
address is selected, and show the confirmation card.

- Tip presets are 0%, 15%, 18%, 20%, 25% of the subtotal, or a custom dollar amount. Default 18%.
- If no address is saved, tell the customer to add one from the home screen's "Deliver to" control
  and stop there — you cannot check out without it.
- After the confirmation card is shown, tell them to review it and tap Confirm. Nothing is charged
  until they do. NEVER say the order is placed."""

EXTRACTOR = """You read a checkout message and extract what the customer wants set.

Return JSON only, no prose and no code fences:
{
  "tip_percent": null,
  "tip_amount": null,
  "address_hint": "",
  "wants_confirmation": false,
  "wants_totals": false
}

Rules:
- "tip_percent" only if they named one of 0, 15, 18, 20, 25 (or said "no tip" -> 0).
- "tip_amount" for a custom dollar tip ("tip five bucks" -> 5).
- "address_hint" is their words for which saved address to deliver to ("home", "the office"), else "".
- "wants_confirmation" is true when they want to check out, place the order, see the final total
  to confirm, or say they're done adding items.
- "wants_totals" is true when they only want to hear the current total."""


class CheckoutAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        extracted = llm_json(system=EXTRACTOR, user=message, history=history, default={})
        extracted = extracted if isinstance(extracted, dict) else {}

        actions: list[dict] = []
        applied: list[str] = []

        tip_percent = _as_number(extracted.get("tip_percent"))
        tip_amount = _as_number(extracted.get("tip_amount"))
        if tip_percent is not None and int(tip_percent) in TIP_PRESETS:
            actions.append(action("set_tip", percent=int(tip_percent)))
            applied.append(f"Set the tip to {int(tip_percent)}% of the subtotal.")
        elif tip_amount is not None and 0 <= tip_amount <= 200:
            actions.append(action("set_tip", amount=round(tip_amount, 2)))
            applied.append(f"Set the tip to ${tip_amount:.2f}.")

        address_hint = str(extracted.get("address_hint") or "").strip()
        if address_hint:
            matched = _match_address(context, address_hint)
            if matched:
                actions.append(action("select_address", address_id=matched.id))
                applied.append(
                    f"Selected the delivery address '{matched.label or matched.addressLine}'."
                )
            else:
                applied.append(
                    f"No saved address matches '{address_hint}' — list what they do have and ask."
                )

        wants_confirmation = bool(extracted.get("wants_confirmation"))
        if wants_confirmation:
            if not context.cart:
                applied.append(
                    "Could not check out: the cart is empty. Offer to help them pick something."
                )
            elif not context.selected_address():
                applied.append(
                    "Could not check out: no delivery address is saved. Tell them to add one from "
                    "the home screen's 'Deliver to' control, then say checkout again."
                )
            else:
                actions.append(action("stage_order_confirmation"))
                applied.append(
                    "Showed the order confirmation card. The order is NOT placed — the customer "
                    "must tap Confirm on the card. Do not claim it was placed."
                )

        if not applied:
            applied.append(
                "Nothing was changed. Read the totals below and answer the customer's question."
            )

        return AgentPlan(
            agent="checkout",
            system=build_system(f"{BRIEF}\n\n{_totals_block(context)}", context, language, "\n".join(applied)),
            actions=actions,
            quick_replies=_quick_replies(context, wants_confirmation),
        )


def _totals_block(context: GoerContext) -> str:
    saved = (
        "\n".join(
            f"- {address.id}: {address.label or 'saved address'} — {address.addressLine}"
            + (" (default)" if address.isDefault else "")
            for address in context.addresses
        )
        or "- none saved"
    )
    return (
        "CURRENT TOTALS:\n"
        f"- Subtotal ${context.subtotal:.2f}\n"
        f"- Delivery fee ${context.deliveryFee:.2f}\n"
        f"- Tip {context.tip_label()}\n"
        f"- Total ${context.total():.2f}\n\n"
        f"SAVED ADDRESSES:\n{saved}"
    )


def _match_address(context: GoerContext, hint: str):
    needle = hint.lower().strip()
    for address in context.addresses:
        haystack = f"{address.label} {address.addressLine}".lower()
        if needle in haystack:
            return address
    return None


def _as_number(raw) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _quick_replies(context: GoerContext, staged: bool) -> list[str]:
    if staged:
        return []
    if not context.cart:
        return ["Show me the menu", "What's popular?"]
    return ["Checkout", "Tip 20%", "Tip 15%"]


def checkout_agent(message: str, history: list, context: GoerContext, language: str) -> AgentPlan:
    return CheckoutAgent().get_agent_plan(message, history, context, language)
