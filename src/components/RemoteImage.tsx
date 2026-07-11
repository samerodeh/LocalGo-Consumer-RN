import { useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';
import type { IoniconName } from '../types';

interface Props {
  urlString: string | null;
  fallbackIcon: IoniconName;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  borderRadius?: number;
}

/**
 * Async remote image with a graceful icon fallback — mirrors the SwiftUI RemoteImage.
 * Shows the fallback icon on a tinted surface while loading fails or the URL is null.
 */
export function RemoteImage({
  urlString,
  fallbackIcon,
  style,
  iconSize = 24,
  borderRadius = 0,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !urlString || failed;

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {showFallback ? (
        <Ionicons name={fallbackIcon} size={iconSize} color={colors.orange} />
      ) : (
        <Image
          source={{ uri: urlString! }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
