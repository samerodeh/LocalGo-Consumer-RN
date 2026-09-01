"""Menu Concierge — the port of SufraAI's `agents/menu_agent.py`.

Answers "what do you have", "what's in the shish taouk", "how much is delivery"
by retrieving from both ChromaDB collections (menu + FAQ), then decides which
items deserve a card so the customer sees photos and prices instead of a wall
of text.
"""

from __future__ import annotations

from .agent_utilities import compact_menu, describe_item, get_menu_items, llm_json, menu_item_by_id
from .menu_index import resolve_category, resolve_item_id, search_items
from .prompts import build_system
from .rag import query_faq, query_menu, query_menu_structured
from .schemas import AgentPlan, GoerContext, action

BRIEF = """You are the MENU CONCIERGE. Help the customer browse Al Taib's menu, understand what's
in a dish, and answer questions about how LocalGO works (delivery area, fees, timing, payment).
Recommend at most 2-3 items at a time. If the customer wants something added to their cart, say
you'll add it — the Cart Manager takes over automatically."""

CARD_PICKER = """You pick which menu items deserve a visual card in a chat reply.
Given the customer's message and the candidate items, return the ids worth showing.

Return JSON only, no prose and no code fences:
{"item_ids": ["id", "id"], "category": "" }

Rules:
- At most 4 ids, ordered most relevant first.
- Use "category" instead (and leave item_ids empty) when the customer asked to browse a whole
  section, e.g. "show me the pizzas".
- Return {"item_ids": [], "category": ""} when the question is factual (hours, fees, allergens of
  one item they already know) and cards would add nothing."""


class MenuAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        menu_hits = query_menu(message, n=6)
        faq_hits = query_faq(message, n=3)
        structured = query_menu_structured(message, n=6)

        candidates = [
            row["id"] for row in structured if row.get("id") and menu_item_by_id(row["id"])
        ]
        candidate_text = "\n".join(
            describe_item(menu_item_by_id(item_id)) + f" [id: {item_id}]"
            for item_id in candidates
        )

        picked = llm_json(
            system=CARD_PICKER,
            user=f"Customer message: {message}\n\nCandidate items:\n{candidate_text}",
            default={"item_ids": [], "category": ""},
        )
        picked = picked if isinstance(picked, dict) else {}

        actions: list[dict] = []
        outcome = ""

        category = resolve_category(str(picked.get("category") or "")) or _category_from_message(
            message
        )
        item_ids = [
            resolved
            for raw in (picked.get("item_ids") or [])
            if (resolved := resolve_item_id(str(raw)))
        ][:4]

        if category and not item_ids:
            actions.append(action("show_category", category=category))
            outcome = f"Showed the customer the '{category}' section as item cards."
        elif item_ids:
            actions.append(action("show_menu_items", item_ids=item_ids))
            shown = ", ".join(
                menu_item_by_id(i)["name_en"] for i in item_ids if menu_item_by_id(i)
            )
            outcome = f"Showed item cards for: {shown}."

        context_block = "\n".join(
            [
                "RETRIEVED MENU DATA (the only items and prices you may cite):",
                *menu_hits,
                "",
                "RETRIEVED LOCALGO FACTS:",
                *faq_hits,
                "",
                "MENU SECTIONS: " + ", ".join(_sections()),
            ]
        )

        return AgentPlan(
            agent="concierge",
            system=build_system(f"{BRIEF}\n\n{context_block}", context, language, outcome),
            actions=actions,
            quick_replies=_quick_replies(context),
        )


def _sections() -> list[str]:
    seen: list[str] = []
    for item in get_menu_items():
        if item["category"] not in seen:
            seen.append(item["category"])
    return seen


def _category_from_message(message: str) -> str | None:
    """Catch a plain "show me the drinks" the picker may have shrugged at."""
    lowered = message.lower()
    if not any(word in lowered for word in ("show", "browse", "see", "list", "what", "have")):
        return None
    return resolve_category(message)


def _quick_replies(context: GoerContext) -> list[str]:
    if context.cart:
        return ["What's in my cart?", "Recommend something", "Checkout"]
    return ["Show me the pizzas", "What's popular?", "Anything vegetarian?"]


def menu_agent(message: str, history: list, context: GoerContext, language: str) -> AgentPlan:
    return MenuAgent().get_agent_plan(message, history, context, language)


def menu_search_ids(message: str, limit: int = 4) -> list[str]:
    """Used by other agents that want cards for a free-text menu query."""
    return [item["id"] for item in search_items(message, limit)]


def full_menu_for_prompt() -> str:
    return compact_menu(with_descriptions=True)
