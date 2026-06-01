import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../../src/api/client";
import { reportLearnerNoShow } from "../../../src/api/bookings";
import { getSessionBookings } from "../../../src/api/sessions";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { safePush } from "@/src/utils/safeRouter";

const COLORS = {
  bg: "#12051F",
  surface: "#241032",
  surfaceSoft: "#321447",
  surfaceDeep: "#0B0314",

  text: "#FDF7FF",
  textSoft: "rgba(244,229,255,0.76)",
  textMuted: "rgba(244,229,255,0.52)",

  border: "rgba(216,180,254,0.16)",
  borderStrong: "rgba(216,180,254,0.42)",

  accent: "#C084FC",
  accentStrong: "#A855F7",
  accentSoft: "rgba(192,132,252,0.18)",
  accentBorder: "rgba(216,180,254,0.38)",

  button: "#9333EA",
  buttonPressed: "#7E22CE",
  buttonSecondary: "#321447",

  teacherGlow: "rgba(168,85,247,0.22)",
  teacherCard: "#1B0829",
  teacherCardInner: "#100318",

  successBg: "rgba(81,207,102,0.12)",
  successBorder: "rgba(81,207,102,0.22)",
  successText: "#8CE99A",

  warningBg: "rgba(255,193,7,0.12)",
  warningBorder: "rgba(255,193,7,0.22)",
  warningText: "#FFD666",

  dangerBg: "rgba(255,107,107,0.12)",
  dangerBorder: "rgba(255,107,107,0.22)",
  dangerText: "#FFA8A8",

  infoBg: "rgba(192,132,252,0.14)",
  infoBorder: "rgba(216,180,254,0.28)",
  infoText: "#E9D5FF",

  neutralBg: "rgba(255,255,255,0.05)",
  neutralBorder: "rgba(255,255,255,0.08)",
  neutralText: "rgba(245,248,255,0.78)",

  divider: "rgba(255,255,255,0.07)",
};

type SessionBookingRow = {
  id: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED_BY_LEARNER"
    | "LATE_CANCELLED_BY_LEARNER"
    | "CANCELLED_BY_TEACHER"
    | "REFUND_PENDING"
    | "REFUNDED"
    | "DISPUTED"
    | "LEARNER_NO_SHOW"
    | "TEACHER_NO_SHOW"
    | "EXPIRED"
    | string;
  intro_message?: string | null;
  created_at: string;
  learner_id: string;
  learner_first_name: string;
};

type SessionDetails = {
  id: string;
  title: string;
  start_time: string;
  duration: number;
  max_participants: number;
  price: number;
  arrival_instructions?: string | null;
};

type SessionBookingsResponse = {
  session: SessionDetails | null;
  bookings: SessionBookingRow[];
};

function statusLabel(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "PENDING":
      return "Pending payment";
    case "CANCELLED_BY_LEARNER":
      return "Cancelled by learner";
      case "LATE_CANCELLED_BY_LEARNER":
  return "Late cancelled by learner";
    case "CANCELLED_BY_TEACHER":
      return "Cancelled by teacher";
    case "REFUND_PENDING":
      return "Refund in progress";
    case "REFUNDED":
      return "Refund completed";
    case "DISPUTED":
      return "Under review";
    case "LEARNER_NO_SHOW":
      return "Learner no-show";
    case "TEACHER_NO_SHOW":
      return "Teacher no-show";
    case "EXPIRED":
      return "Expired";
    default:
      return status || "Unknown";
  }
}

function getStatusStyles(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return {
        backgroundColor: COLORS.successBg,
        borderColor: COLORS.successBorder,
        textColor: COLORS.successText,
      };
    case "PENDING":
    case "REFUND_PENDING":
    case "DISPUTED":
      return {
        backgroundColor: COLORS.warningBg,
        borderColor: COLORS.warningBorder,
        textColor: COLORS.warningText,
      };
    case "CANCELLED_BY_LEARNER":
    case "CANCELLED_BY_TEACHER":
      case "LATE_CANCELLED_BY_LEARNER":
    case "LEARNER_NO_SHOW":
    case "TEACHER_NO_SHOW":
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
    case "EXPIRED":
    default:
      return {
        backgroundColor: COLORS.neutralBg,
        borderColor: COLORS.neutralBorder,
        textColor: COLORS.neutralText,
      };
  }
}

function getTeacherBookingStatusDescription(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return "This learner’s place is confirmed.";
    case "PENDING":
      return "This learner has started checkout but has not completed payment yet.";
    case "CANCELLED_BY_LEARNER":
      return "The learner cancelled this booking.";
      case "LATE_CANCELLED_BY_LEARNER":
  return "The learner cancelled less than 12 hours before the session. This remains eligible for teacher payout.";
    case "CANCELLED_BY_TEACHER":
      return "You cancelled this booking.";
    case "REFUND_PENDING":
      return "The learner’s refund is being processed.";
    case "REFUNDED":
      return "The learner’s refund has been completed.";
    case "DISPUTED":
      return "This booking is under admin review.";
    case "LEARNER_NO_SHOW":
      return "This learner no-show has been approved.";
    case "EXPIRED":
      return "This booking expired before payment was completed.";
    default:
      return null;
  }
}

export default function TeacherSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionBookingsResponse | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const [noShowModalVisible, setNoShowModalVisible] = useState(false);
  const [noShowBooking, setNoShowBooking] = useState<SessionBookingRow | null>(
    null,
  );
  const [noShowComment, setNoShowComment] = useState("");

  const loadSessionBookings = useCallback(async () => {
    const result = (await getSessionBookings(id!)) as SessionBookingsResponse;
    setData(result);
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const result = (await getSessionBookings(
          id!,
        )) as SessionBookingsResponse;

        if (!alive) return;
        setData(result);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        Alert.alert("Error", "Could not load session bookings.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const session = data?.session;
  const bookings: SessionBookingRow[] = data?.bookings ?? [];

  const canTeacherCancelBooking = useCallback(
    (bookingStatus?: string) => {
      if (!session?.start_time) return false;
      const isFutureSession = new Date(session.start_time).getTime() > Date.now();
      return bookingStatus === "CONFIRMED" && isFutureSession;
    },
    [session?.start_time],
  );

  function canReportLearnerNoShow(bookingStatus?: string) {
    if (!session?.start_time) return false;
    const hasStarted = new Date(session.start_time).getTime() < Date.now();
    return bookingStatus === "CONFIRMED" && hasStarted;
  }

  const handleCancelBooking = useCallback(
    (bookingId: string, learnerName?: string | null) => {
      Alert.alert(
        "Cancel learner booking",
        `Are you sure you want to cancel this booking${
          learnerName ? ` for ${learnerName}` : ""
        }?\n\nIf you cancel, the learner will lose their place and any eligible refund will be processed automatically.`,
        [
          { text: "Keep booking", style: "cancel" },
          {
            text: "Cancel booking",
            style: "destructive",
            onPress: async () => {
              try {
                setBusyBookingId(bookingId);

                await api.post(`/bookings/${bookingId}/cancel/teacher`);
                await loadSessionBookings();

                Alert.alert(
                  "Booking cancelled",
                  "The learner booking has been cancelled and any eligible refund will be processed automatically.",
                );
              } catch (e: any) {
                console.error(e);
                const message =
                  e?.response?.data?.message ??
                  e?.message ??
                  "Could not cancel booking.";

                Alert.alert(
                  "Cancel error",
                  Array.isArray(message) ? message.join("\n") : String(message),
                );
              } finally {
                setBusyBookingId(null);
              }
            },
          },
        ],
      );
    },
    [loadSessionBookings],
  );

  function openNoShowModal(booking: SessionBookingRow) {
    setNoShowBooking(booking);
    setNoShowComment("");
    setNoShowModalVisible(true);
  }

  async function submitLearnerNoShow() {
    if (!noShowBooking) return;

    try {
      setBusyBookingId(noShowBooking.id);

      await reportLearnerNoShow(
        noShowBooking.id,
        noShowComment.trim().slice(0, 200),
      );

      setNoShowModalVisible(false);
      setNoShowBooking(null);
      setNoShowComment("");

      await loadSessionBookings();

      Alert.alert(
        "Report submitted",
        "Your learner no-show report has been sent to admin for review.",
      );
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not report learner no-show.";

      Alert.alert(
        "Report failed",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setBusyBookingId(null);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Teacher mode</Text>
            </View>

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Session Bookings</Text>
                <Text style={styles.heroSubtitle}>
                  View learners booked into this session.
                </Text>
              </View>

              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => safePush(`/(teacher)/sessions/${id}/edit`)}
                  style={({ pressed }) => [
                    styles.topButton,
                    pressed && styles.topButtonPressed,
                  ]}
                >
                  <Text style={styles.topButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [
                    styles.topButton,
                    pressed && styles.topButtonPressed,
                  ]}
                >
                  <Text style={styles.topButtonText}>Back</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading bookings…</Text>
                </View>
              </View>
            </View>
          ) : !session ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <Text style={styles.cardTitle}>Session not found</Text>
                <Text style={styles.bodyText}>
                  This session could not be loaded.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <View style={styles.sessionHeaderRow}>
                    <View style={styles.sessionTitleWrap}>
                      <Text style={styles.cardTitle}>{session.title}</Text>
                      <Text style={styles.metaText}>
                        {new Date(session.start_time).toLocaleDateString()} ·{" "}
                        {new Date(session.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>€{session.price}</Text>
                    </View>
                  </View>

                  <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={COLORS.text}
                      />
                      <Text style={styles.chipText}>{session.duration} min</Text>
                    </View>

                    <View style={styles.chip}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={COLORS.text}
                      />
                      <Text style={styles.chipText}>
                        Max {session.max_participants}
                      </Text>
                    </View>

                    <View style={styles.chip}>
                      <Ionicons
                        name="ticket-outline"
                        size={14}
                        color={COLORS.text}
                      />
                      <Text style={styles.chipText}>
                        {bookings.length} booking
                        {bookings.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => safePush(`/(teacher)/sessions/${id}/edit`)}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Edit this session</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.warningCardOuter}>
                <View style={styles.cardInner}>
                  <View style={styles.noticeHeader}>
                    <Ionicons
                      name="warning-outline"
                      size={18}
                      color={COLORS.warningText}
                    />
                    <Text style={styles.warningTitle}>Cancellation policy</Text>
                  </View>

                  <Text style={styles.bodyText}>
                    If you cancel a confirmed learner booking, the learner will
                    lose their place immediately.
                  </Text>

                  <Text style={styles.bodyText}>
                    Teacher-initiated cancellations automatically trigger any
                    eligible refund for the learner.
                  </Text>

                  <Text style={styles.bodyText}>
                    After the session starts, use learner no-show reporting only
                    if the learner did not attend.
                  </Text>
                </View>
              </View>

              {bookings.length === 0 ? (
                <View style={styles.cardOuter}>
                  <View style={styles.cardInner}>
                    <Text style={styles.cardTitle}>No bookings yet</Text>
                    <Text style={styles.bodyText}>
                      Learners who book this session will appear here.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.bookingStack}>
                  {bookings.map((booking: SessionBookingRow) => {
                    const statusStyles = getStatusStyles(booking.status);
                    const showCancelButton = canTeacherCancelBooking(
                      booking.status,
                    );
                    const showNoShowButton = canReportLearnerNoShow(
                      booking.status,
                    );
                    const isBusy = busyBookingId === booking.id;
                    const statusDescription = getTeacherBookingStatusDescription(
                      booking.status,
                    );

                    return (
                      <View key={booking.id} style={styles.cardOuter}>
                        <View style={styles.cardInner}>
                          <View style={styles.bookingHeaderRow}>
                            <View style={styles.learnerAvatar}>
                              <Text style={styles.learnerAvatarText}>
                                {(booking.learner_first_name || "L")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </Text>
                            </View>

                            <View style={styles.bookingTextWrap}>
                              <Text style={styles.bookingName}>
                                {booking.learner_first_name || "Learner"}
                              </Text>

                              <Text style={styles.metaText}>
                                Booked{" "}
                                {new Date(booking.created_at).toLocaleString()}
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
                                {statusLabel(booking.status)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.messageBox}>
                            <Text style={styles.messageText}>
                              {booking.intro_message?.trim()
                                ? booking.intro_message
                                : "No intro message."}
                            </Text>
                          </View>

                          {statusDescription ? (
                            <View style={styles.statusDescriptionBox}>
                              <Text style={styles.bodyText}>
                                {statusDescription}
                              </Text>
                            </View>
                          ) : null}

                          {showCancelButton || showNoShowButton ? (
                            <View style={styles.bookingFooter}>
                              {showCancelButton ? (
                                <Pressable
                                  onPress={() =>
                                    handleCancelBooking(
                                      booking.id,
                                      booking.learner_first_name || null,
                                    )
                                  }
                                  disabled={isBusy}
                                  style={({ pressed }) => [
                                    styles.cancelButton,
                                    isBusy && styles.cancelButtonDisabled,
                                    pressed &&
                                      !isBusy &&
                                      styles.cancelButtonPressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.cancelButtonText,
                                      isBusy && styles.cancelButtonTextDisabled,
                                    ]}
                                  >
                                    {isBusy
                                      ? "Cancelling..."
                                      : "Cancel booking"}
                                  </Text>
                                </Pressable>
                              ) : null}

                              {showNoShowButton ? (
                                <Pressable
                                  onPress={() => openNoShowModal(booking)}
                                  disabled={isBusy}
                                  style={({ pressed }) => [
                                    styles.noShowButton,
                                    isBusy && styles.cancelButtonDisabled,
                                    pressed &&
                                      !isBusy &&
                                      styles.cancelButtonPressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.noShowButtonText,
                                      isBusy && styles.cancelButtonTextDisabled,
                                    ]}
                                  >
                                    {isBusy
                                      ? "Submitting..."
                                      : "Report learner no-show"}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={noShowModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoShowModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Report learner no-show</Text>

              <Text style={styles.modalBody}>
                Briefly explain what happened
                {noShowBooking?.learner_first_name
                  ? ` with ${noShowBooking.learner_first_name}`
                  : ""}
                . Admin will review this before payout is approved.
              </Text>

              <TextInput
                value={noShowComment}
                onChangeText={(text) => setNoShowComment(text.slice(0, 200))}
                placeholder="Example: I waited 15 minutes at the agreed spot."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={200}
                style={styles.modalInput}
              />

              <Text style={styles.characterCount}>
                {noShowComment.length}/200
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setNoShowModalVisible(false);
                    setNoShowBooking(null);
                    setNoShowComment("");
                  }}
                  style={styles.modalCancelButton}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={submitLearnerNoShow}
                  disabled={!noShowBooking || busyBookingId === noShowBooking.id}
                  style={styles.modalSubmitButton}
                >
                  <Text style={styles.modalSubmitText}>
                    {busyBookingId === noShowBooking?.id
                      ? "Submitting..."
                      : "Submit report"}
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
  content: {
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.accentStrong,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  cardOuter: {
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.teacherCard,
    marginBottom: 14,
    overflow: "hidden",
  },

  warningCardOuter: {
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.teacherCard,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.teacherCardInner,
    padding: 16,
  },

  topButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  messageBox: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    padding: 12,
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

  heroActions: {
    flexDirection: "row",
    gap: 8,
  },

  topButtonPressed: {
    opacity: 0.86,
  },

  topButtonText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },

  metaText: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  loadingText: {
    color: COLORS.textSoft,
    marginTop: 10,
  },

  sessionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  sessionTitleWrap: {
    flex: 1,
  },

  pricePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  pricePillText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  warningTitle: {
    color: COLORS.warningText,
    fontSize: 17,
    fontWeight: "900",
  },

  bookingStack: {
    gap: 0,
  },

  bookingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  learnerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  learnerAvatarText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },

  bookingTextWrap: {
    flex: 1,
  },

  bookingName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 3,
  },

  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "900",
  },

  messageText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  statusDescriptionBox: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.neutralBg,
    borderWidth: 1,
    borderColor: COLORS.neutralBorder,
    padding: 12,
  },

  bookingFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
  },

  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
  },

  cancelButtonPressed: {
    opacity: 0.86,
  },

  cancelButtonDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  cancelButtonText: {
    fontWeight: "900",
    color: COLORS.dangerText,
  },

  cancelButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  noShowButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
  },

  noShowButtonText: {
    fontWeight: "900",
    color: COLORS.warningText,
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
    backgroundColor: COLORS.teacherCardInner,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
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
    borderColor: COLORS.accentBorder,
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
});