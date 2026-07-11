import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Address, OrderRecord, StoredUser } from '../types';

/**
 * Thin AsyncStorage layer standing in for the SwiftUI app's SwiftData store +
 * Keychain session. Users are keyed by email; orders and addresses are namespaced
 * per owner email so nothing leaks across accounts on a shared device.
 */

const KEYS = {
  users: 'localgo.users',
  session: 'localgo.session',
  orders: (email: string) => `localgo.orders.${email}`,
  addresses: (email: string) => `localgo.addresses.${email}`,
};

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// MARK: - Users

type UserMap = Record<string, StoredUser>;

export async function loadUsers(): Promise<UserMap> {
  return readJSON<UserMap>(KEYS.users, {});
}

export async function getUser(email: string): Promise<StoredUser | undefined> {
  const users = await loadUsers();
  return users[email.toLowerCase()];
}

export async function saveUser(user: StoredUser): Promise<void> {
  const users = await loadUsers();
  users[user.email.toLowerCase()] = user;
  await writeJSON(KEYS.users, users);
}

// MARK: - Session

export async function loadSessionEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.session);
}

export async function saveSessionEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.session, email.toLowerCase());
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.session);
}

// MARK: - Orders

export async function loadOrders(email: string): Promise<OrderRecord[]> {
  return readJSON<OrderRecord[]>(KEYS.orders(email.toLowerCase()), []);
}

export async function saveOrders(email: string, orders: OrderRecord[]): Promise<void> {
  await writeJSON(KEYS.orders(email.toLowerCase()), orders);
}

// MARK: - Addresses

export async function loadAddresses(email: string): Promise<Address[]> {
  return readJSON<Address[]>(KEYS.addresses(email.toLowerCase()), []);
}

export async function saveAddresses(email: string, addresses: Address[]): Promise<void> {
  await writeJSON(KEYS.addresses(email.toLowerCase()), addresses);
}
