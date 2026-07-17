import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { sendGoerMessage } from '../../goer/send';
import type { CartSummarySnapshot } from '../../goer/types';

/** Cart snapshot card rendered by the view_cart tool. */
export function CartSummaryCard({ snapshot }: { snapshot: CartSummarySnapshot }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="cart" size={15} color={colors.orange} />
        <Text style={styles.headerText}>Your cart</Text>
      </View>
      {snapshot.lines.map((line) => (
        <View key={line.itemID} style={styles.row}>
          <Text style={styles.rowName} numberOfLines={1}>
            {line.quantity}× {line.name}
          </Text>
          <Text style={styles.rowValue}>${(line.unitPrice * line.quantity).toFixed(2)}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.rowMuted}>Subtotal</Text>
        <Text style={styles.rowValue}>${snapshot.subtotal.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowMuted}>Delivery fee</Text>
        <Text style={styles.rowValue}>${snapshot.deliveryFee.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowStrong}>Total (before tip)</Text>
        <Text style={styles.rowStrong}>${snapshot.total.toFixed(2)}</Text>
      </View>
      <Pressable
        onPress={() => void sendGoerMessage('Checkout')}
        style={({ pressed }) => [styles.checkoutChip, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Start checkout"
      >
        <Text style={styles.checkoutText}>Checkout</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.orange} />
      </Pressable>
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
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    headerText: { fontSize: 13, fontWeight: '800', color: colors.navy },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    rowName: { flex: 1, fontSize: 13, color: colors.navy },
    rowMuted: { fontSize: 12, color: colors.textLight },
    rowValue: { fontSize: 12, color: colors.navy },
    rowStrong: { fontSize: 13, fontWeight: '700', color: colors.navy },
    divider: { height: 1, backgroundColor: colors.gray200, marginVertical: 2 },
    checkoutChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.orange,
      paddingVertical: 8,
      marginTop: 4,
    },
    checkoutText: { fontSize: 13, fontWeight: '700', color: colors.orange },
  });
