// src/utils/notificationNavigation.ts
import * as Notifications from "expo-notifications";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

export type NotificationData = Record<string, unknown> | undefined;

function pickString(data: NotificationData, ...keys: string[]): string | null {
  if (!data) return null;

  for (const key of keys) {
    const value = data[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

export function openNotificationDestination(data: NotificationData) {
  const type = pickString(data, "type")?.toLowerCase() ?? "";
  const bookingId = pickString(data, "booking_id", "bookingId");
  const sessionId = pickString(data, "session_id", "sessionId");
  const privateSessionRequestId = pickString(
    data,
    "private_session_request_id",
    "privateSessionRequestId",
  );

  console.log("Opening notification destination:", {
    type,
    bookingId,
    sessionId,
    privateSessionRequestId,
    rawData: data,
  });

  const learnerBookingTypes = new Set([
    "booking_confirmed",
    "booking_cancelled_by_teacher",
    "refund_completed",
    "refund_failed",
    "session_reminder_24h",
    "session_reminder_1h",
    "learner_no_show_recorded",
    "teacher_no_show_recorded",
  ]);

  const teacherSessionTypes = new Set([
    "new_booking_started",
    "booking_confirmed_teacher",
    "booking_cancelled_by_learner",
    "teacher_session_reminder_24h",
    "teacher_session_reminder_1h",
    "teacher_attendance_check",
    "learner_no_show_reported",
    "teacher_no_show_reported",
    "booking_disputed",
    "payout_sent",
    "payout_review_period_started",
  ]);

  if (learnerBookingTypes.has(type)) {
    safeReplace("/(learner)/bookings");
    return;
  }

  if (type === "review_reminder") {
    if (bookingId) {
      safePush({
        pathname: "/(learner)/review/[bookingId]",
        params: { bookingId },
      });
      return;
    }

    safeReplace("/(learner)/bookings");
    return;
  }

  if (type === "private_session_request_created") {
    if (privateSessionRequestId) {
      safePush({
        pathname: "/(teacher)/private-session-requests/[id]",
        params: { id: privateSessionRequestId },
      });
      return;
    }

    safeReplace("/(teacher)/private-session-requests");
    return;
  }

  if (type === "private_session_request_accepted") {
    if (sessionId) {
safePush({
  pathname: "/(modal)/booking/[sessionId]",
  params: { sessionId },
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

  if (type === "session_approved" || type === "session_rejected") {
    safeReplace("/(teacher)/sessions");
    return;
  }

  if (teacherSessionTypes.has(type)) {
    if (sessionId) {
      safePush({
        pathname: "/(teacher)/sessions/[id]",
        params: { id: sessionId },
      });
      return;
    }

    safeReplace("/(teacher)/sessions");
    return;
  }

  if (sessionId) {
safePush({
  pathname: "/(modal)/booking/[sessionId]",
  params: { sessionId },
});
    return;
  }

  if (bookingId) {
    safeReplace("/(learner)/bookings");
    return;
  }

  console.warn("Unhandled notification; opening inbox:", type, data);
  safeReplace("/(learner)/notifications");
}

export function openNotificationResponse(
  response: Notifications.NotificationResponse,
) {
  openNotificationDestination(
    response.notification.request.content.data as NotificationData,
  );
}
