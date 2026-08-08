// Supabase client for consumer accounts (sign up / log in / session). Points at
// the SAME project the driver app reads from. When the env vars are absent the
// client is null and auth falls back to the local AsyncStorage store (src/lib/storage.ts)
// so the UI works with no backend. Separate from dispatch.ts's client, which is
// a stateless anon-only client for the one-way order insert at checkout.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both env vars are set. Gates every real-vs-demo branch. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // React Native has no URL to parse OAuth redirects from.
        detectSessionInUrl: false,
      },
    })
  : null;
