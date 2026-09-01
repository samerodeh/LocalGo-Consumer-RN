"""Server-side menu resolution: text -> menu item id.

Deliberately conservative. The client already ships a well-tested fuzzy
resolver (`src/goer/menuIndex.ts`) that knows how to come back "ambiguous" and
ask the user, and the cart tools accept a free-text `query` as well as an
`item_id`. So this module resolves only what it can do *confidently* — exact
ids, exact names, normalised names, and unique substring hits — and hands
anything murkier to the client as a `query`, where the ambiguity path already
exists.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

from .agent_utilities import get_menu_items, menu_categories

STOP_WORDS = {
    "a", "an", "the", "of", "some", "please", "me", "my", "and", "with", "order",
    "large", "small", "one", "two", "three", "get", "add", "want", "like",
}


def normalize(text: str) -> str:
    lowered = unicodedata.normalize("NFD", (text or "").lower())
    stripped = "".join(ch for ch in lowered if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", stripped)).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in normalize(text).split(" ") if t and t not in STOP_WORDS]


@lru_cache(maxsize=1)
def _lookup() -> dict[str, str]:
    """normalised name/id -> item id, for O(1) exact hits."""
    table: dict[str, str] = {}
    for item in get_menu_items():
        table[normalize(item["id"])] = item["id"]
        table[normalize(item["name_en"])] = item["id"]
        if item.get("name_ar"):
            table[item["name_ar"].strip()] = item["id"]
    return table


def resolve_item_id(text: str) -> str | None:
    """An item id when the text names exactly one item, else None."""
    if not text:
        return None
    raw = text.strip()

    # Exact id straight from the model.
    for item in get_menu_items():
        if raw == item["id"]:
            return item["id"]

    key = normalize(raw)
    if key in _lookup():
        return _lookup()[key]
    if raw.strip() in _lookup():  # Arabic name, unnormalised
        return _lookup()[raw.strip()]

    # Tolerate plurals the model adds ("2 pepperoni slices").
    singular = re.sub(r"s\b", "", key).strip()
    if singular and singular in _lookup():
        return _lookup()[singular]

    # Unique substring / token-subset hit. Anything with more than one
    # candidate is left for the client's ambiguity flow.
    query_tokens = set(_tokens(raw))
    if not query_tokens:
        return None
    matches = []
    for item in get_menu_items():
        name_key = normalize(item["name_en"])
        name_tokens = set(_tokens(item["name_en"]))
        if key and (key in name_key or name_key in key):
            matches.append(item["id"])
        elif query_tokens and query_tokens <= name_tokens:
            matches.append(item["id"])
    return matches[0] if len(matches) == 1 else None


def resolve_category(text: str) -> str | None:
    """Fuzzy category lookup: "pizzas" -> "Pizza", "drink" -> "Drinks"."""
    key = normalize(text)
    if not key:
        return None
    for category in menu_categories():
        cat = normalize(category)
        if key in (cat, f"{cat}s") or f"{key}s" == cat or cat in key or key in cat:
            return category
    query_tokens = set(_tokens(text))
    for category in menu_categories():
        if query_tokens & set(_tokens(category)):
            return category
    return None


def search_items(text: str, limit: int = 6) -> list[dict]:
    """Loose ranked search over names, categories, and descriptions.

    Used to turn a retrieval hit or a recommendation into item cards.
    """
    query_tokens = _tokens(text)
    if not query_tokens:
        return []

    scored: list[tuple[int, dict]] = []
    for item in get_menu_items():
        name_tokens = set(_tokens(item["name_en"]))
        haystack = normalize(
            f"{item['name_en']} {item['category']} {item.get('description_en', '')}"
        )
        score = 0
        for token in query_tokens:
            if token in name_tokens:
                # Exact name token — safe at any length, so "7 up" still works.
                score += 10
            elif len(token) >= 3 and any(token in name_token for name_token in name_tokens):
                score += 6
            elif len(token) >= 4 and token in haystack:
                # Length-gated: contraction fragments ("I'm" -> "i", "m") are
                # substrings of nearly every item and would score the whole menu.
                score += 3
        if score:
            scored.append((score, item))

    scored.sort(key=lambda pair: (-pair[0], pair[1]["name_en"]))
    return [item for _, item in scored[:limit]]
