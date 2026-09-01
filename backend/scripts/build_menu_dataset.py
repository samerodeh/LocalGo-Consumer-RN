"""Generate the Goer's menu.json from the app's source of truth (src/data/menu.ts).

`src/data/menu.ts` is what the React Native app renders, so it must stay the one
place item ids, names, and prices are edited. This script reads it and emits
`app/goer/data/menu.json` in the SufraAI menu schema — the extra fields the
agents and the RAG index need (bilingual names, ingredients, allergens, diet
tags, meal period) are derived here from the item name/description/category.

Run after any menu edit:

    python scripts/build_menu_dataset.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
MENU_TS = BACKEND.parent / "src" / "data" / "menu.ts"
OUT = BACKEND / "app" / "goer" / "data" / "menu.json"

# One `{ id: '...', name: '...', ... }` object literal per line in menu.ts.
FIELD = re.compile(
    r"id:\s*'(?P<id>[^']*)',\s*"
    r"name:\s*'(?P<name>(?:[^'\\]|\\.)*)',\s*"
    r"category:\s*'(?P<category>[^']*)',\s*"
    r"price:\s*(?P<price>[\d.]+),\s*"
    r"icon:\s*'(?P<icon>[^']*)',\s*"
    r"itemDescription:\s*(?P<description>null|'(?:[^'\\]|\\.)*'),"
)

# ── Derivation tables ─────────────────────────────────────────────────────────
# Keyword → (ingredients, allergens, diet tags). Longest match wins per bucket,
# and every rule that fires contributes; the item's own description adds more.

ALLERGEN_KEYWORDS: dict[str, list[str]] = {
    "gluten": [
        "pizza", "manakish", "pie", "sandwich", "bread", "pita", "baklava",
        "cheesecake", "fatoush", "tabouleh", "poutine", "trio", "burger",
    ],
    "dairy": [
        "cheese", "mozzarella", "akawi", "feta", "fromage", "cheesecake",
        "poutine", "ayran", "yogurt", "baklava",
    ],
    "nuts": ["baklava", "nuts"],
    "sesame": ["zaatar", "sesame", "hummus", "tahini", "shawarma", "falafel"],
    "fish": ["tuna", "salmon"],
    "shellfish": ["shrimp"],
    "eggs": ["mayonnaise", "cheesecake"],
    "soy": ["soy"],
}

MEAT_KEYWORDS = [
    "pepperoni", "chicken", "poulet", "beef", "boeuf", "kafta", "sojuk", "sojok",
    "shawarma", "taouk", "lahmbajine", "steak", "merguez", "meat", "lamb",
    "kabab", "kebab", "mexican", "hawaiian", "all dressed", "trio", "grill",
]
FISH_KEYWORDS = ["tuna", "salmon", "shrimp", "fish"]
DAIRY_KEYWORDS = [
    "cheese", "mozzarella", "akawi", "feta", "fromage", "cheesecake", "poutine",
    "ayran", "yogurt", "baklava", "milk",
]
GLUTEN_KEYWORDS = ALLERGEN_KEYWORDS["gluten"]

# Category → the meal period the kitchen serves it in.
MEAL_PERIOD: dict[str, str] = {
    "Create your bowl": "all-day",
    "Pizza Slices": "all-day",
    "Pizza": "all-day",
    "Manakish and Pies": "breakfast",
    "Grills": "lunch",
    "Sides": "all-day",
    "Drinks": "all-day",
}

# Arabic names for the recurring words in Al Taib's menu. Composed left to right
# so "Cheese Pizza Slice" becomes a sensible Arabic phrase without a translator.
AR_WORDS: dict[str, str] = {
    "cheese": "جبنة",
    "pizza": "بيتزا",
    "slice": "شريحة",
    "pepperoni": "بيبروني",
    "all dressed": "كامل الإضافات",
    "veggie": "خضار",
    "vegetarian": "نباتي",
    "chicken": "دجاج",
    "poulet": "دجاج",
    "mexican": "مكسيكي",
    "hawaiian": "هاوايي",
    "spinach": "سبانخ",
    "tuna": "تونة",
    "zaatar": "زعتر",
    "manakish": "مناقيش",
    "kafta": "كفتة",
    "sojuk": "سجق",
    "sojok": "سجق",
    "lahmbajine": "لحم بعجين",
    "feta": "فيتا",
    "pie": "فطيرة",
    "falafel": "فلافل",
    "sandwich": "ساندويش",
    "fromage": "جبنة",
    "shish taouk": "شيش طاووق",
    "shawarma": "شاورما",
    "beef": "لحم بقري",
    "boeuf": "لحم بقري",
    "plate": "صحن",
    "trio": "ثلاثية",
    "combo": "كومبو",
    "hummus": "حمص",
    "poutine": "بوتين",
    "fries": "بطاطا مقلية",
    "cheesecake": "تشيز كيك",
    "tabouleh": "تبولة",
    "fatoush": "فتوش",
    "hot potato": "بطاطا حارة",
    "basmati rice": "أرز بسمتي",
    "cabbage salad": "سلطة ملفوف",
    "baklava": "بقلاوة",
    "patesserie": "حلويات",
    "salad bar": "بار السلطة",
    "steak": "ستيك",
    "merguez": "مرقاز",
    "coke": "كوكا كولا",
    "diet": "دايت",
    "pepsi": "بيبسي",
    "redbull": "ريد بُل",
    "apple juice": "عصير تفاح",
    "perrier": "بيريه",
    "water": "مياه",
    "fanta": "فانتا",
    "sprite": "سبرايت",
    "ayran": "عيران",
    "create your bowl": "اصنع وعاءك",
    "half": "نصف",
    "and": "و",
}

# Ingredient vocabulary pulled straight out of the description text.
INGREDIENT_WORDS = [
    "sauce", "mozzarella", "pepperoni", "mushrooms", "green pepper", "green peppers",
    "black olives", "fresh tomatoes", "tomatoes", "tomato puree", "chicken", "spicy beef",
    "beef", "pineapple", "spinach", "tuna", "garlic", "thyme", "sumac", "sesame seeds",
    "akawi cheese", "ground-beef", "kafta spices", "sujok spices", "onions", "onion",
    "seven spices", "parsley", "lemon", "feta", "filo", "chopped nuts", "honey",
    "canned drink", "small potato", "rice", "potato",
]


def _clean(raw: str | None) -> str | None:
    if raw is None or raw == "null":
        return None
    return raw.strip("'").replace("\\'", "'").replace("\\\\", "\\")


def arabic_name(name: str) -> str:
    """Compose an Arabic name from the phrase table, longest phrase first."""
    remaining = name.lower()
    parts: list[str] = []
    for phrase in sorted(AR_WORDS, key=len, reverse=True):
        if phrase in remaining:
            parts.append(AR_WORDS[phrase])
            remaining = remaining.replace(phrase, " ")
    return " ".join(parts) if parts else name


def derive_ingredients(name: str, description: str | None) -> list[str]:
    haystack = f"{name} {description or ''}".lower()
    found = [w for w in INGREDIENT_WORDS if w in haystack]
    # Drop a word when a longer phrase containing it already matched
    # ("tomatoes" alongside "fresh tomatoes").
    return sorted({w for w in found if not any(w != o and w in o for o in found)})


def derive_allergens(name: str, description: str | None) -> list[str]:
    haystack = f"{name} {description or ''}".lower()
    return sorted(
        allergen
        for allergen, keywords in ALLERGEN_KEYWORDS.items()
        if any(k in haystack for k in keywords)
    )


def derive_diet_tags(name: str, description: str | None, category: str) -> list[str]:
    haystack = f"{name} {description or ''}".lower()
    has_meat = any(k in haystack for k in MEAT_KEYWORDS)
    has_fish = any(k in haystack for k in FISH_KEYWORDS)
    has_dairy = any(k in haystack for k in DAIRY_KEYWORDS)
    has_gluten = any(k in haystack for k in GLUTEN_KEYWORDS)

    tags: list[str] = []
    # Al Taib is a halal kitchen — every item qualifies, which is exactly the
    # signal the dietary agent needs when a user sets `halal: true`.
    tags.append("halal")
    if not has_meat and not has_fish:
        tags.append("vegetarian")
        if not has_dairy:
            tags.append("vegan")
    if not has_gluten:
        tags.append("gluten-free")
    if not has_dairy:
        tags.append("no-dairy")
    if "baklava" not in haystack and "nuts" not in haystack:
        tags.append("no-nuts")
    if category == "Drinks":
        tags.append("drink")
    return tags


def main() -> None:
    source = MENU_TS.read_text(encoding="utf-8")
    # Only the Al Taib block — chateauKababMenuItems follows it and Goer only
    # sells Al Taib today.
    al_taib_block = source.split("export const chateauKababMenuItems")[0]

    items: list[dict] = []
    for match in FIELD.finditer(al_taib_block):
        name = _clean(match.group("name")) or ""
        description = _clean(match.group("description"))
        category = match.group("category")
        image = re.search(
            rf"id:\s*'{re.escape(match.group('id'))}'.*?imageURL:\s*(null|`[^`]*`)",
            al_taib_block,
            re.S,
        )
        image_url = None
        if image and image.group(1) != "null":
            image_url = (
                image.group(1)
                .strip("`")
                .replace(
                    "${S3}",
                    "https://betterresto.s3.us-west-1.wasabisys.com/production",
                )
            )

        items.append(
            {
                "id": match.group("id"),
                "name_en": name,
                "name_ar": arabic_name(name),
                "category": category,
                "meal_period": MEAL_PERIOD.get(category, "all-day"),
                "description_en": description or "",
                "description_ar": "",
                "ingredients": derive_ingredients(name, description),
                "allergens": derive_allergens(name, description),
                "diet_tags": derive_diet_tags(name, description, category),
                "variants": [],
                "modifications": {},
                "price": float(match.group("price")),
                "image_url": image_url,
                "available": True,
                "alternativeItemIds": [],
            }
        )

    # Alternatives = same category, closest price. The menu agent offers these
    # when an item is sold out.
    by_category: dict[str, list[dict]] = {}
    for item in items:
        by_category.setdefault(item["category"], []).append(item)
    for item in items:
        siblings = [s for s in by_category[item["category"]] if s["id"] != item["id"]]
        siblings.sort(key=lambda s: abs(s["price"] - item["price"]))
        item["alternativeItemIds"] = [s["id"] for s in siblings[:3]]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(items)} menu items -> {OUT.relative_to(BACKEND)}")


if __name__ == "__main__":
    main()
