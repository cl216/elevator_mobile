import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { authStore } from "@/src/store/auth.store";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  // 🔽 toned down borders
  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  // 🔽 softer accent system
  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",

  // 🔽 less aggressive button
  button: "#3F6AE0",
  buttonPressed: "#355CC2",
  buttonSecondary: "#121A2C",

  divider: "rgba(255,255,255,0.06)",
};

type ProfileCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  danger?: boolean;
};

function ProfileCard({
  icon,
  title,
  body,
  cta,
  onPress,
  danger = false,
}: ProfileCardProps) {
  return (
    <View style={[styles.cardOuter, danger && styles.cardOuterDanger]}>
      <View style={styles.cardInner}>
        <Pressable onPress={onPress} style={styles.cardPressable}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, danger && styles.iconCircleDanger]}>
              <Ionicons name={icon} size={18} color="#FFFFFF" />
            </View>

            <View style={styles.cardHeaderTextWrap}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textMuted}
              />
            </View>
          </View>

          <Text style={styles.cardBody}>{body}</Text>

          <View
            style={[
              styles.ctaButton,
              danger && styles.ctaButtonSecondary,
            ]}
          >
            <Text
              style={[
                styles.ctaButtonText,
                danger && styles.ctaButtonTextSecondary,
              ]}
            >
              {cta}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);
  const logout = authStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <AppLayout>
      <AppScreen>
        <View style={styles.screen}>
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Profile</Text>
            </View>

            <Text style={styles.title}>Manage your account</Text>
            <Text style={styles.subtitle}>
              Payments, teaching access, and account settings in one place.
            </Text>
          </View>

          <ProfileCard
            icon="card-outline"
            title="Payment methods"
            body="View saved cards for quicker checkout and manage how you pay."
            cta="View saved cards"
            onPress={() => router.push("/(learner)/payment-methods")}
          />

          <ProfileCard
            icon="school-outline"
            title="Teach on Elevator"
            body={
              hasTeacherProfile
                ? "Manage your sessions and teaching tools from the dashboard."
                : "Start teaching and manage your sessions in one place."
            }
            cta={hasTeacherProfile ? "Go to dashboard" : "Become a teacher"}
            onPress={() => {
              if (hasTeacherProfile) {
                router.replace("/(teacher)/dashboard");
                return;
              }

              router.push("/(teacher)/profile");
            }}
          />

          <ProfileCard
            icon="person-circle-outline"
            title="Account"
            body="Manage your account and sign out securely when needed."
            cta="Logout"
            onPress={handleLogout}
            danger
          />
        </View>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: 40,
  flexGrow: 1,  },

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

cardOuter: {
  borderRadius: 24,
  borderWidth: 1.2, // slightly thinner
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surface,
  marginBottom: 14,
  overflow: "hidden",
},

  cardOuterDanger: {
    borderColor: "rgba(110,145,255,0.22)",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },

  cardPressable: {
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
  backgroundColor: "rgba(111,146,255,0.18)", // instead of solid blue
  borderWidth: 1,
  borderColor: "rgba(111,146,255,0.28)",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 12,
},

  iconCircleDanger: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },

ctaButton: {
  minHeight: 48,
  borderRadius: 16,
  backgroundColor: "rgba(111,146,255,0.16)",
  borderWidth: 1,
  borderColor: "rgba(111,146,255,0.25)",
  alignItems: "center",
  justifyContent: "center",
},
ctaButtonText: {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "800",
},

  ctaButtonSecondary: {
    backgroundColor: COLORS.buttonSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },


  ctaButtonTextSecondary: {
    color: COLORS.text,
  },
});