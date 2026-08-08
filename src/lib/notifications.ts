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
      name: 'Order alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
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

/** Ensures OS notification permission and (on Android) a high-importance
 *  channel with sound. Unlike `registerForPushNotifications`, this runs on
 *  simulators too and never needs Supabase — so the in-app LOCAL notifications
 *  below can alert *with sound* in Expo Go / simulators, where remote Expo push
 *  tokens can't be minted. Memoized: cheap to call on every launch. No-op on web. */
let permissionEnsured: Promise<boolean> | null = null;
export function ensureNotificationPermission(): Promise<boolean> {
  if (permissionEnsured) return permissionEnsured;
  permissionEnsured = (async () => {
    if (Platform.OS === 'web') return false;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return false;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Order alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }
      return true;
    } catch (err) {
      console.warn('[notifications] permission setup failed:', err);
      return false;
    }
  })();
  return permissionEnsured;
}

/** Presents an immediate in-app notification with a sound alert. The local
 *  counterpart to the server's remote push (`/notify`): remote push only reaches
 *  physical EAS builds, so this makes the same alerts seen/heard in Expo Go and
 *  on simulators too (banner everywhere; sound on real devices). No-op on web. */
export async function presentLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (Platform.OS === 'web') return;
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data },
      trigger: null, // present immediately
    });
  } catch (err) {
    console.warn('[notifications] present failed:', err);
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
