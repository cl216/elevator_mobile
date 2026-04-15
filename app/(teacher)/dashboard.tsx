import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { authStore } from "../../src/store/auth.store";
import { api } from "../../src/api/client";
import { getNearbyTeacherDemand } from "../../src/api/classRequests";
import { ExplainCard } from "../../src/components/ui/ExplainCard";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../src/utils/explainCard";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { AppButton } from "@/src/components/ui/AppButton";

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

  success: "rgba(80, 200, 120, 0.18)",
  warning: "rgba(255,255,255,0.10)",

  divider: "rgba(255,255,255,0.06)",
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

      const [stripeRes, demandRes] = await Promise.all([
        api.get("/teacher/stripe/status"),
        getNearbyTeacherDemand(),
      ]);

      setStripeStatus(stripeRes.data);

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

  async function handleLogout() {
    await authStore.getState().logout();
    router.replace("/(auth)/login");
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
              <Text style={styles.heroBadgeText}>Teacher</Text>
            </View>

            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>
              Manage your sessions, payouts, profile, and local demand.
            </Text>
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
                <View style={styles.explainWrap}>
                  <ExplainCard
                    title="Simple teaching flow"
                    body="You create one session with title, price, time, and location. Learners only see bookable sessions."
                    ctaText="Create session"
                    onPressCta={() => router.push("/(teacher)/sessions/create")}
                    dismissText="Got it"
                    onDismiss={handleDismissTeacherExplainCard}
                  />
                </View>
              ) : null}

              <DashboardCard icon="card-outline" title="Stripe payouts">
                <Text style={styles.bodyText}>
                  {stripeReady
                    ? "Your Stripe account is connected and ready to accept bookings and payouts."
                    : "Complete Stripe onboarding before creating sessions and receiving payouts."}
                </Text>

                <View
                  style={[
                    styles.metaBadge,
                    stripeReady ? styles.metaBadgeSuccess : styles.metaBadgeWarning,
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

              <DashboardCard icon="trending-up-outline" title="Learners near you want">
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
                      onPress={() => router.push("/(teacher)/sessions/create")}
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
                              <Text style={styles.listValue}>
                                {item.count}
                              </Text>
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
                              <Text style={styles.listValue}>
                                {item.count}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.actionStack}>
                      <AppButton
                        title="Create session for this demand"
                        onPress={() => router.push("/(teacher)/sessions/create")}
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

              <DashboardCard icon="person-outline" title="Profile">
                <Text style={styles.bodyText}>
                  Add your bio, profile image, and teaching identity so learners
                  can trust and follow you.
                </Text>

                <AppButton
                  title="Edit profile"
                  onPress={() => router.replace("/(teacher)/profile")}
                />
              </DashboardCard>

              <DashboardCard icon="calendar-outline" title="Sessions">
                <Text style={styles.bodyText}>
                  Create bookable sessions, manage upcoming ones, and duplicate
                  past ones quickly.
                </Text>

                <View style={styles.actionStack}>
                  <AppButton
                    title="My sessions"
                    onPress={() => router.replace("/(teacher)/sessions")}
                  />
                  <AppButton
                    title="Create session"
                    onPress={() => router.push("/(teacher)/sessions/create")}
                    variant="secondary"
                  />
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(111,146,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
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

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  explainWrap: {
    marginBottom: 12,
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
    backgroundColor: COLORS.success,
    borderColor: "rgba(80,200,120,0.28)",
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
});