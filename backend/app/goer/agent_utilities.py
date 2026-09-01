"""Shared helpers every Goer agent uses — the port of SufraAI's
`agents/agent_utilities.py`.

One Groq client, one `llm()` entry point, plus the menu/language/dietary
helpers the specialists lean on. Keeping these in one module is what lets each
agent file stay as small as it is.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator

from groq import Groq

from .. import config

DATA_DIR = Path(__file__).resolve().parent / "data"

_client: Groq | None = None


def client() -> Groq:
    """Lazily built so importing this module never requires a key — the app
    falls back to its on-device assistant when Goer isn't configured."""
    global _client
    if _client is None:
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured")
        _client = Groq(api_key=config.GROQ_API_KEY)
    return _client


def llm(system: str, user: str, history: list | None = None) -> str:
    """One completion. Same signature as SufraAI's so the agents read alike."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    messages += _clean_history(history)
    messages.append({"role": "user", "content": user})
    response = client().chat.completions.create(
        model=config.GOER_MODEL,
        messages=messages,
        temperature=config.GOER_TEMPERATURE,
        max_tokens=config.GOER_MAX_TOKENS,
    )
    return response.choices[0].message.content or ""


def llm_stream(system: str, user: str, history: list | None = None) -> Iterator[str]:
    """Token stream for the SSE endpoint — the same call with `stream=True`."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    messages += _clean_history(history)
    messages.append({"role": "user", "content": user})
    stream = client().chat.completions.create(
        model=config.GOER_MODEL,
        messages=messages,
        temperature=config.GOER_TEMPERATURE,
        max_tokens=config.GOER_MAX_TOKENS,
        stream=True,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield token


def llm_json(system: str, user: str, history: list | None = None, default: Any = None) -> Any:
    """A completion that must come back as JSON.

    Small instruct models wrap JSON in prose or fences often enough that the
    bare `json.loads` + `except` SufraAI uses throws away good answers, so this
    strips fences and falls back to the outermost {...} / [...] span before
    giving up and returning `default`.
    """
    raw = llm(system, user, history)
    parsed = parse_json(raw)
    return default if parsed is None else parsed


def parse_json(raw: str) -> Any | None:
    text = (raw or "").strip()
    if not text:
        return None
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    return None


def _clean_history(history: list | None) -> list[dict[str, str]]:
    """Keep only well-formed user/assistant text turns.

    The transcript comes from the phone, where it also holds rich widget
    messages (menu cards, confirmation cards). Those are dropped here rather
    than at the edge so every agent gets the same clean history.
    """
    cleaned: list[dict[str, str]] = []
    for message in history or []:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = message.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            cleaned.append({"role": role, "content": content})
    return cleaned[-config.GOER_MAX_HISTORY :]


# ── Language ──────────────────────────────────────────────────────────────────

def detect_language(text: str) -> str:
    """Arabic if the message contains Arabic script, French for a few common
    French markers (this is Montreal), English otherwise."""
    for ch in text:
        if "؀" <= ch <= "ۿ":
            return "ar"
    lowered = f" {text.lower()} "
    french_markers = (
        " je ", " veux ", " bonjour ", " merci ", " s'il ", " commande ", " livraison ",
        " poulet ", " boeuf ", " avec ", " pour ", " est-ce ", " voudrais ", " panier ",
    )
    if any(marker in lowered for marker in french_markers):
        return "fr"
    return "en"


LANGUAGE_NAMES = {"en": "English", "ar": "Arabic", "fr": "French"}


def localize(text_en: str, text_ar: str, lang: str, text_fr: str | None = None) -> str:
    if lang == "ar":
        return text_ar
    if lang == "fr" and text_fr:
        return text_fr
    return text_en


# ── Menu ──────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_menu_items() -> list[dict]:
    with open(DATA_DIR / "menu.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def get_faqs() -> list[dict]:
    with open(DATA_DIR / "faq.json", "r", encoding="utf-8") as f:
        return json.load(f)["faqs"]


@lru_cache(maxsize=1)
def _menu_by_id() -> dict[str, dict]:
    return {item["id"]: item for item in get_menu_items()}


def menu_item_by_id(item_id: str) -> dict | None:
    return _menu_by_id().get(item_id)


@lru_cache(maxsize=1)
def menu_categories() -> list[str]:
    seen: list[str] = []
    for item in get_menu_items():
        if item["category"] not in seen:
            seen.append(item["category"])
    return seen


def items_in_category(category: str) -> list[dict]:
    return [item for item in get_menu_items() if item["category"] == category]


def apply_dietary_and_availability(items: list[dict], profile: dict | None) -> list[dict]:
    """Drop anything sold out or ruled out by the user's dietary profile."""
    dietary = (profile or {}).get("dietaryProfile", {}) or {}
    allergies = {a.lower() for a in (dietary.get("allergies") or [])}
    vegan = bool(dietary.get("vegan"))
    vegetarian = bool(dietary.get("vegetarian"))
    halal = bool(dietary.get("halal"))

    filtered = []
    for item in items:
        if not item.get("available", True):
            continue
        tags = {t.lower() for t in item.get("diet_tags", [])}
        allergens = {a.lower() for a in item.get("allergens", [])}
        if vegan and "vegan" not in tags:
            continue
        if vegetarian and not ({"vegan", "vegetarian"} & tags):
            continue
        if halal and "halal" not in tags:
            continue
        if allergies & allergens:
            continue
        filtered.append(item)
    return filtered


def compact_menu(with_descriptions: bool = False, items: list[dict] | None = None) -> str:
    """One line per item — compact enough to sit inside a system prompt."""
    lines = []
    for item in items if items is not None else get_menu_items():
        line = (
            f"{item['id']} | {item['name_en']} | ${item['price']:.2f} | {item['category']}"
        )
        if with_descriptions and item.get("description_en"):
            line += f" | {item['description_en']}"
        if not item.get("available", True):
            line += " | SOLD OUT"
        lines.append(line)
    return "\n".join(lines)


def describe_item(item: dict) -> str:
    parts = [f"{item['name_en']} (${item['price']:.2f}, {item['category']})"]
    if item.get("description_en"):
        parts.append(item["description_en"])
    if item.get("allergens"):
        parts.append(f"Allergens: {', '.join(item['allergens'])}")
    if item.get("diet_tags"):
        parts.append(f"Diet: {', '.join(item['diet_tags'])}")
    return " — ".join(parts)
