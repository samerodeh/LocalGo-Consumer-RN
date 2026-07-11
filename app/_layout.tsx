import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { colors } from '../src/theme/theme';
import { useAuthStore } from '../src/store/authStore';
import { useOrdersStore } from '../src/store/ordersStore';
import { useAddressStore } from '../src/store/addressStore';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'BarlowCondensed-Black': require('../assets/fonts/BarlowCondensed-Black.ttf'),
    'BarlowCondensed-ExtraBold': require('../assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    'BarlowCondensed-Bold': require('../assets/fonts/BarlowCondensed-Bold.ttf'),
    'BarlowCondensed-SemiBold': require('../assets/fonts/BarlowCondensed-SemiBold.ttf'),
  });

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const currentEmail = useAuthStore((s) => s.currentUser?.email ?? null);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const configureOrders = useOrdersStore((s) => s.configure);
  const configureAddresses = useAddressStore((s) => s.configure);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Re-scope per-user stores whenever the signed-in account changes.
  useEffect(() => {
    configureOrders(currentEmail);
    configureAddresses(currentEmail);
  }, [currentEmail, configureOrders, configureAddresses]);

  if (!fontsLoaded || !bootstrapped) {
    return <View style={{ flex: 1, backgroundColor: colors.offWhite }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.offWhite } }}>
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="restaurant/[id]"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="address" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
