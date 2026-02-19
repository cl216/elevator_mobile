import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { API_BASE_URL } from "../../../src/config/api"; // adjust if your path differs

type SessionDetail = {
  id: string;
  start_time: string;
  duration: number;
  price: number;
  class?: { title?: string; description?: string; category?: string };
  teacher?: { name?: string; avatarUrl?: string };
};

export default function SessionPanel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const panelLeftMargin = "0%"; // how much map remains visible

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/sessions/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SessionDetail;

        if (!alive) return;
        setSession(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load session");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const title = session?.class?.title ?? "Session";
  const teacherName = session?.teacher?.name ?? "Teacher";
  const start = session?.start_time ? new Date(session.start_time).toLocaleString() : "";
  const price = session?.price ?? 0;

  return (
    // Backdrop: tap to dismiss
    <Pressable
      onPress={() => router.back()}
      style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)" }}
    >
      {/* Panel: stop propagation so taps inside don’t close */}
      <Pressable
        onPress={() => {}}
        style={{
          flex: 1,
          marginLeft: panelLeftMargin,
          backgroundColor: "white",
          borderTopLeftRadius: 22,
          borderBottomLeftRadius: 22,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: "rgba(0,0,0,0.08)" }}>
          <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={2}>
            {title}
          </Text>
          <Text style={{ marginTop: 6, fontWeight: "700" }}>{teacherName}</Text>
          {start ? <Text style={{ marginTop: 6 }}>{start}</Text> : null}
          <Text style={{ marginTop: 6, fontWeight: "800" }}>€{price}</Text>

          <Pressable onPress={() => router.back()} style={{ position: "absolute", right: 14, top: 14, padding: 8 }}>
            <Text style={{ fontWeight: "900" }}>✕</Text>
          </Pressable>
        </View>

        {/* Body */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {loading ? (
            <View style={{ paddingTop: 30, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 10 }}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={{ paddingTop: 20 }}>
              <Text style={{ fontWeight: "900" }}>Couldn’t load session</Text>
              <Text style={{ marginTop: 8 }}>{error}</Text>
            </View>
          ) : (
            <>
              {session?.class?.category ? (
                <Text style={{ marginBottom: 10 }}>Category: {session.class.category}</Text>
              ) : null}

              {session?.class?.description ? (
                <Text style={{ lineHeight: 20 }}>{session.class.description}</Text>
              ) : (
                <Text style={{ opacity: 0.7 }}>No description yet.</Text>
              )}
            </>
          )}
        </ScrollView>

        {/* Reserve bar */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: 1, borderColor: "rgba(0,0,0,0.08)", backgroundColor: "white" }}>
          <Pressable
            onPress={() => {
              // Next roadmap step: booking gate + Stripe
              console.log("Reserve", id);
            }}
            style={{ backgroundColor: "black", paddingVertical: 14, borderRadius: 14, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Reserve</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}
