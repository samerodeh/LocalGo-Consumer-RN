import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useOrdersStore } from '../store/ordersStore';
import { addressDisplayName, useAddressStore } from '../store/addressStore';
import { useGoerStore } from './goerStore';
import type { GoerRequestContext } from './types';

/**
 * Snapshots the live app state the backend agents reason over.
 *
 * The server rebuilds every system prompt from this on each turn, which is why
 * it's assembled fresh per request rather than cached: the cart the agent
 * describes has to be the cart the user is looking at.
 *
 * Only what the agents need travels — no card details, no coordinates, no
 * instructions field. Addresses go as a label plus street line so Checkout can
 * name one; the delivery-location gate itself stays client- and dispatch-side,
 * where the real coordinates are.
 */
export function buildGoerContext(): GoerRequestContext {
  const user = useAuthStore.getState().currentUser;
  const cart = useCartStore.getState();
  const goer = useGoerStore.getState();
  const addressStore = useAddressStore.getState();
  const orders = useOrdersStore.getState().orders;

  const selected =
    (goer.chatAddressId
      ? addressStore.allAddresses.find((a) => a.id === goer.chatAddressId)
      : null) ?? addressStore.defaultAddress;

  return {
    firstName: user?.firstName ?? '',
    languagePreference: 'auto',
    cart: cart.lines.map((line) => ({
      itemId: line.item.id,
      name: line.item.name,
      quantity: line.quantity,
      unitPrice: line.item.price,
    })),
    restaurantId: cart.restaurantID,
    subtotal: cart.subtotal(),
    deliveryFee: cart.deliveryFee(),
    tip: goer.chatTip,
    addresses: addressStore.allAddresses.map((address) => ({
      id: address.id,
      label: addressDisplayName(address),
      addressLine: address.addressLine,
      isDefault: address.isDefault,
    })),
    selectedAddressId: selected?.id ?? null,
    // Five is enough for "what did I order last time" without bloating the
    // request; the Tracker's tools fetch details for anything older.
    orders: orders.slice(0, 5).map((order) => ({
      id: order.id,
      restaurantName: order.restaurantName,
      status: order.status,
      placedAt: order.placedAt,
      totalCents: order.totalCents,
      items: order.items.map((item) => ({
        itemId: item.menuItemID,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents / 100,
      })),
    })),
    // No profile-editing UI yet (see the known gaps in CLAUDE.md), so this is
    // empty until the user states a restriction in chat — the Dietary Advisor
    // unions what they say with whatever is set here.
    dietaryProfile: { halal: false, vegan: false, vegetarian: false, allergies: [] },
  };
}
