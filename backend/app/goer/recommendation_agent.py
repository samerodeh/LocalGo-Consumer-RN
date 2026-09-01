"""Recommendations — the port of SufraAI's `agents/recommendation_agent.py`.

Identical shape: pull the items the customer mentioned out of the message with
a JSON-only extraction call, union them with what's already in the cart, run
those ids through the Apriori engine, and fall back to popularity when there
are no rules to fire. The model's only job is to make the picks sound
appetising — it never chooses them.
"""

from __future__ import annotations

from .agent_utilities import apply_dietary_and_availability, get_menu_items, llm_json, menu_item_by_id
from .menu_index import resolve_item_id
from .prompts import build_system
from .recommender import explain_pairing, get_popular_items, get_recommendations
from .schemas import AgentPlan, GoerContext, action

BRIEF = """You are RECOMMENDATIONS. Suggest the items listed below and say why they work — how they
pair with what's already in the order, or why they're popular. Keep it to 2-4 sentences, mention at
most 3 items, and never suggest anything that isn't in the list."""

EXTRACTOR = """Extract the menu items a customer mentioned.

Return JSON only, no prose and no code fences:
{"items": ["item name", "item name"]}

Use the names as they appear in the menu list below. Return {"items": []} if none are mentioned.

MENU ITEMS:
{names}"""


class RecommendationAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        menu = get_menu_items()
        extracted = llm_json(
            system=EXTRACTOR.replace(
                "{names}", ", ".join(item["name_en"] for item in menu)
            ),
            user=message,
            history=history,
            default={"items": []},
        )
        mentioned_raw = (extracted or {}).get("items", []) if isinstance(extracted, dict) else []
        mentioned_ids = [
            resolved
            for raw in mentioned_raw
            if isinstance(raw, str) and (resolved := resolve_item_id(raw))
        ]

        cart_ids = [line.itemId for line in context.cart]
        basis_ids = list(dict.fromkeys(mentioned_ids + cart_ids))

        rec_ids = get_recommendations(basis_ids) if basis_ids else get_popular_items()
        rec_items = [item for rid in rec_ids if (item := menu_item_by_id(rid))]

        # Respect the saved dietary profile — a recommendation that breaks it is
        # worse than no recommendation.
        allowed = apply_dietary_and_availability(rec_items, context.profile_dict())
        if not allowed:
            allowed = apply_dietary_and_availability(
                [item for rid in get_popular_items(exclude=cart_ids, top_n=8) if (item := menu_item_by_id(rid))],
                context.profile_dict(),
            )
        rec_items = allowed[:3]

        actions: list[dict] = []
        outcome = "No recommendation cards were shown."
        if rec_items:
            actions.append(action("show_menu_items", item_ids=[item["id"] for item in rec_items]))
            outcome = "Showed recommendation cards for: " + ", ".join(
                item["name_en"] for item in rec_items
            )

        if basis_ids:
            basis_names = [
                item["name_en"] for bid in basis_ids if (item := menu_item_by_id(bid))
            ]
            basis = "based on what's in the order: " + ", ".join(basis_names)
        else:
            basis = "based on what's most popular at Al Taib"

        lines = []
        for item in rec_items:
            reason = next(
                (
                    explanation
                    for bid in basis_ids
                    if (explanation := explain_pairing(bid, item["id"]))
                ),
                None,
            )
            entry = (
                f"- {item['name_en']} (${item['price']:.2f}, {item['category']})"
                f"{': ' + item['description_en'] if item.get('description_en') else ''}"
            )
            if reason:
                entry += f" [why: {reason}]"
            lines.append(entry)

        context_block = "\n".join(
            [
                f"RECOMMENDATION BASIS: {basis}.",
                "",
                "RECOMMENDED ITEMS (suggest only these):",
                *(lines or ["- none available"]),
                "",
                "The 'why' notes come from association rules mined from real order history. "
                "Turn them into natural language — never quote the numbers at the customer.",
            ]
        )

        return AgentPlan(
            agent="recommendation",
            system=build_system(f"{BRIEF}\n\n{context_block}", context, language, outcome),
            actions=actions,
            quick_replies=(
                [f"Add {rec_items[0]['name_en']}" for _ in [0]] + ["Show me the menu", "Checkout"]
                if rec_items
                else ["Show me the menu"]
            ),
        )


def recommendation_agent(
    message: str, history: list, context: GoerContext, language: str
) -> AgentPlan:
    return RecommendationAgent().get_agent_plan(message, history, context, language)
