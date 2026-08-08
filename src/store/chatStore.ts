import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { notifyPush } from '../lib/notifyPush';
import type { Message } from '../types';

interface MessageRow {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  created_at: string;
  read_at: string | null;
}

const COLUMNS = 'id, order_id, sender_id, body, image_url, audio_url, audio_duration_sec, created_at, read_at';

function fromRow(row: MessageRow): Message {
  return {
    id: row.id,
    orderId: row.order_id,
    senderId: row.sender_id,
    body: row.body,
    imageUrl: row.image_url ?? null,
    audioUrl: row.audio_url ?? null,
    audioDurationSec: row.audio_duration_sec ?? null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** Optional attachment for a chat message — at most one of these is set per send(). */
export interface SendAttachment {
  imageUrl?: string;
  audioUrl?: string;
  audioDurationSec?: number;
}

interface ChatState {
  orderId: string | null;
  myUid: string | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;

  /** Loads history + opens the realtime subscription for one order's thread.
   *  Safe to call again with a new orderId — tears down the old channel first. */
  configure: (orderId: string) => Promise<void>;
  /** `body` may be empty when sending an image/voice-only message. */
  send: (body: string, attachment?: SendAttachment) => Promise<void>;
  markRead: () => Promise<void>;
  teardown: () => void;
}

let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
/** Bumped by every configure/teardown — lets a stale in-flight configure
 *  detect it was superseded (screen closed/reopened) and abort cleanly. */
let configureSeq = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  orderId: null,
  myUid: null,
  messages: [],
  loading: false,
  sending: false,

  configure: async (orderId) => {
    get().teardown();
    const token = ++configureSeq;
    if (!isSupabaseConfigured || !supabase) {
      set({ orderId, messages: [] });
      return;
    }
    const sb = supabase;
    set({ orderId, loading: true, messages: [] });

    const { data: userData } = await sb.auth.getUser();
    const myUid = userData.user?.id ?? null;

    const { data } = await sb
      .from('messages')
      .select(COLUMNS)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (token !== configureSeq) return; // superseded while we were loading

    set({
      myUid,
      messages: ((data ?? []) as MessageRow[]).map(fromRow),
      loading: false,
    });

    // Unique topic per subscription: a fixed per-order name hands back the
    // previous, already-subscribed channel on a quick close/reopen, and
    // calling .on() on it throws.
    const ch = sb
      .channel(`order-messages-${orderId}-${token}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          set((s) => (s.messages.some((m) => m.id === row.id) ? s : { messages: [...s.messages, fromRow(row)] }));
        },
      )
      .subscribe();
    if (token !== configureSeq) {
      // Torn down while subscribing — clean up the orphan.
      sb.removeChannel(ch);
      return;
    }
    channel = ch;
  },

  send: async (body, attachment) => {
    const { orderId, myUid } = get();
    const text = body.trim();
    if (!text && !attachment?.imageUrl && !attachment?.audioUrl) return;
    if (!orderId || !myUid || !supabase) return;

    set({ sending: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          order_id: orderId,
          sender_id: myUid,
          body: text,
          image_url: attachment?.imageUrl ?? null,
          audio_url: attachment?.audioUrl ?? null,
          audio_duration_sec: attachment?.audioDurationSec ?? null,
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      // Optimistic append — the realtime echo will no-op via the id dedupe above.
      if (data) {
        const msg = fromRow(data as MessageRow);
        set((s) => (s.messages.some((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg] }));
      }
      const preview = attachment?.audioUrl ? '🎤 Voice message' : attachment?.imageUrl ? '📷 Photo' : text;
      void notifyPush(orderId, 'new_message', { senderId: myUid, preview });
    } catch (err) {
      console.warn('[chatStore] send failed:', err);
    } finally {
      set({ sending: false });
    }
  },

  markRead: async () => {
    const { orderId, myUid } = get();
    if (!orderId || !myUid || !supabase) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .neq('sender_id', myUid)
      .is('read_at', null);
  },

  teardown: () => {
    configureSeq++; // cancels any configure still in flight
    if (channel && supabase) supabase.removeChannel(channel);
    channel = null;
  },
}));
