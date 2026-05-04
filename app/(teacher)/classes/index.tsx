import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { getMyClasses } from "../../../src/api/classes";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

type TeacherClass = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  price: number;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
};

export default function TeacherClassesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<TeacherClass[]>([]);

  const loadClasses = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        const data = await getMyClasses();
        setClasses(data);
      } catch (e: any) {
        console.error(e);

        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Could not load your classes.";

        Alert.alert(
          "Error",
          Array.isArray(message) ? message.join("\n") : String(message),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const emptyState = useMemo(
    () => (
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
          No classes yet
        </Text>
        <Text style={{ lineHeight: 20, marginBottom: 14, opacity: 0.75 }}>
          Create your first reusable class template, then turn it into bookable
          sessions.
        </Text>

        <Pressable
          onPress={() => safePush("/(teacher)/classes/create")}
          style={{
            backgroundColor: "black",
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            Create class
          </Text>
        </Pressable>
      </View>
    ),
    [],
  );

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 40,
        backgroundColor: "white",
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadClasses("refresh")}
        />
      }
    >
      <View
        style={{
          marginBottom: 24,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: "900" }}>My Classes</Text>
          <Text style={{ marginTop: 6, opacity: 0.7 }}>
            View and manage your reusable class templates.
          </Text>
        </View>

        <Pressable
          onPress={() => safePush("/(teacher)/classes/create")}
          style={{
            backgroundColor: "black",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading classes…</Text>
        </View>
      ) : classes.length === 0 ? (
        emptyState
      ) : (
        <View style={{ gap: 12 }}>
          {classes.map((item) => {
            const imageCount = [
              item.image_url_1,
              item.image_url_2,
              item.image_url_3,
            ].filter(Boolean).length;

            return (
              <View
                key={item.id}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                  borderRadius: 18,
                  padding: 16,
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  {item.title}
                </Text>

                <Text style={{ marginTop: 6, opacity: 0.75 }}>
                  {item.category} · €{item.price}
                </Text>

                {item.description ? (
                  <Text
                    style={{ marginTop: 8, lineHeight: 20, opacity: 0.75 }}
                    numberOfLines={3}
                  >
                    {item.description}
                  </Text>
                ) : (
                  <Text style={{ marginTop: 8, opacity: 0.55 }}>
                    No description yet.
                  </Text>
                )}

                <Text style={{ marginTop: 8, opacity: 0.7 }}>
                  {imageCount} image{imageCount === 1 ? "" : "s"} added
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <Pressable
                    onPress={() => safePush(`/(teacher)/classes/${item.id}/edit`)}
                    style={{
                      flex: 1,
                      backgroundColor: "#111",
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "800" }}>
                      Edit class
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => safePush("/(teacher)/sessions/create")}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.12)",
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: "white",
                    }}
                  >
                    <Text style={{ fontWeight: "800" }}>
                      Create session
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}