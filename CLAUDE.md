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
- **@react-native-async-storage/async-storage** — local persistence (stands in for SwiftData + Keychain)
- **expo-crypto** — salted, iterated SHA-256 password hashing (`src/lib/hash.ts`)
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
├── lib/                    ← storage (AsyncStorage) + hash (password KDF)
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
- **Persistence** — `src/lib/storage.ts` namespaces users by email and orders/addresses per owner
  email, so nothing leaks across accounts on a shared device. Session email is stored separately.
- **Money** — order records store amounts in **cents** (`ordersStore`) so totals can't drift from
  float rounding, matching the SwiftUI `OrderRecord`.
- **Payments** — `cart.tsx` runs a simulated authorize→capture (a `setTimeout` + generated
  `pi_sim_…` id). Wire a real Stripe PaymentSheet + backend here for production.
- **Design system** — always use `colors`/`radius` from `src/theme/theme.ts` and `<DisplayText>`
  for Barlow Condensed headings; don't hardcode hex values or font names.

## Data

Only **Al Taib** (`al-taib`) has a real menu (`hasMenu: true`); its 76 items live in
`src/data/menu.ts` with remote product photos. Other partners would render a "coming soon" state.

## Known gaps vs. the SwiftUI app (intentional, for a real backend later)

- Apple / Google sign-in buttons are visual only (no OAuth wired).
- Password hashing uses iterated SHA-256 (expo-crypto has no PBKDF2); swap for a native KDF if this
  ever talks to a shared backend.
- Address entry is a manual form (no GPS / map picker / geocoding).
