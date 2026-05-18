import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createBooking } from "../../../src/api/bookings";
import { createCheckoutSession } from "../../../src/api/payments";
import { API_BASE_URL } from "../../../src/config/api";
import { authStore } from "@/src/store/auth.store";
import { safePush } from "@/src/utils/safeRouter";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",
  surfaceElevated: "#162033",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",

  button: "#3F6AE0",
  buttonPressed: "#355CC2",
  buttonDisabled: "#2A3558",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",
  warningText: "#FFD666",

  dangerBg: "rgba(255, 107, 107, 0.12)",
  dangerBorder: "rgba(255, 107, 107, 0.22)",
  dangerText: "#FFA8A8",

  infoBg: "rgba(111,146,255,0.12)",
  infoBorder: "rgba(111,146,255,0.22)",
  infoText: "#B7C7FF",

  divider: "rgba(255,255,255,0.06)",
};

const BOOKING_EXPLAIN_KEY = "booking-flow-explained-v1";

type SessionDetail = {
  id: string;
  start_time: string;
  end_time?: string;
  duration: number;
  price: number;
  rough_location?: string | null;
  class?: {
    title?: string;
    description?: string;
    category?: string;
  };
  teacher?: {
    id: string;
    name?: string;
    avatarUrl?: string;
  };
};

function isPast(dateString?: string) {
  if (!dateString) return false;
  return new Date(dateString).getTime() < Date.now();
}

function formatDateTime(value?: string) {
  if (!value) return "";

  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getApiErrorMessage(error: any, fallback: string): string {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
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
    case "Please add a profile photo before booking so the teacher can recognise you.":
      return "Please add a profile photo before booking so the teacher can recognise you.";
    case "Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your message.":
      return "Please keep communication on-platform. Remove contact details, social handles, external websites, and off-platform payment requests from your message.";
    default:
      return message;
  }
}

export default function BookingPanel() {
  const { sessionId, introMessage: savedIntroMessage } =
    useLocalSearchParams<{
      sessionId: string;
      introMessage?: string;
    }>();

  const insets = useSafeAreaInsets();

  const imageUrl = authStore((s) => s.imageUrl);
  const currentUser = authStore((s: any) => s.user);

  const [introMessage, setIntroMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [showBookingExplain, setShowBookingExplain] = useState(false);

  const hasProfilePhoto = useMemo(() => {
    return !!(
      imageUrl ||
      currentUser?.image_url ||
      currentUser?.avatar_url ||
      currentUser?.profile_image_url
    );
  }, [imageUrl, currentUser]);

  useEffect(() => {
    if (
      typeof savedIntroMessage === "string" &&
      savedIntroMessage !== introMessage
    ) {
      setIntroMessage(savedIntroMessage);
    }
  }, [savedIntroMessage, introMessage]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(BOOKING_EXPLAIN_KEY);

        if (alive && !seen) {
          setShowBookingExplain(true);
        }
      } catch (e) {
        console.log("BOOKING_EXPLAIN_LOAD_ERROR", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

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

  const title = session?.class?.title?.trim() || "Session";
  const teacherName = session?.teacher?.name?.trim() || "Teacher";
  const start = formatDateTime(session?.start_time);
  const duration = session?.duration ?? 0;

  const lessonPrice = Number(session?.price ?? 0);
const platformFee = 3;
const stripeFee =
  ((lessonPrice + platformFee) * 0.015) + 0.25;
  const totalPrice = lessonPrice + platformFee + stripeFee;

  const publicLocation =
    session?.rough_location?.trim() || "Public area shown before booking";

  const sessionIsPast = useMemo(
    () => isPast(session?.start_time),
    [session?.start_time],
  );

  function handleMissingProfilePhoto() {
    if (!session?.id) return;

    Alert.alert(
      "Profile photo required",
      "Please add a profile photo before booking so the teacher can recognise you.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Add photo",
          onPress: () => {
            safePush({
              pathname: "/(learner)/profile",
              params: {
                returnToSessionId: session.id,
                needsPhotoForBooking: "1",
                introMessage,
              },
            });
          },
        },
      ],
    );
  }

  async function dismissBookingExplain() {
    try {
      await AsyncStorage.setItem(BOOKING_EXPLAIN_KEY, "seen");
    } catch (e) {
      console.log("BOOKING_EXPLAIN_SAVE_ERROR", e);
    }

    setShowBookingExplain(false);
  }

  async function continueFromBookingExplain() {
    await dismissBookingExplain();
    await handleReserve();
  }

  async function handleReserve() {
    if (!session?.id || reserveLoading) return;

    if (sessionIsPast) {
      Alert.alert(
        "Session unavailable",
        "This session has already started or is in the past.",
      );
      return;
    }

    if (!hasProfilePhoto) {
      handleMissingProfilePhoto();
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
      console.log(
        "BOOKING ERROR FULL",
        JSON.stringify(e?.response?.data, null, 2),
      );

      const responseData = e?.response?.data;
      const pendingPayload =
        responseData?.message?.code === "BOOKING_PAYMENT_PENDING"
          ? responseData.message
          : responseData;

      if (
        pendingPayload?.code === "BOOKING_PAYMENT_PENDING" &&
        pendingPayload?.bookingId
      ) {
        try {
          setReserveLoading(true);

          const checkout = await createCheckoutSession(
            String(pendingPayload.bookingId),
          );

          if (!checkout?.checkoutUrl) {
            throw new Error("Missing checkout URL");
          }

          await Linking.openURL(checkout.checkoutUrl);
          return;
        } catch (checkoutError: any) {
          const rawMessage = getApiErrorMessage(
            checkoutError,
            "Could not reopen checkout.",
          );

          Alert.alert("Payment error", String(rawMessage));
          return;
        }
      }

      const rawMessage = getApiErrorMessage(e, "Could not start checkout.");
      const message = normalizeBookingErrorMessage(String(rawMessage));

      Alert.alert("Booking error", message);
    } finally {
      setReserveLoading(false);
    }
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.panelOuter}>
        <View style={styles.panelInner}>


          <ScrollView contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading booking…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Couldn’t load booking</Text>
                <Text style={styles.errorBody}>{error}</Text>
              </View>
            ) : (
              <>
                <View style={styles.locationPrivacyCard}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={COLORS.infoText}
                    />

                    <Text style={styles.sectionTitle}>Location privacy</Text>
                  </View>

                  <Text style={styles.bodyText}>
                    Before booking, you can see the public area only.
                  </Text>

                  <View style={styles.locationPreviewBox}>
                    <Text style={styles.locationPreviewLabel}>
                      Public location
                    </Text>
                    <Text style={styles.locationPreviewText}>
                      {publicLocation}
                    </Text>
                  </View>

                  <Text style={styles.locationPrivacyText}>
                    After your booking is confirmed, the teacher’s exact meetup
                    and arrival instructions will appear in your booking details.
                  </Text>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color={COLORS.accent}
                    />

                    <Text style={styles.sectionTitle}>
                      Tell the host a little about yourself
                    </Text>
                  </View>

                  <Text style={styles.bodyText}>
                    This is optional, but it helps the teacher prepare for your
                    session and understand what you’re hoping to get from it.
                  </Text>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Intro message</Text>

                  <Text style={styles.helperText}>
                    Example: “Hi! I’m a beginner and hoping to learn the
                    basics.”
                  </Text>

                  <TextInput
                    value={introMessage}
                    onChangeText={(text) => setIntroMessage(text)}
                    autoCapitalize="sentences"
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
<View style={styles.priceBreakdownCard}>
  <Text style={styles.priceBreakdownTitle}>
    Price breakdown
  </Text>

  <View style={styles.priceRow}>
    <Text style={styles.priceLabel}>Lesson</Text>

    <Text style={styles.priceValue}>
      €{lessonPrice.toFixed(2)}
    </Text>
  </View>

  <View style={styles.priceRow}>
    <Text style={styles.priceLabel}>
      Elevator service fee
    </Text>

    <Text style={styles.priceValue}>
      €{platformFee.toFixed(2)}
    </Text>
  </View>

  <View style={styles.priceRow}>
    <Text style={styles.priceLabel}>
      Secure payment processing
    </Text>

    <Text style={styles.priceValue}>
      €{stripeFee.toFixed(2)}
    </Text>
  </View>

  <View style={styles.priceDivider} />

  <View style={styles.priceRow}>
    <Text style={styles.totalLabel}>
      Total charged today
    </Text>

    <Text style={styles.totalValue}>
      €{totalPrice.toFixed(2)}
    </Text>
  </View>

  <Text style={styles.priceTransparencyText}>
    Includes payment processing and platform protection fees.
  </Text>
</View>
                <View style={styles.policyCard}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={COLORS.warningText}
                    />

                    <Text style={styles.sectionTitle}>Cancellation policy</Text>
                  </View>

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
              style={({ pressed }) => [
                styles.primaryButton,
                pressed &&
                !reserveLoading &&
                !loading &&
                !error &&
                !sessionIsPast
                  ? styles.primaryButtonPressed
                  : null,
                (reserveLoading || loading || !!error || sessionIsPast) &&
                  styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {reserveLoading
                  ? "Starting checkout..."
                  : sessionIsPast
                    ? "Session started"
                    : hasProfilePhoto
                      ? `Continue to pay €${totalPrice.toFixed(2)}`
                      : "Add profile photo to continue"}
              </Text>
            </Pressable>

            <Text style={styles.footerHint}>
              Payment is handled securely through Stripe. Exact meetup details
              are shared after your booking is confirmed.
            </Text>
          </View>
        </View>
      </View>

      <Modal
        visible={showBookingExplain}
        transparent
        animationType="fade"
        onRequestClose={dismissBookingExplain}
      >
        <View style={styles.explainOverlay}>
          <View style={styles.explainCard}>
            <View style={styles.explainIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color={COLORS.accent}
              />
            </View>

            <Text style={styles.explainTitle}>Before you book</Text>

            <Text style={styles.explainSubtitle}>
              Here’s what happens after you continue to payment.
            </Text>

            <View style={styles.explainItem}>
              <Ionicons
                name="card-outline"
                size={18}
                color={COLORS.infoText}
              />

              <View style={styles.explainItemTextWrap}>
                <Text style={styles.explainItemTitle}>
                  Secure Stripe checkout
                </Text>

                <Text style={styles.explainItemText}>
                  Payment is processed securely through Stripe.
                </Text>
              </View>
            </View>

            <View style={styles.explainItem}>
              <Ionicons
                name="time-outline"
                size={18}
                color={COLORS.infoText}
              />

              <View style={styles.explainItemTextWrap}>
                <Text style={styles.explainItemTitle}>
                  Cancellation timing
                </Text>

                <Text style={styles.explainItemText}>
                  Cancel 12+ hours before the session for a full refund.
                </Text>
              </View>
            </View>

            <View style={styles.explainItem}>
              <Ionicons
                name="location-outline"
                size={18}
                color={COLORS.infoText}
              />

              <View style={styles.explainItemTextWrap}>
                <Text style={styles.explainItemTitle}>
                  Exact meetup details
                </Text>

                <Text style={styles.explainItemText}>
                  Full arrival instructions appear after booking confirmation.
                </Text>
              </View>
            </View>

            <View style={styles.explainItem}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={COLORS.infoText}
              />

              <View style={styles.explainItemTextWrap}>
                <Text style={styles.explainItemTitle}>
                  Instant confirmation
                </Text>

                <Text style={styles.explainItemText}>
                  Your booking becomes active immediately after successful
                  payment.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={dismissBookingExplain}
              style={styles.explainSecondaryButton}
            >
              <Text style={styles.explainSecondaryButtonText}>Understood!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
  },

  panelOuter: {
    flex: 1,
      paddingTop: 42,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    overflow: "hidden",
    borderLeftWidth: 1.2,
    borderTopWidth: 1.2,
    borderBottomWidth: 1.2,
    borderColor: COLORS.borderStrong,
  },

  panelInner: {
    flex: 1,
    margin: 8,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },

  header: {
    padding: 16,
    paddingRight: 58,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
    position: "relative",
  },

  closeButton: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  summaryCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTextWrap: {
    flex: 1,
  },

  sessionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 21,
  },

  metaText: {
    marginTop: 5,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },

  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  priceText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  priceBreakdownCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    padding: 14,
  },

  priceBreakdownTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  priceLabel: {
    color: COLORS.textSoft,
    fontSize: 14,
  },

  priceValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  priceDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },

  totalLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },

  totalValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  priceTransparencyText: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  photoRequiredBox: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  photoRequiredBoxPressed: {
    opacity: 0.86,
  },

  photoRequiredTextWrap: {
    flex: 1,
  },

  photoRequiredTitle: {
    color: COLORS.warningText,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 2,
  },

  photoRequiredText: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },

  warningBox: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },

  warningText: {
    color: COLORS.dangerText,
    fontWeight: "700",
    flex: 1,
    lineHeight: 19,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 150,
  },

  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    padding: 24,
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
    borderRadius: 18,
    padding: 14,
    backgroundColor: COLORS.surfaceSoft,
    marginBottom: 14,
  },

  locationPrivacyCard: {
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
    borderRadius: 18,
    padding: 14,
    backgroundColor: COLORS.infoBg,
    marginBottom: 14,
  },

  locationPreviewBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(18,26,44,0.72)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  locationPreviewLabel: {
    color: COLORS.infoText,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
  },

  locationPreviewText: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20,
  },

  locationPrivacyText: {
    marginTop: 12,
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  sectionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(18,26,44,0.72)",
    marginBottom: 14,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
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
    minHeight: 116,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    padding: 12,
    textAlignVertical: "top",
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
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
    fontWeight: "800",
  },

  policyCard: {
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 18,
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
    minHeight: 52,
    backgroundColor: COLORS.button,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
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

  footerHint: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  explainOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  explainCard: {
    width: "100%",
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 22,
  },

  explainIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 16,
  },

  explainTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },

  explainSubtitle: {
    marginTop: 8,
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  explainItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },

  explainItemTextWrap: {
    flex: 1,
  },

  explainItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },

  explainItemText: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  explainPrimaryButton: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
  },

  explainPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  explainSecondaryButton: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  explainSecondaryButtonText: {
    color: COLORS.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
});