import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { mediaUrl } from "@/src/utils/mediaUrl";
import { autoCapitalize } from "@/src/utils/text";
import { ExplainCard } from "@/src/components/ui/ExplainCard";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { safeReplace } from "@/src/utils/safeRouter";
import {
  createTeacherProfile,
  getMyTeacherProfile,
} from "../../src/api/teacher";
import { uploadImage } from "../../src/api/uploads";
import { authStore } from "../../src/store/auth.store";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppButton } from "@/src/components/ui/AppButton";
import { AppScreen } from "@/src/components/ui/AppScreen";

const BIO_MAX_LENGTH = 300;

const COLORS = {
  bg: "#12051F",
  surface: "#241032",
  surfaceSoft: "#321447",
  surfaceDeep: "#0B0314",

  text: "#FDF7FF",
  textSoft: "rgba(244,229,255,0.76)",
  textMuted: "rgba(244,229,255,0.52)",

  border: "rgba(216,180,254,0.16)",
  borderStrong: "rgba(216,180,254,0.42)",

  accent: "#C084FC",
  accentStrong: "#A855F7",
  accentSoft: "rgba(192,132,252,0.18)",
  accentBorder: "rgba(216,180,254,0.38)",

  buttonSecondary: "#321447",
  teacherCard: "#1B0829",
  teacherCardInner: "#100318",

  divider: "rgba(255,255,255,0.07)",
};

function ProfileStyleCard({
  icon,
  title,
  body,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>

          <View style={styles.cardHeaderTextWrap}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </View>
        </View>

        {body ? <Text style={styles.cardBody}>{body}</Text> : null}

        {children}
      </View>
    </View>
  );
}

function previewUri(uri?: string | null) {
  if (!uri) return null;
  return uri.startsWith("file:") ? uri : mediaUrl(uri);
}

function PreviewGalleryTile({
  uri,
  index,
}: {
  uri: string | null;
  index: number;
}) {
  return (
    <View style={styles.previewSideTile}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.previewSideImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.previewSidePlaceholder}>
          <Ionicons name="image-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.previewSidePlaceholderText}>Photo {index}</Text>
        </View>
      )}
    </View>
  );
}

export default function TeacherProfileScreen() {
  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);
  const currentUser = authStore((s: any) => s.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [imageUrl3, setImageUrl3] = useState("");
const [showIntroCard, setShowIntroCard] = useState(!hasTeacherProfile);
  const isEditing = useMemo(
    () => hasTeacherProfile || !!fullName || !!bio || !!profileImageUrl,
    [hasTeacherProfile, fullName, bio, profileImageUrl],
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const existing: any = await getMyTeacherProfile();

        if (!alive || !existing) return;

        setFullName(existing.full_name ?? existing.display_name ?? "");
        setBio(String(existing.bio ?? "").slice(0, BIO_MAX_LENGTH));
        setProfileImageUrl(existing.image_url ?? existing.avatar_url ?? "");

        const gallery = Array.isArray(existing.gallery_image_urls)
          ? existing.gallery_image_urls
          : Array.isArray(existing.image_urls)
            ? existing.image_urls
            : [];

        setImageUrl1(gallery[0] ?? existing.image_url_1 ?? "");
        setImageUrl2(gallery[1] ?? existing.image_url_2 ?? "");
        setImageUrl3(gallery[2] ?? existing.image_url_3 ?? "");
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasTeacherProfile && !fullName.trim()) {
      const name =
        currentUser?.full_name ??
        currentUser?.display_name ??
        currentUser?.first_name ??
        currentUser?.name ??
        "";

      if (name) setFullName(name);
    }
  }, [currentUser, hasTeacherProfile, fullName]);

  async function pickImage(setter: (uri: string) => void) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo access to choose images.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.55,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const sourceUri = result.assets[0].uri;
    const extension = sourceUri.split(".").pop() || "jpg";
    const safeUri = `${FileSystem.cacheDirectory}teacher-profile-${Date.now()}.${extension}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: safeUri,
    });

    setter(safeUri);
  }

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }

    if (!profileImageUrl.trim()) {
  Alert.alert(
    "Profile photo required",
    "Please upload at least a profile photo before creating your teacher profile."
  );

  return;
}

    const galleryImages = [imageUrl1, imageUrl2, imageUrl3]
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSaving(true);

      const uploadedProfileImageUrl = profileImageUrl.trim()
        ? profileImageUrl.startsWith("file:")
          ? await uploadImage(profileImageUrl)
          : profileImageUrl.trim()
        : undefined;

      const uploadedGalleryImages: string[] = [];

      for (const image of galleryImages) {
        if (image.startsWith("file:")) {
          const uploadedUrl = await uploadImage(image);
          uploadedGalleryImages.push(uploadedUrl);
        } else {
          uploadedGalleryImages.push(image);
        }
      }

      await createTeacherProfile({
        full_name: fullName.trim(),
        bio: bio.trim().slice(0, BIO_MAX_LENGTH) || undefined,
        image_url: uploadedProfileImageUrl,
        gallery_image_urls: uploadedGalleryImages,
        image_url_1: uploadedGalleryImages[0],
        image_url_2: uploadedGalleryImages[1],
        image_url_3: uploadedGalleryImages[2],
      } as any);

      await authStore.getState().setHasTeacherProfile(true);

      Alert.alert(
        isEditing ? "Profile updated" : "Teacher profile created",
        "Your teacher profile has been saved.",
        [
          {
            text: "OK",
            onPress: () => safeReplace("/(teacher)/dashboard"),
          },
        ],
      );
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not save teacher profile.";

      Alert.alert(
        "Profile error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  const profileUri = previewUri(profileImageUrl.trim());
  const coverUri = previewUri(imageUrl1.trim());
  const sideImageOneUri = previewUri(imageUrl2.trim());
  const sideImageTwoUri = previewUri(imageUrl3.trim());

  const previewName = fullName.trim() || "Your name";
  const previewBio = bio.trim() || "Your teacher bio will appear here.";

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.screen}
          showsVerticalScrollIndicator={false}
        >
          {showIntroCard && !hasTeacherProfile ? (
  <Modal transparent visible animationType="fade">
    <View style={styles.explainModalBackdrop}>
      <View style={styles.explainModalCard}>
<ExplainCard
  title="Become a teacher on Elevator"
  iconName="person-circle-outline"
  body="Create your teacher profile so learners can discover and trust you.

Profiles with clear photos and friendly descriptions usually get more bookings."
  ctaText="Create profile"
  onPressCta={() => setShowIntroCard(false)}
  dismissText="Maybe later"
onDismiss={() => {
  setShowIntroCard(false);
  safeReplace("/(learner)/map");
}}
  accentColor={COLORS.accentStrong}
  backgroundColor={COLORS.teacherCard}
  borderColor={COLORS.accentBorder}
/>
      </View>
    </View>
  </Modal>
) : null}
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Teacher workspace</Text>
            </View>

            <Text style={styles.title}>
              {hasTeacherProfile
                ? "Edit teacher profile"
                : "Create your teacher profile"}
            </Text>

            <Text style={styles.subtitle}>
              Manage the purple teacher profile learners see when they open
              your teacher view.
            </Text>
          </View>

          {loading ? (
            <ProfileStyleCard icon="person-outline" title="Profile">
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading profile…</Text>
              </View>
            </ProfileStyleCard>
          ) : (
            <>
              <ProfileStyleCard
                icon="create-outline"
                title="Teacher details"
                body="Add the essentials learners use to trust and book you."
              >
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"                
                    placeholder="Aoife Murphy"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Bio</Text>
                    <Text style={styles.counterText}>
                      {bio.length}/{BIO_MAX_LENGTH}
                    </Text>
                  </View>

<TextInput
  value={bio}
  onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
  autoCapitalize="sentences"
  placeholder="Tell learners about your teaching style, experience, and what makes your sessions special."
  placeholderTextColor={COLORS.textMuted}
  multiline
  maxLength={BIO_MAX_LENGTH}
  style={styles.textArea}
  textAlignVertical="top"
/>
                </View>

                <View style={styles.noticeBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={COLORS.accent}
                  />
                  <Text style={styles.noticeText}>
                    Keep communication on-platform. Contact details and external
                    payment requests are not allowed.
                  </Text>
                </View>
              </ProfileStyleCard>

              <ProfileStyleCard
                icon="image-outline"
                title="Profile photo"
                body="This circular photo appears beside your name on your teacher profile."
              >
                <Pressable
                  onPress={() => pickImage(setProfileImageUrl)}
                  style={styles.ctaButton}
                >
                  <Ionicons name="image-outline" size={18} color={COLORS.text} />
                  <Text style={styles.ctaButtonText}>
                    {profileImageUrl
                      ? "Change profile photo"
                      : "Choose profile photo"}
                  </Text>
                </Pressable>

                {profileUri ? (
                  <View style={styles.profilePreviewWrap}>
                    <Image
                      source={{ uri: profileUri }}
                      style={styles.profilePreview}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
              </ProfileStyleCard>

              <ProfileStyleCard
                icon="images-outline"
                title="Profile images"
                body="Gallery image 1 is your cover photo. Images 2 and 3 appear in the side gallery."
              >
                <View style={styles.galleryPickerStack}>
                  <Pressable
                    onPress={() => pickImage(setImageUrl1)}
                    style={styles.ctaButton}
                  >
                    <Ionicons name="albums-outline" size={18} color={COLORS.text} />
                    <Text style={styles.ctaButtonText}>
                      {imageUrl1 ? "Change cover photo" : "Choose cover photo"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => pickImage(setImageUrl2)}
                    style={styles.ctaButton}
                  >
                    <Ionicons name="images-outline" size={18} color={COLORS.text} />
                    <Text style={styles.ctaButtonText}>
                      {imageUrl2
                        ? "Change side gallery photo 1"
                        : "Choose side gallery photo 1"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => pickImage(setImageUrl3)}
                    style={styles.ctaButton}
                  >
                    <Ionicons name="images-outline" size={18} color={COLORS.text} />
                    <Text style={styles.ctaButtonText}>
                      {imageUrl3
                        ? "Change side gallery photo 2"
                        : "Choose side gallery photo 2"}
                    </Text>
                  </Pressable>
                </View>
              </ProfileStyleCard>

<ProfileStyleCard
  icon="eye-outline"
  title="Teacher view preview"
  body="This matches the learner-facing teacher profile."
>
  <View style={styles.previewProfileCard}>
    <View style={styles.previewCoverWrap}>
      {coverUri ? (
        <Image
          source={{ uri: coverUri }}
          style={styles.previewCoverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.previewCoverPlaceholder}>
          <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
        </View>
      )}

      <View style={styles.previewCoverOverlay} />
    </View>

    <View style={styles.previewContentWrap}>
      <View style={styles.previewTopContentRow}>
        <View style={styles.previewLeftIntro}>
          <View style={styles.previewAvatarRing}>
            {profileUri ? (
              <Image
                source={{ uri: profileUri }}
                style={styles.previewAvatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewAvatarFallback}>
                <Text style={styles.previewAvatarFallbackText}>
                  {previewName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.previewName} numberOfLines={2}>
            {previewName}
          </Text>

          <Text style={styles.previewTagline}>Teacher</Text>
        </View>

        <View style={styles.previewGalleryRow}>
          <PreviewGalleryTile uri={sideImageOneUri} index={2} />
          <PreviewGalleryTile uri={sideImageTwoUri} index={3} />
        </View>
      </View>

      <View style={styles.previewBioBox}>
        <View style={styles.previewBioHeader}>
          <View style={styles.previewBioIconCircle}>
            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
          </View>

          <Text style={styles.previewBioTitle}>Bio</Text>
        </View>

        <Text style={styles.previewBio}>{previewBio}</Text>

        <Text style={styles.previewBioCount}>
          {Math.min(previewBio.length, BIO_MAX_LENGTH)} / {BIO_MAX_LENGTH}
        </Text>
      </View>
    </View>
  </View>
</ProfileStyleCard>

              <View style={styles.actionStack}>
                <AppButton
                  title={
                    saving
                      ? "Saving..."
                      : hasTeacherProfile
                        ? "Save profile"
                        : "Create profile"
                  }
                  onPress={() => {
                    if (!saving) handleSave();
                  }}
                />

                <AppButton
                  title="Cancel"
                  onPress={() => {
                    if (!saving) router.back();
                  }}
                  variant="secondary"
                />
              </View>
            </>
          )}
        </ScrollView>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  
  hero: {
    marginBottom: 18,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.accentStrong,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  cardOuter: {
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.teacherCard,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.teacherCardInner,
    overflow: "hidden",
    padding: 16,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },

  fieldBlock: {
    marginBottom: 14,
  },

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  counterText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  noticeText: {
    flex: 1,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },

  ctaButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  ctaButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },

  galleryPickerStack: {
    gap: 10,
  },

  profilePreviewWrap: {
    marginTop: 14,
    alignItems: "flex-start",
  },

  profilePreview: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.surfaceSoft,
  },
previewProfileCard: {
  borderRadius: 24,
  backgroundColor: "rgba(5,7,15,0.72)",
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
  overflow: "hidden",
},

previewCoverWrap: {
  height: 230,
  backgroundColor: COLORS.surfaceSoft,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
},

previewCoverImage: {
  width: "100%",
  height: "100%",
},

previewCoverPlaceholder: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
},

previewCoverOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.12)",
},

previewContentWrap: {
  paddingHorizontal: 16,
  paddingBottom: 16,
},

previewTopContentRow: {
  flexDirection: "row",
  gap: 12,
  alignItems: "flex-start",
},

previewLeftIntro: {
  flex: 1,
  alignItems: "flex-start",
},
previewGalleryRow: {
  width: 142,
  flexDirection: "row",
  gap: 8,
  paddingTop: 24,
},

previewSideTile: {
  flex: 1,
  height: 74,
  borderRadius: 16,
  overflow: "hidden",
  backgroundColor: COLORS.surfaceSoft,
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
},

previewSideImage: {
  width: "100%",
  height: "100%",
},

previewSidePlaceholder: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},

previewSidePlaceholderText: {
  color: COLORS.textMuted,
  fontSize: 11,
  fontWeight: "800",
},

previewAvatarRing: {
  width: 82,
  height: 82,
  borderRadius: 41,
  padding: 4,
  backgroundColor: COLORS.accent,
  marginTop: -48,
  marginBottom: 12,
},

previewAvatar: {
  width: "100%",
  height: "100%",
  borderRadius: 37,
  borderWidth: 4,
  borderColor: COLORS.teacherCardInner,
},

previewAvatarFallback: {
  flex: 1,
  borderRadius: 37,
  borderWidth: 4,
  borderColor: COLORS.teacherCardInner,
  backgroundColor: COLORS.surfaceSoft,
  alignItems: "center",
  justifyContent: "center",
},

previewAvatarFallbackText: {
  color: COLORS.text,
  fontSize: 28,
  fontWeight: "900",
},
explainModalBackdrop: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.72)",
  justifyContent: "center",
  paddingHorizontal: 20,
},

explainModalCard: {
  width: "100%",
},
previewName: {
  color: COLORS.text,
  fontSize: 24,
  fontWeight: "900",
  lineHeight: 28,
  marginBottom: 3,
},

previewTagline: {
  color: COLORS.accent,
  fontSize: 15,
  fontWeight: "900",
  lineHeight: 20,
},

previewBioBox: {
  width: "100%",
  borderRadius: 22,
  backgroundColor: "rgba(5,7,15,0.62)",
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
  padding: 18,
  marginTop: 20,
},

previewBioHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
},

previewBioIconCircle: {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "rgba(111,146,255,0.18)",
  borderWidth: 1,
  borderColor: COLORS.accentBorder,
  alignItems: "center",
  justifyContent: "center",
},

previewBioTitle: {
  color: COLORS.text,
  fontSize: 20,
  fontWeight: "900",
},

previewBio: {
  color: COLORS.textSoft,
  fontSize: 15,
  lineHeight: 24,
},

previewBioCount: {
  color: COLORS.textMuted,
  fontSize: 13,
  fontWeight: "800",
  textAlign: "right",
  marginTop: 14,
},
  actionStack: {
    gap: 10,
    marginTop: 4,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  loadingText: {
    color: COLORS.textSoft,
    fontSize: 14,
    marginTop: 10,
  },
});