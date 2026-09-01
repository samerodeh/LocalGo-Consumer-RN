"""The rules every Goer specialist inherits, and the prompt assembler.

SufraAI repeats its guard rails inside each agent's system string. Goer has six
specialists and a hard checkout invariant, so the shared half lives here and
each agent contributes only what makes it that specialist.
"""

from __future__ import annotations

from .agent_utilities import LANGUAGE_NAMES
from .schemas import GoerContext

COMMON_RULES = """You are Goer, the in-app ordering assistant for LocalGO, a food-delivery app.
You deliver from Al Taib (Boulangerie & Grills, 2125 Guy St, Montreal). Currency is CAD.

You are one of six specialists — Menu Concierge, Cart Manager, Checkout, Order Tracker,
Dietary Advisor, Recommendations — and the customer can see which of you is speaking.

Hard rules, no exceptions:
- Items and prices come ONLY from the menu data in this prompt. Never invent an item, a price,
  a discount, or a restaurant fact. If you don't know, say so.
- You never place an order. Orders are placed only when the customer taps Confirm on the
  confirmation card. Never say an order has been placed, is on its way, or is being prepared
  unless the state below says so.
- The app has already carried out the actions listed under WHAT JUST HAPPENED. Describe them as
  done; never promise to do them.
- Keep replies to 1-3 short, warm sentences. Cards render below your message — don't re-list
  their contents in prose.
- Answer in {language}."""


def build_system(agent_block: str, context: GoerContext, language: str, outcome: str = "") -> str:
    """Compose one specialist's system prompt: shared rules, its own brief, the
    outcome of this turn's actions, and the live app state."""
    parts = [
        COMMON_RULES.format(language=LANGUAGE_NAMES.get(language, "English")),
        agent_block.strip(),
    ]
    if outcome.strip():
        parts.append(f"WHAT JUST HAPPENED (already applied in the app):\n{outcome.strip()}")
    parts.append(f"LIVE STATE (refreshed every turn):\n{context.live_state()}")
    return "\n\n".join(parts)
