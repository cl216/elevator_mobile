import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getMyLearnerPrivateSessionRequests,
  type PrivateSessionRequest,
} from "@/src/api/privateSessionRequests";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { safePush } from "@/src/utils/safeRouter";

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

  success: "rgba(80, 200, 120, 0.18)",
  successBorder: "rgba(80,200,120,0.28)",

  warning: "rgba(255,255,255,0.10)",
  warningBorder: "rgba(110,145,255,0.28)",

  dangerBg: "rgba(255, 107, 107, 0.14)",
  dangerBorder: "rgba(255, 107, 107, 0.24)",

  divider: "rgba(255,255,255,0.06)",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function getTeacherName(request: PrivateSessionRequest) {
  const teacher = request.teacher;
  if (!teacher) return "Teacher";

  return teacher.first_name?.trim() || teacher.email?.trim() || "Teacher";
}

function getStatusMeta(status: PrivateSessionRequest["status"]) {
  switch (status) {
    case "OPEN":
      return {
        label: "Open",
        bg: COLORS.accentSoft,
        border: COLORS.accentBorder,
      };
    case "ACCEPTED":
      return {
        label: "Accepted",
        bg: COLORS.success,
        border: COLORS.successBorder,
      };
    case "DECLINED":
      return {
        label: "Declined",
        bg: COLORS.dangerBg,
        border: COLORS.dangerBorder,
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        bg: COLORS.warning,
        border: COLORS.warningBorder,
      };
    case "EXPIRED":
      return {
        label: "Expired",
        bg: COLORS.warning,
        border: COLORS.warningBorder,
      };
    default:
      return {
        label: String(status),
        bg: COLORS.accentSoft,
        border: COLORS.accentBorder,
      };
  }
}

function RequestCard({ item }: { item: PrivateSessionRequest }) {
  const statusMeta = getStatusMeta(item.status);

  const requestedTimes = useMemo(
    () =>
      [item.requested_date_1, item.requested_date_2, item.requested_date_3]
        .filter(Boolean)
        .map((value) => formatDate(value)),
    [item.requested_date_1, item.requested_date_2, item.requested_date_3],
  );

  const handleBook = () => {
    if (!item.accepted_session_id) return;

    safePush({
      pathname: "/(modal)/session/[id]",
      params: { id: item.accepted_session_id },
    });
  };

  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
          </View>

          <View style={styles.cardHeaderTextWrap}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.sectionTitle}>{getTeacherName(item)}</Text>
              <Text style={styles.cardMeta}>Sent {formatDate(item.created_at)}</Text>
            </View>

            <View
              style={[
                styles.metaBadge,
                {
                  backgroundColor: statusMeta.bg,
                  borderColor: statusMeta.border,
                },
              ]}
            >
              <Text style={styles.metaBadgeText}>{statusMeta.label}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.subheading}>Your request</Text>
        <Text style={styles.bodyText}>{item.message}</Text>

        {!!item.learner_note?.trim() ? (
          <View style={styles.listBlock}>
            <Text style={styles.subheading}>Extra note</Text>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>{item.learner_note.trim()}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.listBlock}>
          <Text style={styles.subheading}>Requested duration</Text>
          <View style={styles.listRow}>
            <Text style={styles.listLabel}>
              {item.requested_duration_minutes || 60} minutes
            </Text>
          </View>
        </View>

        {requestedTimes.length > 0 ? (
          <View style={styles.listBlock}>
            <Text style={styles.subheading}>Suggested times</Text>
            <View style={styles.listWrap}>
              {requestedTimes.map((timeLabel, index) => (
                <View key={`${item.id}-${index}`} style={styles.listRow}>
                  <Text style={styles.listLabel}>{timeLabel}</Text>
                  <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {item.status === "DECLINED" && item.teacher_response_message?.trim() ? (
          <View style={styles.teacherNoteBox}>
            <Text style={styles.teacherNoteTitle}>Teacher note</Text>
            <Text style={styles.teacherNoteText}>
              {item.teacher_response_message.trim()}
            </Text>
          </View>
        ) : null}

        {item.status === "ACCEPTED" ? (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Accepted</Text>
              <Text style={styles.infoBoxText}>
                Your teacher created a private session for you.
              </Text>
            </View>

            {item.accepted_session_id ? (
              <Pressable
                onPress={handleBook}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Book session</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function LearnerPrivateSessionRequestsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<PrivateSessionRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const data = await getMyLearnerPrivateSessionRequests();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load private session requests.";

      setError(Array.isArray(message) ? message.join("\n") : String(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#FFFFFF"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Private 1:1</Text>
            </View>

            <View style={styles.heroTitleRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.title}>My private requests</Text>
                <Text style={styles.subtitle}>
                  Track your requests, statuses, and teacher responses.
                </Text>
              </View>

              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading requests…</Text>
                </View>
              </View>
            </View>
          ) : error ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.sectionTitle}>Could not load requests</Text>
                </View>

                <Text style={styles.bodyText}>{error}</Text>

                <Pressable
                  onPress={() => load()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Try again</Text>
                </Pressable>
              </View>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="mail-open-outline" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.sectionTitle}>No private requests yet</Text>
                </View>

                <Text style={styles.bodyText}>Your requests will appear here.</Text>
              </View>
            </View>
          ) : (
            rows.map((item) => <RequestCard key={item.id} item={item} />)
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

  heroTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  heroTextWrap: {
    flex: 1,
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
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
    overflow: "hidden",
    padding: 16,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardHeaderCopy: {
    flex: 1,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },

  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 3,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },

  metaBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },

  metaBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  subheading: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  listBlock: {
    marginTop: 4,
    marginBottom: 14,
  },

  listWrap: {
    gap: 8,
  },

  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  listLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },

  teacherNoteBox: {
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
    padding: 12,
  },

  teacherNoteTitle: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 6,
  },

  teacherNoteText: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  infoBox: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    backgroundColor: COLORS.success,
    padding: 12,
  },

  infoBoxTitle: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 4,
  },

  infoBoxText: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  primaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  loadingText: {
    color: COLORS.textSoft,
    fontSize: 14,
    marginTop: 10,
  },

  buttonPressed: {
    opacity: 0.86,
  },
});