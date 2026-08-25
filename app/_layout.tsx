import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppToast } from "../src/components/ui/AppToast";
import { authStore } from "../src/store/auth.store";
import { openNotificationResponse } from "../src/utils/notificationNavigation";
import { registerPushToken } from "../src/utils/registerPushToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const hasTriedPushRegistrationRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const pendingNotificationResponseRef =
    useRef<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    void authStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const tryRegisterPush = async () => {
      const state = authStore.getState();
      const token = state?.token;

      if (!token || hasTriedPushRegistrationRef.current) {
        return;
      }

      hasTriedPushRegistrationRef.current = true;

      try {
        await registerPushToken(token);
      } catch (error) {
        console.error("Push registration failed:", error);
      }
    };

    void tryRegisterPush();

    const unsubscribe = authStore.subscribe((state) => {
      const token = state?.token;

      if (!token) {
        hasTriedPushRegistrationRef.current = false;
        return;
      }

      if (hasTriedPushRegistrationRef.current) {
        return;
      }

      hasTriedPushRegistrationRef.current = true;

      void registerPushToken(token).catch((error) => {
        console.error("Push registration failed:", error);
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const ensureValidSession = async () => {
      const state = authStore.getState();

      if (!state.hydrated) return;
      if (!state.token) return;
      if (state.isRefreshingToken) return;

      try {
        const refreshedToken = await state.refreshAccessToken();

        if (!refreshedToken) {
          console.warn(
            "Session refresh returned no token on resume; keeping current session.",
          );
          return;
        }

        await authStore.getState().refreshMe();
      } catch (error) {
        console.error("Session refresh on resume failed:", error);
      }
    };

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextAppState;

      const becameActive =
        (previous === "background" || previous === "inactive") &&
        nextAppState === "active";

      if (becameActive) {
        void ensureValidSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const navigateFromResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const identifier = response.notification.request.identifier;

      if (
        identifier &&
        lastHandledNotificationIdRef.current === identifier
      ) {
        return;
      }

      const state = authStore.getState();

      if (!state.hydrated) {
        pendingNotificationResponseRef.current = response;
        return;
      }

      lastHandledNotificationIdRef.current = identifier ?? null;

      setTimeout(() => {
        openNotificationResponse(response);
      }, 450);
    };

    const receivedSub =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log(
          "Notification received while app active:",
          notification.request.content.data,
        );
      });

    const responseSub =
      Notifications.addNotificationResponseReceivedListener(
        navigateFromResponse,
      );

// void Notifications.getLastNotificationResponseAsync()
//   .then(async (response) => {
//     if (!response) return;

//     navigateFromResponse(response);

//     await Notifications.clearLastNotificationResponseAsync();
//   })
//       .catch((error) => {
//         console.error(
//           "Could not read initial notification response:",
//           error,
//         );
//       });

    const unsubscribeAuth = authStore.subscribe((state) => {
      if (!state.hydrated || !pendingNotificationResponseRef.current) {
        return;
      }

      const pending = pendingNotificationResponseRef.current;
      pendingNotificationResponseRef.current = null;
      navigateFromResponse(pending);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      unsubscribeAuth();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              gestureEnabled: true,
              contentStyle: {
                backgroundColor: "#000000",
              },
            }}
          />

          <AppToast />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
