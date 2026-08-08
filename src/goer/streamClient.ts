import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from '../lib/supabase';
import { FIRST_BYTE_TIMEOUT_MS, GOER_CHAT_URL, MAX_TOKENS } from './config';
import type { ApiContentBlock, ApiMessage, ToolDef, ApiToolUseBlock } from './types';

/**
 * Streams one model response through the FastAPI backend's /goer/chat proxy.
 *
 * Uses expo/fetch (SDK 52+) because React Native's built-in fetch can't expose
 * `response.body` as a ReadableStream — expo/fetch is WinterCG-compliant on
 * iOS, Android, and web, which is what makes token streaming possible without
 * extra dependencies.
 */

export interface StreamResult {
  content: ApiContentBlock[];
  stopReason: string | null;
}

export async function streamGoerChat(
  body: { system: string; messages: ApiMessage[]; tools: ToolDef[] },
  onTextDelta: (delta: string) => void,
): Promise<StreamResult> {
  if (!GOER_CHAT_URL) throw new Error('Goer LLM endpoint not configured');

  // Send the signed-in user's JWT when there is one — the backend rate-limits
  // per JWT sub, falling back to the caller's IP for signed-out users.
  let bearer: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) bearer = data.session.access_token;
  }

  // Abort if the function doesn't produce a first byte in time (cold start
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
      body: JSON.stringify({ ...body, max_tokens: MAX_TOKENS }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`goer-chat ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!res.body) throw new Error('goer-chat returned no stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const content: ApiContentBlock[] = [];
    const jsonBuffers = new Map<number, string>();
    let stopReason: string | null = null;

    const handleEvent = (data: Record<string, unknown>) => {
      switch (data.type) {
        case 'content_block_start': {
          const index = Number(data.index);
          const block = data.content_block as { type: string; id?: string; name?: string };
          if (block.type === 'text') content[index] = { type: 'text', text: '' };
          else if (block.type === 'tool_use') {
            content[index] = { type: 'tool_use', id: block.id ?? '', name: block.name ?? '', input: {} };
            jsonBuffers.set(index, '');
          }
          break;
        }
        case 'content_block_delta': {
          const index = Number(data.index);
          const delta = data.delta as { type: string; text?: string; partial_json?: string };
          const block = content[index];
          if (delta.type === 'text_delta' && block?.type === 'text') {
            block.text += delta.text ?? '';
            onTextDelta(delta.text ?? '');
          } else if (delta.type === 'input_json_delta' && block?.type === 'tool_use') {
            jsonBuffers.set(index, (jsonBuffers.get(index) ?? '') + (delta.partial_json ?? ''));
          }
          break;
        }
        case 'content_block_stop': {
          const index = Number(data.index);
          const block = content[index];
          if (block?.type === 'tool_use') {
            const raw = jsonBuffers.get(index) ?? '';
            try {
              (block as ApiToolUseBlock).input = raw ? JSON.parse(raw) : {};
            } catch {
              (block as ApiToolUseBlock).input = {};
            }
          }
          break;
        }
        case 'message_delta': {
          const delta = data.delta as { stop_reason?: string | null };
          if (delta?.stop_reason) stopReason = delta.stop_reason;
          break;
        }
        case 'error': {
          const err = data.error as { message?: string } | undefined;
          throw new Error(err?.message ?? 'stream error');
        }
        default:
          break; // message_start / message_stop / ping need no handling
      }
    };

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
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            if (payload && payload !== '[DONE]') handleEvent(JSON.parse(payload));
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }

    return {
      // Drop empty text blocks — the API rejects them when echoed back.
      content: content.filter((b) => b && (b.type !== 'text' || b.text.length > 0)),
      stopReason,
    };
  } catch (err) {
    if (timedOut) throw new Error('goer-chat timed out before first byte');
    throw err;
  } finally {
    disarm();
  }
}
