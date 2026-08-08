import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { useGoerStore } from '../../goer/goerStore';
import { sendGoerMessage } from '../../goer/send';

/** Horizontal chip row of suggested messages; tapping one sends it as the user. */
export function QuickReplies({ options }: { options: string[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isStreaming = useGoerStore((s) => s.isStreaming);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => (
        <Pressable
          key={option}
          disabled={isStreaming}
          onPress={() => void sendGoerMessage(option)}
          style={({ pressed }) => [styles.chip, (pressed || isStreaming) && { opacity: 0.6 }]}
        >
          <Text style={styles.chipText}>{option}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    row: { gap: 8, paddingVertical: 6, paddingRight: 8 },
    chip: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.orange,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.white,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.orange },
  });
