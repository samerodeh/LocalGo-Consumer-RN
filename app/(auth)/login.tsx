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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { accentGradient, colors, radius } from '../../src/theme/theme';
import { DisplayText } from '../../src/components/DisplayText';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuthStore } from '../../src/store/authStore';
import { isSupabaseConfigured } from '../../src/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, errorMessage, clearError } = useAuthStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <LinearGradient
              colors={accentGradient as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Ionicons name="bag" size={32} color={colors.white} />
            </LinearGradient>
            <DisplayText size={40} weight="heavy" style={{ marginTop: 10 }}>
              <Text style={{ color: colors.navy }}>Local</Text>
              <Text style={{ color: colors.orange }}>GO</Text>
            </DisplayText>
            <Text style={styles.tagline}>Groceries delivered fast.</Text>
            {!isSupabaseConfigured && (
              <View style={styles.demoPill}>
                <Text style={styles.demoPillText}>Demo mode · sample data</Text>
              </View>
            )}
          </View>

          <View style={styles.fields}>
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.gray400}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errorMessage) clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.gray400}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errorMessage) clearError();
              }}
              secureTextEntry
              style={styles.input}
            />
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Pressable
              style={styles.forgotLink}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          <GradientButton
            title="Sign In"
            loading={isLoading}
            onPress={() => login(email, password)}
            style={styles.cta}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.or}>or</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.social}>
            <SocialButton icon="logo-apple" label="Continue with Apple" dark />
            <SocialButton icon="logo-google" label="Continue with Google" />
          </View>

          <View style={{ flex: 1 }} />

          <Pressable style={styles.signupLink} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupMuted}>Don't have an account? </Text>
            <Text style={styles.signupAccent}>Sign Up</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SocialButton({
  icon,
  label,
  dark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.socialButton, dark && styles.socialDark]}>
      <Ionicons name={icon} size={20} color={dark ? colors.white : colors.navy} />
      <Text style={[styles.socialLabel, dark && { color: colors.white }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 40 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orange,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tagline: { color: colors.textLight, fontSize: 14, marginTop: 4 },
  demoPill: {
    marginTop: 14,
    backgroundColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  demoPillText: { color: colors.orangeDark, fontSize: 12, fontWeight: '600' },
  fields: { gap: 14 },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 16,
    fontSize: 16,
    color: colors.navy,
  },
  error: { color: colors.danger, fontSize: 13 },
  forgotLink: { alignSelf: 'flex-end' },
  forgotText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
  cta: { marginTop: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: colors.gray200 },
  or: { color: colors.textLight, fontSize: 13, paddingHorizontal: 8 },
  social: { gap: 12 },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  socialDark: { backgroundColor: colors.navy, borderColor: colors.navy },
  socialLabel: { fontSize: 15, fontWeight: '600', color: colors.navy },
  signupLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
  signupMuted: { color: colors.textLight, fontSize: 14 },
  signupAccent: { color: colors.orange, fontSize: 14, fontWeight: '600' },
});
