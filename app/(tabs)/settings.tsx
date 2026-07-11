import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/theme';
import { DisplayText } from '../../src/components/DisplayText';
import { useAuthStore } from '../../src/store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Guest';
  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?';
  const version = Constants.expoConfig?.version ?? '1.0';

  const confirmSignOut = () => {
    Alert.alert('Are you sure you want to sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.titleBar}>
        <DisplayText size={26} weight="bold">
          Settings
        </DisplayText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        {/* Profile */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{fullName}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            </View>
          </View>
        </View>

        {/* Account */}
        <Section title="Account">
          <SettingsRow icon="notifications-outline" label="Notifications" />
          <SettingsRow icon="card-outline" label="Payment Methods" />
          <SettingsRow
            icon="location-outline"
            label="Delivery Addresses"
            onPress={() => router.push('/address')}
          />
        </Section>

        {/* About */}
        <Section title="About">
          <View style={styles.settingsRow}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{version}</Text>
          </View>
        </Section>

        <Pressable style={styles.signOut} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={colors.navy} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.gray300} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  titleBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 18, fontWeight: '700', color: colors.orange },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.navy },
  profileEmail: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15, color: colors.navy },
  rowValue: { fontSize: 15, color: colors.textLight },
  signOut: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
