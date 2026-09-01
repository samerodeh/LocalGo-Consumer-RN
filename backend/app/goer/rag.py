"""ChromaDB retrieval over the Al Taib menu and the LocalGO FAQ — the port of
SufraAI's `rag.py`.

Two persistent collections, embedded with sentence-transformers'
`all-MiniLM-L6-v2` exactly as SufraAI does. On a machine where that stack
won't install (torch has no win-arm64 wheels — this repo's target), it falls
back to Chroma's bundled ONNX embedder so retrieval still works; the model
differs but the interface and the calling agents do not.

`build_index()` runs once at FastAPI startup and upserts, so re-running it is
free and picks up menu edits.
"""

from __future__ import annotations

import json
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

from .. import config
from .agent_utilities import DATA_DIR

CHROMA_PATH = Path(config.CHROMA_PATH or (Path(__file__).resolve().parent / "chroma_db"))

_client: chromadb.ClientAPI | None = None
_menu_collection = None
_faq_collection = None
_embedding_backend = "uninitialised"


def _embedding_function():
    """SufraAI's embedder when available, Chroma's default ONNX one otherwise."""
    global _embedding_backend
    try:
        fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        _embedding_backend = "sentence-transformers/all-MiniLM-L6-v2"
        return fn
    except Exception as exc:  # ImportError, or a torch load failure
        print(f"[goer.rag] sentence-transformers unavailable ({exc}); using Chroma's default embedder")
        _embedding_backend = "chroma-default-onnx"
        return embedding_functions.DefaultEmbeddingFunction()


def _collections():
    global _client, _menu_collection, _faq_collection
    if _menu_collection is None or _faq_collection is None:
        CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_PATH))
        embedding_fn = _embedding_function()
        _menu_collection = _client.get_or_create_collection(
            name="menu_items", embedding_function=embedding_fn
        )
        _faq_collection = _client.get_or_create_collection(
            name="faqs", embedding_function=embedding_fn
        )
    return _menu_collection, _faq_collection


def embedding_backend() -> str:
    return _embedding_backend


def build_index() -> dict:
    """Embed menu.json and faq.json into ChromaDB. Idempotent (upsert)."""
    menu_collection, faq_collection = _collections()

    with open(DATA_DIR / "menu.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    menu_collection.upsert(
        ids=[item["id"] for item in items],
        documents=[
            f"{item['name_en']} ({item['name_ar']}) - {item['description_en']} - "
            f"Category: {item['category']} - Price: ${item['price']} - "
            f"Diet tags: {', '.join(item['diet_tags'])} - "
            f"Allergens: {', '.join(item['allergens']) or 'none listed'} - "
            f"Ingredients: {', '.join(item['ingredients']) or 'not listed'}"
            for item in items
        ],
        metadatas=[
            {
                "name_en": item["name_en"],
                "name_ar": item["name_ar"],
                "category": item["category"],
                "price": item["price"],
                "diet_tags": ", ".join(item["diet_tags"]),
                "allergens": ", ".join(item["allergens"]),
                "meal_period": item["meal_period"],
                "available": str(item["available"]),
            }
            for item in items
        ],
    )

    with open(DATA_DIR / "faq.json", "r", encoding="utf-8") as f:
        faqs = json.load(f)["faqs"]

    faq_collection.upsert(
        ids=[faq["id"] for faq in faqs],
        documents=[f"{faq['question']} {faq['answer']}" for faq in faqs],
        metadatas=[
            {"question": faq["question"], "answer": faq["answer"], "category": faq["category"]}
            for faq in faqs
        ],
    )

    summary = {"menuItems": len(items), "faqs": len(faqs), "embedding": _embedding_backend}
    print(f"[goer.rag] indexed {len(items)} menu items and {len(faqs)} FAQs ({_embedding_backend})")
    return summary


def query_menu(question: str, n: int = 5) -> list[str]:
    """Most relevant menu items for a question, with availability spelled out."""
    menu_collection, _ = _collections()
    results = menu_collection.query(query_texts=[question], n_results=n)
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    merged = []
    for index, doc in enumerate(docs):
        meta = metas[index] if index < len(metas) else {}
        available = str(meta.get("available", "true")).lower() == "true"
        merged.append(f"{doc} | Availability: {'Available' if available else 'Unavailable'}")
    return merged


def query_faq(question: str, n: int = 3) -> list[str]:
    _, faq_collection = _collections()
    results = faq_collection.query(query_texts=[question], n_results=n)
    return results.get("documents", [[]])[0]


def query_menu_structured(question: str, n: int = 5) -> list[dict]:
    """Retrieval that keeps the ids, so an agent can turn hits into item cards."""
    menu_collection, _ = _collections()
    results = menu_collection.query(query_texts=[question], n_results=n)
    ids = results.get("ids", [[]])[0]
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    rows = []
    for index, doc in enumerate(docs):
        rows.append(
            {
                "id": ids[index] if index < len(ids) else None,
                "document": doc,
                "metadata": metas[index] if index < len(metas) else {},
            }
        )
    return rows


if __name__ == "__main__":
    build_index()
    print("\nTest query: 'something vegetarian'")
    for doc in query_menu("something vegetarian"):
        print(" -", doc[:100])
    print("\nTest query: 'how much is delivery'")
    for doc in query_faq("how much is delivery"):
        print(" -", doc[:100])
