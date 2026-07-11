import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradient, colors, radius } from '../theme/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Primary CTA — the orange→orangeDark accent gradient used across the app. */
export function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  height = 52,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: pressed || disabled ? 0.85 : 1 }, style]}
    >
      <LinearGradient
        colors={accentGradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, { height }]}
      >
        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <Text style={styles.label}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orange,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
