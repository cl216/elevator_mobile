import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../../../src/config/api";
import { createBooking } from "../../../src/api/bookings";
import { createCheckoutSession } from "../../../src/api/payments";

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

  button: "#3F6AE0",
  buttonDisabled: "#2A3558",
  buttonSecondary: "#121A2C",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",
  warningText: "#FFD666",

  dangerBg: "rgba(255, 107, 107, 0.12)",
  dangerBorder: "rgba(255, 107, 107, 0.22)",
  dangerText: "#FFA8A8",

  divider: "rgba(255,255,255,0.06)",
};

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
    <Pressable onPress={() => router.back()} style={styles.backdrop}>
      <Pressable onPress={() => {}} style={styles.panelOuter}>
        <View style={styles.panelInner}>
          <View style={styles.header}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Booking</Text>
            </View>

            <Text style={styles.title}>Confirm booking</Text>

            <Text style={styles.sessionTitle} numberOfLines={2}>
              {title}
            </Text>

            <Text style={styles.metaText}>{teacherName}</Text>
            {start ? <Text style={styles.metaText}>{start}</Text> : null}
            <Text style={styles.priceText}>€{price}</Text>

            {sessionIsPast ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  This session has already started or is in the past.
                </Text>
              </View>
            ) : null}

            <Pressable onPress={() => router.back()} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Couldn’t load booking</Text>
                <Text style={styles.errorBody}>{error}</Text>
              </View>
            ) : (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>
                    Tell the host a little about yourself
                  </Text>

                  <Text style={styles.bodyText}>
                    This is optional, but it helps the teacher prepare for your
                    session and understand what you’re hoping to get from it.
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Intro message</Text>

                  <Text style={styles.helperText}>
                    Example: “Hi! I’m a beginner and hoping to learn the basics.”
                  </Text>

                  <TextInput
                    value={introMessage}
                    onChangeText={setIntroMessage}
                    placeholder="Hi! I’m a beginner and excited to join."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    maxLength={300}
                    editable={!reserveLoading}
                    style={[
                      styles.textInput,
                      reserveLoading && styles.textInputDisabled,
                    ]}
                  />

                  <View style={styles.inputFooter}>
                    <Text style={styles.inputHint}>
                      Keep communication on-platform. Contact details and
                      off-platform payment requests are not allowed.
                    </Text>

                    <Text style={styles.counterText}>
                      {introMessage.length}/300
                    </Text>
                  </View>
                </View>

                <View style={styles.policyCard}>
                  <Text style={styles.sectionTitle}>Cancellation policy</Text>

                  <Text style={styles.bodyText}>
                    If the teacher cancels, you’ll receive a full refund.
                  </Text>

                  <Text style={[styles.bodyText, styles.policyLine]}>
                    If you cancel 12 or more hours before the session starts,
                    you’ll receive a full refund.
                  </Text>

                  <Text style={[styles.bodyText, styles.policyLine]}>
                    If you cancel less than 12 hours before the session starts,
                    the cancellation is not eligible for an automatic refund.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleReserve}
              disabled={reserveLoading || loading || !!error || sessionIsPast}
              style={[
                styles.primaryButton,
                (reserveLoading || loading || !!error || sessionIsPast) &&
                  styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {reserveLoading
                  ? "Starting checkout..."
                  : sessionIsPast
                    ? "Session started"
                    : `Continue to pay €${price}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.40)",
  },

  panelOuter: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    overflow: "hidden",
    borderLeftWidth: 1.2,
    borderTopWidth: 1.2,
    borderBottomWidth: 1.2,
    borderColor: COLORS.borderStrong,
  },

  panelInner: {
    flex: 1,
    margin: 8,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },

  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
    position: "relative",
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
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
    fontSize: 20,
    fontWeight: "900",
  },

  sessionTitle: {
    marginTop: 10,
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
  },

  metaText: {
    marginTop: 6,
    color: COLORS.textSoft,
  },

  priceText: {
    marginTop: 8,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  warningBox: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  warningText: {
    color: COLORS.dangerText,
    fontWeight: "700",
  },

  closeButton: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },

  loadingWrap: {
    paddingTop: 30,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },

  errorCard: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    padding: 16,
    backgroundColor: COLORS.surfaceSoft,
  },

  errorTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  errorBody: {
    marginTop: 8,
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  infoCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: COLORS.surfaceSoft,
    marginBottom: 16,
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 8,
    fontSize: 15,
  },

  helperText: {
    color: COLORS.textSoft,
    marginBottom: 10,
    lineHeight: 20,
  },

  bodyText: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  textInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
  },

  textInputDisabled: {
    opacity: 0.7,
  },

  inputFooter: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  inputHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },

  counterText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  policyCard: {
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 16,
    padding: 14,
    backgroundColor: COLORS.warningBg,
  },

  policyLine: {
    marginTop: 6,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.bg,
  },

  primaryButton: {
    backgroundColor: COLORS.button,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.22)",
  },

  primaryButtonDisabled: {
    backgroundColor: COLORS.buttonDisabled,
    borderColor: COLORS.border,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});