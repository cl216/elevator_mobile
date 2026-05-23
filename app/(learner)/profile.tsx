import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { markApiLogoutFinished } from "@/src/api/client";
import { deleteAccount } from "@/src/api/auth";
import { api } from "@/src/api/client";
import { uploadImage } from "@/src/api/uploads";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";
import { authStore } from "@/src/store/auth.store";
import { mediaUrl } from "@/src/utils/mediaUrl";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

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

  teacherPurple: "#A855F7",
  teacherPurpleSoft: "rgba(168,85,247,0.16)",
  teacherPurpleBorder: "rgba(168,85,247,0.34)",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.28)",
  warningText: "#FFD666",
};

const handleDeleteAccount = () => {
  Alert.alert(
    "Delete your account?",
    "This will permanently delete:\n\n• Your profile\n• Your sessions\n• Your bookings\n• Your requests\n• Your notifications\n\nThis action cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete permanently",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAccount();
            await authStore.getState().clearAuthLocalOnly();
            safeReplace("/(auth)/login");
          } catch {
            Alert.alert("Error", "Could not delete account.");
          }
        },
      },
    ],
  );
};

type ProfileCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  danger?: boolean;
  teacher?: boolean;
};

function ProfileCard({
  icon,
  title,
  body,
  cta,
  onPress,
  danger = false,
  teacher = false,
}: ProfileCardProps) {
  return (
    <View
      style={[
        styles.cardOuter,
        danger && styles.cardOuterDanger,
        teacher && styles.cardOuterTeacher,
      ]}
    >
      <View style={styles.cardInner}>
        <Pressable onPress={onPress} style={styles.cardPressable}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.iconCircle,
                danger && styles.iconCircleDanger,
                teacher && styles.iconCircleTeacher,
              ]}
            >
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

          <Text style={styles.cardBody}>{body}</Text>

          <View
            style={[
              styles.ctaButton,
              danger && styles.ctaButtonSecondary,
              teacher && styles.ctaButtonTeacher,
            ]}
          >
            <Text
              style={[
                styles.ctaButtonText,
                danger && styles.ctaButtonTextSecondary,
                teacher && styles.ctaButtonTextTeacher,
              ]}
            >
              {cta}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
const params = useLocalSearchParams<{
  returnToSessionId?: string;
  needsPhotoForBooking?: string;
  introMessage?: string;
}>();

  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);
  const logout = authStore((s) => s.logout);
  const isAdmin = authStore((s) => s.isAdmin);
  const imageUrl = authStore((s) => s.imageUrl);
  const setImageUrl = authStore((s) => s.setImageUrl);

  const [savingPhoto, setSavingPhoto] = useState(false);

  const isBookingPhotoFlow = params.needsPhotoForBooking === "1";
  const returnToSessionId = params.returnToSessionId
    ? String(params.returnToSessionId)
    : "";

const handleLogout = async () => {
  try {
    await logout();
  } finally {
    markApiLogoutFinished();
    safeReplace("/(auth)/login");
  }
};

  async function handleChooseProfilePhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to choose a profile photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setSavingPhoto(true);

      const sourceUri = result.assets[0].uri;
      const extension = sourceUri.split(".").pop() || "jpg";
      const safeUri = `${FileSystem.cacheDirectory}profile-${Date.now()}.${extension}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: safeUri,
      });

      const uploadedUrl = await uploadImage(safeUri);

      const res = await api.patch("/auth/me/profile-photo", {
        image_url: uploadedUrl,
      });

      const nextImageUrl = res.data?.image_url ?? uploadedUrl;

      await setImageUrl(nextImageUrl);

      if (isBookingPhotoFlow && returnToSessionId) {
        Alert.alert(
          "Photo added",
          "Great — you can now continue your booking.",
          [
            {
              text: "Continue booking",
              onPress: () =>
                safeReplace({
                  pathname: "/(modal)/booking/[sessionId]",
                  params: {
                    sessionId: returnToSessionId,
                        introMessage: String(params.introMessage ?? ""),
                  },
                }),
            },
          ],
        );

        return;
      }

      Alert.alert(
        "Profile photo updated",
        "Teachers will now be able to recognize you when you book.",
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not update profile photo.";

      Alert.alert(
        "Photo error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <View style={styles.screen}>
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Profile</Text>
            </View>

            <Text style={styles.title}>
              {isBookingPhotoFlow
                ? "Add a profile photo"
                : "Manage your account"}
            </Text>

            <Text style={styles.subtitle}>
              {isBookingPhotoFlow
                ? "Teachers need a clear photo so they can recognise learners at the session."
                : "Payments, teaching access, private requests, and account settings in one place."}
            </Text>
          </View>

          {isBookingPhotoFlow ? (
            <View style={styles.bookingPhotoNotice}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={COLORS.warningText}
              />

              <View style={styles.bookingPhotoNoticeTextWrap}>
                <Text style={styles.bookingPhotoNoticeTitle}>
                  Add a photo to continue booking
                </Text>

                <Text style={styles.bookingPhotoNoticeBody}>
                  Upload a clear profile photo here. Once it uploads
                  successfully, you’ll be taken straight back to your booking.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.cardOuter}>
            <View style={styles.cardInner}>
              <View style={styles.photoCard}>
                <View style={styles.avatarOuter}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: mediaUrl(imageUrl)! }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={34}
                      color={COLORS.textMuted}
                    />
                  )}
                </View>

                <View style={styles.photoTextWrap}>
                  <Text style={styles.cardTitle}>Profile photo</Text>

                  <Text style={styles.cardBody}>
                    Add a clear photo so teachers can recognize you when you
                    attend a session.
                  </Text>

                  <Pressable
                    onPress={handleChooseProfilePhoto}
                    disabled={savingPhoto}
                    style={[
                      styles.ctaButton,
                      savingPhoto && styles.buttonDisabled,
                      isBookingPhotoFlow && styles.ctaButtonWarning,
                    ]}
                  >
                    {savingPhoto ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.ctaButtonText,
                          isBookingPhotoFlow && styles.ctaButtonTextWarning,
                        ]}
                      >
                        {imageUrl ? "Change photo" : "Add photo"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

{isAdmin ? (
  <>
    <ProfileCard
      icon="shield-checkmark-outline"
      title="Admin dashboard"
      body="Manage users, pending sessions, categories, bookings, and moderation."
      cta="Open admin dashboard"
      onPress={() => router.push("/(admin)/dashboard")}
    />

    <ProfileCard
      icon="checkmark-done-outline"
      title="Session review"
      body="Approve or reject pending sessions before they appear to learners."
      cta="Open session review"
      onPress={() => router.push("/(admin)/session-review")}
    />
  </>
) : null}

          <ProfileCard
            icon={hasTeacherProfile ? "school-outline" : "add-circle-outline"}
            title={hasTeacherProfile ? "Teacher settings" : "Teach on Elevator"}
            body={
              hasTeacherProfile
                ? "Open your teacher dashboard, manage sessions, payouts, and teaching profile."
                : "Create a teacher profile and start hosting classes on Elevator."
            }
            cta={
              hasTeacherProfile
                ? "Open teacher dashboard"
                : "Create teacher profile"
            }
            teacher
            onPress={() =>
              hasTeacherProfile
                ? safePush("/(teacher)/dashboard")
                : safePush("/(teacher)/profile")
            }
          />

          <ProfileCard
            icon="card-outline"
            title="Payment methods"
            body="View saved cards for quicker checkout and manage how you pay."
            cta="View saved cards"
            onPress={() => safePush("/(learner)/payment-methods")}
          />

          <ProfileCard
            icon="paper-plane-outline"
            title="Private session requests"
            body="Track your private 1:1 requests, review statuses, and see any teacher notes."
            cta="View requests"
            onPress={() => safePush("/(learner)/private-session-requests")}
          />

          <ProfileCard
            icon="trash-outline"
            title="Delete account"
            body="Permanently delete your account and all associated data. This cannot be undone."
            cta="Delete account"
            onPress={handleDeleteAccount}
            danger
          />

          <ProfileCard
            icon="person-circle-outline"
            title="Account"
            body="Manage your account and sign out securely when needed."
            cta="Logout"
            onPress={handleLogout}
          />
        </View>
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

  bookingPhotoNotice: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },

  bookingPhotoNoticeTextWrap: {
    flex: 1,
  },

  bookingPhotoNoticeTitle: {
    color: COLORS.warningText,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 5,
  },

  bookingPhotoNoticeBody: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardOuterTeacher: {
    borderColor: COLORS.teacherPurpleBorder,
  },

  cardOuterDanger: {
    borderColor: "rgba(110,145,255,0.22)",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },

  cardPressable: {
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

  iconCircleTeacher: {
    backgroundColor: "rgba(168,85,247,0.18)",
    borderColor: "rgba(168,85,247,0.36)",
  },

  iconCircleDanger: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
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

  ctaButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  ctaButtonWarning: {
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.warningBorder,
  },

  ctaButtonTeacher: {
    backgroundColor: COLORS.teacherPurpleSoft,
    borderColor: COLORS.teacherPurpleBorder,
  },

  ctaButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  ctaButtonTextWarning: {
    color: COLORS.warningText,
    fontWeight: "900",
  },

  ctaButtonTextTeacher: {
    color: "#F3E8FF",
    fontWeight: "900",
  },

  ctaButtonSecondary: {
    backgroundColor: "#8b000086",
    borderWidth: 1,
    borderColor: "#FF4D4D",
    borderRadius: 16,
  },

  ctaButtonTextSecondary: {
    color: "#ffffff",
    fontWeight: "900",
  },

  photoCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  avatarOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  photoTextWrap: {
    flex: 1,
  },

  buttonDisabled: {
    opacity: 0.65,
  },
});