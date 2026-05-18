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
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { getNearbyTeacherDemand } from "../../src/api/classRequests";
import { api } from "../../src/api/client";
import { ExplainCard } from "../../src/components/ui/ExplainCard";
import { authStore } from "../../src/store/auth.store";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "@/src/utils/explainCard";

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

  successBg: "rgba(34,197,94,0.14)",
  successBorder: "rgba(34,197,94,0.28)",
  successText: "#8CE99A",

  warningBg: "rgba(251,191,36,0.14)",
  warningBorder: "rgba(251,191,36,0.28)",
  warningText: "#FDE68A",

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

  const [stripeStatus, setStripeStatus] =
    useState<StripeStatusResponse | null>(null);

  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const [dashboardError, setDashboardError] = useState<string | null>(null);

const [showTeacherExplainCard, setShowTeacherExplainCard] =
  useState(false);
const [checkingExplainCard, setCheckingExplainCard] =
  useState(true);

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
        existing_categories: Array.isArray(
          demandRes.existing_categories
        )
          ? demandRes.existing_categories
          : [],
        custom_ideas: Array.isArray(demandRes.custom_ideas)
          ? demandRes.custom_ideas
          : [],
      });
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load teacher dashboard.";

      setDashboardError(
        Array.isArray(message)
          ? message.join("\n")
          : String(message)
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
    try {
      const seen = await hasSeenExplainCard(
        "teacher-dashboard-intro"
      );

      setShowTeacherExplainCard(!seen);
    } finally {
      setCheckingExplainCard(false);
    }
  })();
}, []);

  const handleDismissTeacherExplainCard = useCallback(async () => {
    await markExplainCardSeen("teacher-dashboard-intro");
    setShowTeacherExplainCard(false);
  }, []);

  const stripeReady =
    !!stripeStatus?.stripe_enabled &&
    !!stripeStatus?.charges_enabled &&
    !!stripeStatus?.payouts_enabled;

  const stripeStatusText = useMemo(() => {
    if (stripeReady) return "Ready";
    return "Action needed";
  }, [stripeReady]);

  const topExistingCategories =
    demand.existing_categories.slice(0, 5);

  const topCustomIdeas = demand.custom_ideas.slice(0, 5);

  const demandEmpty =
    demand.existing_categories.length === 0 &&
    demand.custom_ideas.length === 0;

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
        Array.isArray(message)
          ? message.join("\n")
          : String(message)
      );
    } finally {
      setOnboardingLoading(false);
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This action cannot be undone.",
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

              await authStore
                .getState()
                .clearAuthLocalOnly();

              safeReplace("/(auth)/login");
            } catch {
              Alert.alert(
                "Error",
                "Could not delete account."
              );
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

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                Teacher mode
              </Text>
            </View>

            <Text style={styles.title}>Dashboard</Text>

            <Text style={styles.subtitle}>
              Your teaching workspace for sessions,
              payouts, learners, and local demand.
            </Text>
          </View>

          {loading ? (
            <DashboardCard
              icon="grid-outline"
              title="Dashboard"
            >
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />

                <Text style={styles.loadingText}>
                  Loading dashboard…
                </Text>
              </View>
            </DashboardCard>
          ) : dashboardError ? (
            <DashboardCard
              icon="alert-circle-outline"
              title="Dashboard error"
            >
              <Text style={styles.bodyText}>
                {dashboardError}
              </Text>

              <AppButton
                title="Try again"
                onPress={loadDashboard}
              />
            </DashboardCard>
          ) : (
            <>
{!checkingExplainCard && showTeacherExplainCard ? (
                  <Modal transparent visible animationType="fade">
                  <View style={styles.explainModalBackdrop}>
                    <View style={styles.explainModalCard}>
<ExplainCard
  title="Welcome to teaching on Elevator"
  iconName="school-outline"
  body="This is your teacher workspace.

Create sessions, manage bookings, track payouts, and grow your local teaching profile.

Good photos and beginner-friendly sessions usually perform best."
  ctaText="Continue"
  onPressCta={() => {
    setShowTeacherExplainCard(false);
    handleDismissTeacherExplainCard();
  }}
  dismissText="Maybe later"
  onDismiss={handleDismissTeacherExplainCard}
/>
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
                      {
                        attentionSummary.total_action_items
                      }{" "}
                      teaching item
                      {attentionSummary.total_action_items === 1
                        ? ""
                        : "s"}{" "}
                      needing attention.
                    </Text>

                    <View style={styles.attentionList}>
                      {attentionSummary.items.map((item) => (
                        <Pressable
                          key={item.type}
                          onPress={() =>
                            safePush(item.route as any)
                          }
                          style={[
                            styles.attentionRow,
                            item.priority === "high"
                              ? styles.attentionRowHigh
                              : null,
                          ]}
                        >
                          <View
                            style={styles.attentionCountPill}
                          >
                            <Text
                              style={
                                styles.attentionCountText
                              }
                            >
                              {item.count}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.attentionTextWrap
                            }
                          >
                            <Text
                              style={styles.attentionLabel}
                            >
                              {item.label}
                            </Text>

                            <Text
                              style={styles.attentionAction}
                            >
                              {item.actionLabel}
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={COLORS.textMuted}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.bodyText}>
                    Nothing urgent right now.
                  </Text>
                )}
              </DashboardCard>

              <DashboardCard
                icon="card-outline"
                title="Stripe payouts"
              >
                <Text style={styles.bodyText}>
                  {stripeReady
                    ? "Stripe is fully connected and ready."
                    : "Complete Stripe onboarding before accepting bookings."}
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
                  <AppButton
                    title={
                      onboardingLoading
                        ? "Opening Stripe..."
                        : "Continue Stripe onboarding"
                    }
                    onPress={handleStripeOnboarding}
                  />
                ) : null}
              </DashboardCard>

              <DashboardCard
                icon="calendar-outline"
                title="Sessions"
              >
                <Text style={styles.bodyText}>
                  Create and manage sessions.
                </Text>

                <View style={styles.actionStack}>
                  <AppButton
                    title="My sessions"
                    onPress={() =>
                      safePush("/(teacher)/sessions")
                    }
                  />

                  <AppButton
                    title="Create session"
                    onPress={() =>
                      safePush(
                        "/(teacher)/sessions/create"
                      )
                    }
                    variant="secondary"
                  />
                </View>
              </DashboardCard>

              <DashboardCard
                icon="trending-up-outline"
                title="Nearby learner demand"
              >
                {demandEmpty ? (
                  <Text style={styles.bodyText}>
                    No nearby learner demand yet.
                  </Text>
                ) : (
                  <>
                    {topExistingCategories.length > 0 ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.subheading}>
                          Requested categories
                        </Text>

                        <View style={styles.listWrap}>
                          {topExistingCategories.map(
                            (item) => (
                              <View
                                key={item.category}
                                style={styles.listRow}
                              >
                                <Text
                                  style={styles.listLabel}
                                >
                                  {item.category}
                                </Text>

                                <Text
                                  style={styles.listValue}
                                >
                                  {item.count}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    ) : null}

                    {topCustomIdeas.length > 0 ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.subheading}>
                          New class ideas
                        </Text>

                        <View style={styles.listWrap}>
                          {topCustomIdeas.map((item) => (
                            <View
                              key={item.custom_title}
                              style={styles.listRow}
                            >
                              <Text
                                style={styles.listLabel}
                              >
                                {item.custom_title}
                              </Text>

                              <Text
                                style={styles.listValue}
                              >
                                {item.count}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </DashboardCard>

              <DashboardCard
                icon="person-outline"
                title="Profile"
              >
                <Text style={styles.bodyText}>
                  Update your teacher profile and
                  teaching details.
                </Text>

                <AppButton
                  title="Edit profile"
                  onPress={() =>
                    safePush("/(teacher)/profile")
                  }
                />
              </DashboardCard>

              <DashboardCard
                icon="trash-outline"
                title="Delete account"
              >
                <Text style={styles.bodyText}>
                  Permanently delete your account.
                </Text>

                <Pressable
                  onPress={handleDeleteAccount}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>
                    Delete account
                  </Text>
                </Pressable>
              </DashboardCard>

              <DashboardCard
                icon="settings-outline"
                title="Account"
              >
                <Text style={styles.bodyText}>
                  Logout securely.
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
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
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
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginTop: 10,
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
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.warningBorder,
  },

  metaBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  listBlock: {
    marginBottom: 14,
  },

  subheading: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  listWrap: {
    gap: 8,
  },

  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  listLabel: {
    color: COLORS.text,
    flex: 1,
  },

  listValue: {
    color: COLORS.text,
    fontWeight: "800",
  },

  attentionList: {
    gap: 10,
  },

  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  attentionRowHigh: {
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
  },

  attentionCountPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },

  attentionCountText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  attentionTextWrap: {
    flex: 1,
  },

  attentionLabel: {
    color: COLORS.text,
    fontWeight: "800",
  },

  attentionAction: {
    marginTop: 2,
    color: COLORS.textSoft,
    fontSize: 12,
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
    fontWeight: "900",
  },

  explainModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  explainModalCard: {
    width: "100%",
  },
});