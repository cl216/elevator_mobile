import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

function isPast(dateString?: string) {
  if (!dateString) return false;
  return new Date(dateString).getTime() < Date.now();
}

function getApiErrorMessage(error: any, fallback: string): string {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (
    typeof responseData?.message === "string" &&
    responseData.message.trim()
  ) {
    return responseData.message;
  }

  if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
    return responseData.message.join("\n");
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeBookingErrorMessage(message: string): string {
  switch (message) {
    case "You already booked this session.":
      return "You already booked this session.";

    case "You already started booking this session. Complete payment to confirm it.":
      return "You already started booking this session. Complete payment to confirm it.";

    case "Your previous booking for this session was cancelled by the teacher, so it cannot be booked again.":
      return "This session can’t be booked again because your previous booking was cancelled by the teacher.";

    case "You already cancelled this session and it cannot be booked again.":
      return "This session can’t be booked again because you already cancelled it.";

    case "Your previous booking for this session has already been cancelled.":
      return "This session can’t be booked again because your previous booking was already cancelled.";

    case "Your previous booking attempt for this session expired and it cannot be booked again.":
      return "This session can’t be booked again because your previous booking attempt expired.";

    case "Session is fully booked":
      return "This session is fully booked.";

    case "You cannot book your own session":
      return "You cannot book your own session.";

    case "Session already started or is in the past":
      return "This session has already started or is in the past.";

    case "Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your message.":
      return "Please keep communication on-platform. Remove contact details, social handles, external websites, and off-platform payment requests from your message.";

    default:
      return message;
  }
}

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

  const title = session?.class?.title ?? "Session";
  const teacherName = session?.teacher?.name ?? "Teacher";
  const start = session?.start_time
    ? new Date(session.start_time).toLocaleString()
    : "";
  const price = session?.price ?? 0;
  const sessionIsPast = useMemo(
    () => isPast(session?.start_time),
    [session?.start_time],
  );

  async function handleReserve() {
    if (!session?.id || reserveLoading) return;

    if (sessionIsPast) {
      Alert.alert(
        "Session unavailable",
        "This session has already started or is in the past.",
      );
      return;
    }

    try {
      setReserveLoading(true);

      const booking = await createBooking(session.id, introMessage);
      const checkout = await createCheckoutSession(booking.id);

      if (!checkout?.checkoutUrl) {
        throw new Error("Missing checkout URL");
      }

      await Linking.openURL(checkout.checkoutUrl);
    } catch (e: any) {
      const rawMessage = getApiErrorMessage(
        e,
        "Could not start checkout.",
      );
      const message = normalizeBookingErrorMessage(String(rawMessage));

      Alert.alert("Booking error", message);
    } finally {
      setReserveLoading(false);
    }
  }

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

          {sessionIsPast ? (
            <Text style={{ marginTop: 8, color: "#9b2c2c", fontWeight: "700" }}>
              This session has already started or is in the past.
            </Text>
          ) : null}

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
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  backgroundColor: "#fafafa",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontWeight: "800", marginBottom: 6 }}>
                  Tell the host a little about yourself
                </Text>

                <Text style={{ lineHeight: 20, opacity: 0.75 }}>
                  This is optional, but it helps the teacher prepare for your
                  session and understand what you’re hoping to get from it.
                </Text>
              </View>

              <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                Intro message
              </Text>

              <Text style={{ marginBottom: 10, opacity: 0.75, lineHeight: 20 }}>
                Example: “Hi! I’m a beginner and hoping to learn the basics.”
              </Text>

              <TextInput
                value={introMessage}
                onChangeText={setIntroMessage}
                placeholder="Hi! I’m a beginner and excited to join."
                multiline
                maxLength={300}
                editable={!reserveLoading}
                style={{
                  minHeight: 110,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  textAlignVertical: "top",
                  backgroundColor: reserveLoading ? "#f3f3f3" : "#fafafa",
                }}
              />

              <View
                style={{
                  marginTop: 6,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    opacity: 0.6,
                    flex: 1,
                  }}
                >
                  Keep communication on-platform. Contact details and off-platform
                  payment requests are not allowed.
                </Text>

                <Text style={{ fontSize: 12, opacity: 0.5 }}>
                  {introMessage.length}/300
                </Text>
              </View>

              <View
                style={{
                  marginTop: 18,
                  borderWidth: 1,
                  borderColor: "#e8e1c2",
                  borderRadius: 14,
                  padding: 14,
                  backgroundColor: "#fffaf0",
                }}
              >
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                  Cancellation policy
                </Text>

                <Text style={{ lineHeight: 20, opacity: 0.8 }}>
                  If the teacher cancels, you’ll receive a full refund.
                </Text>

                <Text style={{ lineHeight: 20, opacity: 0.8, marginTop: 6 }}>
                  If you cancel 12 or more hours before the session starts,
                  you’ll receive a full refund.
                </Text>

                <Text style={{ lineHeight: 20, opacity: 0.8, marginTop: 6 }}>
                  If you cancel less than 12 hours before the session starts,
                  the cancellation is not eligible for an automatic refund.
                </Text>
              </View>
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
            disabled={reserveLoading || loading || !!error || sessionIsPast}
            style={{
              backgroundColor:
                reserveLoading || loading || error || sessionIsPast
                  ? "#666"
                  : "black",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              {reserveLoading
                ? "Starting checkout..."
                : sessionIsPast
                  ? "Session started"
                  : `Continue to pay €${price}`}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}