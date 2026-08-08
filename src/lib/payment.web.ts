// Web-only stand-in for payment.ts.
//
// @stripe/stripe-react-native is native-only: it imports
// react-native/Libraries/Utilities/codegenNativeCommands, which Metro refuses
// to bundle for web, and that single import failed the ENTIRE web bundle — the
// app could not run in a browser at all. Metro picks this file over payment.ts
// only when platform=web, so iOS and Android keep the real Stripe PaymentSheet
// untouched.
//
// Card payment genuinely cannot work here (there is no web PaymentSheet in this
// SDK), so this reports that honestly rather than pretending to charge.
import type { PaymentResult } from './payment';

export type { PaymentResult };

export async function payWithCard(
  _amountCents: number,
  _currency = 'cad',
): Promise<PaymentResult> {
  return { ok: false, error: 'Card payment is only available in the mobile app.' };
}
