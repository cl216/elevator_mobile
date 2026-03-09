import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { API_BASE_URL } from "../../../src/config/api";
import { createBooking } from "../../../src/api/bookings";
import { createCheckoutSession } from "../../../src/api/payments";

type SessionDetail = {
  id: string;
  start_time: string;
  duration: number;
  price: number;
  class?: { title?: string; description?: string; category?: string };
  teacher?: { id: string; name?: string; avatarUrl?: string };
};

export default function BookingPanel() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [introMessage, setIntroMessage] = useState("");
  const [reserveLoading, setReserveLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as SessionDetail;
        if (!alive) return;

        setSession(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load booking details");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  async function handleReserve() {
    if (!session?.id) return;

    try {
      setReserveLoading(true);

      const booking = await createBooking(session.id, introMessage);
      const checkout = await createCheckoutSession(booking.id);

      if (!checkout?.checkoutUrl) {
        throw new Error("Missing checkout URL");
      }

      console.log("checkout url", checkout.checkoutUrl);

await Linking.openURL(checkout.checkoutUrl);
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not start checkout.";

      Alert.alert(
        "Booking error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setReserveLoading(false);
    }
  }

  const title = session?.class?.title ?? "Session";
  const teacherName = session?.teacher?.name ?? "Teacher";
  const start = session?.start_time
    ? new Date(session.start_time).toLocaleString()
    : "";
  const price = session?.price ?? 0;

  return (
    <Pressable
      onPress={() => router.back()}
      style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)" }}
    >
      <Pressable
        onPress={() => {}}
        style={{
          flex: 1,
          marginLeft: "0%",
          backgroundColor: "white",
          borderTopLeftRadius: 22,
          borderBottomLeftRadius: 22,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={2}>
            Confirm booking
          </Text>

          <Text style={{ marginTop: 8, fontWeight: "800" }}>{title}</Text>
          <Text style={{ marginTop: 6, fontWeight: "700" }}>{teacherName}</Text>
          {start ? <Text style={{ marginTop: 6 }}>{start}</Text> : null}
          <Text style={{ marginTop: 6, fontWeight: "800" }}>€{price}</Text>

          <Pressable
            onPress={() => router.back()}
            style={{ position: "absolute", right: 14, top: 14, padding: 8 }}
          >
            <Text style={{ fontWeight: "900" }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
          {loading ? (
            <View style={{ paddingTop: 30, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 10 }}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={{ paddingTop: 20 }}>
              <Text style={{ fontWeight: "900" }}>Couldn’t load booking</Text>
              <Text style={{ marginTop: 8 }}>{error}</Text>
            </View>
          ) : (
            <>
              <Text style={{ lineHeight: 20, marginBottom: 16 }}>
                Add a short message for the host if you want. This is optional.
              </Text>

              <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                Optional message
              </Text>

              <TextInput
                value={introMessage}
                onChangeText={setIntroMessage}
                placeholder="Hi! Excited to join this class."
                multiline
                maxLength={300}
                style={{
                  minHeight: 100,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  textAlignVertical: "top",
                  backgroundColor: "#fafafa",
                }}
              />

              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  opacity: 0.6,
                }}
              >
                Keep communication on-platform. Contact details and off-platform
                payment requests are not allowed.
              </Text>
            </>
          )}
        </ScrollView>

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 16,
            borderTopWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
            backgroundColor: "white",
          }}
        >
          <Pressable
            onPress={handleReserve}
            disabled={reserveLoading || loading || !!error}
            style={{
              backgroundColor:
                reserveLoading || loading || error ? "#666" : "black",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              {reserveLoading ? "Starting checkout..." : `Continue to pay €${price}`}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}