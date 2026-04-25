import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
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
  getMyLearnerPrivateSessionRequests,
  type PrivateSessionRequest,
} from "@/src/api/privateSessionRequests";

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

  successBg: "rgba(80, 200, 120, 0.14)",
  successBorder: "rgba(80, 200, 120, 0.28)",

  warningBg: "rgba(255, 193, 7, 0.14)",
  warningBorder: "rgba(255, 193, 7, 0.24)",

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

  return (
    teacher.first_name?.trim() ||
    teacher.email?.trim() ||
    "Teacher"
  );
}

function getStatusMeta(status: PrivateSessionRequest["status"]) {
  switch (status) {
    case "OPEN":
      return { label: "Open", bg: COLORS.accentSoft, border: COLORS.accentBorder };
    case "ACCEPTED":
      return { label: "Accepted", bg: COLORS.successBg, border: COLORS.successBorder };
    case "DECLINED":
      return { label: "Declined", bg: COLORS.dangerBg, border: COLORS.dangerBorder };
    case "CANCELLED":
    case "EXPIRED":
      return { label: status, bg: COLORS.warningBg, border: COLORS.warningBorder };
    default:
      return { label: status, bg: COLORS.accentSoft, border: COLORS.accentBorder };
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

    router.push({
      pathname: "/(learner)/session/[id]",
      params: { id: item.accepted_session_id },
    });
  };

  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopTextWrap}>
            <Text style={styles.cardTitle}>{getTeacherName(item)}</Text>
            <Text style={styles.cardMeta}>
              Sent {formatDate(item.created_at)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
            ]}
          >
            <Text style={styles.statusBadgeText}>{statusMeta.label}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Your request</Text>
        <Text style={styles.cardBody}>{item.message}</Text>

        {!!item.learner_note?.trim() && (
          <>
            <Text style={styles.sectionLabel}>Extra note</Text>
            <Text style={styles.cardBody}>{item.learner_note.trim()}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>Requested duration</Text>
        <Text style={styles.cardBody}>
          {item.requested_duration_minutes || 60} minutes
        </Text>

        {requestedTimes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Suggested times</Text>
            <View style={styles.timesWrap}>
              {requestedTimes.map((timeLabel, index) => (
                <View key={`${item.id}-${index}`} style={styles.timePill}>
                  <Text style={styles.timePillText}>{timeLabel}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ✅ DECLINE MESSAGE */}
        {item.status === "DECLINED" && item.teacher_response_message?.trim() && (
          <>
            <Text style={styles.sectionLabel}>Teacher note</Text>
            <View style={styles.teacherNoteBox}>
              <Text style={styles.teacherNoteText}>
                {item.teacher_response_message.trim()}
              </Text>
            </View>
          </>
        )}

        {/* ✅ ACCEPTED STATE */}
        {item.status === "ACCEPTED" && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Accepted</Text>
              <Text style={styles.infoBoxText}>
                Your teacher created a private session for you.
              </Text>
            </View>

            {/* ✅ NEW: BOOK BUTTON */}
            {item.accepted_session_id && (
              <Pressable
                onPress={handleBook}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  Book session
                </Text>
              </Pressable>
            )}
          </>
        )}
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
        <View style={styles.screen}>
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
              <View style={styles.heroTopRow}>
                <View style={styles.heroTextWrap}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>Private 1:1</Text>
                  </View>

                  <Text style={styles.heroTitle}>My private requests</Text>
                  <Text style={styles.heroSubtitle}>
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
                <View style={styles.cardInnerCentered}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading requests…</Text>
                </View>
              </View>
            ) : error ? (
              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <Text style={styles.errorTitle}>Could not load requests</Text>
                  <Text style={styles.errorBody}>{error}</Text>

                  <Pressable
                    onPress={() => load()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              </View>
            ) : rows.length === 0 ? (
              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <Text style={styles.emptyTitle}>No private requests yet</Text>
                  <Text style={styles.emptyBody}>
                    Your requests will appear here.
                  </Text>
                </View>
              </View>
            ) : (
              rows.map((item) => <RequestCard key={item.id} item={item} />)
            )}
          </ScrollView>
        </View>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  hero: { marginBottom: 18 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between" },

  heroTextWrap: { flex: 1 },

  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  heroBadgeText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },
  heroTitle: { color: COLORS.text, fontSize: 30, fontWeight: "800" },
  heroSubtitle: { color: COLORS.textSoft },

  backButton: {
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: "center",
  },

  backButtonText: { color: COLORS.text },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  cardInnerCentered: { alignItems: "center", padding: 24 },

  cardTopRow: { flexDirection: "row", justifyContent: "space-between" },
  cardTopTextWrap: { flex: 1 },

  cardTitle: { color: COLORS.text, fontWeight: "800", fontSize: 18 },
  cardMeta: { color: COLORS.textMuted },

  statusBadge: { borderRadius: 999, padding: 6, borderWidth: 1 },
  statusBadgeText: { color: COLORS.text, fontWeight: "800" },

  sectionLabel: { color: COLORS.text, marginTop: 12, fontWeight: "800" },
  cardBody: { color: COLORS.textSoft },

  timesWrap: { gap: 8 },
  timePill: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 14,
    padding: 10,
  },

  timePillText: { color: COLORS.text },

  teacherNoteBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
    padding: 12,
  },

  teacherNoteText: { color: COLORS.text },

  infoBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    backgroundColor: COLORS.successBg,
    padding: 12,
  },

  infoBoxTitle: { color: COLORS.text, fontWeight: "800" },
  infoBoxText: { color: COLORS.textSoft },

  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    padding: 14,
    alignItems: "center",
  },

  primaryButtonText: { color: "#fff", fontWeight: "800" },

  retryButton: {
    marginTop: 10,
    backgroundColor: COLORS.accentSoft,
    padding: 12,
    borderRadius: 12,
  },

  retryButtonText: { color: COLORS.text, fontWeight: "800" },

  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800" },
  emptyBody: { color: COLORS.textSoft },

  errorTitle: { color: COLORS.text, fontWeight: "800" },
  errorBody: { color: COLORS.textSoft },

  loadingText: { color: COLORS.textSoft, marginTop: 10 },

  buttonPressed: { opacity: 0.86 },
});