# LocalGO Backend (Python / FastAPI)

The single backend service for **LocalGOConsumerRN** and **LocalGODriverRN**.
It replaces the old TypeScript/Deno Supabase edge functions (`goer-chat`,
`notify-push`) and the apps' direct Supabase data access. Supabase remains the
underlying Postgres + Auth provider; this service is the only backend *code*.

## Endpoints

| Method | Path                   | Caller   | What it does |
|--------|------------------------|----------|--------------|
| GET    | `/health`              | anyone   | Config/liveness probe |
| POST   | `/orders`              | consumer | Validates the delivery location server-side, computes the item summary, inserts the dispatch row, alerts drivers |
| GET    | `/orders/feed`         | driver   | Unclaimed + own orders merged with the driver's `driver_orders` overlay (camelCase, ready for the app) |
| POST   | `/orders/{id}/accept`  | driver   | Atomic claim; `409` when another driver won the race; notifies the customer |
| POST   | `/orders/{id}/status`  | driver   | Upserts the driver's private overlay status (declined / picked_up / delivered) |
| POST   | `/goer/chat`           | consumer | SSE pass-through to the Anthropic Messages API (Goer's LLM brain) |
| POST   | `/notify`              | both     | Push dispatch; recipients derived server-side from the order row |

Driver endpoints require the driver's Supabase Auth access token as
`Authorization: Bearer <jwt>`; the token is forwarded to PostgREST so all RLS
policies in `../../LocalGODriverRN/supabase/schema.sql` apply unchanged.

## Run

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in the values
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Point both apps at it with `EXPO_PUBLIC_API_URL` in their `.env.local`
(use your machine's LAN IP, not localhost, for a physical device):

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

## Environment

See `.env.example`. Everything degrades gracefully: no `ANTHROPIC_API_KEY`
means Goer stays in offline-NLU mode, no `SUPABASE_SERVICE_ROLE_KEY` means
push notifications are skipped, no Supabase values means order endpoints
return 503 (the apps then behave exactly like demo mode).

`app/config.py` calls `load_dotenv()` on `backend/.env`, which is a no-op when
the file is absent — so in a deployed environment the same values are read
straight from the process environment. No code change is needed to deploy.

## Deploy

A LAN IP only works while your phone is on your Wi-Fi and `uvicorn` is running.
An installed APK needs a public HTTPS URL — which also sidesteps Android's
cleartext-HTTP block in release builds. Two ready-made configs, pick one:

- **Render** (`render.yaml`, repo root) — genuinely free, no card required.
  Trade-off: the free instance sleeps after ~15 min idle and takes 30-50s to
  wake on the next request. Good for testing the fix cheaply first.
- **Railway** (`railway.toml`, this dir) — no sleep/cold-start, ~$5/mo in
  practice at this traffic level (see below). Better once you're past testing.

### Render (test this first)

No CLI needed — Render deploys from your GitHub repo directly:

1. Push this branch (`render.yaml` must reach GitHub — Render reads it from
   there, not from your local disk).
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
   → connect the `LocalGo-Consumer-RN` repo. Render finds `render.yaml` at the
   repo root automatically and builds only `backend/` (`rootDir` in the file).
3. It will prompt for the env vars marked `sync: false` in `render.yaml`
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc. — same keys as `.env.example`).
   Nothing secret is in the committed file.
4. After the first deploy, copy the assigned URL
   (`https://localgo-backend-xxxx.onrender.com`).

```bash
curl https://localgo-backend-xxxx.onrender.com/health
# first hit after idle can take 30-50s (cold start) — that's expected on free
```

Wire that URL into both apps the same way described below for Railway.

### Railway (once you're past testing)

Config lives in `railway.toml`: `$PORT` binding, `/health` healthcheck, one
replica (see the comment there — the rate limiter is in-process).

```bash
npm i -g @railway/cli
railway login                       # opens the browser
cd backend                          # deploy THIS dir, not the repo root
railway init                        # first time only
railway up
railway domain                      # -> https://<name>.up.railway.app
```

Set the env vars in the Railway dashboard (Variables tab) — the same keys as
`.env.example`. **`.env` is gitignored and is never uploaded**, exactly like
`.env.local` and EAS: nothing carries your secrets to the cloud but you.

| Variable | Needed for |
|----------|-----------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | order endpoints (503 without) |
| `SUPABASE_SERVICE_ROLE_KEY` | push + customer-facing status mirroring |
| `ANTHROPIC_API_KEY` | Goer's LLM mode (offline NLU without) |
| `GOER_MODEL` | optional override, defaults to `claude-haiku-4-5` |

Verify, then wire the apps to the deployed URL:

```bash
curl https://<name>.up.railway.app/health
# {"ok":true,"supabaseConfigured":true,"pushConfigured":true,"goerConfigured":true}
```

Put that URL in `EXPO_PUBLIC_API_URL` in **both** apps' `.env.local` *and* in
**both** `eas.json` files under `build.preview.env` — EAS never uploads
`.env.local`, so a var that lives only there is compiled into the APK as
`undefined`, and `dispatch.ts` silently no-ops. That is exactly how orders went
missing from builds while working fine on localhost.

⚠️ **Before exposing this publicly**, note that `POST /orders` and
`POST /goer/chat` take no auth — fine on a laptop, but on a public URL anyone
who finds it can inject orders into the driver feed or spend your Anthropic
credits (`/goer/chat` is rate-limited to 20/min per IP, which a rotating
caller defeats). See the security note in the root `CLAUDE.md`.
