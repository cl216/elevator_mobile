import React, { useEffect, useState } from "react";
import { router } from "expo-router";
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
  createTeacherProfile,
  getMyTeacherProfile,
} from "../../src/api/teacher";

export default function TeacherProfileSetupScreen() {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const existing = await getMyTeacherProfile();

        if (!alive) return;

        if (existing) {
          setFullName(existing.full_name ?? "");
          setBio(existing.bio ?? "");
          setImageUrl(existing.image_url ?? "");
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        Alert.alert("Error", "Could not load teacher profile.");
      } finally {
        if (!alive) return;
        setLoading(false);
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

    try {
      setSaving(true);

      await createTeacherProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
      });

      Alert.alert("Profile saved", "Your teacher profile has been updated.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
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
        <Text style={{ fontSize: 28, fontWeight: "900" }}>
          Edit teacher profile
        </Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          This is what learners will see when they view your profile.
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading profile…</Text>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Aoife Murphy"
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell learners a bit about your teaching style and experience."
              multiline
              maxLength={1000}
              style={{
                minHeight: 130,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                textAlignVertical: "top",
                backgroundColor: "#fafafa",
              }}
            />
            <Text style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
              Keep communication on-platform. Contact details and external payment
              requests are not allowed.
            </Text>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Profile image URL
            </Text>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://..."
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            />
          </View>

          <Pressable
            onPress={handleSave}
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
                Save profile
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