import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';

interface Props {
  role: 'user' | 'assistant';
  text: string;
  /** Appends a cursor while tokens are still streaming in. */
  streaming?: boolean;
}

export function MessageBubble({ role, text, streaming = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={isUser ? styles.textUser : styles.textAssistant}>
          {text}
          {streaming ? '▍' : ''}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginVertical: 3 },
    rowUser: { justifyContent: 'flex-end' },
    rowAssistant: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.lg,
    },
    bubbleUser: { backgroundColor: colors.orange, borderBottomRightRadius: 4 },
    bubbleAssistant: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
    textUser: { fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
    textAssistant: { fontSize: 15, lineHeight: 21, color: colors.navy },
  });
