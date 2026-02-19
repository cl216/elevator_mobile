import "react-native-gesture-handler";
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { authStore } from '../src/store/auth.store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

export default function RootLayout() {
  useEffect(() => {
    authStore.getState().hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <BottomSheetModalProvider>

<Stack
  screenOptions={{
    headerShown: false,
    animation: "slide_from_right",
    gestureEnabled: true,
  }}
>      {/* Our routing gate */}
      <Stack.Screen name="index" />

      {/* Our new route groups */}
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(learner)" />
      <Stack.Screen name="(teacher)" />

      {/* Keep template routes so nothing breaks */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
    </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
