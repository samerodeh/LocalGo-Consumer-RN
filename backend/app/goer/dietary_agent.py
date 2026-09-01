"""Dietary Advisor — the port of SufraAI's `agents/dietary_agent.py`.

Allergies and restrictions are the one place a hallucinated menu fact could
actually hurt someone, so this agent does not ask the model to filter. It
filters the menu itself with `apply_dietary_and_availability` (the same helper
SufraAI uses), hands the model only what survived, and always tells severe-allergy
customers to confirm with the restaurant.
"""

from __future__ import annotations

from .agent_utilities import (
    apply_dietary_and_availability,
    describe_item,
    get_menu_items,
    llm_json,
)
from .menu_index import search_items
from .prompts import build_system
from .rag import query_menu
from .recommender import get_popular_items
from .schemas import AgentPlan, GoerContext, action

BRIEF = """You are the DIETARY ADVISOR. Help with allergies, intolerances, and diets.

- Al Taib is a halal kitchen: every item is halal.
- The SAFE ITEMS list below has already been filtered against everything the customer told you
  they avoid. Recommend only from it. If it's empty, say plainly that nothing on the menu fits.
- The EXCLUDED list is there so you can explain *why* something was ruled out if asked.
- Always add that anyone with a severe allergy should confirm with the restaurant directly before
  ordering — allergen lists describe recipes, not a shared kitchen."""

CONSTRAINTS = """Extract the dietary constraints stated in a customer's message.

Return JSON only, no prose and no code fences:
{"vegan": false, "vegetarian": false, "halal": false, "allergies": []}

"allergies" uses only these values where they apply: gluten, dairy, nuts, sesame, fish, shellfish,
eggs, soy. Return everything false and an empty list if the message states no constraint."""


class DietaryAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        stated = llm_json(system=CONSTRAINTS, user=message, history=history, default={})
        stated = stated if isinstance(stated, dict) else {}

        # The saved profile and whatever they just said, unioned — a stated
        # constraint never loosens a saved one.
        saved = context.dietaryProfile
        profile = {
            "dietaryProfile": {
                "vegan": bool(saved.vegan or stated.get("vegan")),
                "vegetarian": bool(saved.vegetarian or stated.get("vegetarian")),
                "halal": bool(saved.halal or stated.get("halal")),
                "allergies": sorted(
                    {a.lower() for a in saved.allergies}
                    | {
                        str(a).lower()
                        for a in (stated.get("allergies") or [])
                        if isinstance(a, str)
                    }
                ),
            }
        }

        all_items = get_menu_items()
        safe = apply_dietary_and_availability(all_items, profile)
        safe_ids = {item["id"] for item in safe}
        excluded = [item for item in all_items if item["id"] not in safe_ids]

        # Rank the safe set by what they actually asked about. "I'm gluten
        # intolerant" names no dish, so the search comes back empty — fall back
        # to what people actually order rather than to menu order, which would
        # surface whatever happens to sit at the top of the file.
        preferred = [item for item in search_items(message, limit=8) if item["id"] in safe_ids]
        popular = [
            item
            for rec_id in get_popular_items(top_n=25)
            if (item := next((i for i in safe if i["id"] == rec_id), None))
        ]
        seen: set[str] = set()
        highlights = [
            item
            for item in (preferred + popular + safe)
            if not (item["id"] in seen or seen.add(item["id"]))
        ][:4]

        actions: list[dict] = []
        outcome = "No items were shown."
        if highlights:
            actions.append(action("show_menu_items", item_ids=[item["id"] for item in highlights]))
            outcome = (
                "Showed item cards for: "
                + ", ".join(item["name_en"] for item in highlights)
                + " — all of them pass the customer's dietary filter."
            )

        constraints = profile["dietaryProfile"]
        constraint_text = ", ".join(
            filter(
                None,
                [
                    "vegan" if constraints["vegan"] else "",
                    "vegetarian" if constraints["vegetarian"] else "",
                    "halal-only" if constraints["halal"] else "",
                    (
                        "avoiding " + ", ".join(constraints["allergies"])
                        if constraints["allergies"]
                        else ""
                    ),
                ],
            )
        ) or "none stated"

        context_block = "\n".join(
            [
                f"CONSTRAINTS IN EFFECT: {constraint_text}",
                "",
                f"SAFE ITEMS ({len(safe)} of {len(all_items)} pass the filter):",
                *[describe_item(item) for item in safe[:25]],
                "",
                f"EXCLUDED ({len(excluded)} items) — a sample with the reason visible in their allergens:",
                *[describe_item(item) for item in excluded[:10]],
                "",
                "RETRIEVED FOR THIS QUESTION:",
                *query_menu(message, n=4),
            ]
        )

        return AgentPlan(
            agent="dietary",
            system=build_system(f"{BRIEF}\n\n{context_block}", context, language, outcome),
            actions=actions,
            quick_replies=["Add one of these", "Show me more options", "What's popular?"],
        )


def dietary_agent(message: str, history: list, context: GoerContext, language: str) -> AgentPlan:
    return DietaryAgent().get_agent_plan(message, history, context, language)
