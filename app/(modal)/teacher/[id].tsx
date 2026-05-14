import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { mediaUrl } from "@/src/utils/mediaUrl";
import { safePush } from "@/src/utils/safeRouter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  accentBorder: "rgba(111,146,255,0.25)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentSoftStrong: "rgba(111,146,255,0.16)",

  button: "#3F6AE0",
  buttonPressed: "#355CC2",

  divider: "rgba(255,255,255,0.06)",
  star: "#FFC947",
};

type TeacherProfile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  bio?: string | null;
  image_url?: string | null;
  avatar_url?: string | null;
  joined_at?: string | null;
  average_rating?: number | null;
  review_count?: number;
  session_count?: number;
  sessions_count?: number;
  follower_count?: number;
  followers_count?: number;
  gallery_image_urls?: string[];
  image_urls?: string[];
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
};

function renderStars(averageRating: number | null) {
  if (averageRating === null || !Number.isFinite(averageRating)) {
    return "☆☆☆☆☆";
  }

  const rounded = Math.max(0, Math.min(5, Math.round(averageRating)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function getRatingLabel(averageRating: number | null, reviewCount: number) {
  if (
    reviewCount <= 0 ||
    averageRating === null ||
    !Number.isFinite(averageRating)
  ) {
    return "No reviews yet";
  }

  return `${averageRating.toFixed(1)} (${reviewCount} review${
    reviewCount === 1 ? "" : "s"
  })`;
}

function compactNumber(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function getTeacherName(profile: TeacherProfile | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.display_name?.trim() ||
    profile?.name?.trim() ||
    "Teacher"
  );
}

function getGalleryImages(profile: TeacherProfile | null) {
  if (!profile) return [];

  const gallery = Array.isArray(profile.gallery_image_urls)
    ? profile.gallery_image_urls
    : Array.isArray(profile.image_urls)
      ? profile.image_urls
      : [profile.image_url_1, profile.image_url_2, profile.image_url_3];

  return gallery
    .map((item) => mediaUrl(item))
    .filter(Boolean)
    .slice(0, 3) as string[];
}

function getAvatar(profile: TeacherProfile | null) {
  return mediaUrl(profile?.image_url || profile?.avatar_url || null);
}

function GalleryImage({
  uri,
  index,
}: {
  uri: string | null;
  index: number;
}) {
  return (
    <View style={styles.galleryTile}>
      {uri ? (
        <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
      ) : (
        <View style={styles.galleryPlaceholder}>
          <Ionicons name="image-outline" size={22} color={COLORS.textMuted} />
          <Text style={styles.galleryPlaceholderText}>Photo {index + 1}</Text>
        </View>
      )}
    </View>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={22} color={COLORS.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
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

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [profileData, followStatus, teacherReviews] = await Promise.all([
          getTeacherProfile(id!),
          getFollowStatus(id!),
          getTeacherReviews(id!),
        ]);

        if (!alive) return;

        setProfile(profileData as TeacherProfile);
        setFollowing(!!followStatus?.following);
        setReviews(Array.isArray(teacherReviews) ? teacherReviews : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load teacher profile");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (id) load();

    return () => {
      alive = false;
    };
  }, [id]);

  async function toggleFollow() {
    if (!profile?.id || followLoading) return;

    try {
      setFollowLoading(true);

      if (following) {
        await unfollowTeacher(profile.id);
        setFollowing(false);
      } else {
        await followTeacher(profile.id);
        setFollowing(true);
      }
    } catch {
      Alert.alert("Error", "Could not update follow status.");
    } finally {
      setFollowLoading(false);
    }
  }

  const teacherName = getTeacherName(profile);
  const avatar = getAvatar(profile);
  const galleryImages = getGalleryImages(profile);
  const paddedGallery = [
    galleryImages[0] ?? null,
    galleryImages[1] ?? null,
    galleryImages[2] ?? null,
  ];

  const averageRating =
    typeof profile?.average_rating === "number" &&
    Number.isFinite(profile.average_rating)
      ? profile.average_rating
      : null;

  const reviewCount =
    typeof profile?.review_count === "number"
      ? profile.review_count
      : reviews.length;

  const sessionCount =
    profile?.session_count ?? profile?.sessions_count ?? 0;

  const followerCount =
    profile?.follower_count ?? profile?.followers_count ?? 0;

  const ratingStars = useMemo(
    () => renderStars(averageRating),
    [averageRating],
  );

  const ratingLabel = useMemo(
    () => getRatingLabel(averageRating, reviewCount),
    [averageRating, reviewCount],
  );

  const bio =
    profile?.bio?.trim() ||
    "This teacher has not added a bio yet. Check their sessions to learn more about what they teach.";

  return (
    <View style={styles.backdrop}>
      <View style={styles.screen}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={COLORS.text} />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.stateText}>Loading teacher…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateWrap}>
              <Text style={styles.errorTitle}>Couldn’t load teacher</Text>
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : profile ? (
            <>
              <View style={styles.galleryRow}>
                {paddedGallery.map((uri, index) => (
                  <GalleryImage
                    key={`${uri ?? "empty"}-${index}`}
                    uri={uri}
                    index={index}
                  />
                ))}
              </View>

              <View style={styles.profileRow}>
                <View style={styles.avatarRing}>
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {teacherName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.profileTextWrap}>
                  <Text style={styles.name} numberOfLines={2}>
                    {teacherName}
                  </Text>

                  <Text style={styles.tagline}>
                    Teacher • Creator • Local host
                  </Text>

                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={15}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.locationText}>Teacher profile</Text>
                  </View>
                </View>
              </View>

              <View style={styles.ratingPill}>
                <Text style={styles.stars}>{ratingStars}</Text>
                <Text style={styles.ratingLabel}>{ratingLabel}</Text>
              </View>

              <Text style={styles.bioText}>{bio}</Text>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <StatItem
                  icon="star-outline"
                  value={compactNumber(reviewCount)}
                  label="Reviews"
                />

                <View style={styles.statDivider} />

                <StatItem
                  icon="calendar-outline"
                  value={compactNumber(sessionCount)}
                  label="Sessions"
                />

                <View style={styles.statDivider} />

                <StatItem
                  icon="people-outline"
                  value={compactNumber(followerCount)}
                  label="Followers"
                />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={toggleFollow}
                  disabled={followLoading}
                  style={({ pressed }) => [
                    styles.followButton,
                    pressed && styles.followButtonPressed,
                    followLoading && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.followButtonText}>
                    {followLoading
                      ? "..."
                      : following
                        ? "Following"
                        : "Follow"}
                  </Text>
                  <Ionicons
                    name={following ? "checkmark-circle" : "add-circle"}
                    size={22}
                    color="#FFFFFF"
                  />
                </Pressable>

                <Pressable
                  onPress={() =>
                    safePush({
                      pathname: "/(modal)/private-session-request/[teacherId]",
                      params: {
                        teacherId: profile.id,
                        teacherName,
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.requestButton,
                    pressed && styles.requestButtonPressed,
                  ]}
                >
                  <Ionicons name="paper-plane-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.requestButtonText}>Request 1:1</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 440);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
  },

  screen: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: COLORS.bg,
  },

  closeButton: {
    position: "absolute",
    top: 42,
    left: 20,
    zIndex: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(111,146,255,0.12)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    width: CARD_WIDTH,
    alignSelf: "center",
    paddingTop: 118,
    paddingBottom: 34,
  },

  stateWrap: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
  },

  stateText: {
    color: COLORS.textSoft,
    marginTop: 10,
    textAlign: "center",
  },

  errorTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  galleryRow: {
    height: 132,
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },

  galleryTile: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  galleryImage: {
    width: "100%",
    height: "100%",
  },

  galleryPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.surfaceSoft,
  },

  galleryPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 18,
  },

  avatarRing: {
    width: 114,
    height: 114,
    borderRadius: 57,
    padding: 5,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
    borderWidth: 4,
    borderColor: COLORS.bg,
  },

  avatarFallback: {
    flex: 1,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: COLORS.bg,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallbackText: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: "900",
  },

  profileTextWrap: {
    flex: 1,
  },

  name: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
    marginBottom: 6,
  },

  tagline: {
    color: COLORS.textSoft,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
  },

  locationText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },

  ratingPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },

  stars: {
    color: COLORS.star,
    fontSize: 19,
    letterSpacing: 1,
    fontWeight: "900",
  },

  ratingLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  bioText: {
    color: COLORS.textSoft,
    fontSize: 17,
    lineHeight: 28,
    marginBottom: 24,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginBottom: 24,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 30,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },

  statValue: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },

  statLabel: {
    color: COLORS.textSoft,
    fontSize: 14,
    fontWeight: "700",
  },

  statDivider: {
    width: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 10,
  },

  actionRow: {
    flexDirection: "row",
    gap: 14,
  },

  followButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  followButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
  },

  requestButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.3,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(5,7,15,0.42)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  requestButtonPressed: {
    backgroundColor: COLORS.accentSoft,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  followButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  requestButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
});