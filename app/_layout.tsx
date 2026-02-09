import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { authStore } from '../src/store/auth.store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  useEffect(() => {
    authStore.getState().hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false }}>
      {/* Our routing gate */}
      <Stack.Screen name="index" />

      {/* Our new route groups */}
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(learner)" />
      <Stack.Screen name="(teacher)" />

      {/* Keep template routes so nothing breaks */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
    </GestureHandlerRootView>
  );
}
