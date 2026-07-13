import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

/** A driver-accepted-your-order notice, shown as a banner in the consumer app. */
export interface OrderAcceptedNotice {
  id: string;
  orderNumber: string;
  etaMinutes: number;
}

/** Lower/upper bound of the delivery window shown to the customer, derived from
 *  the single ETA the driver commits to (45 → "40–50 min"). */
export function etaWindow(etaMinutes: number): { min: number; max: number } {
  return { min: Math.max(5, etaMinutes - 5), max: etaMinutes + 5 };
}

/**
 * Watches the signed-in customer's orders on the shared dispatch backend and
 * raises a notice the moment a driver claims one (orders.accepted_by is set).
 * That claim is how the driver "messages" the customer that the food is coming.
 *
 * Returns the newest un-dismissed accepted order plus a dismiss handler. No-op
 * (null) in demo mode or when signed out — the banner simply never shows.
 */
export function useOrderTracking(): {
  notice: OrderAcceptedNotice | null;
  dismiss: () => void;
} {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [notice, setNotice] = useState<OrderAcceptedNotice | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const raise = useCallback((row: { id: string; order_number: string; eta_minutes: number | null }) => {
    if (dismissedRef.current.has(row.id)) return;
    setNotice({
      id: row.id,
      orderNumber: row.order_number,
      etaMinutes: row.eta_minutes ?? 45,
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !isLoggedIn) {
      setNotice(null);
      return;
    }
    const sb = supabase;
    let channel: ReturnType<typeof sb.channel> | null = null;

    (async () => {
      const { data: userData } = await sb.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      // Catch an order accepted while the app was backgrounded/closed: newest
      // claimed order from the last few hours.
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from('orders')
        .select('id, order_number, eta_minutes, accepted_by, accepted_at')
        .eq('customer_id', uid)
        .not('accepted_by', 'is', null)
        .gte('accepted_at', since)
        .order('accepted_at', { ascending: false })
        .limit(1);
      if (data && data[0]) raise(data[0]);

      channel = sb
        .channel('customer-orders')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${uid}` },
          (payload) => {
            const next = payload.new as {
              id: string;
              order_number: string;
              eta_minutes: number | null;
              accepted_by: string | null;
            };
            if (next.accepted_by) raise(next);
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) sb.removeChannel(channel);
    };
  }, [isLoggedIn, raise]);

  const dismiss = useCallback(() => {
    setNotice((current) => {
      if (current) dismissedRef.current.add(current.id);
      return null;
    });
  }, []);

  return { notice, dismiss };
}
