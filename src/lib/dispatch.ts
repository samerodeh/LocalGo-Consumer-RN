// Bridges a placed consumer order to the shared Supabase `orders` table so it
// appears live on the LocalGO driver dashboard (localgo-driver-web). This is a
// one-way, best-effort side-effect: it never throws, so a missing backend or a
// network failure can never break checkout. Consumer auth stays fully local —
// this uses only the anon key to INSERT a single row.
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Address, CartLine } from '../types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both env vars are set — mirrors the driver app's gate. */
export const isDispatchConfigured = Boolean(url && anonKey);

// No realtime/auth needed: the consumer only inserts. Disabling session
// persistence keeps it stateless and avoids pulling in AsyncStorage here.
const supabase: SupabaseClient | null = isDispatchConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export interface DispatchOrderInput {
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  deliveryAddress: Address | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Maps a placed order to the driver dashboard's `orders` schema (snake_case,
 * per useOrderFeed.mapRow) and inserts it with status 'available'. Swallows all
 * errors — the caller's local order record is the source of truth.
 */
export async function publishOrderToDispatch(input: DispatchOrderInput): Promise<void> {
  if (!supabase) return;

  const { lines, subtotal, deliveryFee, total, deliveryAddress } = input;

  const dropoff = [deliveryAddress?.addressLine, deliveryAddress?.apartmentSuite]
    .filter((part) => part && part.trim().length > 0)
    .join(', ');

  const row = {
    order_number: `#LG-${Date.now().toString().slice(-4)}`,
    restaurant_name: input.restaurantName,
    restaurant_address: input.restaurantAddress,
    customer_name: input.customerName,
    dropoff_address: dropoff || 'No address on file',
    item_count: lines.reduce((sum, l) => sum + l.quantity, 0),
    order_total: round2(total),
    // Demo-grade payout: driver keeps the delivery fee plus 10% of the subtotal.
    payout: round2(deliveryFee + subtotal * 0.1),
    // Placeholder — no geocoding/routing in scope yet.
    distance_km: 2.5,
    status: 'available',
    items: lines.map((l) => `${l.quantity}× ${l.item.name}`),
  };

  try {
    const { error } = await supabase.from('orders').insert(row);
    if (error) {
      console.warn('[dispatch] order publish failed:', error.message);
    }
  } catch (err) {
    console.warn('[dispatch] order publish threw:', err);
  }
}
