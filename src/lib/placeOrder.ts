import * as Crypto from 'expo-crypto';
import type { Address, CartLine, StoredUser } from '../types';
import { alTaib, restaurantById } from '../data/restaurants';
import { useCartStore } from '../store/cartStore';
import { useOrdersStore } from '../store/ordersStore';
import { publishOrderToDispatch } from './dispatch';
import { deliveryLocationProblem } from './deliveryLocation';
import { supabase } from './supabase';

/** Everything checkout needs, snapshotted by the caller before the cart mutates. */
export interface PlaceOrderInput {
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  restaurantID: string | null;
  deliveryAddress: Address | null;
  customer: StoredUser | null;
}

export type PlaceOrderResult = { ok: true } | { ok: false; error: string };

/**
 * The single checkout pipeline, shared by the Cart screen and Goer's in-chat
 * confirmation card: simulated payment, local order record (the source of
 * truth), best-effort dispatch to the driver feed, then cart clear. Uses
 * `getState()` so it's callable outside React components.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { lines, subtotal, deliveryFee, tip, total, deliveryAddress, customer } = input;
  if (lines.length === 0) return { ok: false, error: 'Your cart is empty.' };

  // Hard gate, shared by the Cart screen and Goer: no order leaves the device
  // without a verified delivery location.
  const locationProblem = deliveryLocationProblem(deliveryAddress);
  if (locationProblem) return { ok: false, error: locationProblem };

  const rid = input.restaurantID ?? alTaib.id;
  const restaurant = restaurantById(rid);
  const restaurantName = restaurant?.name ?? rid;

  try {
    // Simulated authorize → capture (the SwiftUI app's PaymentService, minus the network).
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await useOrdersStore.getState().record({
      lines,
      subtotal,
      deliveryFee,
      tip,
      total,
      restaurantID: rid,
      restaurantName,
      deliveryAddress,
      paymentIntentID: `pi_sim_${Crypto.randomUUID().slice(0, 12)}`,
    });

    // Tie the dispatched order to this signed-in customer so the driver who
    // accepts it can message them back (see useOrderTracking).
    const { data: authData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    // Best-effort: surface the order on the driver dashboard. Never blocks or
    // fails checkout — the local record above is the source of truth.
    void publishOrderToDispatch({
      lines,
      subtotal,
      deliveryFee,
      tip,
      total,
      restaurantName,
      restaurantAddress: restaurant?.address ?? '',
      customerName: customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : 'LocalGO Customer',
      deliveryAddress,
      customerId: authData.user?.id ?? null,
    });

    useCartStore.getState().clear();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Something went wrong placing your order.',
    };
  }
}
