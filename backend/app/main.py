"""LocalGO backend — Python/FastAPI.

One service backs BOTH React Native apps:
  * LocalGOConsumerRN — POST /orders (dispatch, with server-side delivery-
    location validation), the Goer chatbot (POST /goer/chat[/stream]),
    POST /notify.
  * LocalGODriverRN   — GET /orders/feed, POST /orders/{id}/accept,
    POST /orders/{id}/status, POST /notify.

It replaces the TypeScript/Deno Supabase edge functions (goer-chat,
notify-push) and the apps' direct PostgREST data access. Supabase stays as the
Postgres + Auth provider underneath; driver endpoints forward the caller's
Supabase Auth JWT so every RLS policy applies unchanged.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000   (from backend/)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routers import account, goer, notify, orders, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Embed the menu and FAQ into ChromaDB once at boot. Upserts, so a restart
    # after a menu edit refreshes the index and an unchanged menu costs nothing.
    # A failure here must not take the service down: order dispatch and push
    # don't need retrieval, and Goer degrades to the app's on-device assistant.
    try:
        from .goer.rag import build_index

        build_index()
    except Exception as exc:
        print(f"[startup] Goer RAG index unavailable ({type(exc).__name__}: {exc})")
    yield


app = FastAPI(title="LocalGO Backend", version="1.1.0", lifespan=lifespan)

# Same posture as the edge functions: public demo endpoints, CORS wide open
# so the Expo web preview works.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(goer.router)
app.include_router(notify.router)
app.include_router(payments.router)
app.include_router(account.router)


@app.get("/health")
def health():
    return {
        "ok": True,
        "supabaseConfigured": config.SUPABASE_CONFIGURED,
        "pushConfigured": bool(config.SUPABASE_SERVICE_ROLE_KEY),
        "goerConfigured": config.GOER_CONFIGURED,
        "goerModel": config.GOER_MODEL,
    }
