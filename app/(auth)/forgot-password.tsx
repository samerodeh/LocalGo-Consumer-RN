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
import { colors, radius } from '../../src/theme/theme';
import { DisplayText } from '../../src/components/DisplayText';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuthStore } from '../../src/store/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { requestPasswordReset, isLoading, errorMessage, clearError } = useAuthStore();

  const handleSubmit = async () => {
    const ok = await requestPasswordReset(email);
    if (ok) setSent(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.orange} />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sent ? (
            <View style={styles.confirmation}>
              <View style={styles.confirmIcon}>
                <Ionicons name="mail" size={32} color={colors.white} />
              </View>
              <DisplayText size={28} weight="heavy" style={{ marginTop: 16, textAlign: 'center' }}>
                Check your email
              </DisplayText>
              <Text style={styles.confirmBody}>
                We sent a password reset link to{'\n'}
                <Text style={{ fontWeight: '700', color: colors.navy }}>{email.trim()}</Text>.
                {'\n\n'}Tap the link on this device to set a new password — it'll open the app
                directly.
              </Text>
              <Pressable style={styles.resendLink} onPress={handleSubmit}>
                <Text style={styles.mutedText}>Didn't get it? </Text>
                <Text style={styles.accentText}>Resend</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <DisplayText size={34} weight="heavy">
                  Forgot Password
                </DisplayText>
                <Text style={styles.subtitle}>
                  Enter the email on your account and we'll send you a link to reset your
                  password.
                </Text>
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
                {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
              </View>

              <GradientButton
                title="Send Reset Link"
                loading={isLoading}
                onPress={handleSubmit}
                style={styles.cta}
              />
            </>
          )}

          <View style={{ flex: 1 }} />

          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.mutedText}>Remembered it? </Text>
            <Text style={styles.accentText}>Sign In</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  topBar: { paddingHorizontal: 16, paddingTop: 4 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  header: { paddingTop: 8, paddingBottom: 32 },
  subtitle: { color: colors.textLight, fontSize: 14, marginTop: 8, lineHeight: 20 },
  fields: { gap: 14 },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 16,
    fontSize: 16,
    color: colors.navy,
  },
  error: { color: colors.danger, fontSize: 13 },
  cta: { marginTop: 20 },
  confirmation: { alignItems: 'center', paddingTop: 40 },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBody: {
    color: colors.textLight,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 14,
  },
  resendLink: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  backLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
  mutedText: { color: colors.textLight, fontSize: 14 },
  accentText: { color: colors.orange, fontSize: 14, fontWeight: '600' },
});
