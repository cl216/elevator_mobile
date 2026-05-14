import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTeacherAttentionSummary,
  type TeacherAttentionSummary,
} from "@/src/api/teacherAttention";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { deleteAccount } from "@/src/api/auth";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { getNearbyTeacherDemand } from "../../src/api/classRequests";
import { api } from "../../src/api/client";
import { ExplainCard } from "../../src/components/ui/ExplainCard";
import { authStore } from "../../src/store/auth.store";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../src/utils/explainCard";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppButton } from "@/src/components/ui/AppButton";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#090313",
  surface: "#2A1242",
  surfaceSoft: "#35185A",
  surfaceDeep: "#12071E",

  text: "#FDF7FF",
  textSoft: "rgba(245,230,255,0.76)",
  textMuted: "rgba(245,230,255,0.52)",

  border: "rgba(216,180,254,0.18)",
  borderStrong: "rgba(216,180,254,0.42)",

  accent: "#C084FC",
  accentStrong: "#A855F7",
  accentSoft: "rgba(192,132,252,0.18)",
  accentBorder: "rgba(216,180,254,0.38)",

  button: "#9333EA",
  buttonPressed: "#7E22CE",
  buttonSecondary: "#35185A",

  successBg: "rgba(34,197,94,0.14)",
  successBorder: "rgba(34,197,94,0.28)",
successText: "#8CE99A",

  warningBg: "rgba(251,191,36,0.14)",
  warningBorder: "rgba(251,191,36,0.28)",
  warningText: "#FDE68A",

  dangerBg: "rgba(248,113,113,0.14)",
  dangerBorder: "rgba(248,113,113,0.28)",
  dangerText: "#FCA5A5",

  divider: "rgba(255,255,255,0.08)",
};

type StripeStatusResponse = {
  stripe_enabled?: boolean;
  stripe_account_id?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
};

type DemandCategory = {
  category: string;
  count: number;
};

type DemandIdea = {
  custom_title: string;
  count: number;
};

type DemandState = {
  existing_categories: DemandCategory[];
  custom_ideas: DemandIdea[];
};

function DashboardCard({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>

          <View style={styles.cardHeaderTextWrap}>
            <Text style={styles.sectionTitle}>{title}</Text>
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

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [attentionSummary, setAttentionSummary] =
  useState<TeacherAttentionSummary | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatusResponse | null>(
    null,
  );
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [showTeacherExplainCard, setShowTeacherExplainCard] = useState(false);
  const [demand, setDemand] = useState<DemandState>({
    existing_categories: [],
    custom_ideas: [],
  });

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setDashboardError(null);

const [stripeRes, demandRes, attentionRes] = await Promise.all([
  api.get("/teacher/stripe/status"),
  getNearbyTeacherDemand(),
  getTeacherAttentionSummary(),
]);

setStripeStatus(stripeRes.data);
setAttentionSummary(attentionRes);
      setDemand({
        existing_categories: Array.isArray(demandRes.existing_categories)
          ? demandRes.existing_categories
          : [],
        custom_ideas: Array.isArray(demandRes.custom_ideas)
          ? demandRes.custom_ideas
          : [],
      });
    } catch (e: any) {
      console.error(e);

      if (e?.response?.status === 429) {
        setDashboardError("Too many requests. Please wait a moment, then try again.");
        return;
      }

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load teacher dashboard.";

      setDashboardError(
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    (async () => {
      const seen = await hasSeenExplainCard("teacher-dashboard-intro");
      setShowTeacherExplainCard(!seen);
    })();
  }, []);

   ////FOR TESTING EXPLAINCARD
// useEffect(() => {
//   setShowTeacherExplainCard(true);
// }, []);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This will permanently delete:\n\n• Your profile\n• All sessions\n• All bookings\n• All messages and requests\n\nThis action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();

              await authStore.getState().clearAuthLocalOnly();
              safeReplace("/(auth)/login");
            } catch (e) {
              Alert.alert("Error", "Could not delete account.");
            }
          },
        },
      ]
    );
  };

  async function handleLogout() {
    await authStore.getState().logout();
    safeReplace("/(auth)/login");
  }

  async function handleStripeOnboarding() {
    try {
      setOnboardingLoading(true);

      const res = await api.post("/teacher/stripe/onboard");
      const onboardingUrl = res?.data?.url;

      if (!onboardingUrl) {
        throw new Error("Missing onboarding URL");
      }

      await Linking.openURL(onboardingUrl);
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not start Stripe onboarding.";

      Alert.alert(
        "Stripe onboarding",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setOnboardingLoading(false);
    }
  }

  //   useFocusEffect(
  //   useCallback(() => {
  //     const sub = BackHandler.addEventListener("hardwareBackPress", () => {
  //       safeReplace("/(learner)/map");
  //       return true;
  //     });

  //     return () => sub.remove();
  //   }, []),
  // );

  const handleDismissTeacherExplainCard = useCallback(async () => {
    await markExplainCardSeen("teacher-dashboard-intro");
    setShowTeacherExplainCard(false);
  }, []);

  const stripeReady =
    !!stripeStatus?.stripe_enabled &&
    !!stripeStatus?.charges_enabled &&
    !!stripeStatus?.payouts_enabled;

  const topExistingCategories = demand.existing_categories.slice(0, 5);
  const topCustomIdeas = demand.custom_ideas.slice(0, 5);

  const demandEmpty =
    demand.existing_categories.length === 0 && demand.custom_ideas.length === 0;

  const stripeStatusText = useMemo(() => {
    if (stripeReady) return "Ready";
    return "Action needed";
  }, [stripeReady]);

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

            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>
  Your teaching workspace for sessions, payouts, profile, and local demand.            </Text>
          </View>

          {loading ? (
            <DashboardCard icon="grid-outline" title="Dashboard">
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading dashboard…</Text>
              </View>
            </DashboardCard>
          ) : dashboardError ? (
            <DashboardCard icon="alert-circle-outline" title="Dashboard error">
              <Text style={styles.bodyText}>{dashboardError}</Text>
              <AppButton title="Try again" onPress={loadDashboard} />
            </DashboardCard>
          ) : (
            <>
{showTeacherExplainCard ? (
  <Modal transparent visible animationType="fade">
    <View style={styles.explainModalBackdrop}>
      <View style={styles.teacherExplainCard}>
        <View style={styles.teacherExplainTopIcon}>
          <Ionicons name="map-outline" size={28} color={COLORS.accent} />
        </View>

        <Text style={styles.teacherExplainTitle}>Simple teaching flow</Text>

        <View style={styles.teacherExplainBody}>
          <View style={styles.explainRow}>
            <View style={styles.explainIconCircle}>
              <Ionicons name="create-outline" size={22} color={COLORS.accent} />
            </View>

            <Text style={styles.explainText}>
              Create a session with{" "}
              <Text style={styles.explainStrong}>title, price, time</Text>, and
              location.
            </Text>
          </View>

          <View style={styles.explainDivider} />

          <View style={styles.explainRow}>
            <View style={styles.explainIconCircle}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.accent} />
            </View>

            <Text style={styles.explainText}>
              Learners only see{" "}
              <Text style={styles.explainStrong}>bookable sessions</Text> they
              can reserve in the app.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            setShowTeacherExplainCard(false);
            safePush("/(teacher)/sessions/create");
          }}
          style={styles.teacherExplainPrimaryButton}
        >
          <Text style={styles.teacherExplainPrimaryText}>Create session</Text>
        </Pressable>

        <Pressable
          onPress={handleDismissTeacherExplainCard}
          style={styles.teacherExplainSecondaryButton}
        >
          <Text style={styles.teacherExplainSecondaryText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
) : null}

<DashboardCard
  icon="notifications-outline"
  title="Needs attention"
>
  {attentionSummary?.items?.length ? (
    <>
      <Text style={styles.bodyText}>
        You have{" "}
        {attentionSummary.total_action_items} teaching item
        {attentionSummary.total_action_items === 1 ? "" : "s"}{" "}
        that may need review.
      </Text>

      <View style={styles.actionStack}>
        {attentionSummary.items.map((item) => (
          <AppButton
            key={item.type}
            title={`${item.count} • ${item.label}`}
            onPress={() => safePush(item.route as any)}
            variant="secondary"
          />
        ))}
      </View>
    </>
  ) : (
    <Text style={styles.bodyText}>
      Nothing urgent right now. Private requests,
      missing arrival instructions, and refund
      issues will appear here.
    </Text>
  )}
</DashboardCard>

              <DashboardCard icon="card-outline" title="Stripe payouts">
                <Text style={styles.bodyText}>
                  {stripeReady
                    ? "Your Stripe account is connected and ready to accept bookings and payouts."
                    : "Complete Stripe onboarding before creating sessions and receiving payouts."}
                </Text>

                <View
                  style={[
                    styles.metaBadge,
                    stripeReady
                      ? styles.metaBadgeSuccess
                      : styles.metaBadgeWarning,
                  ]}
                >
                  <Text style={styles.metaBadgeText}>
                    Status: {stripeStatusText}
                  </Text>
                </View>

                {!stripeReady ? (
                  <View style={styles.buttonTopGap}>
                    <AppButton
                      title={
                        onboardingLoading
                          ? "Opening Stripe..."
                          : "Continue Stripe onboarding"
                      }
                      onPress={handleStripeOnboarding}
                    />
                  </View>
                ) : null}
              </DashboardCard>

              <DashboardCard icon="calendar-outline" title="Sessions">
                <Text style={styles.bodyText}>
                  Create bookable sessions, manage upcoming ones, and duplicate
                  past ones quickly.
                </Text>

                <View style={styles.actionStack}>
                  <AppButton
                    title="My sessions"
                    onPress={() => safePush("/(teacher)/sessions")}
                  />
                  <AppButton
                    title="Create session"
                    onPress={() => safePush("/(teacher)/sessions/create")}
                    variant="secondary"
                  />
                </View>
              </DashboardCard>

              <DashboardCard
                icon="trending-up-outline"
                title="Learners near you want"
              >
                <Text style={styles.bodyText}>
                  Use nearby demand to decide what sessions to run next.
                </Text>

                {demandEmpty ? (
                  <>
                    <Text style={styles.bodyText}>
                      No nearby demand yet. Once learners start requesting
                      classes near your session areas, it will show here.
                    </Text>

                    <AppButton
                      title="Create session anyway"
                      onPress={() => safePush("/(teacher)/sessions/create")}
                    />
                  </>
                ) : (
                  <>
                    {topExistingCategories.length > 0 ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.subheading}>
                          Top requested categories
                        </Text>

                        <View style={styles.listWrap}>
                          {topExistingCategories.map((item) => (
                            <View key={item.category} style={styles.listRow}>
                              <Text style={styles.listLabel}>
                                {item.category}
                              </Text>
                              <Text style={styles.listValue}>{item.count}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {topCustomIdeas.length > 0 ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.subheading}>New class ideas</Text>

                        <View style={styles.listWrap}>
                          {topCustomIdeas.map((item) => (
                            <View key={item.custom_title} style={styles.listRow}>
                              <Text style={styles.listLabel}>
                                {item.custom_title}
                              </Text>
                              <Text style={styles.listValue}>{item.count}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.actionStack}>
                      <AppButton
                        title="Create session for this demand"
                        onPress={() => safePush("/(teacher)/sessions/create")}
                      />
                      <AppButton
                        title="Refresh demand"
                        onPress={loadDashboard}
                        variant="secondary"
                      />
                    </View>
                  </>
                )}
              </DashboardCard>

              <DashboardCard
                icon="chatbubble-ellipses-outline"
                title="Private 1:1 requests"
              >
                <Text style={styles.bodyText}>
                  Review structured learner requests for private sessions and
                  turn accepted ones into paid sessions in the app.
                </Text>

                <View style={styles.actionStack}>
                  <AppButton
                    title="View private requests"
                    onPress={() =>
                      safePush("/(teacher)/private-session-requests")
                    }
                  />
                </View>
              </DashboardCard>

              <DashboardCard icon="person-outline" title="Profile">
                <Text style={styles.bodyText}>
                  Add your bio, profile image, and teaching identity so learners
                  can trust and follow you.
                </Text>

                <AppButton
                  title="Edit profile"
                  onPress={() => safePush("/(teacher)/profile")}
                />
              </DashboardCard>


              <DashboardCard icon="trash-outline" title="Delete account">
                <Text style={styles.bodyText}>
                  Permanently delete your account and all associated data.
                </Text>

                <View style={{ marginTop: 10 }}>
                  <Pressable onPress={handleDeleteAccount} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Delete account</Text>
                  </Pressable>
                </View>
              </DashboardCard>

              <DashboardCard icon="settings-outline" title="Account">
                <Text style={styles.bodyText}>
                  Sign out of your teacher account securely.
                </Text>

                <AppButton
                  title="Logout"
                  onPress={handleLogout}
                  variant="secondary"
                />
              </DashboardCard>





            </>
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
  paddingHorizontal: 12,
  paddingVertical: 7,
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

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#8b000086",
    borderWidth: 1,
    borderColor: "#FF4D4D",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  explainWrap: {
    marginBottom: 12,
  },

cardOuter: {
  borderRadius: 26,
  borderWidth: 1.4,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surface,
  marginBottom: 16,
  overflow: "hidden",
},

cardInner: {
  margin: 8,
  borderRadius: 20,
  backgroundColor: COLORS.surfaceDeep,
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
  backgroundColor: "rgba(168,85,247,0.18)",
  borderWidth: 1,
  borderColor: "rgba(168,85,247,0.30)",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 12,
},

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
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
    marginBottom: 12,
    borderWidth: 1,
  },

metaBadgeSuccess: {
  backgroundColor: COLORS.successBg,
  borderColor: COLORS.successBorder,
},

  metaBadgeWarning: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.borderStrong,
  },

  metaBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  buttonTopGap: {
    marginTop: 4,
  },

  subheading: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  listBlock: {
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
    textTransform: "capitalize",
  },

  listValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  actionStack: {
    gap: 10,
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
  explainModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  explainModalCard: {
    width: "100%",
  },

  explainRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

explainIconCircle: {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: "rgba(168,85,247,0.13)",
  alignItems: "center",
  justifyContent: "center",
},

explainStrong: {
  color: "#7E22CE",
  fontWeight: "900",
},

  explainText: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    lineHeight: 22,
  },



  explainDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  teacherExplainCard: {
  width: "100%",
  borderRadius: 24,
  backgroundColor: "#F8F2FF",
  padding: 18,
  borderWidth: 1.5,
  borderColor: "rgba(168,85,247,0.28)",
},

teacherExplainTopIcon: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "rgba(168,85,247,0.13)",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
},

teacherExplainTitle: {
  color: "#1A0B2E",
  fontSize: 22,
  fontWeight: "900",
  marginBottom: 16,
},

teacherExplainBody: {
  gap: 14,
  marginBottom: 18,
},

teacherExplainPrimaryButton: {
  minHeight: 48,
  borderRadius: 14,
  backgroundColor: COLORS.accent,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
},

teacherExplainPrimaryText: {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "900",
},

teacherExplainSecondaryButton: {
  minHeight: 48,
  borderRadius: 14,
  backgroundColor: "rgba(168,85,247,0.13)",
  borderWidth: 1,
  borderColor: "rgba(168,85,247,0.24)",
  alignItems: "center",
  justifyContent: "center",
},

teacherExplainSecondaryText: {
  color: "#6B21A8",
  fontSize: 15,
  fontWeight: "900",
},
});