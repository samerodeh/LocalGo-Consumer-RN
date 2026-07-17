import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius } from '../src/theme/theme';
import { useTheme, type ThemePalette } from '../src/theme/ThemeContext';
import { DisplayText } from '../src/components/DisplayText';
import { GradientButton } from '../src/components/GradientButton';
import { useAddressStore, addressDisplayName } from '../src/store/addressStore';
import { searchAddresses, reverseGeocode, type GeoResult } from '../src/lib/geocoding';
import { DELIVERY_ZONE, isInDeliveryZone } from '../src/lib/deliveryZone';
import type { DeliveryPreference, PersonalLabel } from '../src/types';

const LABELS: PersonalLabel[] = ['Home', 'Work', 'None'];
const PREFERENCES: DeliveryPreference[] = ['Leave at door', 'Meet at door'];

export default function AddressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addresses = useAddressStore((s) => s.allAddresses);
  const defaultAddress = useAddressStore((s) => s.defaultAddress);
  const setDefault = useAddressStore((s) => s.setDefault);
  const save = useAddressStore((s) => s.save);
  const remove = useAddressStore((s) => s.remove);

  const [adding, setAdding] = useState(addresses.length === 0);
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [apartmentSuite, setApartmentSuite] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [label, setLabel] = useState<PersonalLabel>('Home');
  const [preference, setPreference] = useState<DeliveryPreference>('Leave at door');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Address autocomplete state.
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set right after a suggestion/GPS fill so the effect below doesn't immediately
  // re-search the text we just injected.
  const suppressSearch = useRef(false);

  const canSave = addressLine.trim().length > 0;

  // Debounced address search as the user types.
  useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    const q = addressLine.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const handle = setTimeout(async () => {
      const results = await searchAddresses(q, controller.signal);
      setSuggestions(results);
      setSearching(false);
    }, 320);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [addressLine]);

  const applyResult = (r: GeoResult) => {
    suppressSearch.current = true;
    setAddressLine(r.addressLine);
    setPostalCode(r.postalCode);
    setCoords({ lat: r.latitude, lng: r.longitude });
    setSuggestions([]);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Enable location access to detect your current address, or enter it manually.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (geo) {
        applyResult(geo);
        Alert.alert(
          'Please double-check your address',
          'We filled in your address from your current location. Please review it and make sure it’s correct before saving.',
        );
      } else {
        // Still capture the coordinates even if reverse geocoding found no street.
        suppressSearch.current = true;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        Alert.alert('Location found', 'We pinned your location — please type your street address.');
      }
    } catch {
      Alert.alert('Could not get location', 'Please enter your address manually.');
    } finally {
      setLocating(false);
    }
  };

  const resetForm = () => {
    setAddressLine('');
    setPostalCode('');
    setApartmentSuite('');
    setEntryCode('');
    setInstructions('');
    setCoords(null);
    setSuggestions([]);
  };

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      // Every saved address must be a real, geocodable location — checkout
      // refuses to place orders without verified coordinates. If the user
      // typed the address manually (no suggestion tapped, no GPS), try to
      // resolve it now; refuse the save when nothing matches.
      let resolved = coords;
      if (!resolved) {
        const query = [addressLine.trim(), postalCode.trim()].filter(Boolean).join(' ');
        const matches = await searchAddresses(query);
        const first = matches[0];
        if (first) {
          resolved = { lat: first.latitude, lng: first.longitude };
        } else {
          Alert.alert(
            'Address not found',
            'We couldn’t verify that address. Please pick one of the search suggestions or use your current location.',
          );
          return;
        }
      }
      // Refuse addresses outside the deliverable service area.
      if (!isInDeliveryZone(resolved.lat, resolved.lng)) {
        Alert.alert(
          'Outside our delivery area',
          `We only deliver within ${DELIVERY_ZONE.radiusKm} km of ${DELIVERY_ZONE.label}. Please enter a delivery address inside that area.`,
        );
        return;
      }
      // Don't let the user add the same place twice — an address is a duplicate
      // when its street line, postal code and apartment/suite all match one they
      // already have.
      const key = (line: string, postal: string, suite: string) =>
        `${line.trim().toLowerCase()}|${postal.trim().toLowerCase()}|${suite.trim().toLowerCase()}`;
      const newKey = key(addressLine, postalCode, apartmentSuite);
      const isDuplicate = addresses.some(
        (a) => key(a.addressLine, a.postalCode, a.apartmentSuite) === newKey,
      );
      if (isDuplicate) {
        Alert.alert(
          'Address already saved',
          'You already have this address in your list.',
        );
        return;
      }
      await save({
        addressLine: addressLine.trim(),
        postalCode: postalCode.trim(),
        apartmentSuite: apartmentSuite.trim(),
        entryCode: entryCode.trim(),
        instructions: instructions.trim(),
        latitude: resolved.lat,
        longitude: resolved.lng,
        personalLabel: label,
        deliveryPreference: preference,
        makeDefault: true,
      });
      resetForm();
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  // Close the screen. router.back() is a no-op when this screen was opened
  // without navigation history (e.g. a direct/deep link), so fall back to the
  // home tab in that case.
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <DisplayText size={24} weight="bold" color={colors.navy}>
          Delivery Address
        </DisplayText>
        <Pressable onPress={handleClose} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.navy} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {addresses.map((address) => {
            const isDefault = address.id === defaultAddress?.id;
            return (
              <Pressable
                key={address.id}
                style={[styles.addressCard, isDefault && styles.addressCardActive]}
                onPress={() => setDefault(address.id)}
              >
                <Ionicons
                  name={isDefault ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isDefault ? colors.orange : colors.gray300}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressName}>{addressDisplayName(address)}</Text>
                  <Text style={styles.addressLine} numberOfLines={1}>
                    {address.addressLine}
                    {address.postalCode ? ` • ${address.postalCode}` : ''}
                    {address.apartmentSuite ? ` • ${address.apartmentSuite}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => remove(address.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.gray400} />
                </Pressable>
              </Pressable>
            );
          })}

          {adding ? (
            <View style={styles.form}>
              <Pressable
                style={styles.locateButton}
                onPress={useCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.orange} />
                ) : (
                  <Ionicons name="navigate" size={18} color={colors.orange} />
                )}
                <Text style={styles.locateText}>
                  {locating ? 'Detecting your location…' : 'Use my current location'}
                </Text>
              </Pressable>

              <View>
                <View style={styles.searchField}>
                  <Ionicons name="search" size={18} color={colors.gray400} />
                  <TextInput
                    placeholder="Search your street address"
                    placeholderTextColor={colors.gray400}
                    value={addressLine}
                    onChangeText={setAddressLine}
                    style={styles.searchInput}
                    autoCorrect={false}
                  />
                  {searching ? <ActivityIndicator size="small" color={colors.gray400} /> : null}
                </View>

                {suggestions.length > 0 ? (
                  <View style={styles.suggestions}>
                    {suggestions.map((s, i) => (
                      <Pressable
                        key={`${s.label}-${i}`}
                        style={[styles.suggestionRow, i > 0 && styles.suggestionDivider]}
                        onPress={() => applyResult(s)}
                      >
                        <Ionicons name="location-outline" size={16} color={colors.textLight} />
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <TextInput
                placeholder="Postal code"
                placeholderTextColor={colors.gray400}
                value={postalCode}
                onChangeText={setPostalCode}
                autoCapitalize="characters"
                style={styles.input}
              />
              <TextInput
                placeholder="Apartment / suite (optional)"
                placeholderTextColor={colors.gray400}
                value={apartmentSuite}
                onChangeText={setApartmentSuite}
                style={styles.input}
              />
              <TextInput
                placeholder="Building / buzzer entry code (optional)"
                placeholderTextColor={colors.gray400}
                value={entryCode}
                onChangeText={setEntryCode}
                style={styles.input}
              />
              <TextInput
                placeholder="Delivery instructions (optional)"
                placeholderTextColor={colors.gray400}
                value={instructions}
                onChangeText={setInstructions}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Label</Text>
              <View style={styles.chipRow}>
                {LABELS.map((option) => (
                  <Chip
                    key={option}
                    active={label === option}
                    label={option}
                    onPress={() => setLabel(option)}
                    styles={styles}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Delivery preference</Text>
              <View style={styles.chipRow}>
                {PREFERENCES.map((option) => (
                  <Chip
                    key={option}
                    active={preference === option}
                    label={option}
                    onPress={() => setPreference(option)}
                    styles={styles}
                  />
                ))}
              </View>

              <GradientButton
                title="Save Address"
                onPress={onSave}
                disabled={!canSave}
                loading={saving}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={20} color={colors.orange} />
              <Text style={styles.addButtonText}>Add a new address</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 14,
  },
  addressCardActive: { borderColor: colors.orange },
  addressName: { fontSize: 15, fontWeight: '700', color: colors.navy },
  addressLine: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  form: { backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 12, marginTop: 4 },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  locateText: { fontSize: 14, fontWeight: '700', color: colors.orange },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.navy },
  suggestions: {
    marginTop: 6,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  suggestionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  suggestionText: { flex: 1, fontSize: 13.5, color: colors.navy },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    color: colors.navy,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.navy, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { fontSize: 13, color: colors.navy, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
    paddingVertical: 16,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: colors.orange },
});
