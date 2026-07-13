// Parses the deep link Supabase redirects to after a user taps the password-
// reset email link, e.g. `localgo://reset-password#access_token=...&refresh_token=...&type=recovery`.
// Tokens can arrive in the URL fragment (implicit flow, the default) or as a
// `code` query param (PKCE) — we handle both so this keeps working regardless
// of how the Supabase project's auth flow is configured.
export interface AuthLinkParams {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
}

export function parseAuthLink(url: string): AuthLinkParams {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
  const query = queryIndex >= 0 && queryIndex < queryEnd ? url.slice(queryIndex + 1, queryEnd) : '';

  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(query);

  return {
    accessToken: hashParams.get('access_token') ?? undefined,
    refreshToken: hashParams.get('refresh_token') ?? undefined,
    code: queryParams.get('code') ?? undefined,
    type: hashParams.get('type') ?? queryParams.get('type') ?? undefined,
  };
}
