import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { safePush } from "@/src/utils/safeRouter";

import {
  getMyTeacherPrivateSessionRequests,
  type PrivateSessionRequest,
} from "@/src/api/privateSessionRequests";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

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

  successBg: "rgba(80,200,120,0.14)",
  successBorder: "rgba(80,200,120,0.26)",
  successText: "#B7F5C8",

  neutralBg: "rgba(255,255,255,0.06)",
  neutralBorder: "rgba(255,255,255,0.10)",
  neutralText: "rgba(244,229,255,0.78)",

  divider: "rgba(255,255,255,0.07)",
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
        bg: COLORS.accentSoft,
        border: COLORS.accentBorder,
        text: "#F3E8FF",
      };
    case "ACCEPTED":
      return {
        bg: COLORS.successBg,
        border: COLORS.successBorder,
        text: COLORS.successText,
      };
    case "DECLINED":
    case "CANCELLED":
    case "EXPIRED":
    default:
      return {
        bg: COLORS.neutralBg,
        border: COLORS.neutralBorder,
        text: COLORS.neutralText,
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Teacher mode</Text>
            </View>

            <Text style={styles.title}>Private requests</Text>
            <Text style={styles.subtitle}>
              Review learner 1:1 requests and turn accepted ones into paid
              private sessions.
            </Text>

            {!loading ? (
              <View style={styles.summaryPill}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.text} />
                <Text style={styles.summaryPillText}>
                  {openCount} open · {rows.length} total
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInnerCentered}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading requests…</Text>
              </View>
            </View>
          ) : sortedRows.length === 0 ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="mail-open-outline" size={22} color={COLORS.text} />
                </View>
                <Text style={styles.cardTitle}>No requests yet</Text>
                <Text style={styles.cardBody}>
                  Learner private session requests will appear here.
                </Text>
              </View>
            </View>
          ) : (
            sortedRows.map((item) => {
              const tone = getStatusTone(item.status);

              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    safePush(`/(teacher)/private-session-requests/${item.id}`)
                  }
                  style={({ pressed }) => [
                    styles.cardOuter,
                    pressed && styles.cardPressed,
                    item.status === "OPEN" && styles.cardOuterHighlight,
                  ]}
                >
                  <View style={styles.cardInner}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.requestIconCircle}>
                        <Ionicons
                          name={item.status === "OPEN" ? "mail-unread-outline" : "mail-outline"}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>
                          {item.learner?.first_name?.trim() || "Learner"}
                        </Text>
                        <Text style={styles.cardSubTitle}>Private 1:1 request</Text>
                      </View>

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
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.meta}>
                          Preferred duration: {item.requested_duration_minutes || 60} min
                        </Text>
                      </View>

                      {!!item.requested_date_1 && (
                        <View style={styles.metaRow}>
                          <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                          <Text style={styles.meta}>
                            First option: {formatDate(item.requested_date_1)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.metaRow}>
                        <Ionicons name="send-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.meta}>
                          Requested: {formatDate(item.created_at)}
                        </Text>
                      </View>
                    </View>
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
    flexGrow: 1,
  },

  hero: {
    marginBottom: 22,
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
    fontWeight: "900",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  summaryPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
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
    borderColor: "rgba(216,180,254,0.62)",
  },

  cardPressed: {
    opacity: 0.9,
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  cardInnerCentered: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  requestIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  cardTitleWrap: {
    flex: 1,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
  },

  cardSubTitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },

  metaStack: {
    gap: 7,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  meta: {
    color: COLORS.textMuted,
    fontSize: 13,
    flex: 1,
  },

  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "900",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },
});