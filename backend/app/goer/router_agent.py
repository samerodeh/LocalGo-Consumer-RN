"""Router — the front door of every Goer turn.

SufraAI sketches this agent but never finishes it (`agents/router_agent.py`
there is a stub whose `get_router_agent_response` takes no arguments and calls
`llm()` with the wrong keyword), so its `/chat` endpoint can't actually run.
This is that design carried through: guard the message, pick the specialist,
let the specialist plan, then generate the reply.

    guard_agent  ->  route  ->  <specialist>.get_agent_plan  ->  reply

Routing is a short JSON classification, but only after the cheap deterministic
checks: an empty cart can't check out, an explicit "where's my order" needs no
model, and a turn that continues the specialist you were already talking to
shouldn't bounce elsewhere on a coin flip.
"""

from __future__ import annotations

import re
from typing import Iterator

from .agent_utilities import detect_language, llm, llm_json, llm_stream
from .cart_agent import cart_agent
from .checkout_agent import checkout_agent
from .dietary_agent import dietary_agent
from .guard_agent import guard_agent
from .menu_agent import menu_agent
from .recommendation_agent import recommendation_agent
from .schemas import AGENT_IDS, AgentPlan, ChatResponse, GoerContext
from .tracker_agent import tracker_agent

SPECIALISTS = {
    "concierge": menu_agent,
    "cart": cart_agent,
    "checkout": checkout_agent,
    "tracker": tracker_agent,
    "dietary": dietary_agent,
    "recommendation": recommendation_agent,
}

ROUTER_SYSTEM = """You route a customer's message to one specialist of a food-delivery ordering
assistant. Pick exactly one.

1. "concierge"      — browsing the menu, what's in a dish, prices, and how LocalGO works
                      (delivery area, fees, timing, payment, accounts).
2. "cart"           — adding, removing, or re-quantifying items; "what's in my cart".
3. "checkout"       — tip, delivery address, totals, checking out, placing the order.
4. "tracker"        — where an order is, its ETA, past orders, reordering.
5. "dietary"        — allergies, intolerances, vegan/vegetarian/halal, "is X safe for me".
6. "recommendation" — "what should I get", "what goes with this", "what's popular", surprise me.

Return JSON only, no prose and no code fences:
{
  "chain_of_thought": "one short sentence weighing the options",
  "decision": "concierge" | "cart" | "checkout" | "tracker" | "dietary" | "recommendation"
}

Guidance:
- Naming a dish with an intent to have it ("two zaatar manakish please") is "cart", not "concierge".
- Asking what a dish contains is "concierge"; asking whether they can eat it is "dietary".
- "I'm done" / "that's everything" after building a cart is "checkout"."""

# Deterministic shortcuts. These run before the model because they're both
# unambiguous and hot paths — and because a misroute here is expensive
# (a checkout question answered by the menu agent looks broken).
TRACKER_RE = re.compile(
    r"\b(where'?s?|track|status of|eta)\b.*\b(order|food|delivery|driver)\b"
    r"|\b(past|previous|last) orders?\b",
    re.I,
)
CHECKOUT_RE = re.compile(
    r"\b(check\s?out|place (my |the )?order|order now|confirm (my |the )?order|pay now)\b"
    r"|\btip\b",
    re.I,
)
CART_VIEW_RE = re.compile(r"\bwhat'?s? in my (cart|basket)\b|\bview (my )?cart\b", re.I)
# Explicit cart edits. "add two zaatar manakish" is the single most common thing
# anyone says to Goer, and a classifier that sends it to the concierge produces
# a chatty non-answer, so it never reaches the classifier.
CART_EDIT_RE = re.compile(
    r"^\s*(add|remove|delete|drop)\b"
    r"|\b(add|remove|delete|take (out|off)|drop)\b.*\b(to|from)\b.*\b(cart|basket|order)\b"
    r"|\b(clear|empty) (my |the )?(cart|basket)\b"
    r"|\bmake it (\d+|one|two|three|four|five)\b"
    r"|\b(i'?ll have|i want|i'?d like|can i (get|have)|gimme|give me|get me)\b",
    re.I,
)
DIETARY_RE = re.compile(
    r"\b(allerg\w*|gluten|celiac|coeliac|lactose|vegan|vegetarian|halal|dairy[- ]free|nut[- ]free)\b",
    re.I,
)
RECOMMEND_RE = re.compile(
    r"\b(recommend\w*|suggest\w*|what should i (get|order|try)|what'?s popular|surprise me"
    r"|goes (well )?with)\b",
    re.I,
)


def route(message: str, history: list, context: GoerContext, active_agent: str) -> str:
    """Pick the specialist for this turn."""
    if TRACKER_RE.search(message):
        return "tracker"
    if DIETARY_RE.search(message):
        return "dietary"
    if CART_VIEW_RE.search(message):
        return "cart"
    if RECOMMEND_RE.search(message):
        return "recommendation"
    if CHECKOUT_RE.search(message):
        return "checkout"
    if CART_EDIT_RE.search(message):
        return "cart"

    decision = llm_json(
        system=ROUTER_SYSTEM,
        user=message,
        history=history,
        default={},
    )
    chosen = str((decision or {}).get("decision", "")).strip().lower()
    if chosen in SPECIALISTS:
        return chosen

    # Unparseable classification: stay where the conversation already is rather
    # than dumping the customer back on the concierge mid-checkout.
    return active_agent if active_agent in SPECIALISTS else "concierge"


class RouterAgent:
    def plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        active_agent: str = "concierge",
    ) -> tuple[AgentPlan, str]:
        """Guard, route, and let the specialist plan. Returns (plan, language)."""
        language = context.languagePreference
        if language not in ("en", "ar", "fr"):
            language = detect_language(message)

        verdict = guard_agent(message, history)
        if verdict["classification"] == "blocked":
            return (
                AgentPlan(
                    agent=active_agent if active_agent in SPECIALISTS else "concierge",
                    reply=verdict["message"],
                    quick_replies=["Show me the menu", "What's popular?"],
                ),
                language,
            )

        agent = route(message, history, context, active_agent)
        plan = SPECIALISTS[agent](message, history, context, language)
        return plan, language


def run_turn(
    message: str,
    history: list,
    context: GoerContext,
    active_agent: str = "concierge",
) -> ChatResponse:
    """One complete non-streaming turn."""
    plan, language = RouterAgent().plan(message, history, context, active_agent)
    reply = plan.reply if plan.reply is not None else llm(plan.system, message, history)
    return ChatResponse(
        response=reply.strip(),
        agent=plan.agent,
        actions=plan.actions,
        quick_replies=plan.quick_replies,
        language=language,
        blocked=plan.reply is not None and not plan.actions,
    )


def stream_turn(
    message: str,
    history: list,
    context: GoerContext,
    active_agent: str = "concierge",
) -> Iterator[dict]:
    """The same turn as a sequence of SSE payloads.

    Order matters to the client: the agent (so the handoff divider renders
    before any text), then the reply tokens, then the actions to execute, then
    quick replies, then done. Actions arrive after the text because the reply
    was written knowing what they would do — the client applying them last is
    what makes the cards land under the sentence describing them.
    """
    plan, language = RouterAgent().plan(message, history, context, active_agent)
    yield {"type": "agent", "agent": plan.agent, "language": language}

    if plan.reply is not None:
        yield {"type": "token", "token": plan.reply}
    else:
        for token in llm_stream(plan.system, message, history):
            yield {"type": "token", "token": token}

    if plan.actions:
        yield {"type": "actions", "actions": plan.actions}
    if plan.quick_replies:
        yield {"type": "quick_replies", "options": plan.quick_replies}
    yield {"type": "done"}


# Module-level aliases matching SufraAI's `from agents import router` import style.
router = run_turn
router_stream = stream_turn

__all__ = ["RouterAgent", "route", "run_turn", "stream_turn", "router", "router_stream", "AGENT_IDS"]
