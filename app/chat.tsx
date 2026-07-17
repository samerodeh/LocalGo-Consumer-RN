import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { accentGradient, radius } from '../src/theme/theme';
import { useTheme, type ThemePalette } from '../src/theme/ThemeContext';
import { DisplayText } from '../src/components/DisplayText';
import { ChatMessageBubble } from '../src/components/chat/ChatMessageBubble';
import { useChatStore } from '../src/store/chatStore';
import type { Message } from '../src/types';

/** Chat with the driver who accepted the current order. Route: /chat?orderId=<orders.id>. */
export default function ChatScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const configure = useChatStore((s) => s.configure);
  const teardown = useChatStore((s) => s.teardown);
  const markRead = useChatStore((s) => s.markRead);
  const messages = useChatStore((s) => s.messages);
  const myUid = useChatStore((s) => s.myUid);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);

  const [input, setInput] = useState('');

  useEffect(() => {
    if (!orderId) return;
    void configure(orderId).then(() => void markRead());
    return () => teardown();
  }, [orderId, configure, teardown, markRead]);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    void send(text);
  }, [input, send]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <ChatMessageBubble message={item} mine={item.senderId === myUid} />,
    [myUid],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close chat">
          <Ionicons name="close" size={26} color={colors.navy} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <DisplayText size={20} weight="bold" color={colors.navy}>
            Chat with your driver
          </DisplayText>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {!loading && messages.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.gray400} />
            <Text style={styles.emptyText}>
              Say hi! Your driver will see your message right away.
            </Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={reversed}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.transcript}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            placeholder="Message your driver…"
            placeholderTextColor={colors.gray400}
            style={styles.input}
            returnKeyType="send"
            submitBehavior="submit"
            autoCapitalize="sentences"
            accessibilityLabel="Message your driver"
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || input.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={accentGradient as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendButton, (sending || input.trim().length === 0) && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.offWhite },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
      backgroundColor: colors.white,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
    emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
    transcript: { paddingHorizontal: 14, paddingVertical: 12 },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    input: {
      flex: 1,
      height: 44,
      borderRadius: radius.xl,
      backgroundColor: colors.gray100,
      paddingHorizontal: 16,
      fontSize: 15,
      color: colors.navy,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
