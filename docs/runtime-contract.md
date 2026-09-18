# LocalGo runtime contract

This document records the commands, network boundary, configuration, and
database ownership required to run and deploy the LocalGo consumer safely.

## Consumer app

- Framework: Expo, React Native, and TypeScript
- Start Metro: `npm start`
- iOS: `npm run ios`
- Android: `npm run android`
- Web: `npm run web`
- Frontend tests: `npm run test:frontend`

### Required consumer configuration

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL for Auth, realtime, and chat. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key used by the app. |
| `EXPO_PUBLIC_API_URL` | HTTPS URL of the FastAPI service. Use the development machine's LAN IP rather than `localhost` on a physical device. |
| `EXPO_PUBLIC_GOER_FORCE_FALLBACK` | Optional. Set to `1` to force Goer's offline-NLU fallback. |

The EAS preview and production build profiles must receive the required
`EXPO_PUBLIC_*` values. `.env.local` is intentionally not uploaded to EAS.

## FastAPI backend

- Working directory: `backend/`
- Supported Python: 3.12
- Install a local test environment:

  ```bash
  python3.12 -m venv .venv
  .venv/bin/pip install -r requirements-dev.txt
  ```

- Development start:

  ```bash
  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

- Deployment start:

  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
  ```

- Backend tests: `.venv/bin/python -m pytest`
- Health endpoint: `GET /health`

### Required backend configuration

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL. Required with the anon key for order endpoints. |
| `SUPABASE_ANON_KEY` | Used by the backend's anonymous PostgREST operations. |
| `SUPABASE_SERVICE_ROLE_KEY` | Enables push dispatch and customer-facing status mirroring. Never expose to the client. |
| `ANTHROPIC_API_KEY` | Enables Goer's hosted LLM mode. Without it, Goer falls back to offline NLU. |
| `GOER_MODEL` | Optional model override. Defaults to `claude-haiku-4-5`. |

## Data and migration ownership

- PostgreSQL and Auth provider: Supabase.
- Canonical shared schema owner: [localgo-driver `supabase/schema.sql`](../../localgo-driver/supabase/schema.sql).
- Current schema workflow: the SQL file is idempotent and is re-run after a reviewed schema change. This consumer repository does not own a migration directory or a migration command.
- Before production on EKS, replace this manual/idempotent workflow with ordered, versioned Supabase migrations and test both a restore and a rollback path.

## Verification gate

Before merging or beginning container work, run:

```bash
npm test
curl -f http://localhost:8000/health
```

The second command requires the FastAPI service to be running. A successful
response includes `ok: true`; it never returns secret values.
