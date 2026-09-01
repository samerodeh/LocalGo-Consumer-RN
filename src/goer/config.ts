/** Goer runtime configuration.
 *
 *  The agent pipeline (guard -> router -> specialist, ChromaDB retrieval, Groq)
 *  runs in the Python/FastAPI backend (backend/app/goer/). This app needs only
 *  `EXPO_PUBLIC_API_URL` to reach it; without one, Goer runs on the on-device
 *  rule-based assistant instead. No model key ever ships in the bundle. */

import { API_URL } from '../lib/api';

export const GOER_CHAT_URL = API_URL ? `${API_URL}/goer/chat/stream` : null;

/** Dev/demo escape hatch: force the offline assistant even when the backend
 *  is reachable (EXPO_PUBLIC_GOER_FORCE_FALLBACK=1). */
export const FORCE_FALLBACK = process.env.EXPO_PUBLIC_GOER_FORCE_FALLBACK === '1';

export const isGoerLLMConfigured = Boolean(GOER_CHAT_URL) && !FORCE_FALLBACK;

/** Conversation turns sent to the backend. The server trims again on its side;
 *  this keeps the request small on a phone connection. */
export const MAX_API_MESSAGES = 24;
/** Transcript cap kept in memory/persisted. */
export const MAX_UI_MESSAGES = 50;
/** Abort if the backend hasn't produced a byte in this long. A turn runs the
 *  guard and the router before the first reply token, so this is more generous
 *  than a plain proxy would need — and a cold Render instance can add 30s+. */
export const FIRST_BYTE_TIMEOUT_MS = 25000;
