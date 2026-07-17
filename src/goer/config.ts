/** Goer runtime configuration. The LLM path needs the Python/FastAPI backend
 *  (backend/, POST /goer/chat) running and reachable via EXPO_PUBLIC_API_URL;
 *  without it Goer runs on the local rule-based NLU. */

import { API_URL } from '../lib/api';

export const GOER_CHAT_URL = API_URL ? `${API_URL}/goer/chat` : null;

/** Dev/demo escape hatch: force the offline assistant even when the backend
 *  is reachable (EXPO_PUBLIC_GOER_FORCE_FALLBACK=1). */
export const FORCE_FALLBACK = process.env.EXPO_PUBLIC_GOER_FORCE_FALLBACK === '1';

export const isGoerLLMConfigured = Boolean(GOER_CHAT_URL) && !FORCE_FALLBACK;

/** Hard cap on model↔tool round-trips within a single user turn. */
export const MAX_TURNS = 8;
/** API-side history cap (messages) sent to the model. */
export const MAX_API_MESSAGES = 24;
/** Transcript cap kept in memory/persisted. */
export const MAX_UI_MESSAGES = 50;
/** Abort the stream if the backend hasn't produced a byte in this long. */
export const FIRST_BYTE_TIMEOUT_MS = 15000;
export const MAX_TOKENS = 1024;
