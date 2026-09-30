# LocalGo Consumer

LocalGo is an Expo/React Native consumer app backed by a FastAPI service. The
mobile app handles customer sign-in, addresses, menus, cart, checkout, order
tracking, and chat. The backend handles order dispatch, driver updates,
and push-notification dispatch.

## Architecture

```text
Expo consumer app
  -> FastAPI API (Docker)
  -> Supabase (Auth, Postgres, realtime, chat)
  -> Expo Push (optional notifications)
```

Docker runs the FastAPI backend. The iOS and Android client is not
containerized: it is started with Expo locally and built for devices using
EAS.

## Run on a new machine

### Prerequisites

- Git
- Docker Desktop or Docker Engine with Docker Compose v2
- Node.js 20 LTS or newer and npm, to run the Expo app
- Expo Go on a physical phone, or an iOS Simulator / Android Emulator

Python is not required for the Docker backend workflow.

### 1. Clone and configure

```bash
git clone https://github.com/samerodeh/LocalGo-Consumer-RN.git
cd LocalGo-Consumer-RN
cp backend/.env.example backend/.env
cp .env.example .env.local
```

Edit `backend/.env` and `.env.local` with the appropriate development values.
Never commit either file.

`backend/.env` needs Supabase values for orders and a Supabase service-role key
for pushes/status mirroring. `EXPO_PUBLIC_API_URL` in `.env.local` must point to this backend. Use
`http://localhost:8000` for an iOS simulator, Android emulator, or web; use
your computer's LAN IP (for example `http://192.168.x.x:8000`) for a physical
phone on the same Wi-Fi network.

### 2. Start the backend with Docker

```bash
docker compose up --build
```

Docker builds `backend/Dockerfile`, starts FastAPI on port 8000, and runs a
container health check against `GET /health`. Leave this terminal open while
using the app. A successful health response contains `"ok": true` and only
configuration booleans; it never returns secrets.

To stop the backend, press `Ctrl+C`. To remove the stopped container and its
network, run `docker compose down`.

### 3. Start the Expo consumer app

In a second terminal from the repository root:

```bash
npm ci
npm start
```

Use Expo's prompt to open the app in a simulator/emulator, browser, or Expo Go.
For a physical phone, make sure the phone and computer share Wi-Fi and that
`EXPO_PUBLIC_API_URL` uses the computer's LAN IP rather than `localhost`.

## Validate locally

Run the automated checks before making changes:

```bash
npm test
npx tsc --noEmit
```

Check the running backend from another terminal:

```bash
curl -f http://localhost:8000/health
```

Then exercise the customer flow with a dedicated test account: sign in, save a
valid in-zone address, add an item, check cart totals, and submit a test order.
Test payments only with Stripe test credentials. Do not use a real card or a
production customer account for validation.

## Testing scope

The repository currently includes frontend unit/component/store tests and
FastAPI API-contract tests. They mock Supabase, Expo Push, and
payment infrastructure so they are fast and do not mutate real data.

A real end-to-end test requires a dedicated non-production Supabase project,
Stripe test keys, a consumer test account, a driver test account, and a
disposable test order. See `docs/runtime-contract.md` for the backend runtime
contract and configuration ownership.

## Security notes

- `.env.local` and `backend/.env` are local-only; do not commit them.
- The FastAPI container runs as a non-root `app` user.
- The Docker build ignores environment files and virtual environments.
- Do not expose a development backend publicly until its order routes
  have appropriate authentication and production rate limiting.
