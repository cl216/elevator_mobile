import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

import { api } from "../../src/api/client";
import { ExplainCard } from "../../src/components/ui/ExplainCard";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../src/utils/explainCard";

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

  button: "#3F6AE0",
  buttonSecondary: "#121A2C",

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
  booking_status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED_BY_LEARNER"
    | "CANCELLED_BY_TEACHER"
    | "REFUND_PENDING"
    | "REFUNDED"
    | "REFUND_FAILED"
    | "EXPIRED"
    | string;
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
  if (Number.isNaN(time)) return null;

  return (time - Date.now()) / (1000 * 60 * 60);
}

function getApiErrorMessage(error: any, fallback: string): string {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (
    typeof responseData?.message === "string" &&
    responseData.message.trim()
  ) {
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
      return {
        backgroundColor: COLORS.warningBg,
        borderColor: COLORS.warningBorder,
        textColor: COLORS.warningText,
      };
    case "CANCELLED_BY_LEARNER":
    case "CANCELLED_BY_TEACHER":
      return {
        backgroundColor: COLORS.dangerBg,
        borderColor: COLORS.dangerBorder,
        textColor: COLORS.dangerText,
      };
    case "REFUND_PENDING":
      return {
        backgroundColor: COLORS.warningBg,
        borderColor: COLORS.warningBorder,
        textColor: COLORS.warningText,
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
    case "EXPIRED":
      return {
        backgroundColor: COLORS.neutralBg,
        borderColor: COLORS.neutralBorder,
        textColor: COLORS.neutralText,
      };
    default:
      return {
        backgroundColor: COLORS.neutralBg,
        borderColor: COLORS.neutralBorder,
        textColor: COLORS.neutralText,
      };
  }
}

function getStatusDescription(booking: BookingRow) {
  switch (booking.booking_status) {
    case "PENDING":
      return "Complete payment to confirm your place.";
    case "CONFIRMED":
      return "Your place is confirmed.";
    case "CANCELLED_BY_LEARNER":
      return "You cancelled this booking.";
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

export default function LearnerBookingsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showBookingsExplainCard, setShowBookingsExplainCard] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(
    null,
  );

  async function loadBookings(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const res = await api.get("/bookings/me");
      const rows = Array.isArray(res?.data) ? res.data : [];
      setBookings(rows);
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
    loadBookings();
  }, []);

  useEffect(() => {
    (async () => {
      const seen = await hasSeenExplainCard("learner-bookings-intro");
      setShowBookingsExplainCard(!seen);
    })();
  }, []);

  const handleDismissBookingsExplainCard = useCallback(async () => {
    await markExplainCardSeen("learner-bookings-intro");
    setShowBookingsExplainCard(false);
  }, []);

  const handleCancelBooking = useCallback((booking: BookingRow) => {
    const previewMessage = getLearnerCancelRefundPreview(booking);

    Alert.alert("Cancel booking?", previewMessage, [
      { text: "Keep booking", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          try {
            setCancellingBookingId(booking.booking_id);

            await api.post(`/bookings/${booking.booking_id}/cancel/learner`);

            const hoursUntilSession = getHoursUntil(booking.session_start_time);
            const successMessage =
              hoursUntilSession !== null && hoursUntilSession >= 12
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

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          !!b.session_start_time &&
          !isPast(b.session_start_time) &&
          b.booking_status !== "CANCELLED_BY_LEARNER" &&
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
          b.booking_status === "CANCELLED_BY_LEARNER" ||
          b.booking_status === "CANCELLED_BY_TEACHER" ||
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
      booking.booking_status === "CONFIRMED" &&
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

  function renderBookingCard(booking: BookingRow) {
    const statusStyles = getStatusStyles(booking.booking_status);
    const showCancelButton = canLearnerCancel(booking);
    const showReviewButton = canLeaveReview(booking);
    const isCancelling = cancellingBookingId === booking.booking_id;
    const statusDescription = getStatusDescription(booking);

    return (
      <Pressable
        key={booking.booking_id}
        onPress={() => {
          if (booking.booking_id) {
            router.push(`/(learner)/booking/${booking.booking_id}`);
          }
        }}
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
                {statusLabel(booking.booking_status)}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDate}>{formatDate(booking.session_start_time)}</Text>

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

          {showCancelButton || showReviewButton ? (
            <View style={styles.cardActions}>
              {showReviewButton ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push(`/(learner)/review/${booking.booking_id}`);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Leave review</Text>
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
              <Text style={styles.openBookingText}>Open booking</Text>
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
              onPress={() => router.replace("/(learner)/map")}
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
                See your upcoming and past classes.
              </Text>
            </View>

            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>
        </View>

        {showBookingsExplainCard ? (
          <ExplainCard
            title="Your bookings live here"
            body="Upcoming sessions stay at the top. Tap any booking to open the booking details. Past eligible classes can also be reviewed here."
            ctaText="Browse classes"
            onPressCta={() => router.replace("/(learner)/map")}
            dismissText="Got it"
            onDismiss={handleDismissBookingsExplainCard}
          />
        ) : null}

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

              <Pressable onPress={() => loadBookings()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
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
});