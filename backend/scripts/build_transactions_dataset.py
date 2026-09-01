"""Generate the Al Taib transaction history the recommender trains on.

SufraAI ships a hand-collected `transactions_dataset.json` (one row per line
item) that its notebook mines for Apriori rules. LocalGO has no production
order history to mine yet, so this script synthesises an equivalent dataset
with realistic basket structure: meal-shaped "archetype" baskets (a slice and a
drink, a grill plate with a side, a manakish breakfast run) sampled with a
fixed seed, plus noise items so the rules aren't degenerate.

Deterministic — same seed, same dataset, same trained rules. Regenerate with:

    python scripts/build_transactions_dataset.py
    python scripts/train_recommender.py
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "app" / "goer" / "data"
MENU = DATA / "menu.json"
OUT = DATA / "transactions_dataset.json"

SEED = 20260709  # LocalGo-Consumer repo creation date — arbitrary but fixed.
N_TRANSACTIONS = 420
START_DATE = date(2026, 1, 5)
DAYS = 180

# How people actually order at a Montreal boulangerie-grill near a campus.
# (weight, [item ids that go in the basket together])
ARCHETYPES: list[tuple[int, list[str]]] = [
    # Slice-and-a-drink lunch run — the dominant pattern.
    (22, ["pepperoni-pizza-slice", "coke"]),
    (16, ["cheese-pizza-slice", "coke"]),
    (12, ["all-dressed-pizza-slice", "pepsi"]),
    (10, ["veggie-pizza-slice", "water"]),
    (8, ["chicken-pizza-slice", "sprite"]),
    (6, ["mexican-pizza-slice", "fanta"]),
    # Slice plus fries — the "I'm actually hungry" upgrade.
    (12, ["pepperoni-pizza-slice", "fries", "coke"]),
    (8, ["cheese-pizza-slice", "fries"]),
    # Breakfast manakish run.
    (18, ["zaatar-manakish", "ayran"]),
    (12, ["cheese-manakish", "ayran"]),
    (10, ["zaatar-and-chesse-manakish", "apple-juice"]),
    (8, ["spinach-pie", "zaatar-manakish"]),
    (7, ["cheese-pie", "coke"]),
    (6, ["lahmbajine-manakish", "ayran"]),
    # Grill plates with a side and a sweet.
    (16, ["shish-taouk-plate", "hummus", "coke"]),
    (14, ["shawarma-beef-plate", "hummus"]),
    (10, ["shish-taouk-plate", "fries", "baklava-patesserie"]),
    (9, ["falafel-plate", "hummus", "tabouleh"]),
    (8, ["shawarma-beef-sandwich", "fries", "pepsi"]),
    (8, ["shish-taouk-sandwich", "fries", "coke"]),
    (6, ["chicken-shawarma-trio", "baklava-patesserie"]),
    (5, ["combo-shish-taouk-and-shawarma-beef-plate", "basmati-rice"]),
    # Whole pizzas — group orders, bigger baskets.
    (10, ["pepperoni-pizza", "coke", "fries"]),
    (8, ["all-dressed-pizza", "pepsi", "poutine"]),
    (6, ["cheese-pizza", "veggie-pizza", "coke"]),
    (5, ["chicken-pizza", "sprite", "fries"]),
    # Mezze / salad pickups.
    (9, ["hummus", "tabouleh", "fatoush"]),
    (7, ["fatoush", "falafel-sandwich"]),
    (6, ["tabouleh", "basmati-rice", "hot-potato"]),
    # Sweet tooth.
    (8, ["baklava-patesserie", "coke"]),
    (5, ["cheesecake-slice", "apple-juice"]),
    # Poutine crowd.
    (7, ["poutine", "coke"]),
    (5, ["poutine-au-poulet", "pepsi"]),
]

# Items dropped into baskets at random so the rule set isn't purely archetypal.
NOISE_POOL = [
    "water", "perrier", "redbull", "diet-coke", "diet-pepsi", "7-up",
    "salad-bar-100g", "cabbage-salad", "hot-potato", "fries", "hummus",
    "baklava-patesserie", "cheesecake-slice",
]


def main() -> None:
    menu = json.loads(MENU.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in menu}
    product_id = {item["id"]: index + 1 for index, item in enumerate(menu)}

    for _, basket in ARCHETYPES:
        for item_id in basket:
            if item_id not in by_id:
                raise SystemExit(f"archetype references unknown item id: {item_id}")

    rng = random.Random(SEED)
    weights = [weight for weight, _ in ARCHETYPES]
    baskets = [basket for _, basket in ARCHETYPES]

    rows: list[dict] = []
    for transaction_id in range(1, N_TRANSACTIONS + 1):
        basket = list(rng.choices(baskets, weights=weights, k=1)[0])
        # ~25% of baskets pick up one extra item on the way to the till.
        if rng.random() < 0.25:
            extra = rng.choice(NOISE_POOL)
            if extra not in basket:
                basket.append(extra)
        # A few singles — filtered out at training time, exactly as the SufraAI
        # notebook drops transactions with a single line item.
        if rng.random() < 0.08:
            basket = basket[:1]

        when = START_DATE + timedelta(days=rng.randrange(DAYS))
        customer_id = rng.randrange(1, 121)
        for item_id in basket:
            item = by_id[item_id]
            rows.append(
                {
                    "transaction_id": transaction_id,
                    "transaction_date": when.isoformat(),
                    "sales_outlet_id": 1,
                    "customer_id": customer_id,
                    "product_id": product_id[item_id],
                    "quantity": 1 if rng.random() < 0.85 else 2,
                    "product_category": item["category"],
                    "product": item["name_en"],
                }
            )

    OUT.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    distinct = len({row["transaction_id"] for row in rows})
    print(f"Wrote {len(rows)} line items across {distinct} transactions -> {OUT.relative_to(BACKEND)}")


if __name__ == "__main__":
    main()
