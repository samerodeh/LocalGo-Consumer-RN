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
