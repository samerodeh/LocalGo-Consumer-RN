import { create } from 'zustand';
import type { StoredUser } from '../types';
import { generateSalt, hashPassword, verifyPassword } from '../lib/hash';
import {
  clearSession,
  getUser,
  loadSessionEmail,
  saveSessionEmail,
  saveUser,
} from '../lib/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function passwordError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

/** Builds the app-facing user shape from a Supabase Auth user. Fields that only
 *  make sense for the local demo store (password hash, lockout) are inert here —
 *  Supabase Auth owns that. */
function profileFromSupabaseUser(user: {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}): StoredUser {
  const meta = user.user_metadata ?? {};
  return {
    firstName: (meta.first_name as string) ?? '',
    lastName: (meta.last_name as string) ?? '',
    email: user.email ?? '',
    passwordHash: null,
    passwordSalt: null,
    createdAt: user.created_at ?? new Date().toISOString(),
    failedLoginAttempts: 0,
    lockoutUntil: null,
  };
}

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  bootstrapped: boolean;
  errorMessage: string | null;
  currentUser: StoredUser | null;

  restoreSession: () => Promise<void>;
  clearError: () => void;
  signUp: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  isLoading: false,
  bootstrapped: false,
  errorMessage: null,
  currentUser: null,

  clearError: () => set({ errorMessage: null }),

  restoreSession: async () => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      set({
        currentUser: data.session?.user ? profileFromSupabaseUser(data.session.user) : null,
        isLoggedIn: Boolean(data.session?.user),
        bootstrapped: true,
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          currentUser: session?.user ? profileFromSupabaseUser(session.user) : null,
          isLoggedIn: Boolean(session?.user),
        });
      });
      return;
    }

    const email = await loadSessionEmail();
    if (email) {
      const user = await getUser(email);
      if (user) {
        set({ currentUser: user, isLoggedIn: true });
      }
    }
    set({ bootstrapped: true });
  },

  signUp: async ({ firstName, lastName, email, password, confirmPassword }) => {
    set({ errorMessage: null });
    const first = firstName.trim();
    const last = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!first || !last) {
      set({ errorMessage: 'Please enter your first and last name.' });
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      set({ errorMessage: 'Please enter a valid email address.' });
      return;
    }
    const pwIssue = passwordError(password);
    if (pwIssue) {
      set({ errorMessage: pwIssue });
      return;
    }
    if (password !== confirmPassword) {
      set({ errorMessage: 'Passwords do not match.' });
      return;
    }

    if (isSupabaseConfigured && supabase) {
      set({ isLoading: true });
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { first_name: first, last_name: last } },
      });
      if (error) {
        const message = /already registered|already exists/i.test(error.message)
          ? 'An account with this email already exists.'
          : error.message;
        set({ isLoading: false, errorMessage: message });
        return;
      }
      if (data.user) {
        await supabase.from('customers').insert({
          id: data.user.id,
          first_name: first,
          last_name: last,
        });
      }
      set({ isLoading: false });
      return;
    }

    if (await getUser(normalizedEmail)) {
      set({ errorMessage: 'An account with this email already exists.' });
      return;
    }

    set({ isLoading: true });
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const user: StoredUser = {
      firstName: first,
      lastName: last,
      email: normalizedEmail,
      passwordHash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      lockoutUntil: null,
    };
    await saveUser(user);
    await saveSessionEmail(normalizedEmail);
    set({ currentUser: user, isLoading: false, isLoggedIn: true });
  },

  login: async (email, password) => {
    set({ errorMessage: null });
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      set({ errorMessage: 'Please fill in all fields.' });
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      set({ errorMessage: 'Please enter a valid email address.' });
      return;
    }

    if (isSupabaseConfigured && supabase) {
      set({ isLoading: true });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      // Self-heal: if signup's profile-row insert ever failed (e.g. the
      // customers table didn't exist yet at signup time), backfill it here so
      // the account isn't permanently stuck without a profile row. Harmless
      // no-op once the row already exists.
      if (data.user) {
        const meta = data.user.user_metadata ?? {};
        await supabase.from('customers').upsert({
          id: data.user.id,
          first_name: (meta.first_name as string) ?? '',
          last_name: (meta.last_name as string) ?? '',
        });
      }
      set({
        isLoading: false,
        errorMessage: error ? 'Invalid email or password.' : null,
      });
      return;
    }

    const user = await getUser(normalizedEmail);
    if (!user) {
      // Same message as a wrong password so we don't reveal whether the email exists.
      set({ errorMessage: 'Invalid email or password.' });
      return;
    }
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remaining = Math.max(
        1,
        Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 1000),
      );
      set({ errorMessage: `Too many attempts. Try again in ${remaining}s.` });
      return;
    }
    if (!user.passwordSalt || !user.passwordHash) {
      set({ errorMessage: 'This account uses a social sign-in method.' });
      return;
    }

    set({ isLoading: true });
    const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (valid) {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      await saveUser(user);
      await saveSessionEmail(normalizedEmail);
      set({ currentUser: user, isLoading: false, isLoggedIn: true });
    } else {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockoutUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString();
        user.failedLoginAttempts = 0;
      }
      await saveUser(user);
      set({ isLoading: false, errorMessage: 'Invalid email or password.' });
    }
  },

  logout: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }
    await clearSession();
    set({ isLoggedIn: false, currentUser: null, errorMessage: null });
  },
}));
