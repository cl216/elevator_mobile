import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../../src/api/notifications";

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
  accentBorder: "rgba(111,146,255,0.25)",

  button: "#3F6AE0",
  buttonSecondary: "#121A2C",

  unreadDot: "#6F92FF",
  divider: "rgba(255,255,255,0.06)",
};

function formatDate(dateString?: string) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString();
}

function NotificationsCard({
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

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const rows = await getMyNotifications();
      setNotifications(rows);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load notifications.";

      setError(Array.isArray(message) ? message.join("\n") : String(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  async function handleMarkAllRead() {
    try {
      setMarkingRead(true);
      await markAllNotificationsRead();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read: true,
        })),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingRead(false);
    }
  }

  async function handleMarkOneRead(item: AppNotification) {
    if (item.read) return;

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === item.id
          ? { ...notification, read: true }
          : notification,
      ),
    );

    try {
      await markNotificationRead(item.id);
    } catch (e) {
      console.error(e);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === item.id
            ? { ...notification, read: false }
            : notification,
        ),
      );
    }
  }

  async function handleOpenNotification(item: AppNotification) {
    await handleMarkOneRead(item);

    const bookingId = item.payload?.booking_id;
    const sessionId = item.payload?.session_id;
    const type = item.type;

    if (type === "review_reminder") {
      if (bookingId) {
         safePush(`/(learner)/review/${bookingId}`);
        return;
      }

       safeReplace("/(learner)/bookings");
      return;
    }

    if (
      type === "booking_confirmed" ||
      type === "booking_cancelled_by_teacher" ||
      type === "refund_completed" ||
      type === "session_reminder_24h" ||
      type === "session_reminder_1h"
    ) {
      if (bookingId) {
         safePush(`/(learner)/booking/${bookingId}`);
        return;
      }

       safeReplace("/(learner)/bookings");
      return;
    }

    if (type === "private_session_request_declined") {
      return;
    }

    if (type === "private_session_request_accepted") {
      if (sessionId) {
         safePush(`/(modal)/session/${sessionId}`);
        return;
      }

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
         safeReplace(`/(teacher)/sessions/${sessionId}`);
        return;
      }

       safeReplace("/(teacher)/sessions");
      return;
    }

    if (sessionId) {
       safePush(`/(modal)/session/${sessionId}`);
    }
  }

  async function handleOpenMap(item: AppNotification) {
    await handleMarkOneRead(item);

    const sessionId = item.payload?.session_id;

    if (sessionId) {
       safePush({
        pathname: "/(learner)/map",
        params: {
          focusSessionId: String(sessionId),
        },
      });
    }
  }

  function renderTeacherResponseMessage(item: AppNotification) {
    const teacherResponseMessage = item.payload?.teacher_response_message;

    if (
      item.type !== "private_session_request_declined" ||
      !teacherResponseMessage
    ) {
      return null;
    }

    return (
      <View style={styles.teacherMessageBox}>
        <Text style={styles.teacherMessageLabel}>Teacher response</Text>
        <Text style={styles.teacherMessageText}>
          {String(teacherResponseMessage)}
        </Text>
      </View>
    );
  }

  function renderNotificationCard(item: AppNotification) {
    const hasSession = !!item.payload?.session_id;
    const isPrivateRequestAccepted =
      item.type === "private_session_request_accepted";
    const isPrivateRequestDeclined =
      item.type === "private_session_request_declined";

    return (
      <NotificationsCard
        key={item.id}
        icon={item.read ? "notifications-outline" : "mail-unread-outline"}
        title={item.title}
        subtitle={formatDate(item.created_at)}
        highlight={!item.read}
      >
        <Pressable
          onPress={() => void handleOpenNotification(item)}
          disabled={isPrivateRequestDeclined}
        >
          <View style={styles.notificationBodyWrap}>
            <View style={styles.notificationTitleRow}>
              <View style={styles.notificationTitleTextWrap}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationBody}>{item.body}</Text>
              </View>

              {!item.read ? <View style={styles.unreadDot} /> : null}
            </View>
          </View>
        </Pressable>

        {renderTeacherResponseMessage(item)}

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>

          {hasSession ? (
            <View style={styles.cardFooterActions}>
              <Pressable
                onPress={() => void handleOpenMap(item)}
                style={({ pressed }) => [
                  styles.secondaryPill,
                  pressed && styles.secondaryPillPressed,
                ]}
              >
                <Text style={styles.secondaryPillText}>📍 Map</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleOpenNotification(item)}
                style={({ pressed }) => [
                  styles.secondaryPill,
                  pressed && styles.secondaryPillPressed,
                ]}
              >
                <Text style={styles.secondaryPillText}>Open</Text>
              </Pressable>
            </View>
          ) : isPrivateRequestAccepted ? (
            <Pressable
              onPress={() => void handleOpenNotification(item)}
              style={({ pressed }) => [
                styles.secondaryPill,
                pressed && styles.secondaryPillPressed,
              ]}
            >
              <Text style={styles.secondaryPillText}>Open session</Text>
            </Pressable>
          ) : isPrivateRequestDeclined ? (
            <View style={styles.inlineStatusPill}>
              <Text style={styles.inlineStatusPillText}>Viewed here</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => void handleOpenNotification(item)}
              style={({ pressed }) => [
                styles.secondaryPill,
                pressed && styles.secondaryPillPressed,
              ]}
            >
              <Text style={styles.secondaryPillText}>Open</Text>
            </Pressable>
          )}
        </View>
      </NotificationsCard>
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
                onRefresh={() => loadNotifications(true)}
                tintColor="#FFFFFF"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Notifications</Text>
              </View>

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>Notifications</Text>
                  <Text style={styles.heroSubtitle}>
                    Updates about your bookings, sessions, and private requests.
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.backButtonPressed,
                  ]}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              </View>
            </View>

            {!loading && !error && notifications.length > 0 ? (
              <View style={styles.topRow}>
                <Text style={styles.unreadCountText}>{unreadCount} unread</Text>

                <Pressable
                  onPress={handleMarkAllRead}
                  disabled={markingRead || unreadCount === 0}
                  style={({ pressed }) => [
                    styles.markAllButton,
                    (markingRead || unreadCount === 0) &&
                      styles.markAllButtonDisabled,
                    pressed &&
                      !(markingRead || unreadCount === 0) &&
                      styles.markAllButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.markAllButtonText,
                      (markingRead || unreadCount === 0) &&
                        styles.markAllButtonTextDisabled,
                    ]}
                  >
                    {markingRead ? "Marking..." : "Mark all read"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {loading ? (
              <NotificationsCard
                icon="notifications-outline"
                title="Loading notifications"
                subtitle="Please wait a moment."
              >
                <View style={styles.loadingState}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingStateText}>
                    Loading notifications…
                  </Text>
                </View>
              </NotificationsCard>
            ) : error ? (
              <NotificationsCard
                icon="alert-circle-outline"
                title="Could not load notifications"
                subtitle="Something went wrong while loading updates."
              >
                <Text style={styles.errorBody}>{error}</Text>

                <Pressable
                  onPress={() => loadNotifications()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </Pressable>
              </NotificationsCard>
            ) : notifications.length === 0 ? (
              <NotificationsCard
                icon="notifications-off-outline"
                title="No notifications yet"
                subtitle="Booking updates and important activity will appear here."
              >
                <Text style={styles.emptySubtitle}>
                  You are all caught up for now.
                </Text>
              </NotificationsCard>
            ) : (
              notifications.map(renderNotificationCard)
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
    borderColor: COLORS.accentBorder,
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

  backButtonPressed: {
    opacity: 0.86,
  },

  backButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  topRow: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  unreadCountText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  markAllButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  markAllButtonPressed: {
    opacity: 0.86,
  },

  markAllButtonDisabled: {
    borderColor: COLORS.border,
  },

  markAllButtonText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  markAllButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardOuterHighlight: {
    borderColor: "rgba(111,146,255,0.36)",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
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
    backgroundColor: "rgba(111,146,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.28)",
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
    fontWeight: "800",
    marginBottom: 4,
  },

  cardShellSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  notificationBodyWrap: {
    marginTop: -2,
  },

  notificationTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  notificationTitleTextWrap: {
    flex: 1,
  },

  notificationTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
  },

  notificationBody: {
    marginTop: 6,
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.unreadDot,
    marginTop: 4,
  },

  teacherMessageBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    padding: 12,
  },

  teacherMessageLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },

  teacherMessageText: {
    color: COLORS.text,
    lineHeight: 20,
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
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceSoft,
  },

  secondaryPillPressed: {
    opacity: 0.86,
  },

  secondaryPillText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  inlineStatusPill: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.accentSoft,
  },

  inlineStatusPillText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },

  primaryButtonPressed: {
    opacity: 0.86,
  },

  primaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  loadingState: {
    paddingTop: 8,
    alignItems: "center",
  },

  loadingStateText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },

  errorBody: {
    color: COLORS.textSoft,
    lineHeight: 20,
    marginBottom: 14,
  },

  emptySubtitle: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },
});