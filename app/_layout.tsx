import "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";

import { authStore } from "../src/store/auth.store";
import { AppToast } from "../src/components/ui/AppToast";
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
  const router = useRouter();
  const hasTriedPushRegistrationRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
          router.replace("/(auth)/login");
          return;
        }

        await authStore.getState().refreshMe();
      } catch (error) {
        console.error("Session refresh on resume failed:", error);
        await authStore.getState().logout();
        router.replace("/(auth)/login");
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
  }, [router]);

  useEffect(() => {
    const handleNotificationNavigation = (data: any) => {
      const bookingId = data?.booking_id;
      const sessionId = data?.session_id;
      const privateSessionRequestId = data?.private_session_request_id;
      const type = data?.type;

      if (
        type === "booking_confirmed" ||
        type === "booking_cancelled_by_teacher" ||
        type === "refund_completed" ||
        type === "session_reminder_24h" ||
        type === "session_reminder_1h"
      ) {
        if (bookingId) {
          router.push({
            pathname: "/(learner)/booking/[id]",
            params: { id: String(bookingId) },
          });
          return;
        }

        router.push("/(learner)/bookings");
        return;
      }

      if (type === "review_reminder") {
        if (bookingId) {
          router.push({
            pathname: "/(learner)/review/[bookingId]",
            params: { bookingId: String(bookingId) },
          });
          return;
        }

        router.push("/(learner)/bookings");
        return;
      }

      if (type === "private_session_request_declined") {
        router.push("/(learner)/notifications");
        return;
      }

      if (type === "private_session_request_accepted") {
        if (sessionId) {
          router.push({
            pathname: "/(learner)/session/[id]",
            params: { id: String(sessionId) },
          });
          return;
        }

        if (privateSessionRequestId) {
          router.push("/(learner)/notifications");
          return;
        }

        router.push("/(learner)/notifications");
        return;
      }

      if (type === "private_session_request_created") {
        router.push("/(teacher)/private-session-requests");
        return;
      }

      if (
        type === "new_booking_started" ||
        type === "booking_confirmed_teacher" ||
        type === "booking_cancelled_by_learner" ||
        type === "teacher_session_reminder_24h" ||
        type === "teacher_session_reminder_1h"
      ) {
        if (sessionId) {
          router.push({
            pathname: "/(teacher)/sessions/[id]",
            params: { id: String(sessionId) },
          });
          return;
        }

        router.push("/(teacher)/sessions");
        return;
      }

      router.push("/(learner)/notifications");
    };

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
      },
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data: any = response.notification.request.content.data;
        handleNotificationNavigation(data);
      });

    const handleInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;

      const data: any = response.notification.request.content.data;
      handleNotificationNavigation(data);
    };

    void handleInitialNotification();

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />

        <AppToast />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}