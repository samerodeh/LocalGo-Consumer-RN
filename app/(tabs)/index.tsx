import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius } from '../../src/theme/theme';
import { useTheme, type ThemePalette } from '../../src/theme/ThemeContext';
import { DisplayText } from '../../src/components/DisplayText';
import { RemoteImage } from '../../src/components/RemoteImage';
import { restaurants } from '../../src/data/restaurants';
import type { Restaurant } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';
import { useAddressStore, addressDisplayName } from '../../src/store/addressStore';
import { useOrderTracking } from '../../src/store/useOrderTracking';
import { usePendingOrders } from '../../src/store/usePendingOrders';
import { OrderTrackingStack } from '../../src/components/OrderTrackingStack';
import { PendingOrderStack } from '../../src/components/PendingOrderStack';
// Goer chatbot disabled for now.
// import { GoerFab } from '../../src/components/goer/GoerFab';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [searchText, setSearchText] = useState('');
  const firstName = useAuthStore((s) => s.currentUser?.firstName ?? '');
  const defaultAddress = useAddressStore((s) => s.defaultAddress);
  const { orders: activeOrders, dismiss } = useOrderTracking();
  const { pending: pendingOrders } = usePendingOrders();

  const results = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return restaurants;
    return restaurants.filter(
      (r) => r.name.toLowerCase().includes(query) || r.cuisine.toLowerCase().includes(query),
    );
  }, [searchText]);

  const greeting = firstName ? `Hungry, ${firstName}?` : 'What are you craving?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.push('/address')}>
              <Text style={styles.deliverTo}>DELIVER TO</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color={colors.navy} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {defaultAddress ? addressDisplayName(defaultAddress) : 'Set your location'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.navy} />
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/settings')} hitSlop={8}>
              <Ionicons name="person-circle" size={34} color={colors.orange} />
            </Pressable>
          </View>
          <DisplayText size={30} weight="bold" color={colors.navy} style={{ marginTop: 16 }}>
            {greeting}
          </DisplayText>
        </View>

        {/* Just-placed orders still waiting for a driver to accept. */}
        <PendingOrderStack orders={pendingOrders} />

        {/* Live tracking for every in-flight order — each with its own driver chat. */}
        <OrderTrackingStack orders={activeOrders} onDismiss={dismiss} />

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput
            placeholder="Search restaurants or cuisines…"
            placeholderTextColor={colors.gray400}
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.gray300} />
            </Pressable>
          ) : null}
        </View>

        {/* Restaurants */}
        <DisplayText size={22} weight="bold" color={colors.navy} style={styles.sectionTitle}>
          Available Partners
        </DisplayText>

        {results.length === 0 ? (
          <View style={styles.noResults}>
            <Ionicons name="search" size={36} color={colors.gray300} />
            <Text style={styles.noResultsText}>No matches for “{searchText}”</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {results.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {/* <GoerFab /> */}
    </SafeAreaView>
  );
}

function RestaurantCard({
  restaurant,
  onPress,
  styles,
  colors,
}: {
  restaurant: Restaurant;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemePalette;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View>
        <RemoteImage
          urlString={restaurant.heroImageURL}
          fallbackIcon={restaurant.heroIcon}
          style={styles.cardHero}
          iconSize={44}
          priority="high"
        />
        <RemoteImage
          urlString={restaurant.logoURL}
          fallbackIcon={restaurant.heroIcon}
          style={styles.cardLogo}
          iconSize={18}
          borderRadius={23}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{restaurant.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={colors.star} />
            <Text style={styles.ratingText}>{restaurant.rating}</Text>
          </View>
        </View>
        <Text style={styles.cardCuisine}>{restaurant.cuisine}</Text>
        <View style={styles.metaRow}>
          <Meta icon="time-outline" text={restaurant.deliveryTime} styles={styles} colors={colors} />
          <Meta icon="location-outline" text={restaurant.distance} styles={styles} colors={colors} />
          <Meta icon="bicycle-outline" text={restaurant.deliveryFee} styles={styles} colors={colors} />
        </View>
      </View>
    </Pressable>
  );
}

function Meta({
  icon,
  text,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemePalette;
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color={colors.textLight} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.offWhite },
    scroll: { paddingBottom: 32 },
    header: { paddingHorizontal: 16, paddingTop: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    deliverTo: {
      color: colors.orange,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { color: colors.navy, fontSize: 17, fontWeight: '700', maxWidth: 220 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.gray200,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 16,
      marginTop: 24,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.navy },
    sectionTitle: { marginHorizontal: 16, marginTop: 24, marginBottom: 14 },
    noResults: { alignItems: 'center', paddingTop: 32, gap: 8 },
    noResultsText: { color: colors.textLight, fontSize: 14 },
    cardList: { paddingHorizontal: 16, gap: 16 },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardHero: { height: 150, width: '100%' },
    cardLogo: {
      position: 'absolute',
      left: 12,
      bottom: 12,
      width: 46,
      height: 46,
      borderWidth: 2,
      borderColor: colors.white,
    },
    cardBody: { padding: 12, gap: 6 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: { fontSize: 17, fontWeight: '700', color: colors.navy },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 13, fontWeight: '700', color: colors.navy },
    cardCuisine: { fontSize: 14, color: colors.textLight },
    metaRow: { flexDirection: 'row', gap: 12 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
    metaText: { fontSize: 12, color: colors.textLight },
  });
