import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import {
  approveSessionReview,
  getPendingReviewSessions,
  rejectSessionReview,
} from "@/src/api/sessions";

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
  successBg: "rgba(80,200,120,0.14)",
  successBorder: "rgba(80,200,120,0.28)",
  successText: "#B7F5C8",
  dangerBg: "rgba(255,107,107,0.12)",
  dangerBorder: "rgba(255,107,107,0.24)",
  dangerText: "#FFA8A8",
};

type PendingSession = {
  id: string;
  start_time: string;
  price: number | string;
  duration?: number;
  max_participants?: number;
  review_status?: string;
  title?: string;
  category?: string;
  description?: string;
  rough_location?: string;
  arrival_instructions?: string;
  image_urls?: string[];
  teacher_id?: string;
  teacher?: {
    email?: string;
    first_name?: string;
  };
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value?: number | string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "€0.00";
  return `€${n.toFixed(2)}`;
}

export default function AdminSessionReviewScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<PendingSession[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(() => rows.length, [rows]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await getPendingReviewSessions();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load pending sessions.";

      Alert.alert(
        "Review error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(session: PendingSession) {
    try {
      setBusyId(session.id);
      await approveSessionReview(session.id);
      await load("refresh");

      Alert.alert(
        "Approved",
        `"${session.title ?? "Session"}" is now live and the teacher has been notified.`,
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? e?.message ?? "Could not approve session.";

      Alert.alert(
        "Approve error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setBusyId(null);
    }
  }

  function confirmApprove(session: PendingSession) {
    Alert.alert(
      "Approve session?",
      `"${session.title ?? "Session"}" will go live and the teacher will be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => void handleApprove(session),
        },
      ],
    );
  }

  async function handleReject(session: PendingSession) {
    try {
      setBusyId(session.id);
      await rejectSessionReview(session.id);
      await load("refresh");

      Alert.alert(
        "Rejected",
        `"${session.title ?? "Session"}" was rejected and the teacher has been notified.`,
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? e?.message ?? "Could not reject session.";

      Alert.alert(
        "Reject error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setBusyId(null);
    }
  }

  function confirmReject(session: PendingSession) {
    Alert.alert(
      "Reject session?",
      `"${session.title ?? "Session"}" will be marked as rejected and the teacher will be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => void handleReject(session),
        },
      ],
    );
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={COLORS.accent}
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Admin</Text>
            </View>

            <Text style={styles.title}>Session review</Text>
            <Text style={styles.subtitle}>
              Approve or reject teacher sessions before they appear to learners.
            </Text>

            {!loading ? (
              <View style={styles.summaryPill}>
                <Text style={styles.summaryPillText}>
                  {pendingCount} pending
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.card}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading pending sessions…</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.card}>
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color={COLORS.successText}
              />
              <Text style={styles.cardTitle}>Nothing to review</Text>
              <Text style={styles.cardBody}>
                New sessions submitted by teachers will appear here.
              </Text>
            </View>
          ) : (
            rows.map((session) => {
              const isBusy = busyId === session.id;

              return (
                <View key={session.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIcon}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>

                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>
                        {session.title || "Untitled session"}
                      </Text>

                      <Text style={styles.cardBody}>
                        {session.category || "Category"} ·{" "}
                        {formatPrice(session.price)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.metaText}>
                    {formatDate(session.start_time)}
                  </Text>

                  <Text style={styles.detailText}>
                    Teacher:{" "}
                    {session.teacher?.email ?? session.teacher_id ?? "Unknown"}
                  </Text>

                  <Text style={styles.detailText}>
                    Duration: {session.duration ?? "?"} mins · Capacity:{" "}
                    {session.max_participants ?? "?"}
                  </Text>

                  <Text style={styles.detailText}>
                    Location: {session.rough_location || "No public location"}
                  </Text>

                  {session.description ? (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailBody}>
                        {session.description}
                      </Text>
                    </View>
                  ) : null}

                  {session.arrival_instructions ? (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>
                        Arrival instructions
                      </Text>
                      <Text style={styles.detailBody}>
                        {session.arrival_instructions}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.idText}>ID: {session.id}</Text>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => confirmApprove(session)}
                      disabled={isBusy || !!busyId}
                      style={[
                        styles.actionButton,
                        styles.approveButton,
                        (isBusy || !!busyId) && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.approveButtonText}>
                        {isBusy ? "Working..." : "Approve"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => confirmReject(session)}
                      disabled={isBusy || !!busyId}
                      style={[
                        styles.actionButton,
                        styles.rejectButton,
                        (isBusy || !!busyId) && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
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
    marginBottom: 18,
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    marginBottom: 12,
  },

  badgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },

  summaryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  summaryPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },

  card: {
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    padding: 16,
    marginBottom: 14,
  },

  cardTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTextWrap: {
    flex: 1,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 5,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  metaText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },

  detailText: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 5,
  },

  detailBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  detailLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  detailBody: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  idText: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  approveButton: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },

  approveButtonText: {
    color: COLORS.successText,
    fontWeight: "900",
  },

  rejectButton: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },

  rejectButtonText: {
    color: COLORS.dangerText,
    fontWeight: "900",
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  loadingText: {
    color: COLORS.textSoft,
    marginTop: 10,
  },
});