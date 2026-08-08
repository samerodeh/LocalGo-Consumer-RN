import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import type { PaymentCard } from '../types';
import { loadCards, saveCards } from '../lib/storage';
import { detectBrand } from '../lib/cardBrand';

interface AddCardInput {
  number: string;
  expiry: string; // "MM/YY"
  cardholder: string;
}

interface PaymentState {
  ownerEmail: string | null;
  cards: PaymentCard[];

  configure: (email: string | null) => Promise<void>;
  addCard: (input: AddCardInput) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function sortCards(cards: PaymentCard[]): PaymentCard[] {
  return [...cards].sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1));
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  ownerEmail: null,
  cards: [],

  configure: async (email) => {
    if (!email) {
      set({ ownerEmail: null, cards: [] });
      return;
    }
    set({ ownerEmail: email, cards: sortCards(await loadCards(email)) });
  },

  addCard: async ({ number, expiry, cardholder }) => {
    const email = get().ownerEmail;
    if (!email) return;
    const digits = number.replace(/\D/g, '');
    const [mm, yy] = expiry.split('/');
    const card: PaymentCard = {
      id: Crypto.randomUUID(),
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      expMonth: mm ?? '',
      expYear: yy ?? '',
      cardholder: cardholder.trim(),
      // First card added becomes the default.
      isDefault: get().cards.length === 0,
    };
    const cards = sortCards([...get().cards, card]);
    await saveCards(email, cards);
    set({ cards });
  },

  setDefault: async (id) => {
    const email = get().ownerEmail;
    if (!email) return;
    const cards = sortCards(get().cards.map((c) => ({ ...c, isDefault: c.id === id })));
    await saveCards(email, cards);
    set({ cards });
  },

  remove: async (id) => {
    const email = get().ownerEmail;
    if (!email) return;
    let cards = get().cards.filter((c) => c.id !== id);
    // Keep a default if one still exists.
    if (cards.length > 0 && !cards.some((c) => c.isDefault)) cards[0].isDefault = true;
    cards = sortCards(cards);
    await saveCards(email, cards);
    set({ cards });
  },
}));

