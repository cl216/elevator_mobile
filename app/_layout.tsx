import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { AppToast } from "../src/components/ui/AppToast";
import { authStore } from "../src/store/auth.store";
import { registerPushToken } from "../src/utils/registerPushToken";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  console.warn("Session refresh returned no token on resume; keeping current session.");
  return;
}

        await authStore.getState().refreshMe();
      } catch (error) {
console.error("Session refresh on resume failed:", error);

// Do not logout on app resume failure.
// The user may just have weak signal/background network issues.
// If the token is truly invalid, the API interceptor will handle a real 401 later.
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
          safePush({
            pathname: "/(learner)/booking/[id]",
            params: { id: String(bookingId) },
          });
          return;
        }

        safeReplace("/(learner)/bookings");
        return;
      }

      if (type === "review_reminder") {
        if (bookingId) {
          safePush({
            pathname: "/(learner)/review/[bookingId]",
            params: { bookingId: String(bookingId) },
          });
          return;
        }

        safeReplace("/(learner)/bookings");
        return;
      }

      if (type === "private_session_request_declined") {
        safeReplace("/(learner)/notifications");
        return;
      }

      if (type === "private_session_request_accepted") {
        if (sessionId) {
          safePush({
            pathname: "/(modal)/session/[id]",
            params: { id: String(sessionId) },
          });
          return;
        }

        if (privateSessionRequestId) {
          safeReplace("/(learner)/notifications");
          return;
        }

        safeReplace("/(learner)/notifications");
        return;
      }

      if (type === "private_session_request_created") {
        safePush("/(teacher)/private-session-requests");
        return;
      }

      if (
        type === "new_booking_started" ||
        type === "booking_confirmed_teacher" ||
        type === "booking_cancelled_by_learner" ||
        type === "teacher_session_reminder_24h" ||
        type === "teacher_session_reminder_1h" ||
        type === "teacher_attendance_check"
      ) {
        if (sessionId) {
          safePush({
            pathname: "/(teacher)/sessions/[id]",
            params: { id: String(sessionId) },
          });
          return;
        }

        safeReplace("/(teacher)/sessions");
        return;
      }

console.log("Unhandled notification type:", type, data);
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

    return () => {
      receivedSub.remove();
      responseSub.remove();
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