import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import {
  cancelSession,
  duplicateSession,
  getMySessions,
} from "../../../src/api/sessions";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#05070F",

  teacherPanel: "#1A0627",
  teacherPanelSoft: "#250B38",
  teacherPanelDeep: "#100018",

  surface: "#170A24",
  surfaceSoft: "#211033",

  text: "#F5F8FF",
  textSoft: "rgba(235,220,255,0.76)",
  textMuted: "rgba(235,220,255,0.54)",

  border: "rgba(168,85,247,0.16)",
  borderStrong: "rgba(168,85,247,0.42)",

  accent: "#A855F7",
  accentStrong: "#C084FC",
  accentSoft: "rgba(168,85,247,0.16)",
  accentBorder: "rgba(168,85,247,0.34)",

  button: "#7C3AED",
  buttonPressed: "#6D28D9",
  buttonSecondary: "#211033",

  successBg: "rgba(81, 207, 102, 0.12)",
  successBorder: "rgba(81, 207, 102, 0.22)",
  successText: "#8CE99A",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",
  warningText: "#FFD666",

  dangerBg: "rgba(255, 107, 107, 0.12)",
  dangerBorder: "rgba(255, 107, 107, 0.22)",
  dangerText: "#FFA8A8",

  infoBg: "rgba(168,85,247,0.12)",
  infoBorder: "rgba(168,85,247,0.22)",
  infoText: "#E9D5FF",

  neutralBg: "rgba(255,255,255,0.05)",
  neutralBorder: "rgba(255,255,255,0.08)",
  neutralText: "rgba(245,248,255,0.78)",

  divider: "rgba(255,255,255,0.06)",
};

type TeacherSession = {
  id: string;
  start_time: string;
  end_time: string;
  duration: number;
  max_participants: number;
  price: number;
  rough_location?: string | null;
  title: string;
  category: string;
  bookings_count: string | number;
  status?: "ACTIVE" | "CANCELLED" | string;
  review_status?: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | string;
  cancelled_at?: string | null;
};

function isPastSession(startTime: string) {
  return new Date(startTime).getTime() < Date.now();
}

function needsAttendanceConfirmation(session: TeacherSession) {
  const start = new Date(session.start_time).getTime();
  const now = Date.now();

  if (Number.isNaN(start)) return false;

  return (
    session.status === "ACTIVE" &&
    Number(session.bookings_count ?? 0) > 0 &&
    now >= start + 15 * 60 * 1000 &&
    now <= start + 24 * 60 * 60 * 1000
  );
}

function formatSessionDate(startTime: string) {
  const start = new Date(startTime);

  return `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatCancelledDate(cancelledAt?: string | null) {
  if (!cancelledAt) return "Cancelled";

  const date = new Date(cancelledAt);
  return `Cancelled ${date.toLocaleDateString()} · ${date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}

function SessionsCard({
  icon,
  title,
  subtitle,
  children,
  highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.cardOuter, highlight && styles.cardOuterHighlight]}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeaderRowShell}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>

          <View style={styles.cardHeaderTextWrapShell}>
            <View style={styles.cardHeaderCopyShell}>
              <Text style={styles.cardShellTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.cardShellSubtitle}>{subtitle}</Text>
              ) : null}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </View>
        </View>

        {children}
      </View>
    </View>
  );
}

export default function TeacherSessionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [stripeBlocked, setStripeBlocked] = useState(false);
  const [stripeBlockedMessage, setStripeBlockedMessage] = useState("");

  const [repeatTargetSession, setRepeatTargetSession] =
    useState<TeacherSession | null>(null);
  const [repeatDateTime, setRepeatDateTime] = useState<Date>(new Date());
  const [showRepeatDatePicker, setShowRepeatDatePicker] = useState(false);
  const [showRepeatTimePicker, setShowRepeatTimePicker] = useState(false);

  const loadSessions = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        setStripeBlocked(false);
        setStripeBlockedMessage("");

        const data = await getMySessions();
        const rows = Array.isArray(data) ? data : [];

        const normalizedSessions: TeacherSession[] = rows.map((item: any) => ({
          ...item,
          end_time: item.end_time ?? item.start_time,
        }));

        setSessions(normalizedSessions);
      } catch (e: any) {
        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Could not load your sessions.";

        if (e?.response?.status === 403) {
          setStripeBlocked(true);
          setStripeBlockedMessage(
            Array.isArray(message) ? message.join("\n") : String(message),
          );
          return;
        }

        Alert.alert(
          "Error",
          Array.isArray(message) ? message.join("\n") : String(message),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleCancel(sessionId: string) {
    Alert.alert(
      "Cancel session",
      "Are you sure you want to cancel this session? It will be removed from the learner map and marked as cancelled instead of being deleted.",
      [
        { text: "Keep session", style: "cancel" },
        {
          text: "Cancel session",
          style: "destructive",
          onPress: async () => {
            try {
              setBusySessionId(sessionId);
              await cancelSession(sessionId);
              await loadSessions();
              Alert.alert("Cancelled", "Session cancelled successfully.");
            } catch (e: any) {
              const message =
                e?.response?.data?.message ??
                e?.message ??
                "Could not cancel session.";

              Alert.alert(
                "Cancel error",
                Array.isArray(message) ? message.join("\n") : String(message),
              );
            } finally {
              setBusySessionId(null);
            }
          },
        },
      ],
    );
  }

  function handleOpenRepeatPicker(session: TeacherSession) {
    const base = new Date(session.start_time);
    const next = new Date(base);
    next.setDate(next.getDate() + 7);

    if (next.getTime() <= Date.now()) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      fallback.setSeconds(0, 0);
      next.setFullYear(
        fallback.getFullYear(),
        fallback.getMonth(),
        fallback.getDate(),
      );
    }

    setRepeatTargetSession(session);
    setRepeatDateTime(next);
    setShowRepeatDatePicker(false);
    setShowRepeatTimePicker(false);
  }

  function closeRepeatModal() {
    setRepeatTargetSession(null);
    setShowRepeatDatePicker(false);
    setShowRepeatTimePicker(false);
  }

  async function handleConfirmRepeat() {
    if (!repeatTargetSession) return;

    if (repeatDateTime.getTime() <= Date.now()) {
      Alert.alert(
        "Invalid time",
        "Please choose a future date and time for the repeated session.",
      );
      return;
    }

    try {
      setBusySessionId(repeatTargetSession.id);

      await duplicateSession(
        repeatTargetSession.id,
        repeatDateTime.toISOString(),
      );

      closeRepeatModal();

      await loadSessions();

      Alert.alert(
        "Submitted for review",
        "Your repeated session was submitted for approval before going live.",
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not duplicate session.";

      Alert.alert(
        "Repeat error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setBusySessionId(null);
    }
  }

  const upcomingSessions = useMemo(() => {
    return [...sessions]
      .filter(
        (session) =>
          session.status !== "CANCELLED" && !isPastSession(session.start_time),
      )
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [sessions]);

  const pastSessions = useMemo(() => {
    return [...sessions]
      .filter(
        (session) =>
          session.status !== "CANCELLED" && isPastSession(session.start_time),
      )
      .sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      );
  }, [sessions]);

  const cancelledSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => session.status === "CANCELLED")
      .sort(
        (a, b) =>
          new Date(b.cancelled_at || b.start_time).getTime() -
          new Date(a.cancelled_at || a.start_time).getTime(),
      );
  }, [sessions]);

  const formattedRepeatDate = useMemo(() => {
    return repeatDateTime.toLocaleDateString([], {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [repeatDateTime]);

  const formattedRepeatTime = useMemo(() => {
    return repeatDateTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [repeatDateTime]);

  function renderEmptySection(
    title: string,
    subtitle: string,
    showCreateButton = false,
  ) {
    return (
      <SessionsCard
        icon="calendar-clear-outline"
        title={title}
        subtitle={subtitle}
      >
        {showCreateButton ? (
          <Pressable
            onPress={() => safePush("/(teacher)/sessions/create")}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Create session</Text>
          </Pressable>
        ) : null}
      </SessionsCard>
    );
  }

  function renderSessionCard(
    session: TeacherSession,
    section: "upcoming" | "past" | "cancelled",
  ) {
    const bookingsCount = Number(session.bookings_count ?? 0);
    const spotsLeft = Math.max(
      0,
      Number(session.max_participants) - bookingsCount,
    );
    const isBusy = busySessionId === session.id;
    const attendanceNeeded = needsAttendanceConfirmation(session);

    return (
      <SessionsCard
        key={session.id}
        icon={
          attendanceNeeded
            ? "alert-circle-outline"
            : section === "upcoming"
              ? "calendar-outline"
              : section === "past"
                ? "time-outline"
                : "close-circle-outline"
        }
        title={session.title}
        subtitle={`${session.category} · €${session.price}`}
        highlight={!isBusy && (section === "upcoming" || attendanceNeeded)}
      >
        <Text style={styles.sessionMetaPrimary}>
          {formatSessionDate(session.start_time)}
        </Text>

        {session.rough_location ? (
          <Text style={styles.sessionMetaSecondary}>
            {session.rough_location}
          </Text>
        ) : null}

        <Text style={styles.sessionMetaSecondary}>
          {session.duration} min · Max {session.max_participants}
        </Text>

        <Text style={styles.sessionStats}>
          {bookingsCount} booking{bookingsCount === 1 ? "" : "s"}
          {section === "upcoming"
            ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
            : ""}
        </Text>

        {session.review_status === "PENDING_REVIEW" ? (
          <View style={styles.pendingReviewPill}>
            <Text style={styles.pendingReviewPillText}>Pending review</Text>
          </View>
        ) : null}

        {attendanceNeeded ? (
          <View style={styles.attendanceBox}>
            <View style={styles.attendanceHeaderRow}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.warningText}
              />

              <Text style={styles.attendanceTitle}>
                Attendance check needed
              </Text>
            </View>

            <Text style={styles.attendanceBody}>
              This session has started. Open it to confirm attendance or report
              a learner no-show within 24 hours.
            </Text>

            <Pressable
              onPress={() => safePush(`/(teacher)/sessions/${session.id}`)}
              style={styles.attendanceButton}
            >
              <Text style={styles.attendanceButtonText}>
                Review attendance
              </Text>
            </Pressable>
          </View>
        ) : null}

        {section === "cancelled" ? (
          <View style={[styles.statusPill, styles.statusPillDanger]}>
            <Text style={[styles.statusPillText, styles.statusPillTextDanger]}>
              {formatCancelledDate(session.cancelled_at)}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {attendanceNeeded
              ? "Action may be needed for learner attendance."
              : section === "cancelled"
                ? "This session is no longer bookable."
                : section === "past"
                  ? "Use repeat to create a new copy quickly."
                  : "Manage this live session and view learner bookings."}
          </Text>

          <View style={styles.cardFooterActions}>
            <Pressable
              onPress={() => safePush(`/(teacher)/sessions/${session.id}`)}
              style={({ pressed }) => [
                attendanceNeeded ? styles.attendancePill : styles.secondaryPill,
                pressed && styles.secondaryPillPressed,
              ]}
            >
              <Text
                style={
                  attendanceNeeded
                    ? styles.attendancePillText
                    : styles.secondaryPillText
                }
              >
                {attendanceNeeded ? "Review attendance" : "Open"}
              </Text>
            </Pressable>

            {section === "upcoming" ? (
              <>
                <Pressable
                  onPress={() =>
                    safePush(`/(teacher)/sessions/${session.id}/edit`)
                  }
                  style={({ pressed }) => [
                    styles.secondaryPill,
                    pressed && styles.secondaryPillPressed,
                  ]}
                >
                  <Text style={styles.secondaryPillText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleCancel(session.id)}
                  disabled={isBusy}
                  style={({ pressed }) => [
                    styles.secondaryPill,
                    styles.dangerPill,
                    isBusy && styles.dangerPillDisabled,
                    pressed && !isBusy && styles.secondaryPillPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dangerPillText,
                      isBusy && styles.dangerPillTextDisabled,
                    ]}
                  >
                    {isBusy ? "Working..." : "Cancel"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => handleOpenRepeatPicker(session)}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.secondaryPill,
                  pressed && !isBusy && styles.secondaryPillPressed,
                ]}
              >
                <Text style={styles.secondaryPillText}>
                  {isBusy
                    ? "Working..."
                    : section === "past"
                      ? "Repeat"
                      : "Create copy"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </SessionsCard>
    );
  }

  const emptyState = useMemo(
    () => (
      <SessionsCard
        icon="calendar-clear-outline"
        title="No sessions yet"
        subtitle="Create your first session to start appearing on the map and accepting bookings."
      >
        <Pressable
          onPress={() => safePush("/(teacher)/sessions/create")}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Create session</Text>
        </Pressable>
      </SessionsCard>
    ),
    [],
  );

  return (
    <AppLayout>
      <AppScreen>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadSessions("refresh")}
                tintColor={COLORS.accent}
              />
            }
          >
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Teacher workspace</Text>
              </View>

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>My sessions</Text>
                  <Text style={styles.heroSubtitle}>
                    Create, repeat, and manage your bookable sessions.
                  </Text>
                </View>

                {!stripeBlocked ? (
                  <Pressable
                    onPress={() => safePush("/(teacher)/sessions/create")}
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.backButtonPressed,
                    ]}
                  >
                    <Text style={styles.backButtonText}>New</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {loading ? (
              <SessionsCard
                icon="calendar-outline"
                title="Loading sessions"
                subtitle="Please wait a moment."
              >
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading sessions…</Text>
                </View>
              </SessionsCard>
            ) : stripeBlocked ? (
              <SessionsCard
                icon="alert-circle-outline"
                title="Finish Stripe setup"
                subtitle={
                  stripeBlockedMessage ||
                  "You need to complete Stripe onboarding before creating and managing paid sessions."
                }
              >
                <Pressable
                  onPress={() => safeReplace("/(teacher)/dashboard")}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    Continue Stripe setup
                  </Text>
                </Pressable>
              </SessionsCard>
            ) : sessions.length === 0 ? (
              emptyState
            ) : (
              <>
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Upcoming</Text>

                  {upcomingSessions.length === 0
                    ? renderEmptySection(
                        "No upcoming sessions",
                        "Create a new session to start taking bookings.",
                        true,
                      )
                    : upcomingSessions.map((session) =>
                        renderSessionCard(session, "upcoming"),
                      )}
                </View>

                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Past</Text>

                  {pastSessions.length === 0
                    ? renderEmptySection(
                        "No past sessions yet",
                        "When you’ve run sessions before, they’ll appear here so you can repeat them quickly.",
                      )
                    : pastSessions.map((session) =>
                        renderSessionCard(session, "past"),
                      )}
                </View>

                <View style={styles.sectionWrapLast}>
                  <Text style={styles.sectionHeading}>Cancelled</Text>

                  {cancelledSessions.length === 0
                    ? renderEmptySection(
                        "No cancelled sessions",
                        "Cancelled sessions stay here for history and reference.",
                      )
                    : cancelledSessions.map((session) =>
                        renderSessionCard(session, "cancelled"),
                      )}
                </View>
              </>
            )}
          </ScrollView>
        </View>

        <Modal
          transparent
          visible={!!repeatTargetSession}
          animationType="fade"
          onRequestClose={closeRepeatModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                </View>

                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Repeat session</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose a new date and time for this copied session.
                  </Text>
                </View>
              </View>

              {repeatTargetSession ? (
                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryTitle}>
                    {repeatTargetSession.title}
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    {repeatTargetSession.category} · €{repeatTargetSession.price}
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    Original: {formatSessionDate(repeatTargetSession.start_time)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.repeatPickerStack}>
                <Pressable
                  onPress={() => setShowRepeatDatePicker(true)}
                  style={({ pressed }) => [
                    styles.repeatPickerCard,
                    pressed && styles.secondaryPillPressed,
                  ]}
                >
                  <Text style={styles.repeatPickerLabel}>New date</Text>
                  <Text style={styles.repeatPickerValue}>
                    {formattedRepeatDate}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowRepeatTimePicker(true)}
                  style={({ pressed }) => [
                    styles.repeatPickerCard,
                    pressed && styles.secondaryPillPressed,
                  ]}
                >
                  <Text style={styles.repeatPickerLabel}>New time</Text>
                  <Text style={styles.repeatPickerValue}>
                    {formattedRepeatTime}
                  </Text>
                </Pressable>
              </View>

              {showRepeatDatePicker ? (
                <DateTimePicker
                  value={repeatDateTime}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    setShowRepeatDatePicker(Platform.OS === "ios");
                    if (!selected) return;

                    const next = new Date(repeatDateTime);
                    next.setFullYear(
                      selected.getFullYear(),
                      selected.getMonth(),
                      selected.getDate(),
                    );
                    setRepeatDateTime(next);
                  }}
                />
              ) : null}

              {showRepeatTimePicker ? (
                <DateTimePicker
                  value={repeatDateTime}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    setShowRepeatTimePicker(Platform.OS === "ios");
                    if (!selected) return;

                    const next = new Date(repeatDateTime);
                    next.setHours(
                      selected.getHours(),
                      selected.getMinutes(),
                      0,
                      0,
                    );
                    setRepeatDateTime(next);
                  }}
                />
              ) : null}

              <Text style={styles.modalHelperText}>
                The copied session will be submitted for review before going
                live.
              </Text>

              <Pressable
                onPress={handleConfirmRepeat}
                disabled={
                  !!repeatTargetSession &&
                  busySessionId === repeatTargetSession.id
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  !!repeatTargetSession &&
                    busySessionId === repeatTargetSession.id &&
                    styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {!!repeatTargetSession &&
                  busySessionId === repeatTargetSession.id
                    ? "Creating..."
                    : "Create copy"}
                </Text>
              </Pressable>

              <Pressable
                onPress={closeRepeatModal}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.secondaryPillPressed,
                ]}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentStrong,
    marginBottom: 12,
  },

  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
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
    fontWeight: "900",
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
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonPressed: {
    backgroundColor: "rgba(168,85,247,0.24)",
  },

  backButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  sectionWrap: {
    marginBottom: 28,
  },

  sectionWrapLast: {
    marginBottom: 0,
  },

  sectionHeading: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },

  cardOuter: {
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.teacherPanel,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardOuterHighlight: {
    borderColor: "rgba(192,132,252,0.58)",
    backgroundColor: COLORS.teacherPanelSoft,
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.teacherPanelDeep,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.12)",
  },

  cardHeaderRowShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(168,85,247,0.22)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.42)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardHeaderTextWrapShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardHeaderCopyShell: {
    flex: 1,
  },

  cardShellTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  cardShellSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  sessionMetaPrimary: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: -2,
    marginBottom: 8,
  },

  sessionMetaSecondary: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },

  sessionStats: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  statusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillDanger: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "900",
  },

  statusPillTextDanger: {
    color: COLORS.dangerText,
  },

  pendingReviewPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  pendingReviewPillText: {
    color: COLORS.warningText,
    fontSize: 12,
    fontWeight: "900",
  },

  attendanceBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  attendanceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  attendanceTitle: {
    color: COLORS.warningText,
    fontSize: 14,
    fontWeight: "900",
  },

  attendanceBody: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  attendanceButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  attendanceButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },

  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    flex: 1,
    minWidth: 140,
  },

  cardFooterActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  secondaryPill: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.accentSoft,
  },

  secondaryPillPressed: {
    opacity: 0.86,
  },

  secondaryPillText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  attendancePill: {
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.warningBg,
  },

  attendancePillText: {
    color: COLORS.warningText,
    fontWeight: "900",
  },

  dangerPill: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
  },

  dangerPillDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  dangerPillText: {
    color: COLORS.dangerText,
    fontWeight: "900",
  },

  dangerPillTextDisabled: {
    color: COLORS.textMuted,
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    borderWidth: 1,
    borderColor: COLORS.accentStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
  },

  primaryButtonDisabled: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  repeatPickerStack: {
    gap: 10,
  },

  repeatPickerCard: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 14,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },

  repeatPickerLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4,
  },

  repeatPickerValue: {
    color: COLORS.textSoft,
  },

  loadingWrap: {
    paddingTop: 8,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.teacherPanel,
    padding: 18,
  },

  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  modalHeaderText: {
    flex: 1,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },

  modalSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  modalSummaryBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.teacherPanelDeep,
    padding: 14,
    marginBottom: 14,
  },

  modalSummaryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  modalSummaryText: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  modalHelperText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 12,
  },

  modalCancelButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.buttonSecondary,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 10,
  },

  modalCancelButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
});