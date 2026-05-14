import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getTeacherReviews,
  type TeacherReview,
} from "@/src/api/reviews";

import {
  followTeacher,
  getFollowStatus,
  getTeacherProfile,
  unfollowTeacher,
} from "@/src/api/teacher";

import { mediaUrl } from "@/src/utils/mediaUrl";
import { safePush } from "@/src/utils/safeRouter";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",
  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",
  borderStrong: "rgba(110,145,255,0.28)",
  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",
  button: "#3F6AE0",
  buttonPressed: "#355CC2",
  divider: "rgba(255,255,255,0.06)",
  indicator: "rgba(255,255,255,0.55)",
};

type TeacherProfile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  bio?: string | null;
  image_url?: string | null;
  avatar_url?: string | null;
  average_rating?: number | null;
  review_count?: number;
  gallery_image_urls?: string[];
  image_urls?: string[];
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
};

type Props = {
  teacherId: string | null;
  locationLabel?: string | null;
  onClose: () => void;
    onBeforeNavigateAway?: () => void;
};

function capitalizeName(value?: string | null) {
  return (value ?? "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTeacherName(profile: TeacherProfile | null) {
  return (
    capitalizeName(profile?.full_name) ||
    capitalizeName(profile?.display_name) ||
    capitalizeName(profile?.name) ||
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

function GalleryTile({
  uri,
  index,
  onPress,
}: {
  uri: string | null;
  index: number;
  onPress: (uri: string) => void;
}) {
  return (
    <Pressable
      disabled={!uri}
      onPress={() => uri && onPress(uri)}
      style={styles.galleryTile}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
      ) : (
        <View style={styles.galleryPlaceholder}>
          <Ionicons name="image-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.galleryPlaceholderText}>Photo {index + 1}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const TeacherProfileBottomSheet = forwardRef<any, Props>(
  function TeacherProfileBottomSheet(
    { teacherId, locationLabel, onClose, onBeforeNavigateAway },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const modalRef = useRef<BottomSheetModal | null>(null);

    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<TeacherProfile | null>(null);
    const [reviews, setReviews] = useState<TeacherReview[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [following, setFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [expandedImageUri, setExpandedImageUri] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
      close: () => modalRef.current?.close(),
    }));

    useEffect(() => {
      let alive = true;

      if (!teacherId) {
        setProfile(null);
        setReviews([]);
        setError(null);
        return;
      }

      const safeTeacherId = teacherId;

      async function load() {
        try {
          setLoading(true);
          setError(null);

          const [profileData, followStatus, teacherReviews] =
            await Promise.all([
              getTeacherProfile(safeTeacherId),
              getFollowStatus(safeTeacherId),
              getTeacherReviews(safeTeacherId),
            ]);

          if (!alive) return;

          setProfile(profileData as TeacherProfile);
          setFollowing(!!followStatus?.following);
          setReviews(Array.isArray(teacherReviews) ? teacherReviews : []);
        } catch (e: any) {
          if (!alive) return;
          setError(e?.message ?? "Failed to load teacher profile");
        } finally {
          if (alive) setLoading(false);
        }
      }

      load();

      return () => {
        alive = false;
      };
    }, [teacherId]);

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
    const avatar = mediaUrl(profile?.image_url || profile?.avatar_url || null);

    const galleryImages = getGalleryImages(profile);
    const coverImage = galleryImages[0] ?? avatar ?? null;
    const sideImageOne = galleryImages[1] ?? galleryImages[0] ?? avatar ?? null;
    const sideImageTwo = galleryImages[2] ?? galleryImages[1] ?? avatar ?? null;

    const bio =
      profile?.bio?.trim() ||
      "This teacher has not added a bio yet. Check their sessions to learn more about what they teach.";

    return (
      <>
        <BottomSheetModal
          ref={modalRef}
          index={0}
          snapPoints={["88%", "96%"]}
          enablePanDownToClose
          onDismiss={onClose}
          handleIndicatorStyle={styles.handleIndicator}
          backgroundStyle={styles.sheetBackground}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              pressBehavior="close"
              opacity={0.32}
            />
          )}
        >
          <View style={styles.sheetRoot}>
            <View style={styles.sheetInner}>
              <Pressable
                onPress={() => modalRef.current?.dismiss()}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>

              <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: 34 + insets.bottom },
                ]}
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
                    <View style={styles.profileCard}>
                      <Pressable
                        disabled={!coverImage}
                        onPress={() => coverImage && setExpandedImageUri(coverImage)}
                        style={styles.coverWrap}
                      >
                        {coverImage ? (
                          <Image
                            source={{ uri: coverImage }}
                            style={styles.coverImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.coverPlaceholder}>
                            <Ionicons
                              name="image-outline"
                              size={24}
                              color={COLORS.textMuted}
                            />
                          </View>
                        )}

                        <View style={styles.coverOverlay} />
                      </Pressable>

                      <View style={styles.contentWrap}>
                        <View style={styles.topContentRow}>
                          <View style={styles.leftIntro}>
                            <Pressable
                              disabled={!avatar}
                              onPress={() => avatar && setExpandedImageUri(avatar)}
                              style={styles.avatarRing}
                            >
                              {avatar ? (
                                <Image source={{ uri: avatar }} style={styles.avatar} />
                              ) : (
                                <View style={styles.avatarFallback}>
                                  <Text style={styles.avatarFallbackText}>
                                    {teacherName.slice(0, 1).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </Pressable>

                            <Text style={styles.name} numberOfLines={2}>
                              {teacherName}
                            </Text>

                            <Text style={styles.tagline}>Teacher</Text>

                            {locationLabel?.trim() ? (
                              <View style={styles.locationRow}>
                                <Ionicons
                                  name="location-outline"
                                  size={14}
                                  color={COLORS.textMuted}
                                />
                                <Text style={styles.locationText} numberOfLines={1}>
                                  {locationLabel.trim()}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.galleryRow}>
                            <GalleryTile
                              uri={sideImageOne}
                              index={1}
                              onPress={setExpandedImageUri}
                            />

                            <GalleryTile
                              uri={sideImageTwo}
                              index={2}
                              onPress={setExpandedImageUri}
                            />
                          </View>
                        </View>

                        <View style={styles.bioBox}>
                          <View style={styles.bioHeader}>
                            <View style={styles.bioIconCircle}>
                              <Ionicons
                                name="person-outline"
                                size={18}
                                color="#FFFFFF"
                              />
                            </View>

                            <Text style={styles.bioTitle}>Bio</Text>
                          </View>

                          <Text style={styles.bioText}>{bio}</Text>

                          <Text style={styles.bioCount}>
                            {Math.min(bio.length, 300)} / 300
                          </Text>
                        </View>
                      </View>
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
                        onPress={() => {
                          onBeforeNavigateAway?.();
  modalRef.current?.dismiss();
                          safePush({
                            pathname:
                              "/(modal)/private-session-request/[teacherId]",
                            params: {
                              teacherId: profile.id,
                              teacherName,
                            },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.requestButton,
                          pressed && styles.requestButtonPressed,
                        ]}
                      >
                        <Ionicons
                          name="paper-plane-outline"
                          size={22}
                          color="#FFFFFF"
                        />

                        <Text style={styles.requestButtonText}>Request 1:1</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </BottomSheetScrollView>
            </View>
          </View>
        </BottomSheetModal>

        <Modal
          transparent
          visible={!!expandedImageUri}
          animationType="fade"
          onRequestClose={() => setExpandedImageUri(null)}
        >
          <View style={styles.imageModalBackdrop}>
            <Pressable
              style={styles.imageModalClose}
              onPress={() => setExpandedImageUri(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>

            {expandedImageUri ? (
              <Image
                source={{ uri: expandedImageUri }}
                style={styles.expandedImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Modal>
      </>
    );
  },
);

const styles = StyleSheet.create({
  handleIndicator: {
    width: 44,
    height: 5,
    backgroundColor: COLORS.indicator,
  },

  sheetBackground: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
  },

  sheetRoot: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 8,
  },

  sheetInner: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },

  closeButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(5,7,15,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
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

  profileCard: {
    borderRadius: 24,
    backgroundColor: "rgba(5,7,15,0.72)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    overflow: "hidden",
    marginBottom: 16,
  },

  coverWrap: {
    height: 230,
    backgroundColor: COLORS.surfaceSoft,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  coverImage: {
    width: "100%",
    height: "100%",
  },

  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  contentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  topContentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  leftIntro: {
    flex: 1,
    alignItems: "flex-start",
  },

  galleryRow: {
    width: 214,
    flexDirection: "row",
    gap: 10,
    paddingTop: 28,
  },

  galleryTile: {
    flex: 1,
    height: 104,
    borderRadius: 16,
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
  },

  galleryPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },

  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: COLORS.accent,
    marginTop: -48,
    marginBottom: 12,
  },

  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 46,
    borderWidth: 4,
    borderColor: COLORS.bg,
  },

  avatarFallback: {
    flex: 1,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: COLORS.bg,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallbackText: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
  },

  name: {
    color: COLORS.text,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 35,
    marginBottom: 3,
  },

  tagline: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },

  locationText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  bioBox: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(5,7,15,0.62)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 18,
    marginTop: 20,
  },

  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  bioIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(111,146,255,0.18)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  bioTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  bioText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 24,
  },

  bioCount: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 14,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 2,
  },

  followButton: {
    flex: 1,
    minHeight: 56,
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
    minHeight: 56,
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
    fontSize: 16,
    fontWeight: "900",
  },

  requestButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  imageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  imageModalClose: {
    position: "absolute",
    top: 54,
    right: 22,
    zIndex: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  expandedImage: {
    width: "100%",
    height: "82%",
  },
});