// Goer chat proxy — a thin, secure SSE pass-through to the Anthropic Messages
// API. The ANTHROPIC_API_KEY lives only in this function's secrets; the mobile
// client sends {system, messages, tools} and receives the raw Anthropic event
// stream. Tools execute client-side (the cart is on-device state), so this
// function stays stateless.
//
// Deploy (run from the repo root):
//   supabase functions deploy goer-chat --project-ref sxednzdbbfjxdvezmouf
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref sxednzdbbfjxdvezmouf
// Optional model override:
//   supabase secrets set GOER_MODEL=claude-haiku-4-5 --project-ref sxednzdbbfjxdvezmouf
//
// JWT verification stays ON (the default): the project's anon key is itself a
// valid JWT, so the app can call this signed-out, while random internet
// traffic without any key gets 401 at the gateway. If the project ever moves
// to sb_publishable_* keys (not JWTs), redeploy with --no-verify-jwt and check
// the apikey header manually here.

const MODEL_ALLOWLIST = ['claude-haiku-4-5', 'claude-sonnet-4-6'];
const DEFAULT_MODEL = Deno.env.get('GOER_MODEL') ?? 'claude-haiku-4-5';
const MAX_TOKENS_CAP = 2048;
const MAX_MESSAGES = 40;
const MAX_BODY_BYTES = 100_000;

// Best-effort sliding-window rate limit. Deno isolates are ephemeral, so this
// resets on cold starts — good enough to blunt abuse of a demo endpoint;
// production wants a durable counter (Postgres/Upstash).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

/** Per-user key: JWT sub claim (gateway already verified the signature). */
function callerKey(req: Request): string {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.sub === 'string' && payload.sub) return payload.sub;
  } catch {
    // anon key or malformed — fall through to IP.
  }
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ type: 'error', error: { message } }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonError(405, 'POST only');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonError(500, 'ANTHROPIC_API_KEY is not configured');

  if (rateLimited(callerKey(req))) return jsonError(429, 'Slow down — try again in a minute.');

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(400, 'Request too large');

  let body: {
    system?: unknown;
    messages?: unknown;
    tools?: unknown;
    model?: unknown;
    max_tokens?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, 'Invalid JSON');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, 'messages[] required');
  }

  const payload = {
    model:
      typeof body.model === 'string' && MODEL_ALLOWLIST.includes(body.model)
        ? body.model
        : DEFAULT_MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP),
    system: typeof body.system === 'string' ? body.system : undefined,
    messages: body.messages.slice(-MAX_MESSAGES),
    tools: Array.isArray(body.tools) ? body.tools : [],
    stream: true,
  };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[goer-chat] upstream error', upstream.status, detail.slice(0, 500));
    return jsonError(502, `Upstream error (${upstream.status})`);
  }

  // Pipe Anthropic's SSE stream through verbatim.
  return new Response(upstream.body, {
    headers: {
      ...CORS_HEADERS,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
    },
  });
});
