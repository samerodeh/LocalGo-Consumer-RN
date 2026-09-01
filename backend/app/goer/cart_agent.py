"""Cart Manager — the port of SufraAI's `agents/order_agent.py`.

Same two-phase shape as SufraAI's order agent: a JSON-only extraction call
works out what the customer wants done, the server turns that into concrete
tool calls, and only then does a second call write the sentence the customer
reads — with the outcome already in its prompt, so it can't claim something
that didn't happen.

Where SufraAI writes the order straight into SQLite, the cart here lives on the
phone, so the operations travel back as `actions` for the client's executors.
"""

from __future__ import annotations

from .agent_utilities import compact_menu, llm_json, menu_item_by_id
from .menu_index import resolve_item_id
from .prompts import build_system
from .rag import query_menu
from .schemas import AgentPlan, GoerContext, action

BRIEF = """You are the CART MANAGER. You add, remove, and re-quantify items, and you confirm what
changed in one short sentence. Never guess between two similar items — if the app came back saying
a request was ambiguous, ask the customer which one they meant. When the cart is ready, tell them
they can say "checkout"."""

EXTRACTOR = """You turn a customer's message into cart operations for a food-delivery app.

Return JSON only, no prose and no code fences:
{
  "operations": [
    {"op": "add",    "item": "menu item name or id", "quantity": 1},
    {"op": "remove", "item": "menu item name or id"},
    {"op": "set",    "item": "menu item name or id", "quantity": 3},
    {"op": "view"},
    {"op": "clear"}
  ]
}

Rules:
- Use the exact item id from the MENU list when you can identify one; otherwise put the customer's
  own words in "item" and the app will resolve them.
- "op": "set" is for an explicit quantity ("make it 3 cokes"); "add" is for adding more.
- "remove" takes the whole line out. "clear" empties the cart — only when the customer clearly
  asks to start over.
- "view" is for "what's in my cart".
- Return {"operations": []} if the message asks for none of this.
- Only use items that appear in the MENU list below.

MENU:
{menu}"""


class CartAgent:
    def get_agent_plan(
        self,
        message: str,
        history: list,
        context: GoerContext,
        language: str,
    ) -> AgentPlan:
        extracted = llm_json(
            system=EXTRACTOR.replace("{menu}", compact_menu()),
            user=message,
            history=history,
            default={"operations": []},
        )
        operations = extracted.get("operations", []) if isinstance(extracted, dict) else []

        actions: list[dict] = []
        applied: list[str] = []

        for operation in operations if isinstance(operations, list) else []:
            if not isinstance(operation, dict):
                continue
            op = str(operation.get("op", "")).lower()
            raw_item = str(operation.get("item", "") or "").strip()
            item_id = resolve_item_id(raw_item) if raw_item else None
            item = menu_item_by_id(item_id) if item_id else None
            label = item["name_en"] if item else raw_item
            quantity = _clamp_quantity(operation.get("quantity"))

            if op == "add" and (item_id or raw_item):
                actions.append(
                    action(
                        "add_to_cart",
                        items=[
                            {
                                **({"item_id": item_id} if item_id else {"query": raw_item}),
                                "quantity": quantity or 1,
                            }
                        ],
                    )
                )
                applied.append(f"Asked the app to add {quantity or 1}x {label} to the cart.")
            elif op == "remove" and (item_id or raw_item):
                actions.append(
                    action(
                        "remove_from_cart",
                        **({"item_id": item_id} if item_id else {"query": raw_item}),
                    )
                )
                applied.append(f"Asked the app to remove {label} from the cart.")
            elif op == "set" and (item_id or raw_item) and quantity is not None:
                actions.append(
                    action(
                        "set_quantity",
                        quantity=quantity,
                        **({"item_id": item_id} if item_id else {"query": raw_item}),
                    )
                )
                applied.append(f"Asked the app to set {label} to {quantity}.")
            elif op == "view":
                actions.append(action("view_cart"))
                applied.append("Showed the customer their cart summary card.")
            elif op == "clear":
                actions.append(action("clear_cart"))
                applied.append("Emptied the cart.")

        # Merge consecutive adds into one call so the client reports one result.
        actions = _merge_adds(actions)

        outcome = "\n".join(applied) if applied else ""
        if not applied:
            outcome = (
                "Nothing was changed in the cart — the message didn't name an item clearly. "
                "Ask what they'd like, or offer to show the menu."
            )

        relevant = query_menu(message, n=5)
        context_block = "\n".join(
            [
                "RELEVANT MENU DATA (retrieved for this message):",
                *relevant,
                "",
                "NOTE: the app resolves item names itself and will report back if a name matched "
                "more than one item. If that happens, ask the customer which one they meant.",
            ]
        )

        return AgentPlan(
            agent="cart",
            system=build_system(f"{BRIEF}\n\n{context_block}", context, language, outcome),
            actions=actions,
            quick_replies=(
                ["Checkout", "Add something else", "What's in my cart?"] if applied else []
            ),
        )


def _clamp_quantity(raw) -> int | None:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return max(0, min(20, value))


def _merge_adds(actions: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for current in actions:
        previous = merged[-1] if merged else None
        if (
            previous
            and previous["tool"] == "add_to_cart"
            and current["tool"] == "add_to_cart"
        ):
            previous["input"]["items"].extend(current["input"]["items"])
            continue
        merged.append(current)
    return merged


def cart_agent(message: str, history: list, context: GoerContext, language: str) -> AgentPlan:
    return CartAgent().get_agent_plan(message, history, context, language)
