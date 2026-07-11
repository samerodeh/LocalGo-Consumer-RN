import { useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../src/theme/theme';
import { DisplayText } from '../src/components/DisplayText';
import { GradientButton } from '../src/components/GradientButton';
import { useAddressStore, addressDisplayName } from '../src/store/addressStore';
import type { DeliveryPreference, PersonalLabel } from '../src/types';

const LABELS: PersonalLabel[] = ['Home', 'Work', 'None'];
const PREFERENCES: DeliveryPreference[] = ['Leave at door', 'Meet at door'];

export default function AddressScreen() {
  const router = useRouter();
  const addresses = useAddressStore((s) => s.allAddresses);
  const defaultAddress = useAddressStore((s) => s.defaultAddress);
  const setDefault = useAddressStore((s) => s.setDefault);
  const save = useAddressStore((s) => s.save);
  const remove = useAddressStore((s) => s.remove);

  const [adding, setAdding] = useState(addresses.length === 0);
  const [addressLine, setAddressLine] = useState('');
  const [apartmentSuite, setApartmentSuite] = useState('');
  const [instructions, setInstructions] = useState('');
  const [label, setLabel] = useState<PersonalLabel>('Home');
  const [preference, setPreference] = useState<DeliveryPreference>('Leave at door');

  const canSave = addressLine.trim().length > 0;

  const onSave = async () => {
    if (!canSave) return;
    await save({
      addressLine: addressLine.trim(),
      apartmentSuite: apartmentSuite.trim(),
      instructions: instructions.trim(),
      personalLabel: label,
      deliveryPreference: preference,
      makeDefault: true,
    });
    setAddressLine('');
    setApartmentSuite('');
    setInstructions('');
    setAdding(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <DisplayText size={24} weight="bold">
          Delivery Address
        </DisplayText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
              <TextInput
                placeholder="Street address"
                placeholderTextColor={colors.gray400}
                value={addressLine}
                onChangeText={setAddressLine}
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
                  />
                ))}
              </View>

              <GradientButton
                title="Save Address"
                onPress={onSave}
                disabled={!canSave}
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
