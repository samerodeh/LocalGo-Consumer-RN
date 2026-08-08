// Indirection so the root layout never imports @stripe/stripe-react-native
// directly. On native this is a straight re-export — same component, same
// behaviour. The sibling stripeProvider.web.tsx is what lets the app bundle for
// web at all (see payment.web.ts for the full explanation).
//
// `children` mirrors Stripe's own prop type (elements, not bare ReactNode)
// rather than widening it, so the two files stay swappable.
import type { ReactElement } from 'react';
import { StripeProvider as NativeStripeProvider } from '@stripe/stripe-react-native';

export function StripeProvider({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: ReactElement | ReactElement[];
}) {
  return <NativeStripeProvider publishableKey={publishableKey}>{children}</NativeStripeProvider>;
}
