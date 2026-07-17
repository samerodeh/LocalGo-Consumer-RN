import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme/theme';
import { useTheme, type ThemePalette } from '../../theme/ThemeContext';
import { AGENT_META, type GoerAgentId } from '../../goer/types';

/** Pill naming the specialist currently handling the conversation. */
export function AgentBadge({ agent }: { agent: GoerAgentId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta = AGENT_META[agent];
  return (
    <View style={styles.pill}>
      <Ionicons name={meta.icon} size={12} color={colors.orange} />
      <Text style={styles.pillText}>{meta.name}</Text>
    </View>
  );
}

/** Inline divider announcing a visible agent handoff in the transcript. */
export function HandoffDivider({ from, to }: { from: GoerAgentId; to: GoerAgentId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerPill}>
        <Ionicons name={AGENT_META[from].icon} size={11} color={colors.textLight} />
        <Ionicons name="arrow-forward" size={11} color={colors.textLight} />
        <Ionicons name={AGENT_META[to].icon} size={11} color={colors.orange} />
        <Text style={styles.dividerText}>{AGENT_META[to].name}</Text>
      </View>
      <View style={styles.dividerLine} />
    </View>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gray100,
      borderRadius: radius.xl,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: { fontSize: 11, fontWeight: '700', color: colors.navy },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 10,
      paddingHorizontal: 8,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.gray200 },
    dividerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gray100,
      borderRadius: radius.xl,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    dividerText: { fontSize: 11, fontWeight: '600', color: colors.textLight },
  });
