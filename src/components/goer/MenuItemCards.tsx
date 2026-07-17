import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { RemoteImage } from '../RemoteImage';
import { alTaib } from '../../data/restaurants';
import { menuItemById } from '../../goer/menuIndex';
import { useCartStore } from '../../store/cartStore';
import type { MenuItem } from '../../types';

/** Rich in-chat menu cards: photo, price, and a live add/step control. */
export function MenuItemCards({ itemIDs }: { itemIDs: string[] }) {
  const items = useMemo(
    () => itemIDs.map((id) => menuItemById(id)).filter((i): i is MenuItem => Boolean(i)),
    [itemIDs],
  );
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (items.length === 0) return null;
  return (
    <View style={styles.stack}>
      {items.map((item) => (
        <MenuItemRow key={item.id} item={item} styles={styles} />
      ))}
    </View>
  );
}

function MenuItemRow({ item, styles }: { item: MenuItem; styles: ReturnType<typeof makeStyles> }) {
  const { colors } = useTheme();
  const quantity = useCartStore((s) => s.quantityFor(item.id));
  const add = useCartStore((s) => s.add);
  const decrement = useCartStore((s) => s.decrement);

  return (
    <View style={styles.card}>
      <RemoteImage
        urlString={item.imageURL}
        fallbackIcon={item.icon}
        style={styles.image}
        iconSize={20}
        borderRadius={10}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.itemDescription ? (
          <Text style={styles.description} numberOfLines={1}>
            {item.itemDescription}
          </Text>
        ) : null}
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      </View>
      {quantity === 0 ? (
        <Pressable
          onPress={() => add(item, alTaib.id)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to cart`}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Pressable>
      ) : (
        <View style={styles.stepper}>
          <Pressable onPress={() => decrement(item)} hitSlop={6} accessibilityLabel={`Remove one ${item.name}`}>
            <Ionicons name="remove-circle" size={22} color={colors.orange} />
          </Pressable>
          <Text style={styles.qty}>{quantity}</Text>
          <Pressable onPress={() => add(item, alTaib.id)} hitSlop={6} accessibilityLabel={`Add one ${item.name}`}>
            <Ionicons name="add-circle" size={22} color={colors.orange} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    stack: { gap: 6, marginVertical: 4, maxWidth: '92%' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: radius.md,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    image: { width: 44, height: 44 },
    name: { fontSize: 13, fontWeight: '700', color: colors.navy },
    description: { fontSize: 11, color: colors.textLight },
    price: { fontSize: 12, fontWeight: '600', color: colors.orange },
    addButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qty: { fontSize: 13, fontWeight: '700', color: colors.navy, minWidth: 14, textAlign: 'center' },
  });
