import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SessionBottomSheet } from "../../src/components/session/sessionBottomSheet";
import {
  reportTeacherNoShow,
} from "@/src/api/bookings";
import {
  getMyLearnerPrivateSessionRequests,
  type PrivateSessionRequest,
} from "@/src/api/privateSessionRequests";
import { api } from "../../src/api/client";
import {
  createCheckoutSession,
  syncCheckoutStatus,
} from "../../src/api/payments";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",

  successBg: "rgba(81, 207, 102, 0.12)",
  successBorder: "rgba(81, 207, 102, 0.22)",
  successText: "#8CE99A",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",
  warningText: "#FFD666",

  dangerBg: "rgba(255, 107, 107, 0.12)",
  dangerBorder: "rgba(255, 107, 107, 0.22)",
  dangerText: "#FFA8A8",

  infoBg: "rgba(111,146,255,0.12)",
  infoBorder: "rgba(111,146,255,0.22)",
  infoText: "#B7C7FF",

  neutralBg: "rgba(255,255,255,0.05)",
  neutralBorder: "rgba(255,255,255,0.08)",
  neutralText: "rgba(245,248,255,0.78)",

  divider: "rgba(255,255,255,0.06)",
};

type BookingRow = {
  booking_id: string;
  booking_status: string;
  booking_created_at: string;
  booking_confirmed_at?: string | null;
  booking_cancelled_at?: string | null;
  booking_refunded_at?: string | null;

  session_id: string;
  session_start_time: string;
  session_price: number;
  session_max_participants: number;
  session_rough_location?: string | null;
  session_arrival_instructions?: string | null;
  session_lat?: number | string | null;
  session_lng?: number | string | null;

  class_title: string;
  class_category: string;
  teacher_name: string;
};

function formatDate(dateString?: string) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString();
}

function isPast(dateString?: string) {
  if (!dateString) return false;
  return new Date(dateString).getTime() < Date.now();
}

function getHoursUntil(dateString?: string) {
  if (!dateString) return null;

  const time = new Date(dateString).getTime();

  if (Number.isNaN(time)) {
    return null;
  }

  return (time - Date.now()) / (1000 * 60 * 60);
}

function getApiErrorMessage(error: any, fallback: string): string {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message;
  }

  if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
    return responseData.message.join("\n");
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeBookingErrorMessage(message: string) {
  switch (message) {
    case "You already booked this session.":
      return "You already booked this session.";
    case "You already started booking this session. Complete payment to confirm it.":
      return "You already started booking this session. Complete payment to confirm it.";
    case "Your previous booking for this session was cancelled by the teacher, so it cannot be booked again.":
      return "This session can’t be booked again because your previous booking was cancelled by the teacher.";
    case "You already cancelled this session and it cannot be booked again.":
      return "This session can’t be booked again because you already cancelled it.";
    case "Your previous booking for this session has already been cancelled.":
      return "This session can’t be booked again because your previous booking was already cancelled.";
    case "Your previous booking attempt for this session expired and it cannot be booked again.":
      return "This session can’t be booked again because your previous booking attempt expired.";
    case "Session is fully booked":
      return "This session is fully booked.";
    case "You cannot book your own session":
      return "You cannot book your own session.";
    case "Session already started or is in the past":
      return "This session has already started or is in the past.";
    default:
      return message;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "PENDING":
      return "Pending payment";
    case "CANCELLED_BY_LEARNER":
      return "Cancelled by you";
      case "LATE_CANCELLED_BY_LEARNER":
  return "Late cancelled by you";
    case "CANCELLED_BY_TEACHER":
      return "Cancelled by teacher";
    case "REFUND_PENDING":
      return "Refund in progress";
    case "REFUNDED":
      return "Refund completed";
    case "REFUND_FAILED":
      return "Refund issue";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

function getStatusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return {
        backgroundColor: COLORS.successBg,
        borderColor: COLORS.successBorder,
        textColor: COLORS.successText,
      };
    case "PENDING":
    case "REFUND_PENDING":
      return {
        backgroundColor: COLORS.warningBg,
        borderColor: COLORS.warningBorder,
        textColor: COLORS.warningText,
      };
    case "CANCELLED_BY_LEARNER":
    case "CANCELLED_BY_TEACHER":
      case "LATE_CANCELLED_BY_LEARNER":
      return {
        backgroundColor: COLORS.dangerBg,
        borderColor: COLORS.dangerBorder,
        textColor: COLORS.dangerText,
      };
    case "REFUNDED":
      return {
        backgroundColor: COLORS.infoBg,
        borderColor: COLORS.infoBorder,
        textColor: COLORS.infoText,
      };
    case "REFUND_FAILED":
      return {
        backgroundColor: "rgba(255, 146, 43, 0.12)",
        borderColor: "rgba(255, 146, 43, 0.22)",
        textColor: "#FFC078",
      };
    default:
      return {
        backgroundColor: COLORS.neutralBg,
        borderColor: COLORS.neutralBorder,
        textColor: COLORS.neutralText,
      };
  }
}

function isPendingBookingExpired(booking: BookingRow) {
  if (booking.booking_status !== "PENDING") return false;

  const createdAt = new Date(booking.booking_created_at).getTime();

  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() > createdAt + 15 * 60 * 1000;
}

function getStatusDescription(booking: BookingRow) {
  if (booking.booking_status === "PENDING" && isPendingBookingExpired(booking)) {
    return "This booking looks expired because payment wasn’t completed in the app within 15 minutes. If you already paid in Stripe, tap Check payment status.";
  }

  switch (booking.booking_status) {
    case "PENDING":
      return "Complete payment to confirm your place. If you already paid, tap Check payment status.";
    case "CONFIRMED":
      return "Your place is confirmed.";
    case "CANCELLED_BY_LEARNER":
      return "You cancelled this booking.";
      case "LATE_CANCELLED_BY_LEARNER":
  return "You cancelled this booking less than 12 hours before the session. This is not eligible for an automatic refund.";
    case "CANCELLED_BY_TEACHER":
      return "The teacher cancelled this booking. Any eligible refund will be processed automatically.";
    case "REFUND_PENDING":
      return "Your refund is being processed.";
    case "REFUNDED":
      return booking.booking_refunded_at
        ? `Your refund was completed on ${formatDate(booking.booking_refunded_at)}.`
        : "Your refund has been completed.";
    case "REFUND_FAILED":
      return "There was an issue processing your refund. Please contact support if this is not resolved shortly.";
    case "EXPIRED":
      return "This booking expired before payment was completed.";
    default:
      return null;
  }
}

function getLearnerCancelRefundPreview(booking: BookingRow) {
  if (booking.booking_status === "PENDING") {
    return "This will cancel your pending booking. No payment has been confirmed yet, so no refund is needed.";
  }

  const hoursUntilSession = getHoursUntil(booking.session_start_time);

  if (hoursUntilSession === null) {
    return "This will cancel your confirmed booking. Refund eligibility will depend on the booking policy.";
  }

  if (hoursUntilSession >= 12) {
    return "This will cancel your confirmed booking. You’ll receive a full refund because this session starts in more than 12 hours.";
  }

  if (hoursUntilSession > 0) {
    return "This will cancel your confirmed booking. This cancellation is not eligible for an automatic refund because the session starts in less than 12 hours.";
  }

  return "This will cancel your confirmed booking. This cancellation is not eligible for an automatic refund because the session has already started.";
}

function openDirections(booking: BookingRow) {
  const lat = Number(booking.session_lat);
  const lng = Number(booking.session_lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    Alert.alert(
      "Directions unavailable",
      "The exact map location is not available for this booking yet.",
    );
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

  Linking.openURL(url).catch(() => {
    Alert.alert("Could not open maps", "Please try again.");
  });
}

export default function LearnerBookingsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [privateRequests, setPrivateRequests] = useState<
    PrivateSessionRequest[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const sessionSheetRef = useRef<any>(null);
  const [sheetSessionId, setSheetSessionId] = useState<string | null>(null);

  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(
    null,
  );
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [checkingBookingId, setCheckingBookingId] = useState<string | null>(
    null,
  );
  const [teacherNoShowModalVisible, setTeacherNoShowModalVisible] =
  useState(false);

const [teacherNoShowBooking, setTeacherNoShowBooking] =
  useState<BookingRow | null>(null);

const [teacherNoShowComment, setTeacherNoShowComment] = useState("");

  async function loadBookings(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const [bookingsRes, privateRows] = await Promise.all([
        api.get("/bookings/me"),
        getMyLearnerPrivateSessionRequests(),
      ]);

      const rows: BookingRow[] = Array.isArray(bookingsRes?.data)
        ? bookingsRes.data
        : [];

      const syncedRows = await Promise.all(
        rows.map(async (booking: BookingRow) => {
          if (booking.booking_status === "PENDING") {
            try {
              const result = await syncCheckoutStatus(booking.booking_id);

              if (result.status === "CONFIRMED") {
                return {
                  ...booking,
                  booking_status: "CONFIRMED",
                  booking_confirmed_at: new Date().toISOString(),
                };
              }
            } catch (e) {
              console.log("AUTO SYNC FAILED", e);
            }
          }

          return booking;
        }),
      );

      setBookings(syncedRows);
      setPrivateRequests(Array.isArray(privateRows) ? privateRows : []);
    } catch (e: any) {
      const rawMessage = getApiErrorMessage(
        e,
        "Could not load your bookings.",
      );

      setError(normalizeBookingErrorMessage(String(rawMessage)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBookings(true);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadBookings(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleCompletePayment = useCallback(
    async (booking: BookingRow) => {
      if (!booking.booking_id || payingBookingId) return;

      try {
        setPayingBookingId(booking.booking_id);

        const checkout = await createCheckoutSession(booking.booking_id);

        if (!checkout?.checkoutUrl) {
          throw new Error("Missing checkout URL");
        }

        await Linking.openURL(checkout.checkoutUrl);
      } catch (e: any) {
        const rawMessage = getApiErrorMessage(e, "Could not open checkout.");
        const message = normalizeBookingErrorMessage(String(rawMessage));

        Alert.alert("Payment error", message);
      } finally {
        setPayingBookingId(null);
      }
    },
    [payingBookingId],
  );

  const handleCheckPaymentStatus = useCallback(
    async (booking: BookingRow) => {
      if (!booking.booking_id || checkingBookingId) return;

      try {
        setCheckingBookingId(booking.booking_id);

        const result = await syncCheckoutStatus(booking.booking_id);

        if (result.status === "CONFIRMED") {
          Alert.alert("Payment confirmed", "Your booking is now confirmed.");
          await loadBookings(true);
          return;
        }

        Alert.alert(
          "Still pending",
          result.message ?? "Stripe has not confirmed this payment yet.",
        );

        await loadBookings(true);
      } catch (e: any) {
        const rawMessage = getApiErrorMessage(
          e,
          "Could not check payment status.",
        );

        Alert.alert("Payment check failed", String(rawMessage));
      } finally {
        setCheckingBookingId(null);
      }
    },
    [checkingBookingId],
  );

  const handleOpenBooking = useCallback(
    (booking: BookingRow) => {
      if (
        booking.booking_status === "PENDING" &&
        !isPendingBookingExpired(booking)
      ) {
        void handleCompletePayment(booking);
        return;
      }

      if (booking.session_id) {
        setSheetSessionId(booking.session_id);

        requestAnimationFrame(() => {
          sessionSheetRef.current?.present?.();
        });
      }
    },
    [handleCompletePayment],
  );

  const handleOpenPrivateAcceptedSession = useCallback((sessionId: string) => {
    setSheetSessionId(sessionId);

    requestAnimationFrame(() => {
      sessionSheetRef.current?.present?.();
    });
  }, []);

function openTeacherNoShowModal(booking: BookingRow) {
  setTeacherNoShowBooking(booking);
  setTeacherNoShowComment("");
  setTeacherNoShowModalVisible(true);
}

async function submitTeacherNoShow() {
  if (!teacherNoShowBooking) return;

  try {
    await reportTeacherNoShow(
      teacherNoShowBooking.booking_id,
      teacherNoShowComment.trim().slice(0, 200),
    );

    setTeacherNoShowModalVisible(false);
    setTeacherNoShowBooking(null);
    setTeacherNoShowComment("");

    Alert.alert(
      "Report submitted",
      "Your report has been sent to admin for review.",
    );

    await loadBookings(true);
  } catch (e: any) {
    const rawMessage = getApiErrorMessage(e, "Could not submit report.");
    Alert.alert("Could not report no-show", String(rawMessage));
  }
}

const handleCancelBooking = useCallback((booking: BookingRow) => {
  const previewMessage = getLearnerCancelRefundPreview(booking);

  Alert.alert("Cancel booking?", previewMessage, [
    {
      text: "Keep booking",
      style: "cancel",
    },
    {
      text: "Cancel booking",
      style: "destructive",
      onPress: async () => {
        try {
          setCancellingBookingId(booking.booking_id);

          await api.post(`/bookings/${booking.booking_id}/cancel/learner`);

          const hoursUntilSession = getHoursUntil(booking.session_start_time);
          const successMessage =
            booking.booking_status === "PENDING"
              ? "Your pending booking has been cancelled."
              : hoursUntilSession !== null && hoursUntilSession >= 12
                ? "Your booking has been cancelled. Your refund will be processed automatically."
                : "Your booking has been cancelled.";

          Alert.alert("Booking cancelled", successMessage);
          await loadBookings(true);
        } catch (e: any) {
          const rawMessage = getApiErrorMessage(
            e,
            "Could not cancel booking.",
          );
          const message = normalizeBookingErrorMessage(String(rawMessage));

          Alert.alert("Could not cancel booking", message);
        } finally {
          setCancellingBookingId(null);
        }
      },
    },
  ]);
}, []);

  const activePrivateRequests = useMemo(() => {
    return privateRequests.filter((request: any) =>
      ["OPEN", "ACCEPTED"].includes(request.status),
    );
  }, [privateRequests]);

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          !!b.session_start_time &&
          !isPast(b.session_start_time) &&
          !isPendingBookingExpired(b) &&
          b.booking_status !== "CANCELLED_BY_LEARNER" &&
          b.booking_status !== "LATE_CANCELLED_BY_LEARNER" &&
          b.booking_status !== "CANCELLED_BY_TEACHER" &&
          b.booking_status !== "REFUNDED" &&
          b.booking_status !== "REFUND_PENDING" &&
          b.booking_status !== "REFUND_FAILED" &&
          b.booking_status !== "EXPIRED",
      )
      .sort(
        (a, b) =>
          new Date(a.session_start_time).getTime() -
          new Date(b.session_start_time).getTime(),
      );
  }, [bookings]);

  const pastBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          !b.session_start_time ||
          isPast(b.session_start_time) ||
          isPendingBookingExpired(b) ||
          b.booking_status === "CANCELLED_BY_LEARNER" ||
          b.booking_status === "CANCELLED_BY_TEACHER" ||
          b.booking_status === "LATE_CANCELLED_BY_LEARNER" ||
          b.booking_status === "REFUND_PENDING" ||
          b.booking_status === "REFUNDED" ||
          b.booking_status === "REFUND_FAILED" ||
          b.booking_status === "EXPIRED",
      )
      .sort((a, b) => {
        const aTime = a.session_start_time
          ? new Date(a.session_start_time).getTime()
          : 0;
        const bTime = b.session_start_time
          ? new Date(b.session_start_time).getTime()
          : 0;

        return bTime - aTime;
      });
  }, [bookings]);

  function canLearnerCancel(booking: BookingRow) {
    return (
      ["CONFIRMED", "PENDING"].includes(booking.booking_status) &&
      !isPendingBookingExpired(booking) &&
      !!booking.session_start_time &&
      !isPast(booking.session_start_time)
    );
  }

  function canLeaveReview(booking: BookingRow) {
    return (
      booking.booking_status === "CONFIRMED" &&
      !!booking.session_start_time &&
      isPast(booking.session_start_time)
    );
  }

  function hasActiveBookingForSession(sessionId?: string | null) {
    if (!sessionId) return false;

    return bookings.some(
      (booking) =>
        booking.session_id === sessionId &&
        ["PENDING", "CONFIRMED"].includes(booking.booking_status) &&
        !isPendingBookingExpired(booking),
    );
  }

  function renderPrivateRequestCard(request: any) {
    const acceptedSessionId = request.accepted_session_id;
    const isAccepted = request.status === "ACCEPTED";
    const alreadyHasBooking = hasActiveBookingForSession(
      acceptedSessionId ? String(acceptedSessionId) : null,
    );

    return (
      <View key={request.id} style={styles.cardOuter}>
        <View style={styles.cardInner}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderTop}>
              <Text style={styles.cardTitle}>Private 1:1 request</Text>

              <Text style={styles.cardTeacher}>
                {request.teacher?.first_name ||
                  request.teacher?.full_name ||
                  "Teacher"}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isAccepted
                    ? COLORS.successBg
                    : COLORS.warningBg,
                  borderColor: isAccepted
                    ? COLORS.successBorder
                    : COLORS.warningBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: isAccepted
                      ? COLORS.successText
                      : COLORS.warningText,
                  },
                ]}
              >
                {isAccepted ? "Ready to book" : "Awaiting teacher"}
              </Text>
            </View>
          </View>

          {request.message ? (
            <Text style={styles.privateRequestMessage}>{request.message}</Text>
          ) : null}

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              {isAccepted
                ? "Your teacher accepted this private request. Book the private session to confirm your place."
                : "Your teacher has not accepted or declined this request yet."}
            </Text>
          </View>

          {acceptedSessionId && !alreadyHasBooking ? (
            <Pressable
              onPress={() =>
                handleOpenPrivateAcceptedSession(String(acceptedSessionId))
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Book private session</Text>
            </Pressable>
          ) : acceptedSessionId && alreadyHasBooking ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                You already have a booking in progress for this private session.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderBookingCard(booking: BookingRow) {
    const pendingExpired = isPendingBookingExpired(booking);
    const effectiveStatus = pendingExpired ? "EXPIRED" : booking.booking_status;
    const statusStyles = getStatusStyles(effectiveStatus);

    const showCancelButton = canLearnerCancel(booking);
    const showReviewButton = canLeaveReview(booking);
    const showTeacherNoShowButton =
  booking.booking_status === "CONFIRMED" &&
  !!booking.session_start_time &&
  isPast(booking.session_start_time);
    const isCancelling = cancellingBookingId === booking.booking_id;
    const isPaying = payingBookingId === booking.booking_id;
    const isChecking = checkingBookingId === booking.booking_id;
    const statusDescription = getStatusDescription(booking);

    const showPaymentButton =
      booking.booking_status === "PENDING" && !pendingExpired;

    const showCheckStatusButton = booking.booking_status === "PENDING";

    const hasMeetingDetails =
      booking.booking_status === "CONFIRMED" &&
      !!(
        booking.session_rough_location ||
        booking.session_arrival_instructions ||
        (Number.isFinite(Number(booking.session_lat)) &&
          Number.isFinite(Number(booking.session_lng)))
      );

    const hasDirections =
      booking.booking_status === "CONFIRMED" &&
      Number.isFinite(Number(booking.session_lat)) &&
      Number.isFinite(Number(booking.session_lng));

    return (
      <Pressable
        key={booking.booking_id}
        onPress={() => handleOpenBooking(booking)}
        style={styles.cardOuter}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderTop}>
              <Text style={styles.cardTitle}>
                {booking.class_title || "Booked session"}
              </Text>

              <Text style={styles.cardTeacher}>
                {booking.teacher_name || "Teacher"}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: statusStyles.backgroundColor,
                  borderColor: statusStyles.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: statusStyles.textColor },
                ]}
              >
                {pendingExpired
                  ? "Expired"
                  : statusLabel(booking.booking_status)}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDate}>
            {formatDate(booking.session_start_time)}
          </Text>

          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>€{booking.session_price}</Text>
            </View>

            {booking.class_category ? (
              <View style={styles.chip}>
                <Text style={styles.chipTextCategory}>
                  {booking.class_category}
                </Text>
              </View>
            ) : null}
          </View>

          {statusDescription ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>{statusDescription}</Text>
            </View>
          ) : null}
{showTeacherNoShowButton ? (
  <View style={styles.postSessionCard}>
    <View style={styles.postSessionHeader}>
      <Ionicons
        name="time-outline"
        size={18}
        color={COLORS.warningText}
      />

      <Text style={styles.postSessionTitle}>
        How did your session go?
      </Text>
    </View>

    <Text style={styles.postSessionBody}>
      If your teacher never arrived or the session did not happen,
      you can report a no-show within 24 hours of the session start time.
    </Text>

    <View style={styles.postSessionActions}>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          safePush(`/(learner)/review/${booking.booking_id}`);
        }}
        style={styles.postSessionSuccessButton}
      >
        <Text style={styles.postSessionSuccessText}>
          Session went fine
        </Text>
      </Pressable>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          openTeacherNoShowModal(booking);
        }}
        style={styles.postSessionDangerButton}
      >
        <Text style={styles.postSessionDangerText}>
          Report no-show
        </Text>
      </Pressable>
    </View>
  </View>
) : null}

          {hasMeetingDetails ? (
            <View style={styles.meetingBox}>
              <View style={styles.meetingHeaderRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={COLORS.infoText}
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.meetingTitle}>Where to meet</Text>

                  <Text style={styles.meetingSubtitle}>
                    Important meetup details from the teacher
                  </Text>
                </View>
              </View>

              {booking.session_rough_location ? (
                <View style={styles.meetingSection}>
                  <Text style={styles.meetingLabel}>Location</Text>

                  <Text style={styles.meetingText}>
                    {booking.session_rough_location}
                  </Text>
                </View>
              ) : null}

              {booking.session_arrival_instructions ? (
                <View style={styles.meetingSection}>
                  <Text style={styles.meetingLabel}>Arrival instructions</Text>

                  <Text style={styles.meetingText}>
                    {booking.session_arrival_instructions}
                  </Text>
                </View>
              ) : null}


              {hasDirections ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    openDirections(booking);
                  }}
                  style={styles.directionsButton}
                >
                  <Ionicons name="navigate-outline" size={17} color="#FFFFFF" />

                  <Text style={styles.directionsButtonText}>
                    Get directions
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

{showPaymentButton ||
showCheckStatusButton ||
showCancelButton ||
showReviewButton ||
showTeacherNoShowButton ? (
            <View style={styles.cardActions}>
              {showPaymentButton ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();

                    if (!isPaying) {
                      void handleCompletePayment(booking);
                    }
                  }}
                  disabled={isPaying}
                  style={[
                    styles.paymentButton,
                    isPaying && styles.paymentButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentButtonText,
                      isPaying && styles.paymentButtonTextDisabled,
                    ]}
                  >
                    {isPaying ? "Opening checkout..." : "Complete payment"}
                  </Text>
                </Pressable>
              ) : null}

              {showCheckStatusButton ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();

                    if (!isChecking) {
                      void handleCheckPaymentStatus(booking);
                    }
                  }}
                  disabled={isChecking}
                  style={[
                    styles.secondaryButton,
                    isChecking && styles.paymentButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      isChecking && styles.paymentButtonTextDisabled,
                    ]}
                  >
                    {isChecking ? "Checking..." : "Check payment status"}
                  </Text>
                </Pressable>
              ) : null}

              {showReviewButton ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    safePush(`/(learner)/review/${booking.booking_id}`);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Leave review</Text>
                </Pressable>
              ) : null}

{showTeacherNoShowButton ? (
  <Pressable
    onPress={(e) => {
      e.stopPropagation();
openTeacherNoShowModal(booking);    }}
    style={styles.secondaryButton}
  >
    <Text style={styles.secondaryButtonText}>
      Report teacher no-show
    </Text>
  </Pressable>
) : null}

              {showCancelButton ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();

                    if (!isCancelling) {
                      handleCancelBooking(booking);
                    }
                  }}
                  disabled={isCancelling}
                  style={[
                    styles.dangerButton,
                    isCancelling && styles.dangerButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.dangerButtonText,
                      isCancelling && styles.dangerButtonTextDisabled,
                    ]}
                  >
                    {isCancelling ? "Cancelling..." : "Cancel booking"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <Text style={styles.bookingRef}>
              Booking #{booking.booking_id.slice(0, 8)}
            </Text>

            <View style={styles.openBookingWrap}>
              <Text style={styles.openBookingText}>
                {pendingExpired
                  ? "View details"
                  : booking.booking_status === "PENDING"
                    ? "Complete payment"
                    : "Open session"}
              </Text>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.textMuted}
              />
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  function renderEmptyState(
    title: string,
    subtitle: string,
    showBrowse = false,
  ) {
    return (
      <View style={styles.emptyOuter}>
        <View style={styles.emptyInner}>
          <Text style={styles.emptyTitle}>{title}</Text>

          <Text style={styles.emptySubtitle}>{subtitle}</Text>

          {showBrowse ? (
            <Pressable
              onPress={() => safeReplace("/(learner)/map")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Browse classes</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <AppLayout>
      <AppScreen>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadBookings(true)}
                tintColor="#FFFFFF"
              />
            }
          >
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Bookings</Text>
              </View>

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>My Bookings</Text>

                  <Text style={styles.heroSubtitle}>
                    See your upcoming classes, private requests, and past
                    bookings.
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={COLORS.accent} />

                <Text style={styles.loadingStateText}>Loading bookings…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorOuter}>
                <View style={styles.errorInner}>
                  <Text style={styles.errorTitle}>Could not load bookings</Text>

                  <Text style={styles.errorBody}>{error}</Text>

                  <Pressable
                    onPress={() => loadBookings()}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {activePrivateRequests.length > 0 ? (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionTitle}>
                      Private 1:1 requests
                    </Text>

                    {activePrivateRequests.map(renderPrivateRequestCard)}
                  </View>
                ) : null}

                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionTitle}>Upcoming</Text>

                  {upcomingBookings.length === 0
                    ? renderEmptyState(
                        "No upcoming bookings",
                        "You haven’t booked any upcoming sessions yet. Explore the map to find something nearby.",
                        true,
                      )
                    : upcomingBookings.map(renderBookingCard)}
                </View>

                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionTitle}>Past & Cancelled</Text>

                  {pastBookings.length === 0
                    ? renderEmptyState(
                        "Nothing here yet",
                        "Your completed, cancelled, refunded, and refund-issue bookings will appear here.",
                      )
                    : pastBookings.map(renderBookingCard)}
                </View>
              </>
            )}
          </ScrollView>
        </View>

        <SessionBottomSheet
          ref={sessionSheetRef}
          sessionId={sheetSessionId}
          visible={!!sheetSessionId}
          onClose={() => {
            setSheetSessionId(null);
          }}
        />
        <Modal
  visible={teacherNoShowModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setTeacherNoShowModalVisible(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        Report teacher no-show
      </Text>

      <Text style={styles.modalBody}>
        Briefly explain what happened. Admin will review this
        before any refund is approved.

        {"\n\n"}

        No-show reports must be submitted within 24 hours
        of the session start time.
      </Text>

      <TextInput
        value={teacherNoShowComment}
        onChangeText={(text) =>
          setTeacherNoShowComment(text.slice(0, 200))
        }
        placeholder="Example: I waited 20 minutes and the teacher never arrived."
        placeholderTextColor={COLORS.textMuted}
        multiline
        maxLength={200}
        style={styles.modalInput}
      />

      <Text style={styles.characterCount}>
        {teacherNoShowComment.length}/200
      </Text>

      <View style={styles.modalActions}>
        <Pressable
          onPress={() => {
            setTeacherNoShowModalVisible(false);
            setTeacherNoShowBooking(null);
            setTeacherNoShowComment("");
          }}
          style={styles.modalCancelButton}
        >
          <Text style={styles.modalCancelText}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          onPress={submitTeacherNoShow}
          style={styles.modalSubmitButton}
        >
          <Text style={styles.modalSubmitText}>
            Submit report
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  hero: {
    marginBottom: 22,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    marginBottom: 12,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  heroTextWrap: {
    flex: 1,
  },

  heroTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  heroSubtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  backButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  loadingState: {
    paddingTop: 40,
    alignItems: "center",
  },

  loadingStateText: {
    color: COLORS.textSoft,
    marginTop: 10,
  },

  errorOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  errorInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 18,
  },

  errorTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  errorBody: {
    color: COLORS.textSoft,
    lineHeight: 20,
    marginBottom: 14,
  },

  meetingBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
  },

  meetingHeaderRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },

  meetingTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },

  meetingSubtitle: {
    color: COLORS.textMuted,
    marginTop: 2,
    fontSize: 12,
  },

  meetingSection: {
    marginTop: 10,
  },

  meetingLabel: {
    color: COLORS.infoText,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
  },

  meetingText: {
    color: COLORS.text,
    lineHeight: 20,
  },

  directionsButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  directionsButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  sectionWrap: {
    marginBottom: 28,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  cardHeaderTop: {
    flex: 1,
  },

  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 22,
  },

  cardTeacher: {
    marginTop: 6,
    color: COLORS.textSoft,
  },

  privateRequestMessage: {
    marginTop: 12,
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },

  cardDate: {
    marginTop: 12,
    color: COLORS.text,
    fontWeight: "700",
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  chip: {
    borderWidth: 1,
    borderColor: "rgba(110,145,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceSoft,
  },

  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },

  chipTextCategory: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "capitalize",
  },

  infoBox: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  infoBoxText: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  cardActions: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  paymentButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
  },

  paymentButtonDisabled: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
  },

  paymentButtonText: {
    fontWeight: "900",
    color: COLORS.warningText,
  },

  paymentButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  secondaryButtonText: {
    fontWeight: "800",
    color: COLORS.text,
  },

  dangerButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
  },

  dangerButtonDisabled: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
  },

  dangerButtonText: {
    fontWeight: "800",
    color: COLORS.dangerText,
  },

  dangerButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bookingRef: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  openBookingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  openBookingText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  emptyOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  emptyInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 18,
  },

  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  emptySubtitle: {
    marginTop: 8,
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  modalBackdrop: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.72)",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
},

modalCard: {
  width: "100%",
  maxWidth: 420,
  borderRadius: 22,
  padding: 18,
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
},

modalTitle: {
  color: COLORS.text,
  fontSize: 20,
  fontWeight: "900",
  marginBottom: 8,
},

modalBody: {
  color: COLORS.textSoft,
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 12,
},

modalInput: {
  minHeight: 96,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surfaceSoft,
  color: COLORS.text,
  padding: 12,
  textAlignVertical: "top",
},

characterCount: {
  color: COLORS.textMuted,
  fontSize: 12,
  textAlign: "right",
  marginTop: 6,
},

modalActions: {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 14,
},

modalCancelButton: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.surfaceSoft,
},

modalCancelText: {
  color: COLORS.text,
  fontWeight: "800",
},

modalSubmitButton: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.warningBorder,
  backgroundColor: COLORS.warningBg,
},

modalSubmitText: {
  color: COLORS.warningText,
  fontWeight: "900",
},
postSessionCard: {
  marginTop: 14,
  borderRadius: 18,
  padding: 14,
  backgroundColor: COLORS.warningBg,
  borderWidth: 1,
  borderColor: COLORS.warningBorder,
},

postSessionHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
},

postSessionTitle: {
  color: COLORS.warningText,
  fontSize: 15,
  fontWeight: "900",
},

postSessionBody: {
  color: COLORS.textSoft,
  lineHeight: 20,
},

postSessionActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 14,
  flexWrap: "wrap",
},

postSessionSuccessButton: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.successBorder,
  backgroundColor: COLORS.successBg,
},

postSessionSuccessText: {
  color: COLORS.successText,
  fontWeight: "900",
},

postSessionDangerButton: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.dangerBorder,
  backgroundColor: COLORS.dangerBg,
},

postSessionDangerText: {
  color: COLORS.dangerText,
  fontWeight: "900",
},
});