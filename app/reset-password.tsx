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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../src/theme/theme';
import { DisplayText } from '../src/components/DisplayText';
import { GradientButton } from '../src/components/GradientButton';
import { useAuthStore } from '../src/store/authStore';

/**
 * Reached only via the deep link a password-reset email opens
 * (localgo://reset-password#access_token=...). By the time this screen
 * mounts, the root layout's deep-link handler has already exchanged those
 * tokens for a live recovery session via beginPasswordRecovery(), so all this
 * screen does is collect + submit the new password against that session.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { resetPassword, isLoggedIn, isLoading, errorMessage, clearError } = useAuthStore();

  const handleSubmit = async () => {
    const success = await resetPassword(newPassword, confirmPassword);
    if (success) {
      Alert.alert('Password Reset', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.replace(isLoggedIn ? '/(tabs)' : '/(auth)/login') },
      ]);
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
              Set New Password
            </DisplayText>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
          </View>

          <View style={styles.fields}>
            <TextInput
              placeholder="New password"
              placeholderTextColor={colors.gray400}
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                if (errorMessage) clearError();
              }}
              secureTextEntry
              autoComplete="new-password"
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
              autoComplete="new-password"
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
});
