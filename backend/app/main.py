"""LocalGO backend — Python/FastAPI.

One service backs BOTH React Native apps:
  * LocalGOConsumerRN — POST /orders (dispatch, with server-side delivery-
    location validation), POST /notify.
  * LocalGODriverRN   — GET /orders/feed, POST /orders/{id}/accept,
    POST /orders/{id}/status, POST /notify.

Supabase stays as the
Postgres + Auth provider underneath; driver endpoints forward the caller's
Supabase Auth JWT so every RLS policy applies unchanged.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000   (from backend/)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routers import notify, orders

app = FastAPI(title="LocalGO Backend", version="1.0.0")

# Same posture as the edge functions: public demo endpoints, CORS wide open
# so the Expo web preview works.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(notify.router)


@app.get("/health")
def health():
    return {
        "ok": True,
        "supabaseConfigured": config.SUPABASE_CONFIGURED,
        "pushConfigured": bool(config.SUPABASE_SERVICE_ROLE_KEY),
    }

