"""Apriori + popularity recommendations — the port of SufraAI's `recomender.py`.

Reads the artefacts `scripts/train_recommender.py` produces. No model is loaded
at runtime: association rules are a dict lookup, which is why this can sit
inside a chat turn without adding latency.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

TRAINED = Path(__file__).resolve().parent / "data" / "trained"


@lru_cache(maxsize=2)
def _load(filename: str):
    path = TRAINED / filename
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_recommendations(cart_item_ids: list[str], top_n: int = 3) -> list[str]:
    """Items to suggest next, given what's already in the cart.

    Confidence accumulates across rules, so an item recommended by two of the
    cart's items outranks one backed by a single stronger rule.
    """
    rules = _load("apriori_recommendations.json")
    scores: dict[str, float] = {}

    for item_id in cart_item_ids:
        for match in rules.get(item_id, []):
            for rec_id in match["itemIds"]:
                if rec_id in cart_item_ids:
                    continue  # never recommend what they already have
                scores[rec_id] = scores.get(rec_id, 0) + match["confidence"]

    if scores:
        ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
        return [item_id for item_id, _ in ranked[:top_n]]

    return get_popular_items(exclude=cart_item_ids, top_n=top_n)


def get_popular_items(
    category: str | None = None, exclude: list[str] | None = None, top_n: int = 5
) -> list[str]:
    popularity = _load("popularity_recommendations.json")
    excluded = set(exclude or [])
    filtered = [
        entry
        for entry in popularity
        if entry["itemId"] not in excluded
        and (category is None or entry.get("category") == category)
    ]
    return [entry["itemId"] for entry in filtered[:top_n]]


def explain_pairing(item_id: str, rec_id: str) -> str | None:
    """Human-readable strength of a rule, for the recommendation prompt."""
    for match in _load("apriori_recommendations.json").get(item_id, []):
        if rec_id in match["itemIds"]:
            return (
                f"{round(match['confidence'] * 100)}% of orders with this item also "
                f"include it (lift {match['lift']:g})"
            )
    return None
