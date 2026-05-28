import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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

import { createReview, getReviewEligibility } from "../../../src/api/reviews";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { safeReplace } from "@/src/utils/safeRouter";

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
  star: "#FFC947",
};

function getReasonMessage(reason?: string | null) {
  switch (reason) {
    case "already_reviewed":
      return "You have already reviewed this booking.";
    case "booking_not_confirmed":
      return "Only completed confirmed bookings can be reviewed.";
    case "session_not_started":
      return "You can review this session after it starts.";
    case "not_eligible":
      return "This booking is not eligible for review.";
    default:
      return "This booking is not eligible for review.";
  }
}

function getRatingLabel(rating: number) {
  if (rating === 5) return "Excellent";
  if (rating === 4) return "Very good";
  if (rating === 3) return "Good";
  if (rating === 2) return "Poor";
  return "Very poor";
}

function StarButton({
  filled,
  onPress,
}: {
  filled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.starButton, filled && styles.starButtonFilled]}
    >
      <Text style={[styles.starText, filled && styles.starTextFilled]}>★</Text>
    </Pressable>
  );
}

export default function LeaveReviewScreen() {
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();

  const bookingId = useMemo(() => {
    if (Array.isArray(params.bookingId)) return params.bookingId[0];
    return params.bookingId;
  }, [params.bookingId]);

  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(
    null,
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!bookingId) {
        setEligibilityReason("Missing booking id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await getReviewEligibility(bookingId);

        if (!alive) return;

        setEligible(result.eligible);
        setEligibilityReason(result.reason);
      } catch (e: any) {
        if (!alive) return;

        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Could not check review eligibility.";

        setEligible(false);
        setEligibilityReason(
          Array.isArray(message) ? message.join("\n") : String(message),
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [bookingId]);

  async function handleSubmit() {
    if (!bookingId) {
      Alert.alert("Missing booking", "Booking id is required.");
      return;
    }

    if (rating < 1 || rating > 5) {
      Alert.alert("Invalid rating", "Please choose a rating from 1 to 5.");
      return;
    }

    try {
      setSaving(true);

      await createReview({
        bookingId,
        rating,
        comment: comment.trim() || undefined,
      });

      Alert.alert("Review submitted", "Thanks for sharing your feedback.", [
        {
          text: "OK",
          onPress: () => safeReplace("/(learner)/bookings"),
        },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? e?.message ?? "Could not submit review.";

      Alert.alert(
        "Review error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Review</Text>
            </View>

            <Text style={styles.title}>Leave a review</Text>
            <Text style={styles.subtitle}>
              Share your experience to help future learners choose the right
              class.
            </Text>
          </View>

          {loading ? (
            <View style={styles.card}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.loadingText}>Checking eligibility…</Text>
            </View>
          ) : !eligible ? (
            <View style={styles.card}>
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={COLORS.accent}
              />

              <Text style={styles.cardTitle}>Review unavailable</Text>
              <Text style={styles.cardBody}>
                {getReasonMessage(eligibilityReason)}
              </Text>

              <Pressable onPress={() => router.back()} style={styles.button}>
                <Text style={styles.buttonText}>Go back</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your rating</Text>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <StarButton
                      key={value}
                      filled={value <= rating}
                      onPress={() => setRating(value)}
                    />
                  ))}
                </View>

                <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Comment</Text>
                <Text style={styles.cardBody}>
                  Optional. Keep it respectful and relevant to the class
                  experience.
                </Text>

                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  autoCapitalize="sentences"
                  placeholder="What did you enjoy? Anything future learners should know?"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={1000}
                  style={styles.input}
                />

                <Text style={styles.characterCount}>
                  {comment.length}/1000
                </Text>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={saving}
                style={[styles.button, saving && styles.buttonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Submit review</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.back()}
                disabled={saving}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
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
    marginBottom: 22,
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
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
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    padding: 18,
    marginBottom: 16,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 8,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },

  loadingText: {
    color: COLORS.textSoft,
    marginTop: 10,
    textAlign: "center",
  },

  starsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },

  starButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  starButtonFilled: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  starText: {
    fontSize: 21,
    color: COLORS.textMuted,
    fontWeight: "900",
  },

  starTextFilled: {
    color: "#FFFFFF",
  },

  ratingLabel: {
    color: COLORS.star,
    fontSize: 15,
    fontWeight: "900",
  },

  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    padding: 14,
    textAlignVertical: "top",
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },

  characterCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginTop: 8,
  },

  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 12,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
});