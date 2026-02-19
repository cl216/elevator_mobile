// import { useLocalSearchParams, router } from "expo-router";
// import React, { useEffect, useState, useCallback } from "react";
// import { View, Text, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
// import { API_BASE_URL } from "../../../src/config/api"; // adjust path if needed

// type SessionDetail = {
//   id: string;
//   start_time: string;
//   duration: number;
//   price: number;
//   class?: { title?: string; description?: string; category?: string; thumbnailUrl?: string };
//   teacher?: { id?: string; email?: string; name?: string; avatarUrl?: string };
// };

// export default function SessionScreen() {
//   const { id } = useLocalSearchParams<{ id: string }>();
//   const [loading, setLoading] = useState(true);
//   const [session, setSession] = useState<SessionDetail | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const load = useCallback(async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       const res = await fetch(`${API_BASE_URL}/sessions/${id}`);
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       const data = await res.json();

//       setSession(data);
//     } catch (e: any) {
//       setError(e?.message ?? "Failed to load session");
//     } finally {
//       setLoading(false);
//     }
//   }, [id]);

//   useEffect(() => {
//     if (!id) return;
//     load();
//   }, [id, load]);

//   if (loading) {
//     return (
//       <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
//         <ActivityIndicator />
//         <Text style={{ marginTop: 10 }}>Loading…</Text>
//       </View>
//     );
//   }

//   if (error || !session) {
//     return (
//       <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
//         <Text style={{ fontWeight: "800", fontSize: 18 }}>Couldn’t load session</Text>
//         <Text style={{ marginTop: 8 }}>{error ?? "Unknown error"}</Text>

//         <Pressable onPress={load} style={{ marginTop: 16, padding: 12, borderWidth: 1, borderRadius: 12 }}>
//           <Text style={{ fontWeight: "700" }}>Retry</Text>
//         </Pressable>

//         <Pressable onPress={() => router.back()} style={{ marginTop: 12, padding: 12 }}>
//           <Text style={{ fontWeight: "700" }}>Back</Text>
//         </Pressable>
//       </View>
//     );
//   }

//   const title = session.class?.title ?? "Session";
//   const desc = session.class?.description ?? "";
//   const category = session.class?.category ?? "";
//   const teacherName = session.teacher?.name ?? "Teacher";
//   const start = new Date(session.start_time).toLocaleString();

//   return (
//     <View style={{ flex: 1, backgroundColor: "white" }}>
//       <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
//         <Text style={{ fontSize: 22, fontWeight: "900" }}>{title}</Text>
//         <Text style={{ marginTop: 6, fontWeight: "700" }}>{teacherName}</Text>
//         {category ? <Text style={{ marginTop: 6 }}>Category: {category}</Text> : null}

//         <Text style={{ marginTop: 10 }}>
//           €{session.price} · {start} · {session.duration} min
//         </Text>

//         {desc ? <Text style={{ marginTop: 14, lineHeight: 20 }}>{desc}</Text> : null}
//       </ScrollView>

//       {/* Reserve bar */}
//       <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: 1, backgroundColor: "white" }}>
//         <Pressable
//           onPress={() => {
//             // Step 3 later: booking gate + Stripe
//             console.log("Reserve pressed for", session.id);
//           }}
//           style={{ backgroundColor: "black", paddingVertical: 14, borderRadius: 14, alignItems: "center" }}
//         >
//           <Text style={{ color: "white", fontWeight: "800" }}>Reserve</Text>
//         </Pressable>
//       </View>
//     </View>
//   );
// }
