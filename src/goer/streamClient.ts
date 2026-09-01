import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from '../lib/supabase';
import { FIRST_BYTE_TIMEOUT_MS, GOER_CHAT_URL } from './config';
import type { ApiMessage, GoerAgentId, GoerRequestContext, GoerStreamEvent } from './types';

/**
 * Streams one turn from the backend's `POST /goer/chat/stream`.
 *
 * Uses expo/fetch (SDK 52+) because React Native's built-in fetch can't expose
 * `response.body` as a ReadableStream — expo/fetch is WinterCG-compliant on
 * iOS, Android, and web, which is what makes token streaming possible without
 * extra dependencies.
 *
 * The frames are the backend's own small protocol (`agent`, `token`, `actions`,
 * `quick_replies`, `done`), not a passthrough of a model vendor's event stream:
 * the agent loop now lives server-side, so all this has to parse is the result.
 */

export interface StreamRequest {
  message: string;
  history: ApiMessage[];
  activeAgent: GoerAgentId;
  context: GoerRequestContext;
  userId: string;
}

export async function streamGoerChat(
  request: StreamRequest,
  onEvent: (event: GoerStreamEvent) => void,
): Promise<void> {
  if (!GOER_CHAT_URL) throw new Error('Goer backend not configured');

  // Send the signed-in user's JWT when there is one — the backend rate-limits
  // per JWT sub, falling back to the caller's IP for signed-out users.
  let bearer: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) bearer = data.session.access_token;
  }

  // Abort if the backend doesn't produce a first byte in time (cold start
  // budget included); once streaming, the guard is disarmed.
  const controller = new AbortController();
  let timedOut = false;
  let firstByteTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FIRST_BYTE_TIMEOUT_MS);
  const disarm = () => {
    if (firstByteTimer) {
      clearTimeout(firstByteTimer);
      firstByteTimer = null;
    }
  };

  try {
    const res = await streamingFetch(GOER_CHAT_URL, {
      method: 'POST',
      headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        history: request.history,
        user_id: request.userId,
        active_agent: request.activeAgent,
        context: request.context,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`goer/chat ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!res.body) throw new Error('goer/chat returned no stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      disarm();
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines; each carries `data: {...}`.
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            onEvent(JSON.parse(payload) as GoerStreamEvent);
          } catch {
            // A malformed frame shouldn't kill a turn that's otherwise fine.
            console.warn('[goer] unparseable stream frame:', payload.slice(0, 120));
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (err) {
    if (timedOut) throw new Error('goer/chat timed out before first byte');
    throw err;
  } finally {
    disarm();
  }
}
