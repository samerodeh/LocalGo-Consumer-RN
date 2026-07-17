import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accentGradient } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { useGoerStore } from '../../goer/goerStore';

interface Props {
  /** Extra lift for screens with their own bottom bars (e.g. the cart summary). */
  bottomOffset?: number;
}

/**
 * The floating "chat with Goer" button, pinned bottom-right like a standard
 * in-app support launcher. Shows an unread badge for replies that arrived
 * while the sheet was closed.
 */
export function GoerFab({ bottomOffset = 0 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const open = useGoerStore((s) => s.open);
  const isOpen = useGoerStore((s) => s.isOpen);
  const unread = useGoerStore((s) => s.unread);

  // Slow halo pulse to draw the eye without being distracting.
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(2400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);

  if (isOpen) return null;

  return (
    <View
      style={[styles.wrap, { bottom: 20 + bottomOffset + Math.max(insets.bottom - 8, 0) }]}
      pointerEvents="box-none"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
          },
        ]}
      />
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Chat with Goer"
        style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <LinearGradient
          colors={accentGradient as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
        </LinearGradient>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: 18,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30,
    },
    halo: {
      position: 'absolute',
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.orange,
    },
    button: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.orange,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.white,
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  });
