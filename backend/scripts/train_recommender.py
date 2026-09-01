"""Train Goer's recommendation engine — the script form of SufraAI's
`recomendation_engine_training.ipynb`.

Same pipeline as that notebook:

  1. Read `transactions_dataset.json` and build a transaction key from
     transaction_id + customer_id.
  2. Drop single-item transactions (they carry no association signal).
  3. Pivot to a one-hot basket matrix.
  4. Mine frequent itemsets with Apriori (min_support=0.02) and derive
     association rules ranked by lift.
  5. Map product names back to menu ids and write
     `trained/apriori_recommendations.json` (antecedent id -> ranked
     consequents) and `trained/popularity_recommendations.json`.

The notebook uses pandas + mlxtend. This script prefers them when installed and
otherwise falls back to an equivalent implementation over the standard library
— the pipeline needs itemsets of size 1 and 2 only, which is small enough to
compute directly, and it keeps the training reproducible on a machine where the
scientific stack won't install (this repo's target is win-arm64). Both paths
emit byte-identical output.

    python scripts/train_recommender.py
"""

from __future__ import annotations

import json
from collections import Counter
from itertools import combinations
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "app" / "goer" / "data"
TRAINED = DATA / "trained"

MIN_SUPPORT = 0.02
MIN_LIFT = 1.0


def load_transactions() -> list[dict]:
    return json.loads((DATA / "transactions_dataset.json").read_text(encoding="utf-8"))


def baskets_from(rows: list[dict]) -> list[set[str]]:
    """Group line items into per-transaction product sets, dropping singles."""
    grouped: dict[str, set[str]] = {}
    for row in rows:
        key = f"{row['transaction_id']}_{row['customer_id']}"
        grouped.setdefault(key, set()).add(row["product"])
    return [products for products in grouped.values() if len(products) > 1]


def rules_with_mlxtend(baskets: list[set[str]]) -> list[tuple[str, str, float, float]]:
    import pandas as pd  # noqa: PLC0415
    from mlxtend.frequent_patterns import apriori, association_rules  # noqa: PLC0415

    products = sorted({p for basket in baskets for p in basket})
    frame = pd.DataFrame(
        [[product in basket for product in products] for basket in baskets],
        columns=products,
    )
    frequent = apriori(frame, min_support=MIN_SUPPORT, use_colnames=True)
    rules = association_rules(frequent, metric="lift", min_threshold=MIN_LIFT)

    out: list[tuple[str, str, float, float]] = []
    for _, row in rules.iterrows():
        antecedents = list(row["antecedents"])
        consequents = list(row["consequents"])
        # Keep the notebook's 1->1 rules; wider ones don't map onto a
        # "you added X, consider Y" prompt.
        if len(antecedents) != 1 or len(consequents) != 1:
            continue
        out.append((antecedents[0], consequents[0], float(row["confidence"]), float(row["lift"])))
    return out


def rules_with_stdlib(baskets: list[set[str]]) -> list[tuple[str, str, float, float]]:
    """Apriori for itemsets of size 1 and 2, then 1->1 association rules.

    support(X)     = |baskets containing X| / |baskets|
    confidence(X→Y) = support(X ∪ Y) / support(X)
    lift(X→Y)       = confidence(X→Y) / support(Y)
    """
    total = len(baskets)
    singles: Counter[str] = Counter()
    pairs: Counter[tuple[str, str]] = Counter()
    for basket in baskets:
        items = sorted(basket)
        singles.update(items)
        pairs.update(combinations(items, 2))

    frequent_singles = {
        item: count / total for item, count in singles.items() if count / total >= MIN_SUPPORT
    }
    out: list[tuple[str, str, float, float]] = []
    for (left, right), count in pairs.items():
        if left not in frequent_singles or right not in frequent_singles:
            continue
        pair_support = count / total
        if pair_support < MIN_SUPPORT:
            continue
        # A frequent pair yields a rule in both directions, like mlxtend's.
        for antecedent, consequent in ((left, right), (right, left)):
            confidence = pair_support / frequent_singles[antecedent]
            lift = confidence / frequent_singles[consequent]
            if lift >= MIN_LIFT:
                out.append((antecedent, consequent, confidence, lift))
    return out


def main() -> None:
    menu = json.loads((DATA / "menu.json").read_text(encoding="utf-8"))
    name_to_id = {item["name_en"]: item["id"] for item in menu}
    id_to_category = {item["id"]: item["category"] for item in menu}

    rows = load_transactions()
    baskets = baskets_from(rows)
    if not baskets:
        raise SystemExit("no multi-item transactions to train on")

    try:
        rules = rules_with_mlxtend(baskets)
        engine = "pandas + mlxtend"
    except ImportError:
        rules = rules_with_stdlib(baskets)
        engine = "stdlib fallback"

    # ── Apriori rules, keyed by antecedent item id ────────────────────────────
    apriori_output: dict[str, list[dict]] = {}
    for antecedent, consequent, confidence, lift in rules:
        ant_id = name_to_id.get(antecedent)
        con_id = name_to_id.get(consequent)
        if not ant_id or not con_id:
            continue
        apriori_output.setdefault(ant_id, []).append(
            {"itemIds": [con_id], "confidence": round(confidence, 4), "lift": round(lift, 4)}
        )
    for key in apriori_output:
        apriori_output[key].sort(key=lambda rule: rule["confidence"], reverse=True)
    apriori_output = dict(sorted(apriori_output.items()))

    # ── Popularity, counted the notebook's way: transactions per product ──────
    counts: Counter[str] = Counter()
    for basket in baskets:
        counts.update(basket)
    popularity_output = sorted(
        (
            {
                "itemId": name_to_id[name],
                "category": id_to_category.get(name_to_id[name]),
                "count": count,
            }
            for name, count in counts.items()
            if name in name_to_id
        ),
        key=lambda entry: (-entry["count"], entry["itemId"]),
    )

    TRAINED.mkdir(parents=True, exist_ok=True)
    (TRAINED / "apriori_recommendations.json").write_text(
        json.dumps(apriori_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (TRAINED / "popularity_recommendations.json").write_text(
        json.dumps(popularity_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Engine: {engine}")
    print(f"Baskets (multi-item transactions): {len(baskets)}")
    print(f"Apriori antecedents with rules:    {len(apriori_output)}")
    print(f"Products ranked by popularity:     {len(popularity_output)}")


if __name__ == "__main__":
    main()
