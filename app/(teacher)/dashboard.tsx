import React, { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { authStore } from "../../src/store/auth.store";
import { api } from "../../src/api/client";

type StripeStatusResponse = {
  stripe_enabled?: boolean;
  stripe_account_id?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
};

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const loadStripeStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/teacher/stripe/status");
      setStripeStatus(res.data);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load teacher dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStripeStatus();
  }, [loadStripeStatus]);

  async function handleLogout() {
    await authStore.getState().logout();
    router.replace("/");
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
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not start Stripe onboarding.");
    } finally {
      setOnboardingLoading(false);
    }
  }

  const stripeReady =
    !!stripeStatus?.stripe_enabled &&
    !!stripeStatus?.charges_enabled &&
    !!stripeStatus?.payouts_enabled;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 40,
        backgroundColor: "#fff",
        flexGrow: 1,
      }}
    >
      <View
        style={{
          marginBottom: 24,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={{ fontSize: 28, fontWeight: "900" }}>
            Teacher Dashboard
          </Text>
          <Text style={{ marginTop: 6, opacity: 0.7 }}>
            Manage your classes and sessions
          </Text>
        </View>

        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: "black",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Logout</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading dashboard…</Text>
        </View>
      ) : (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
              backgroundColor: stripeReady ? "#f6fff7" : "#fffaf2",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>
              Stripe payouts
            </Text>

            <Text style={{ lineHeight: 20, marginBottom: 12 }}>
              {stripeReady
                ? "Your Stripe account is connected and ready to accept bookings and payouts."
                : "Complete Stripe onboarding before creating sessions and receiving payouts."}
            </Text>

            <Text style={{ fontWeight: "700", marginBottom: 6 }}>
              Status: {stripeReady ? "Ready" : "Action needed"}
            </Text>

            {!stripeReady ? (
              <Pressable
                onPress={handleStripeOnboarding}
                disabled={onboardingLoading}
                style={{
                  marginTop: 10,
                  backgroundColor: "black",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>
                  {onboardingLoading ? "Opening Stripe..." : "Continue Stripe onboarding"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>
              Profile
            </Text>
            <Text style={{ lineHeight: 20, marginBottom: 12 }}>
              Add your bio, profile image, and teaching identity so learners can trust and follow you.
            </Text>

            <Pressable
onPress={() => router.push("/(teacher)/profile")}
              style={{
                backgroundColor: "#111",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                Set up profile
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>
              Classes
            </Text>
            <Text style={{ lineHeight: 20, marginBottom: 12 }}>
              Create class templates like Watercolour Basics or Intro to Guitar.
            </Text>

            <Pressable
              onPress={() => {
                router.push("/(teacher)/classes/create");
              }}
              style={{
                backgroundColor: "#111",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                Create class
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>
              Sessions
            </Text>
            <Text style={{ lineHeight: 20, marginBottom: 12 }}>
              Schedule upcoming sessions, duplicate previous ones, and manage bookings.
            </Text>

            <Pressable
              onPress={() => {
    router.push("/(teacher)/sessions/create");              }}
              style={{
                backgroundColor: "#111",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                Create session
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}