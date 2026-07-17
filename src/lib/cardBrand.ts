// Lightweight card-brand detection + input formatting for the (mock) add-card
// form. Nothing here touches a network or stores a full card number.

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Card';

/** Ionicons glyph roughly matching each brand for the card row. */
export const BRAND_ICON: Record<CardBrand, string> = {
  Visa: 'card',
  Mastercard: 'card',
  Amex: 'card',
  Discover: 'card',
  Card: 'card-outline',
};

export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'Visa';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(5[1-5]|22[2-9]|2[3-6]|27[01]|2720)/.test(digits)) return 'Mastercard';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
  return 'Card';
}

/** Strip to digits and group for display (Amex 4-6-5, everyone else 4-4-4-4). */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  const brand = detectBrand(digits);
  const groups = brand === 'Amex' ? [4, 6, 5] : [4, 4, 4, 4];
  const out: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  return out.join(' ');
}

/** Expiry as MM/YY while typing. */
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export interface CardValidation {
  valid: boolean;
  error?: string;
}

export function validateCard(input: {
  number: string;
  expiry: string;
  cvv: string;
  cardholder: string;
}): CardValidation {
  const digits = input.number.replace(/\D/g, '');
  if (!input.cardholder.trim()) return { valid: false, error: 'Enter the cardholder name.' };
  if (digits.length < 15) return { valid: false, error: 'Enter a valid card number.' };
  const [mm, yy] = input.expiry.split('/');
  const month = Number(mm);
  if (!mm || !yy || month < 1 || month > 12) return { valid: false, error: 'Enter a valid expiry (MM/YY).' };
  const cvvLen = detectBrand(digits) === 'Amex' ? 4 : 3;
  if (input.cvv.replace(/\D/g, '').length !== cvvLen) {
    return { valid: false, error: `Enter the ${cvvLen}-digit security code.` };
  }
  return { valid: true };
}
