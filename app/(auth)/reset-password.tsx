import { useState } from 'react';
import {
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../src/theme/theme';
import { DisplayText } from '../../src/components/DisplayText';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuthStore } from '../../src/store/authStore';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = emailParam ?? '';
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { requestPasswordReset, confirmPasswordReset, isLoading, errorMessage, clearError } =
    useAuthStore();

  const handleSubmit = async () => {
    const success = await confirmPasswordReset(email, code, newPassword, confirmPassword);
    if (success) {
      Alert.alert('Password Reset', 'Your password has been updated. You are now signed in.');
    }
  };

  const handleResend = async () => {
    const sent = await requestPasswordReset(email);
    if (sent) {
      Alert.alert('Code sent', 'Check your email for the new code.');
    }
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
          <View style={styles.header}>
            <DisplayText size={34} weight="heavy">
              Enter Code
            </DisplayText>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {email || 'your email'}. Enter it below with your new
              password.
            </Text>
          </View>

          <View style={styles.fields}>
            <TextInput
              placeholder="6-digit code"
              placeholderTextColor={colors.gray400}
              value={code}
              onChangeText={(t) => {
                setCode(t);
                if (errorMessage) clearError();
              }}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            <TextInput
              placeholder="New password"
              placeholderTextColor={colors.gray400}
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                if (errorMessage) clearError();
              }}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              placeholder="Confirm new password"
              placeholderTextColor={colors.gray400}
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (errorMessage) clearError();
              }}
              secureTextEntry
              style={styles.input}
            />
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          </View>

          <GradientButton
            title="Reset Password"
            loading={isLoading}
            onPress={handleSubmit}
            style={styles.cta}
          />

          <Pressable style={styles.resendLink} onPress={handleResend}>
            <Text style={styles.mutedText}>Didn't get a code? </Text>
            <Text style={styles.accentText}>Resend</Text>
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
  resendLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
  mutedText: { color: colors.textLight, fontSize: 14 },
  accentText: { color: colors.orange, fontSize: 14, fontWeight: '600' },
});
