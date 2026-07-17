import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import type { Message } from '../../types';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** One chat bubble in a customer↔driver thread. `mine` puts it on the right
 *  in the accent color, matching the rest of the app's chat surfaces. */
export function ChatMessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {message.imageUrl ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel="Delivery photo"
          />
        ) : null}
        {message.body ? (
          <Text
            style={[
              mine ? styles.textMine : styles.textTheirs,
              message.imageUrl ? styles.captionSpacing : null,
            ]}
          >
            {message.body}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    row: { marginVertical: 3, maxWidth: '82%' },
    rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
    photo: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.gray100 },
    captionSpacing: { marginTop: 8 },
    bubbleMine: { backgroundColor: colors.orange, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
    textMine: { fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
    textTheirs: { fontSize: 15, lineHeight: 21, color: colors.navy },
    time: { fontSize: 10, marginTop: 2, marginHorizontal: 4, color: colors.gray400 },
    timeMine: { textAlign: 'right' },
    timeTheirs: { textAlign: 'left' },
  });
