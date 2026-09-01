import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Address, OrderRecord, PaymentCard, StoredUser } from '../types';
import type { PersistedGoerChat } from '../goer/types';

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
  cards: (email: string) => `localgo.cards.${email}`,
  goer: (email: string) => `localgo.goer.${email}`,
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

// MARK: - Goer chat

export async function loadGoerChat(email: string): Promise<PersistedGoerChat | null> {
  return readJSON<PersistedGoerChat | null>(KEYS.goer(email.toLowerCase()), null);
}

export async function saveGoerChat(email: string, chat: PersistedGoerChat): Promise<void> {
  await writeJSON(KEYS.goer(email.toLowerCase()), chat);
}

// MARK: - Payment cards

export async function loadCards(email: string): Promise<PaymentCard[]> {
  return readJSON<PaymentCard[]>(KEYS.cards(email.toLowerCase()), []);
}

export async function saveCards(email: string, cards: PaymentCard[]): Promise<void> {
  await writeJSON(KEYS.cards(email.toLowerCase()), cards);
}

// MARK: - Account deletion

/**
 * Removes every trace of one account from this device: their orders, saved
 * addresses, saved cards, Goer chat history, the demo-mode user record, and the
 * session pointer.
 *
 * Server-side deletion is separate (`src/lib/account.ts`). This runs even in
 * demo mode, where there is no server and this IS the deletion.
 */
export async function clearUserData(email: string): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.orders(email),
    KEYS.addresses(email),
    KEYS.cards(email),
    KEYS.goer(email),
  ]);

  // Demo-mode accounts live in a single map keyed by email.
  const users = await loadUsers();
  if (users[email]) {
    delete users[email];
    await writeJSON(KEYS.users, users);
  }

  await clearSession();
}
