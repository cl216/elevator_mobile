import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  createTeacherProfile,
  getMyTeacherProfile,
} from "../../src/api/teacher";
import { authStore } from "../../src/store/auth.store";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { AppButton } from "@/src/components/ui/AppButton";

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

  button: "#3F6AE0",
  buttonPressed: "#355CC2",
  buttonSecondary: "#121A2C",

  divider: "rgba(255,255,255,0.06)",
};

function DashboardStyleCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
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
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.sectionSubtitle}>{subtitle}</Text>
              ) : null}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </View>
        </View>

        {children}
      </View>
    </View>
  );
}

export default function TeacherProfileScreen() {
  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);

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

        setFullName(existing.full_name ?? "");
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

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }

    if (!profileImageUrl.trim()) {
      Alert.alert("Missing profile photo", "Please add a profile image URL.");
      return;
    }

    const galleryImages = [imageUrl1, imageUrl2, imageUrl3]
      .map((item) => item.trim())
      .filter(Boolean);

    if (galleryImages.length === 0) {
      Alert.alert(
        "Missing gallery images",
        "Please add at least 1 extra image for your teacher profile.",
      );
      return;
    }

    try {
      setSaving(true);

      await createTeacherProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || undefined,
        image_url: profileImageUrl.trim(),
        gallery_image_urls: galleryImages,
        image_url_1: imageUrl1.trim() || undefined,
        image_url_2: imageUrl2.trim() || undefined,
        image_url_3: imageUrl3.trim() || undefined,
      } as any);

      await authStore.getState().setHasTeacherProfile(true);

      Alert.alert(
        isEditing ? "Profile updated" : "Teacher profile created",
        "Your teacher profile has been saved.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(teacher)/dashboard"),
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Teacher</Text>
            </View>

            <Text style={styles.title}>
              {hasTeacherProfile
                ? "Edit profile"
                : "Create your teacher profile"}
            </Text>

            <Text style={styles.subtitle}>
              Manage the profile learners see when they open your teacher view.
            </Text>
          </View>

          {loading ? (
            <DashboardStyleCard icon="person-outline" title="Profile">
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading profile…</Text>
              </View>
            </DashboardStyleCard>
          ) : (
            <>
              <DashboardStyleCard
                icon="create-outline"
                title="Teacher details"
                subtitle="Add the essentials learners use to trust and book you."
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
              </DashboardStyleCard>

              <DashboardStyleCard
                icon="image-outline"
                title="Profile photo"
                subtitle="This is the main image learners will associate with you."
              >
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Main profile image URL</Text>
                  <TextInput
                    value={profileImageUrl}
                    onChangeText={setProfileImageUrl}
                    placeholder="https://example.com/profile-photo.jpg"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                {profileImageUrl.trim() ? (
                  <View style={styles.profilePreviewWrap}>
                    <Image
                      source={{ uri: profileImageUrl.trim() }}
                      style={styles.profilePreview}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
              </DashboardStyleCard>

              <DashboardStyleCard
                icon="images-outline"
                title="Gallery images"
                subtitle="Add 1 to 3 extra images to make your teacher view feel richer."
              >
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Gallery image 1</Text>
                  <TextInput
                    value={imageUrl1}
                    onChangeText={setImageUrl1}
                    placeholder="https://example.com/teaching-photo-1.jpg"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Gallery image 2</Text>
                  <TextInput
                    value={imageUrl2}
                    onChangeText={setImageUrl2}
                    placeholder="https://example.com/teaching-photo-2.jpg"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Gallery image 3</Text>
                  <TextInput
                    value={imageUrl3}
                    onChangeText={setImageUrl3}
                    placeholder="https://example.com/teaching-photo-3.jpg"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              </DashboardStyleCard>

              <DashboardStyleCard
                icon="eye-outline"
                title="Teacher view preview"
                subtitle="A quick preview of how your profile may feel to learners."
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
                      <View style={styles.previewAvatarFallback} />
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
              </DashboardStyleCard>

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
    if (!saving) {
      handleSave();
    }
  }}
/>

<AppButton
  title="Cancel"
  onPress={() => {
    if (!saving) {
      router.back();
    }
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
  content: {
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: 40,
  flexGrow: 1,  },

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
    alignItems: "flex-start",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardHeaderCopy: {
    flex: 1,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },

  sectionSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
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

  profilePreviewWrap: {
    marginTop: 4,
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