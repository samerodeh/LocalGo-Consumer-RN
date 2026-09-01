"""Order Tracker — the port of SufraAI's `agents/order_history_agent.py`.

SufraAI's history agent answers without calling a model at all when there's
nothing to say, and that's worth keeping: "no orders yet" needs no LLM, and a
localized constant answers faster and never hallucinates an order. Anything
richer goes through the model with the order facts already in the prompt.
"""

from __future__ import annotations

from .agent_utilities import llm_json, localize
from .prompts import build_system
from .schemas import AgentPlan, GoerContext, action

BRIEF = """You are the ORDER TRACKER. Answer "where's my order" from the live status below, and
history questions from the past orders below.

- Before a driver accepts, the status is "waiting for a driver" — say so plainly, don't invent an ETA.
- Once accepted, quote the ETA as a plus-or-minus 5 minute window.
- Never invent an order, an order number, or a delivery time."""

INTENT = """Classify an order-tracking message.

Return JSON only, no prose and no code fences:
{"scope": "active" or "history" or "details", "order_id": ""}

- "active": the current or most recent order ("where's my food", "is it close").
- "history": previous orders ("what did I order last time", "my past orders").
- "details": one specific past order they named; put its id in "order_id" if present."""


class TrackerAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        if not context.orders:
            return AgentPlan(
                agent="tracker",
                reply=localize(
                    "You haven't placed an order yet — once you do, I'll track it right here.",
                    "لم تقم بأي طلب بعد — وحالما تفعل، سأتابعه لك هنا.",
                    language,
                    "Vous n'avez pas encore passé de commande — dès que ce sera fait, je la suivrai ici.",
                ),
                quick_replies=["Show me the menu", "What's popular?"],
            )

        intent = llm_json(system=INTENT, user=message, history=history, default={"scope": "active"})
        scope = str((intent or {}).get("scope", "active")).lower()
        order_id = str((intent or {}).get("order_id") or "").strip()

        actions: list[dict] = []
        if scope == "history":
            actions.append(action("get_past_orders", limit=5))
            outcome = "Looked up the customer's recent order history."
        elif scope == "details" and order_id:
            actions.append(action("get_order_details", order_id=order_id))
            outcome = f"Looked up the details of order {order_id}."
        else:
            # The live path also renders a status card with the driver's ETA.
            actions.append(action("get_active_order"))
            outcome = "Showed the live status card for the customer's most recent order."

        return AgentPlan(
            agent="tracker",
            system=build_system(f"{BRIEF}\n\n{_orders_block(context)}", context, language, outcome),
            actions=actions,
            quick_replies=["Order again", "Show me the menu"],
        )


def _orders_block(context: GoerContext) -> str:
    lines = []
    for order in context.orders[:5]:
        items = ", ".join(f"{line.quantity}x {line.name}" for line in order.items) or "no items recorded"
        lines.append(
            f"- {order.id or 'order'}: {order.restaurantName or 'Al Taib'}, status {order.status}, "
            f"${order.totalCents / 100:.2f}, placed {order.placedAt} — {items}"
        )
    return "ORDERS ON THIS ACCOUNT (most recent first):\n" + "\n".join(lines)


def tracker_agent(message: str, history: list, context: GoerContext, language: str) -> AgentPlan:
    return TrackerAgent().get_agent_plan(message, history, context, language)
