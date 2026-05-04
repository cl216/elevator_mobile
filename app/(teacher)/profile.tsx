import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import {
  createTeacherProfile,
  getMyTeacherProfile,
} from "../../src/api/teacher";
import { uploadImage } from "../../src/api/uploads";
import { authStore } from "../../src/store/auth.store";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppButton } from "@/src/components/ui/AppButton";
import { AppScreen } from "@/src/components/ui/AppScreen";

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
  accentBorder: "rgba(111,146,255,0.25)",

  buttonSecondary: "#121A2C",
  divider: "rgba(255,255,255,0.06)",
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
        setBio(existing.bio ?? "");
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
      Alert.alert("Permission needed", "Please allow photo access to choose images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
quality: 0.55,    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setter(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
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
  bio: bio.trim() || undefined,
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
            onPress: () =>  safeReplace("/(teacher)/dashboard"),
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

  const previewImages = [imageUrl1, imageUrl2, imageUrl3]
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.screen}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Teacher</Text>
            </View>

            <Text style={styles.title}>
              {hasTeacherProfile ? "Edit profile" : "Create your teacher profile"}
            </Text>

            <Text style={styles.subtitle}>
              Manage the profile learners see when they open your teacher view.
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
                    placeholder="Aoife Murphy"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell learners about your teaching style, experience, and what makes your sessions special."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    maxLength={1000}
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
                body="Optional for now. This is the main image learners associate with you."
              >
                <Pressable
                  onPress={() => pickImage(setProfileImageUrl)}
                  style={styles.ctaButton}
                >
                  <Ionicons name="image-outline" size={18} color={COLORS.text} />
                  <Text style={styles.ctaButtonText}>
                    {profileImageUrl ? "Change profile photo" : "Choose profile photo"}
                  </Text>
                </Pressable>

                {profileImageUrl.trim() ? (
                  <View style={styles.profilePreviewWrap}>
                    <Image
                      source={{ uri: profileImageUrl.trim() }}
                      style={styles.profilePreview}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
              </ProfileStyleCard>

              <ProfileStyleCard
                icon="images-outline"
                title="Gallery images"
                body="Optional for now. Add up to 3 extra images to make your teacher view feel richer."
              >
                <View style={styles.galleryPickerStack}>
                  {[setImageUrl1, setImageUrl2, setImageUrl3].map((setter, index) => {
                    const value = [imageUrl1, imageUrl2, imageUrl3][index];

                    return (
                      <Pressable
                        key={index}
                        onPress={() => pickImage(setter)}
                        style={styles.ctaButton}
                      >
                        <Ionicons name="images-outline" size={18} color={COLORS.text} />
                        <Text style={styles.ctaButtonText}>
                          {value
                            ? `Change gallery image ${index + 1}`
                            : `Choose gallery image ${index + 1}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ProfileStyleCard>

              <ProfileStyleCard
                icon="eye-outline"
                title="Teacher view preview"
                body="A quick preview of how your profile may feel to learners."
              >
                <View style={styles.previewGallery}>
                  {[0, 1, 2].map((index) => {
                    const imageUrl = previewImages[index];

                    return (
                      <View key={index} style={styles.previewTile}>
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.previewTileImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.previewTilePlaceholder}>
                            <Text style={styles.previewTilePlaceholderText}>
                              Photo
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.previewContent}>
                  <View style={styles.previewTeacherRow}>
                    {profileImageUrl.trim() ? (
                      <Image
                        source={{ uri: profileImageUrl.trim() }}
                        style={styles.previewAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.previewAvatarFallback}>
                        <Ionicons
                          name="person-outline"
                          size={24}
                          color={COLORS.textMuted}
                        />
                      </View>
                    )}

                    <View style={styles.previewTextWrap}>
                      <Text style={styles.previewName}>
                        {fullName.trim() || "Your name"}
                      </Text>
                      <Text style={styles.previewBio} numberOfLines={3}>
                        {bio.trim() || "Your teacher bio will appear here."}
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(111,146,255,0.12)",
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
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
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
    backgroundColor: "rgba(111,146,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.28)",
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
    fontWeight: "800",
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

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  textArea: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
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
    fontWeight: "800",
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
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },

  previewGallery: {
    flexDirection: "row",
    gap: 8,
    height: 118,
    marginBottom: 14,
  },

  previewTile: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  previewTileImage: {
    width: "100%",
    height: "100%",
  },

  previewTilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
  },

  previewTilePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },

  previewContent: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 14,
  },

  previewTeacherRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  previewTextWrap: {
    flex: 1,
    justifyContent: "center",
  },

  previewAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  previewAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  previewName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },

  previewBio: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
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