import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import type { CartLine, CartLineSelection, MenuItem } from '../types';
import { cartLineUnitPrice } from '../lib/cartLine';

const DELIVERY_FEE = 5;

/** Order-independent key so two identically-configured adds merge into one line, while two different configurations of the same item stay separate. */
function selectionsKey(selections?: CartLineSelection[]): string {
  if (!selections || selections.length === 0) return '';
  return selections
    .map((s) => `${s.groupId}:${[...s.choiceNames].sort().join(',')}`)
    .sort()
    .join('|');
}

function lineKey(itemID: string, selections?: CartLineSelection[], notes?: string): string {
  return `${itemID}::${selectionsKey(selections)}::${notes ?? ''}`;
}

interface CartState {
  lines: CartLine[];
  /** Restaurant the current cart's items came from — recorded to history on checkout. */
  restaurantID: string | null;

  add: (item: MenuItem, restaurantID?: string, selections?: CartLineSelection[], notes?: string) => void;
  /** Legacy convenience for items with no customizations — decrements that item's plain (unconfigured) line. */
  decrement: (item: MenuItem) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;

  quantityFor: (itemID: string) => number;
  itemCount: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  restaurantID: null,

  add: (item, restaurantID, selections, notes) =>
    set((state) => {
      const nextRestaurant =
        restaurantID && state.lines.length === 0 ? restaurantID : state.restaurantID;
      const key = lineKey(item.id, selections, notes);
      const idx = state.lines.findIndex((l) => lineKey(l.item.id, l.selections, l.notes) === key);
      if (idx >= 0) {
        const lines = [...state.lines];
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + 1 };
        return { lines, restaurantID: nextRestaurant };
      }
      const newLine: CartLine = {
        lineId: Crypto.randomUUID(),
        item,
        quantity: 1,
        selections,
        notes,
      };
      return { lines: [...state.lines, newLine], restaurantID: nextRestaurant };
    }),

  decrement: (item) =>
    set((state) => {
      const idx = state.lines.findIndex((l) => l.item.id === item.id && selectionsKey(l.selections) === '' && !l.notes);
      if (idx < 0) return state;
      const lines = [...state.lines];
      if (lines[idx].quantity > 1) {
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity - 1 };
      } else {
        lines.splice(idx, 1);
      }
      return { lines, restaurantID: lines.length === 0 ? null : state.restaurantID };
    }),

  incrementLine: (lineId) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)),
    })),

  decrementLine: (lineId) =>
    set((state) => {
      const idx = state.lines.findIndex((l) => l.lineId === lineId);
      if (idx < 0) return state;
      const lines = [...state.lines];
      if (lines[idx].quantity > 1) {
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity - 1 };
      } else {
        lines.splice(idx, 1);
      }
      return { lines, restaurantID: lines.length === 0 ? null : state.restaurantID };
    }),

  removeLine: (lineId) =>
    set((state) => {
      const lines = state.lines.filter((l) => l.lineId !== lineId);
      return { lines, restaurantID: lines.length === 0 ? null : state.restaurantID };
    }),

  clear: () => set({ lines: [], restaurantID: null }),

  quantityFor: (itemID) =>
    get()
      .lines.filter((l) => l.item.id === itemID)
      .reduce((sum, l) => sum + l.quantity, 0),
  itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
  subtotal: () => get().lines.reduce((sum, l) => sum + cartLineUnitPrice(l) * l.quantity, 0),
  deliveryFee: () => (get().lines.length === 0 ? 0 : DELIVERY_FEE),
  total: () => get().subtotal() + get().deliveryFee(),
}));
