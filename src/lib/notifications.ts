// Push notification registration: requests permission, mints an Expo push
// token, and upserts it into the shared `push_tokens` table so the
// `notify-push` edge function can reach this device. No-ops entirely when
// Supabase isn't configured or the user isn't signed in — same gate as
// useOrderTracking.ts. Remote push tokens require a physical-device EAS
// dev/preview build; Expo Go (SDK 53+) can't mint them.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { isSupabaseConfigured, supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Requests permission and upserts this device's Expo push token. Safe to
 *  call on every app launch — it's a cheap idempotent upsert. */
export async function registerForPushNotifications(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (!Device.isDevice) return; // simulators/web can't receive remote push

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert(
      { user_id: uid, token, platform: Platform.OS },
      { onConflict: 'user_id,token' },
    );
  } catch (err) {
    console.warn('[notifications] failed to register push token:', err);
  }
}

/** Fires when the user taps a notification (app backgrounded or killed).
 *  Returns an unsubscribe function. */
export function onNotificationTapped(handler: (data: Record<string, unknown>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data as Record<string, unknown>);
  });
  return () => sub.remove();
}
