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
- **Order dispatch bridge** — after the local `record(...)` at checkout, `cart.tsx` calls
  `publishOrderToDispatch()` (`src/lib/dispatch.ts`), which inserts the order into a shared Supabase
  `orders` table so it appears live on the driver app (`../LocalGODriverRN`). Best-effort: it never
  blocks or fails checkout, and is a no-op unless `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are set in
  `.env.local`. Consumer accounts (separately) ARE now real Supabase Auth users when configured —
  see "Accounts — dual-mode" above — but that's unrelated to this anon-key order insert, which stays
  anonymous either way. The inserted row is insert-only from this side and never updated afterward;
  each driver's delivery progress lives in a driver-side `driver_orders` overlay table, so every
  driver sees every order.

## Backend status (live, as of 2026-07-11)

A real Supabase project backs this app and `../LocalGODriverRN` — not hypothetical, already wired
and verified end-to-end (order placed here → appeared live on the driver dashboard; consumer
signup verified end-to-end into the `customers` table). Project: `sxednzdbbfjxdvezmouf.supabase.co`.
`.env.local` (gitignored) has the real `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Schema lives at `../LocalGODriverRN/supabase/schema.sql` — same project backs both apps, same file
covers both apps' tables (idempotent — re-run the whole file after any schema change).

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
- Address entry is a manual form (no GPS / map picker / geocoding).
- No profile-editing UI (Settings only displays name/email + sign-out), so `customers` has no
  update RLS policy — matches the driver app's `drivers` table, which has the same gap.
