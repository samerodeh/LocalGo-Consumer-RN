// Web-only stand-in for stripeProvider.tsx. Renders children unchanged: there
// is no native Stripe SDK to initialise in a browser, and the checkout path is
// already stubbed out by payment.web.ts. Metro picks this file only when
// platform=web, so native keeps the real provider.
import type { ReactElement } from 'react';

export function StripeProvider({
  publishableKey: _publishableKey,
  children,
}: {
  publishableKey: string;
  children: ReactElement | ReactElement[];
}) {
  return <>{children}</>;
}
