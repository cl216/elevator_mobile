import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createReview,
  getReviewEligibility,
} from "../../../src/api/reviews";

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
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: filled ? "#111" : "rgba(0,0,0,0.12)",
        backgroundColor: filled ? "#111" : "white",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 20,
          color: filled ? "white" : "#111",
          fontWeight: "900",
        }}
      >
        ★
      </Text>
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
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
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
        if (!alive) return;
        setLoading(false);
      }
    })();

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
          onPress: () => router.replace("/(learner)/bookings"),
        },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not submit review.";

      Alert.alert(
        "Review error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 40,
        backgroundColor: "white",
        flexGrow: 1,
      }}
    >
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: "900" }}>Leave a review</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Share your experience to help future learners.
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Checking eligibility…</Text>
        </View>
      ) : !eligible ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: 18,
            backgroundColor: "white",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>
            Review unavailable
          </Text>

          <Text style={{ lineHeight: 20, opacity: 0.75, marginBottom: 14 }}>
            {getReasonMessage(eligibilityReason)}
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: "black",
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              backgroundColor: "white",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
              Your rating
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <StarButton
                  key={value}
                  filled={value <= rating}
                  onPress={() => setRating(value)}
                />
              ))}
            </View>

            <Text style={{ opacity: 0.7 }}>
              {rating === 5
                ? "Excellent"
                : rating === 4
                  ? "Very good"
                  : rating === 3
                    ? "Good"
                    : rating === 2
                      ? "Poor"
                      : "Very poor"}
            </Text>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              backgroundColor: "white",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
              Comment
            </Text>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="What did you enjoy? Anything future learners should know?"
              multiline
              maxLength={1000}
              style={{
                minHeight: 140,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                textAlignVertical: "top",
                backgroundColor: "#fafafa",
              }}
            />

            <Text style={{ marginTop: 8, opacity: 0.55, fontSize: 12 }}>
              Optional. Keep it respectful and relevant to the class experience.
            </Text>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            style={{
              backgroundColor: saving ? "#666" : "black",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white", fontWeight: "900" }}>
                Submit review
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Cancel</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}