import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { etaWindow } from '../../store/useOrderTracking';
import type { OrderStatusInfo } from '../../goer/types';

/** Order tracking card: status, ETA window, and total. */
export function OrderStatusCard({ info }: { info: OrderStatusInfo }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const eta = info.etaMinutes != null ? etaWindow(info.etaMinutes) : null;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, info.driverAccepted && { backgroundColor: colors.orange }]}>
          <Ionicons
            name={info.driverAccepted ? 'bicycle' : 'receipt'}
            size={16}
            color={info.driverAccepted ? '#FFFFFF' : colors.orange}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {info.orderNumber ? `Order ${info.orderNumber}` : info.restaurantName}
          </Text>
          <Text style={styles.subtitle}>{info.status}</Text>
        </View>
        {info.totalCents != null ? (
          <Text style={styles.total}>${(info.totalCents / 100).toFixed(2)}</Text>
        ) : null}
      </View>
      {eta ? (
        <View style={styles.etaRow}>
          <Ionicons name="time-outline" size={13} color={colors.textLight} />
          <Text style={styles.etaText}>
            Arriving in about {eta.min}–{eta.max} min
          </Text>
        </View>
      ) : null}
      {info.placedAt ? (
        <Text style={styles.placedAt}>
          Placed {new Date(info.placedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      ) : null}
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
      gap: 8,
      marginVertical: 4,
      maxWidth: '92%',
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.gray100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 13, fontWeight: '800', color: colors.navy },
    subtitle: { fontSize: 12, color: colors.textLight },
    total: { fontSize: 13, fontWeight: '700', color: colors.navy },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    etaText: { fontSize: 12, color: colors.textLight },
    placedAt: { fontSize: 11, color: colors.gray400 },
  });
