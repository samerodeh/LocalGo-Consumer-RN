import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { GradientButton } from '../GradientButton';
import { addressDisplayName } from '../../store/addressStore';
import { useGoerStore } from '../../goer/goerStore';
import type { StagedOrder } from '../../goer/types';

/**
 * The money card: the staged order summary with the ONLY button in the chat
 * that actually places an order. Reads live staged state from the store so the
 * same message re-renders through staged → placing → placed (or stale/expired).
 */
export function OrderConfirmationCard({ stagedOrderID }: { stagedOrderID: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const stagedOrder = useGoerStore((s) => s.stagedOrder);
  const placedOrders = useGoerStore((s) => s.placedOrders);
  const confirmStagedOrder = useGoerStore((s) => s.confirmStagedOrder);

  const order: StagedOrder | null =
    stagedOrder?.id === stagedOrderID ? stagedOrder : placedOrders[stagedOrderID] ?? null;

  if (!order) {
    return (
      <View style={[styles.card, styles.expired]}>
        <Ionicons name="time-outline" size={14} color={colors.gray400} />
        <Text style={styles.expiredText}>This order summary expired — ask Goer to check out again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="receipt" size={15} color={colors.orange} />
        <Text style={styles.headerText}>Order confirmation</Text>
      </View>

      {order.lines.map((line) => (
        <View key={line.item.id} style={styles.row}>
          <Text style={styles.rowName} numberOfLines={1}>
            {line.quantity}× {line.item.name}
          </Text>
          <Text style={styles.rowValue}>${(line.item.price * line.quantity).toFixed(2)}</Text>
        </View>
      ))}

      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.rowMuted}>Subtotal</Text>
        <Text style={styles.rowValue}>${order.subtotal.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowMuted}>Delivery fee</Text>
        <Text style={styles.rowValue}>${order.deliveryFee.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowMuted}>Driver tip</Text>
        <Text style={styles.rowValue}>${order.tip.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowStrong}>Total</Text>
        <Text style={styles.rowStrong}>${order.total.toFixed(2)}</Text>
      </View>

      {order.address ? (
        <View style={styles.addressRow}>
          <Ionicons name="location" size={13} color={colors.textLight} />
          <Text style={styles.addressText} numberOfLines={1}>
            {addressDisplayName(order.address)} — {order.address.addressLine}
          </Text>
        </View>
      ) : null}

      {order.status === 'staged' || order.status === 'placing' ? (
        <>
          <GradientButton
            title={`Confirm Order • $${order.total.toFixed(2)}`}
            loading={order.status === 'placing'}
            onPress={() => void confirmStagedOrder()}
            height={46}
            style={{ marginTop: 6 }}
          />
          <Text style={styles.hint}>Nothing is charged until you tap Confirm.</Text>
        </>
      ) : order.status === 'placed' ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.orange} />
          <Text style={styles.statusText}>Order placed</Text>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.statusText, { color: colors.danger }]}>
            Cart changed since this summary — ask Goer to check out again.
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray200,
      padding: 12,
      gap: 6,
      marginVertical: 4,
      maxWidth: '92%',
    },
    expired: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    expiredText: { flex: 1, fontSize: 12, color: colors.gray400 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    headerText: { fontSize: 13, fontWeight: '800', color: colors.navy },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    rowName: { flex: 1, fontSize: 13, color: colors.navy },
    rowMuted: { fontSize: 12, color: colors.textLight },
    rowValue: { fontSize: 12, color: colors.navy },
    rowStrong: { fontSize: 14, fontWeight: '800', color: colors.navy },
    divider: { height: 1, backgroundColor: colors.gray200, marginVertical: 2 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    addressText: { flex: 1, fontSize: 12, color: colors.textLight },
    hint: { fontSize: 11, color: colors.gray400, textAlign: 'center' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    statusText: { fontSize: 13, fontWeight: '700', color: colors.navy, flex: 1 },
  });
