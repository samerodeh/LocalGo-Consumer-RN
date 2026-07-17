// The Python/FastAPI backend (see ../../backend). All server-side work —
// order dispatch, the Goer LLM proxy, push notifications — goes through it;
// the app talks to Supabase directly only for Auth sessions and realtime.
// Unset EXPO_PUBLIC_API_URL = demo mode, mirroring the old edge-function gate.

const raw = process.env.EXPO_PUBLIC_API_URL;

export const API_URL: string | null = raw ? raw.replace(/\/+$/, '') : null;

/** True only when EXPO_PUBLIC_API_URL is set. Gates every backend call. */
export const isBackendConfigured = Boolean(API_URL);
