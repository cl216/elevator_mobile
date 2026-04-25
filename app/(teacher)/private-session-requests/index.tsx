import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import {
  getMyTeacherPrivateSessionRequests,
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
};

type PrivateSessionRequestRow = PrivateSessionRequest;

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusTone(status: PrivateSessionRequestRow["status"]) {
  switch (status) {
    case "OPEN":
      return {
        bg: "rgba(111,146,255,0.12)",
        border: "rgba(111,146,255,0.25)",
        text: "#DCE7FF",
      };
    case "ACCEPTED":
      return {
        bg: "rgba(80,200,120,0.14)",
        border: "rgba(80,200,120,0.24)",
        text: "#B7F5C8",
      };
    case "DECLINED":
    case "CANCELLED":
    case "EXPIRED":
      return {
        bg: "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.10)",
        text: "#DDE6F7",
      };
    default:
      return {
        bg: "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.10)",
        text: "#DDE6F7",
      };
  }
}

export default function TeacherPrivateSessionRequestsScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PrivateSessionRequestRow[]>([]);

  async function load() {
    try {
      setLoading(true);
      const data = await getMyTeacherPrivateSessionRequests();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.status === "OPEN" && b.status !== "OPEN") return -1;
      if (a.status !== "OPEN" && b.status === "OPEN") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows]);

  const openCount = useMemo(
    () => rows.filter((item) => item.status === "OPEN").length,
    [rows],
  );

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Private 1:1</Text>
            </View>

            <Text style={styles.title}>Private session requests</Text>
            <Text style={styles.subtitle}>
              Review learner requests and turn accepted ones into paid private sessions.
            </Text>

            {!loading ? (
              <View style={styles.summaryPill}>
                <Text style={styles.summaryPillText}>
                  {openCount} open · {rows.length} total
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.card}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading requests…</Text>
            </View>
          ) : sortedRows.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No requests yet</Text>
              <Text style={styles.cardBody}>
                Learner private session requests will appear here.
              </Text>
            </View>
          ) : (
            sortedRows.map((item) => {
              const tone = getStatusTone(item.status);

              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push(`/(teacher)/private-session-requests/${item.id}`)
                  }
                  style={styles.card}
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>
                      {item.learner?.first_name?.trim() || "Learner"}
                    </Text>

                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: tone.bg,
                          borderColor: tone.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: tone.text }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.message}
                  </Text>

                  <View style={styles.metaStack}>
                    <Text style={styles.meta}>
                      Preferred duration: {item.requested_duration_minutes || 60} min
                    </Text>

                    {!!item.requested_date_1 && (
                      <Text style={styles.meta}>
                        First option: {formatDate(item.requested_date_1)}
                      </Text>
                    )}

                    <Text style={styles.meta}>
                      Requested: {formatDate(item.created_at)}
                    </Text>
                  </View>
                </Pressable>
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
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  badgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
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
    fontWeight: "800",
  },

  card: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    padding: 16,
    marginBottom: 14,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },

  cardBody: {
    color: COLORS.textSoft,
    lineHeight: 20,
    marginBottom: 10,
  },

  metaStack: {
    gap: 4,
  },

  meta: {
    color: COLORS.textMuted,
    fontSize: 13,
  },

  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },
});