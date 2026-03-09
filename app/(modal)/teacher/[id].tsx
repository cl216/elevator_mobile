import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState } from "react";
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
};

export default function TeacherProfileModal() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileData, followStatus] = await Promise.all([
          getTeacherProfile(id!),
          getFollowStatus(id!),
        ]);

        if (!alive) return;

        setProfile(profileData);
        setFollowing(!!followStatus.following);
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

                {joinedLabel ? (
                  <Text style={{ marginTop: 6, opacity: 0.7 }}>{joinedLabel}</Text>
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
              </View>

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