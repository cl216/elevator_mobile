import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { safePush } from "@/src/utils/safeRouter";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import {
    getTeacherReviews,
    type TeacherReview,
} from "../../../src/api/reviews";
import {
    followTeacher,
    getFollowStatus,
    getTeacherProfile,
    unfollowTeacher,
} from "../../../src/api/teacher";

type TeacherProfile = {
  id: string;
  full_name: string;
  bio: string | null;
  image_url: string | null;
  joined_at: string;
  average_rating: number | null;
  review_count: number;
};

function renderStars(averageRating: number | null) {
  if (averageRating === null || !Number.isFinite(averageRating)) {
    return "☆☆☆☆☆";
  }

  const rounded = Math.round(averageRating);
  const filled = "★".repeat(Math.max(0, Math.min(5, rounded)));
  const empty = "☆".repeat(Math.max(0, 5 - rounded));
  return `${filled}${empty}`;
}

function renderReviewStars(rating?: number | null) {
  const safeRating =
    typeof rating === "number" && Number.isFinite(rating)
      ? Math.max(0, Math.min(5, Math.round(rating)))
      : 0;

  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
}

function getRatingLabel(
  averageRating: number | null,
  reviewCount: number,
): string {
  if (
    reviewCount <= 0 ||
    averageRating === null ||
    !Number.isFinite(averageRating)
  ) {
    return "No reviews yet";
  }

  if (reviewCount === 1) {
    return `${averageRating.toFixed(1)} · 1 review`;
  }

  return `${averageRating.toFixed(1)} · ${reviewCount} reviews`;
}

function getLearnerDisplayName(review: TeacherReview) {
  const learner = review.learner;

  if (!learner) return "Learner";

  if (typeof learner.first_name === "string" && learner.first_name.trim()) {
    return learner.first_name.trim();
  }

  if (typeof learner.full_name === "string" && learner.full_name.trim()) {
    return learner.full_name.trim().split(" ")[0];
  }

  return "Learner";
}

function formatReviewDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function TeacherProfileModal() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [reviews, setReviews] = useState<TeacherReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileData, followStatus, teacherReviews] = await Promise.all([
          getTeacherProfile(id!),
          getFollowStatus(id!),
          getTeacherReviews(id!),
        ]);

        if (!alive) return;

        setProfile(profileData);
        setFollowing(!!followStatus.following);
        setReviews(Array.isArray(teacherReviews) ? teacherReviews : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load teacher profile");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function toggleFollow() {
    if (!profile?.id) return;

    try {
      setFollowLoading(true);

      if (following) {
        await unfollowTeacher(profile.id);
        setFollowing(false);
      } else {
        await followTeacher(profile.id);
        setFollowing(true);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update follow status.");
    } finally {
      setFollowLoading(false);
    }
  }

  const joinedLabel = profile?.joined_at
    ? `Joined ${new Date(profile.joined_at).toLocaleDateString()}`
    : "";

  const ratingStars = useMemo(() => {
    return renderStars(profile?.average_rating ?? null);
  }, [profile?.average_rating]);

  const ratingLabel = useMemo(() => {
    return getRatingLabel(
      profile?.average_rating ?? null,
      profile?.review_count ?? 0,
    );
  }, [profile?.average_rating, profile?.review_count]);

  const reviewPreview = useMemo(() => reviews.slice(0, 3), [reviews]);

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
          <Text style={{ fontSize: 18, fontWeight: "900" }}>
            Teacher profile
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={{ position: "absolute", right: 14, top: 14, padding: 8 }}
          >
            <Text style={{ fontWeight: "900" }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {loading ? (
            <View style={{ paddingTop: 30, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 10 }}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={{ paddingTop: 20 }}>
              <Text style={{ fontWeight: "900" }}>Couldn’t load teacher</Text>
              <Text style={{ marginTop: 8 }}>{error}</Text>
            </View>
          ) : profile ? (
            <>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
  {profile.image_url ? (
    <Image
      source={{ uri: profile.image_url }}
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        marginBottom: 12,
      }}
    />
  ) : (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        marginBottom: 12,
        backgroundColor: "#ddd",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "900", fontSize: 28 }}>
        {profile.full_name?.[0] ?? "T"}
      </Text>
    </View>
  )}

  <Text style={{ fontSize: 22, fontWeight: "900" }}>
    {profile.full_name}
  </Text>

  <View
    style={{
      marginTop: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
      backgroundColor: "#fafafa",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 150,
    }}
  >
    <Text style={{ fontSize: 18, letterSpacing: 1 }}>
      {ratingStars}
    </Text>
    <Text style={{ marginTop: 4, opacity: 0.72, fontWeight: "700" }}>
      {ratingLabel}
    </Text>
  </View>

  {joinedLabel ? (
    <Text style={{ marginTop: 10, opacity: 0.7 }}>{joinedLabel}</Text>
  ) : null}

  <Pressable
    onPress={toggleFollow}
    disabled={followLoading}
    style={{
      marginTop: 16,
      backgroundColor: following ? "#eee" : "black",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
    }}
  >
    <Text
      style={{
        color: following ? "black" : "white",
        fontWeight: "800",
      }}
    >
      {followLoading ? "..." : following ? "Following" : "Follow"}
    </Text>
  </Pressable>

  <Pressable
    onPress={() =>
       safePush({
        pathname: "/(modal)/private-session-request/[teacherId]",
        params: {
          teacherId: profile.id,
          teacherName: profile.full_name,
        },
      })
    }
    style={{
      marginTop: 12,
      backgroundColor: "#111",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      minWidth: 220,
    }}
  >
    <Text style={{ color: "white", fontWeight: "800" }}>
      Request 1:1 session
    </Text>
  </Pressable>
</View>

              <View
                style={{
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: "#fafafa",
                }}
              >
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                  Reviews
                </Text>

                <Text style={{ lineHeight: 22, opacity: 0.78 }}>
                  {profile.review_count > 0
                    ? `${profile.full_name} has an average rating of ${profile.average_rating?.toFixed(1)} from ${profile.review_count} review${profile.review_count === 1 ? "" : "s"}.`
                    : "No learner reviews yet. Ratings will appear here after learners leave feedback."}
                </Text>
              </View>

              {reviewPreview.length > 0 ? (
                <View
                  style={{
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.08)",
                    borderRadius: 16,
                    padding: 14,
                    backgroundColor: "white",
                  }}
                >
                  <Text style={{ fontWeight: "800", marginBottom: 12 }}>
                    Recent reviews
                  </Text>

                  {reviewPreview.map((review, index) => (
                    <View
                      key={review.id}
                      style={{
                        paddingTop: index === 0 ? 0 : 12,
                        paddingBottom: 12,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: "rgba(0,0,0,0.06)",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "800" }}>
                            {getLearnerDisplayName(review)}
                          </Text>
                          <Text style={{ marginTop: 4, opacity: 0.72 }}>
                            {renderReviewStars(review.rating)}
                          </Text>
                        </View>

                        <Text style={{ opacity: 0.55, fontSize: 12 }}>
                          {formatReviewDate(review.created_at)}
                        </Text>
                      </View>

                      <Text
                        style={{
                          marginTop: 8,
                          lineHeight: 21,
                          opacity: review.comment ? 0.82 : 0.55,
                        }}
                      >
                        {review.comment?.trim() || "No written comment."}
                      </Text>
                    </View>
                  ))}

                  {reviews.length > 3 ? (
                    <Text style={{ marginTop: 4, opacity: 0.6 }}>
                      Showing 3 of {reviews.length} reviews
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View>
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>About</Text>
                <Text style={{ lineHeight: 22, opacity: profile.bio ? 1 : 0.6 }}>
                  {profile.bio || "No bio yet."}
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}