import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/theme';
import { DisplayText } from '../../src/components/DisplayText';
import { GradientButton } from '../../src/components/GradientButton';
import { RemoteImage } from '../../src/components/RemoteImage';
import { useCartStore } from '../../src/store/cartStore';
import { useOrdersStore } from '../../src/store/ordersStore';
import { useAddressStore } from '../../src/store/addressStore';
import { alTaib, restaurantById } from '../../src/data/restaurants';

export default function CartScreen() {
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const decrement = useCartStore((s) => s.decrement);
  const clear = useCartStore((s) => s.clear);
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryFee = useCartStore((s) => s.deliveryFee());
  const total = useCartStore((s) => s.total());
  const restaurantID = useCartStore((s) => s.restaurantID);

  const record = useOrdersStore((s) => s.record);
  const defaultAddress = useAddressStore((s) => s.defaultAddress);

  const [processing, setProcessing] = useState(false);

  const placeOrder = async () => {
    if (lines.length === 0 || processing) return;
    setProcessing(true);

    // Snapshot before the cart is cleared on success.
    const rid = restaurantID ?? alTaib.id;
    const restaurantName = restaurantById(rid)?.name ?? rid;
    const snapshot = { lines, subtotal, deliveryFee, total };

    // Simulated authorize → capture (the SwiftUI app's PaymentService, minus the network).
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await record({
      ...snapshot,
      restaurantID: rid,
      restaurantName,
      deliveryAddress: defaultAddress,
      paymentIntentID: `pi_sim_${Crypto.randomUUID().slice(0, 12)}`,
    });

    clear();
    setProcessing(false);
    Alert.alert(
      'Order Placed!',
      'Your order is on its way. Thanks for shopping with LocalGO!',
    );
  };

  if (lines.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.titleBar}>
          <DisplayText size={26} weight="bold">
            Cart
          </DisplayText>
        </View>
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyBody}>Add items from a restaurant to get started.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.titleBar}>
        <DisplayText size={26} weight="bold">
          Cart
        </DisplayText>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {lines.map((line) => (
          <View key={line.item.id} style={styles.row}>
            <RemoteImage
              urlString={line.item.imageURL}
              fallbackIcon={line.item.icon}
              style={styles.rowImage}
              iconSize={20}
              borderRadius={10}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowName}>{line.item.name}</Text>
              <Text style={styles.rowPrice}>${line.item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.qtyControl}>
              <Pressable onPress={() => decrement(line.item)} hitSlop={6}>
                <Ionicons name="remove-circle" size={24} color={colors.orange} />
              </Pressable>
              <Text style={styles.qtyText}>{line.quantity}</Text>
              <Pressable onPress={() => add(line.item)} hitSlop={6}>
                <Ionicons name="add-circle" size={24} color={colors.orange} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <SummaryRow label="Subtotal" value={subtotal} />
        <SummaryRow label="Delivery Fee" value={deliveryFee} />
        <View style={styles.divider} />
        <SummaryRow label="Total" value={total} emphasized />
        <GradientButton
          title={`Place Order • $${total.toFixed(2)}`}
          loading={processing}
          onPress={placeOrder}
          style={{ marginTop: 8 }}
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, emphasized && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, emphasized && styles.summaryStrong]}>
        ${value.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  titleBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  emptyBody: { fontSize: 14, color: colors.textLight },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  rowImage: { width: 48, height: 48 },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.navy },
  rowPrice: { fontSize: 12, color: colors.textLight },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyText: { fontSize: 14, fontWeight: '700', minWidth: 16, textAlign: 'center', color: colors.navy },
  summary: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: colors.textLight },
  summaryValue: { fontSize: 14, color: colors.navy },
  summaryStrong: { fontWeight: '700', color: colors.navy },
  divider: { height: 1, backgroundColor: colors.gray200 },
});
