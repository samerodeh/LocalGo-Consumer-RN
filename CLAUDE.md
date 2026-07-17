# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**LocalGO Consumer** — a cross-platform (iOS + Android) food-delivery consumer app built with
**Expo + React Native + TypeScript**. It is a faithful port of the SwiftUI app at
`../LocalGOConsumer` (`LocalGoConsumer/`), rebuilt in React Native so a single codebase ships to
both App Store and Google Play. Design tokens, screens, data, and flows mirror the SwiftUI original.

## Stack

- **Expo SDK 54**, React Native 0.81, React 19.1 (SDK 54 so the released Expo Go app can run it — SDK 57 was too new for any published Expo Go)
- **expo-router** — file-based routing (`app/`), tabs + stack + modals
- **zustand** — state stores (the RN counterpart to the SwiftUI `@EnvironmentObject` view models)
- **@react-native-async-storage/async-storage** — local persistence: orders/addresses always (namespaced
  per owner email), plus accounts/session in demo mode (no Supabase env vars)
- **@supabase/supabase-js** — real accounts (`src/lib/supabase.ts`) when configured; `expo-crypto`
  salted, iterated SHA-256 (`src/lib/hash.ts`) is the demo-mode password fallback only
- **expo-linear-gradient**, **@expo/vector-icons** (Ionicons), **expo-font** (Barlow Condensed)

## Run

```bash
cd ~/projects/LocalGOConsumerRN
npx expo start
```

Then:
- **Phone** — open the **Expo Go** app and scan the QR code printed in the terminal
- **iOS Simulator** — press `i`
- **Android Emulator** — press `a`
- **Browser** — press `w` (used for quick verification)

⚠️ Keep `expo` pinned to `~54.0.0` in `package.json`. `npx expo install` / `expo upgrade` will
happily jump to whatever the newest SDK is (57 as of writing), which breaks Expo Go on-device
until the store app catches up — see the SDK-54 note below.

## Layout

```
backend/                    ← Python/FastAPI backend (serves BOTH apps — see below)
app/                        ← expo-router routes
├── _layout.tsx             ← root: loads fonts, restores session, Stack.Protected auth gate
├── (auth)/                 ← login + signup (shown when logged out)
├── (tabs)/                 ← Home / Cart / Settings (shown when logged in)
├── restaurant/[id].tsx     ← full-screen menu (fullScreenModal)
└── address.tsx             ← delivery-address modal
src/
├── theme/theme.ts          ← colors, radii, Barlow font families (mirrors SwiftUI AppTheme)
├── types/                  ← shared TS types
├── data/                   ← static catalogs: partner, restaurants, Al Taib menu (76 items)
├── lib/                    ← supabase (accounts client) + dispatch (order bridge) + storage
│                              (AsyncStorage: orders/addresses always, demo-mode accounts) + hash (demo-mode KDF)
├── store/                  ← zustand: auth, cart, orders, address
└── components/             ← RemoteImage, DisplayText, GradientButton
```

## Architecture notes

- **Auth gate** — `app/_layout.tsx` uses `Stack.Protected guard={isLoggedIn}` to swap the `(auth)`
  and `(tabs)` groups. `restoreSession()` runs on mount; per-user stores (orders, addresses) are
  re-scoped whenever `currentUser.email` changes.
- **State** — one zustand store per domain, mirroring the SwiftUI view models
  (`authStore` ↔ AuthViewModel, `cartStore` ↔ CartViewModel, `ordersStore` ↔ OrdersViewModel,
  `addressStore` ↔ AddressViewModel).
- **Accounts — dual-mode, mirrors the driver app** — `src/store/authStore.ts` keys every branch off
  `isSupabaseConfigured` (`src/lib/supabase.ts`). Configured: `supabase.auth.signUp/signInWithPassword/
  signOut/getSession`, with a best-effort profile-row insert into the shared project's `customers`
  table (`../LocalGODriverRN/supabase/schema.sql`) after signup — same two-step pattern as the driver
  app's `drivers` insert. Unconfigured (demo mode): the original local flow, salted iterated-SHA256
  hashing (`src/lib/hash.ts`) + AsyncStorage (`src/lib/storage.ts`), unchanged. Either way `currentUser`
  ends up the same `StoredUser` shape, so nothing downstream (Settings, checkout) needs to care which
  mode is active.
- **Persistence** — orders/addresses are *always* local, namespaced by owner email
  (`src/lib/storage.ts`), regardless of auth mode — Supabase Auth still gives every account a stable,
  unique email, so `ordersStore`/`addressStore` didn't need to change when accounts went real.
- **Money** — order records store amounts in **cents** (`ordersStore`) so totals can't drift from
  float rounding, matching the SwiftUI `OrderRecord`.
- **Payments** — `cart.tsx` runs a simulated authorize→capture (a `setTimeout` + generated
  `pi_sim_…` id). Wire a real Stripe PaymentSheet + backend here for production.
- **Order dispatch bridge** — after the local `record(...)` at checkout, the shared pipeline
  (`src/lib/placeOrder.ts`) calls `publishOrderToDispatch()` (`src/lib/dispatch.ts`), which POSTs
  the order to the **Python/FastAPI backend** (`backend/`, `POST /orders`). The backend re-validates
  the delivery location, computes the item summary, inserts the shared Supabase `orders` row
  (anon key, never chaining RETURNING — see the RLS gotcha in backend/app/routers/orders.py), and
  alerts drivers via push. Best-effort: it never blocks or fails checkout, and is a no-op unless
  `EXPO_PUBLIC_API_URL` is set in `.env.local`. The inserted row is insert-only from this side;
  each driver's delivery progress lives in a driver-side `driver_orders` overlay table.
- **Delivery-location gate** — checkout is impossible without a *verified* delivery location.
  `src/lib/deliveryLocation.ts` defines the rule (non-trivial street line + real geocoded
  coordinates; (0,0) is the "never geocoded" sentinel) and is enforced in four places: the Cart
  screen (blocks the confirm dialog, routes to the Address screen), `placeOrder()` (hard gate for
  every entry point incl. Goer), `goerStore.stageOrder()` (Goer can't even stage a confirmation
  card), and server-side in the backend's `POST /orders` (422). `app/address.tsx` guarantees the
  invariant at the source: saving an address geocodes it (Photon autocomplete, GPS, or a save-time
  lookup) and refuses saves that can't be resolved to coordinates.

## Goer — the multi-agent ordering chatbot

**Goer** is the in-app AI assistant (floating button, bottom-right of Home and Cart) that can do
everything the UI can: browse the Al Taib menu, recommend, build the cart, set the tip, and run
checkout — all from chat. Code lives in `src/goer/` (logic) + `src/components/goer/` (UI).

- **Two brains, one toolset** — `send.ts` routes each user turn either to the **LLM loop**
  (`agentLoop.ts` → `streamClient.ts` → the `goer-chat` edge function → Anthropic, streamed SSE) or
  to the **offline rule-based NLU** (`localNLU.ts`: intent detection + fuzzy matching in
  `menuIndex.ts`). Both drive the *same* client-side tool executors (`tools/executors.ts`), so
  behavior is identical and the app demos fully offline. Transport failures downgrade to the NLU
  mid-conversation (sticky per session, re-probes on next launch).
- **Four specialists with visible handoffs** — Menu Concierge / Cart Manager / Checkout / Order
  Tracker (`agents.ts`). Each has its own system prompt + restricted toolset (`tools/schemas.ts`)
  over one shared history; a `handoff_to_agent` tool swaps the active agent and renders a divider
  in the transcript. System prompts are rebuilt every call with live cart/tip/address state; the
  full menu is compacted into the Concierge prompt (`compactMenuForPrompt`).
- **Checkout safety invariant** — `stage_order_confirmation` only *stages* a snapshot
  (`goerStore.stageOrder`) and renders `OrderConfirmationCard`; the ONLY code path that places an
  order from chat is the card's Confirm button → `confirmStagedOrder()` → `src/lib/placeOrder.ts`
  (the same pipeline `cart.tsx` uses). Duplicate taps no-op via the staged→placing status guard,
  and a cart-hash check marks the card stale if the cart changed after staging.
- **State & persistence** — `goerStore.ts` (zustand): transcript (`GoerMessage` discriminated
  union: text, menu cards, cart summary, order confirmation, order status, quick replies, handoff,
  system note), API history (trimmed to 24 messages, tool_results never orphaned), staged order,
  chat tip/address. Persisted per user at `localgo.goer.<email>` like the other stores.
- **LLM proxy** — `backend/app/routers/goer.py` (`POST /goer/chat` on the FastAPI backend): thin
  SSE pass-through to Anthropic that holds `ANTHROPIC_API_KEY` (never in the client bundle), clamps
  model/max_tokens/history, and rate-limits per JWT sub. Default model `claude-haiku-4-5`
  (override with `GOER_MODEL` in `backend/.env`). It replaced the old Deno edge function
  (`supabase/functions/goer-chat/` — kept only as reference, no longer called). Without a running
  backend the app simply stays in offline-NLU mode; `EXPO_PUBLIC_GOER_FORCE_FALLBACK=1` forces it
  for testing.
- **Streaming on RN** — uses `expo/fetch` (WinterCG, SDK 52+) because RN's built-in fetch can't
  expose `response.body`; the SSE parser is hand-rolled in `streamClient.ts`. No new dependencies.

## Backend status (Python/FastAPI, as of 2026-07-16)

**The backend code is Python/FastAPI** (`backend/` in this repo — one service backs this app AND
`../LocalGODriverRN`). It replaced the TypeScript/Deno edge functions and the apps' direct
PostgREST data access: order dispatch (`POST /orders`, with server-side delivery-location
validation), the driver feed/claim/status endpoints, the Goer LLM proxy (`POST /goer/chat`), and
push notifications (`POST /notify`). Run it with `uvicorn app.main:app --port 8000` from
`backend/` (Python **3.12** venv — 3.14 on this machine breaks httpx/asyncio with
`No module named 'concurrent.futures.thread'`); see `backend/README.md`. Apps find it via
`EXPO_PUBLIC_API_URL` in `.env.local` (LAN IP for physical devices).

Supabase stays underneath as the managed Postgres + Auth provider (project:
`sxednzdbbfjxdvezmouf.supabase.co`) — the apps still use `supabase-js` for **Auth sessions,
realtime, and chat only**; all other data access goes through FastAPI, which forwards the caller's
JWT to PostgREST so every RLS policy applies unchanged. Schema lives at
`../LocalGODriverRN/supabase/schema.sql` (idempotent — re-run the whole file after any change).
Verified end-to-end on 2026-07-16: order POSTed through FastAPI → appeared in the driver feed →
accept (incl. the 409 lost-race path) → delivered.

## EAS Build (Android)

`app.json` → `android.package: "com.samerodeh.localgoconsumer"`. `eas.json` has a `preview`
profile (internal-distribution `.apk`, not the Play Store `.aab`).

```bash
npx eas-cli build --platform android --profile preview
```

⚠️ **Critical gotcha already hit once:** EAS Build uploads the project archive respecting
`.gitignore`, so `.env.local` (gitignored, real credentials) **never reaches the cloud build** —
the resulting APK silently falls back to whatever "unconfigured" behavior the code has. Fixed by
putting the same `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` directly in `eas.json`'s `build.preview.env`
block (safe — these are publishable/anon keys, protected by RLS not secrecy). **If you ever rotate
the Supabase key or `eas.json` loses that `env` block, rebuilds will silently break dispatch again**
— always check the build log for `No environment variables ... found` as the tell.

`npx expo start --tunnel` needs `@expo/ngrok`; the global-install path fails with exit 243 on this
machine (npm permissions) — install it **locally** instead: `npm install @expo/ngrok@^4.1.0 --legacy-peer-deps`.
- **Design system** — always use `colors`/`radius` from `src/theme/theme.ts` and `<DisplayText>`
  for Barlow Condensed headings; don't hardcode hex values or font names.

## Data

Only **Al Taib** (`al-taib`) has a real menu (`hasMenu: true`); its 76 items live in
`src/data/menu.ts` with remote product photos. Other partners would render a "coming soon" state.

## Known gaps vs. the SwiftUI app (intentional, for a real backend later)

- Apple / Google sign-in buttons are visual only (no OAuth wired).
- Demo-mode-only password hashing uses iterated SHA-256 (expo-crypto has no PBKDF2) — irrelevant
  when Supabase is configured (the normal case), since Supabase Auth owns password storage then.
- Address entry has autocomplete + GPS via Photon geocoding (`src/lib/geocoding.ts`) but no map
  picker; saved addresses are guaranteed to carry verified coordinates (see the
  delivery-location gate above).
- No profile-editing UI (Settings only displays name/email + sign-out), so `customers` has no
  update RLS policy — matches the driver app's `drivers` table, which has the same gap.
