import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/theme';
import { useTheme, type ThemePalette } from '../theme/ThemeContext';
import type { PendingOrder } from '../store/usePendingOrders';

/** Live cards for the customer's just-placed orders that no driver has claimed
 *  yet. Each starts as "finding you a driver…" and, once the accept timer
 *  elapses (see usePendingOrders / PATIENCE_MS), switches to the "please be
 *  patient, we're a new business" reassurance. A card disappears the moment a
 *  driver accepts — OrderTrackingStack then shows the delivery timeline. */
export function PendingOrderStack({ orders }: { orders: PendingOrder[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (orders.length === 0) return null;

  return (
    <View style={styles.stack}>
      {orders.map((order) => (
        <View key={order.id} style={[styles.card, order.patient && styles.cardPatient]}>
          <View style={styles.headerRow}>
            {order.patient ? (
              <Ionicons name="heart" size={18} color={colors.orange} />
            ) : (
              <ActivityIndicator size="small" color={colors.orange} />
            )}
            <Text style={styles.title}>
              {order.patient ? 'Thanks for your patience 🙏' : 'Finding you a driver…'}
            </Text>
          </View>

          <Text style={styles.body}>
            {order.patient
              ? `We're a new business and working hard to find a driver for ${order.orderNumber}. Hang tight — it won't be long, and we truly appreciate you!`
              : `Order ${order.orderNumber} is in — we've sent it to nearby drivers and one will accept it any moment.`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    stack: { gap: 12, marginTop: 20, marginHorizontal: 16 },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.gray200,
      padding: 16,
      gap: 8,
      shadowColor: colors.navy,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    // Warm the card once we're reassuring the customer.
    cardPatient: { borderColor: colors.orangeLight, backgroundColor: '#FFF7ED' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 15, fontWeight: '800', color: colors.navy, flex: 1 },
    body: { fontSize: 13, color: colors.textLight, lineHeight: 19 },
  });
