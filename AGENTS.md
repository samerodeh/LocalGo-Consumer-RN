# LocalGO Consumer — agent guide

## Before changing code

- Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo or React Native code.
- Treat `package.json` as the source of truth for installed dependency versions. Do not upgrade Expo, React Native, or related packages unless the task explicitly calls for it.
- Inspect the relevant route, store, and shared type before editing. This is an Expo Router app: routes live in `app/`, domain state lives in `src/store/`, and shared types live in `src/types/`.

## Project conventions

- Use TypeScript and preserve the existing Expo Router file-based routing structure.
- Use Zustand stores for cross-screen domain state; keep UI-specific state local where practical.
- Use design tokens from `src/theme/theme.ts` and `DisplayText` for Barlow Condensed headings. Do not introduce hard-coded colors or font-family names when a token/component exists.
- Monetary values in persisted orders are integer cents. Do not use floating-point values for stored totals.
- Scope persisted consumer data by the active account email, following the existing storage/store patterns.
- Keep secrets out of the client and git. Only `EXPO_PUBLIC_*` configuration belongs in the Expo app; server-only keys belong in Supabase secrets.

## Goer assistant

- Goer logic is in `src/goer/` and its UI is in `src/components/goer/`. The online LLM path and offline NLU path must use the same client-side tool executors.
- Chat checkout must remain confirmation-gated: stage an order first, then place it only through the explicit confirmation flow. Do not bypass the stale-cart or duplicate-placement guards.

## Verification

- Run the narrowest relevant check after changes. For app-flow changes, start Expo and exercise the affected route when feasible.
- Preserve the current working-tree changes; this repository may already contain user work in progress.
