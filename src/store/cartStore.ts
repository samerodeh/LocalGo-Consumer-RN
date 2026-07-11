import { create } from 'zustand';
import type { CartLine, MenuItem } from '../types';

const DELIVERY_FEE = 2.99;

interface CartState {
  lines: CartLine[];
  /** Restaurant the current cart's items came from — recorded to history on checkout. */
  restaurantID: string | null;

  add: (item: MenuItem, restaurantID?: string) => void;
  decrement: (item: MenuItem) => void;
  removeLine: (itemID: string) => void;
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

  add: (item, restaurantID) =>
    set((state) => {
      const nextRestaurant =
        restaurantID && state.lines.length === 0 ? restaurantID : state.restaurantID;
      const idx = state.lines.findIndex((l) => l.item.id === item.id);
      if (idx >= 0) {
        const lines = [...state.lines];
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + 1 };
        return { lines, restaurantID: nextRestaurant };
      }
      return { lines: [...state.lines, { item, quantity: 1 }], restaurantID: nextRestaurant };
    }),

  decrement: (item) =>
    set((state) => {
      const idx = state.lines.findIndex((l) => l.item.id === item.id);
      if (idx < 0) return state;
      const lines = [...state.lines];
      if (lines[idx].quantity > 1) {
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity - 1 };
      } else {
        lines.splice(idx, 1);
      }
      return { lines, restaurantID: lines.length === 0 ? null : state.restaurantID };
    }),

  removeLine: (itemID) =>
    set((state) => {
      const lines = state.lines.filter((l) => l.item.id !== itemID);
      return { lines, restaurantID: lines.length === 0 ? null : state.restaurantID };
    }),

  clear: () => set({ lines: [], restaurantID: null }),

  quantityFor: (itemID) => get().lines.find((l) => l.item.id === itemID)?.quantity ?? 0,
  itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
  subtotal: () => get().lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
  deliveryFee: () => (get().lines.length === 0 ? 0 : DELIVERY_FEE),
  total: () => get().subtotal() + get().deliveryFee(),
}));
