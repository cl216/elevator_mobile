// import { router, useLocalSearchParams } from "expo-router";
// import React, { useEffect, useMemo, useState } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   Image,
//   Pressable,
//   ScrollView,
//   Text,
//   View,
// } from "react-native";
// import { safePush } from "@/src/utils/safeRouter";
// import {
//   followTeacher,
//   getFollowStatus,
//   unfollowTeacher,
// } from "../../../src/api/teacher";
// import { API_BASE_URL } from "../../../src/config/api";
// import { mediaUrl } from "@/src/utils/mediaUrl";

// type SessionDetail = {
//   id: string;
//   start_time: string;
//   duration: number;
//   price: number;
//   max_participants: number;
//   bookings_count?: number;
//   spots_left?: number;
//   attendee_first_names?: string[];
//   image_urls?: string[];
//   class?: { title?: string; description?: string; category?: string };
//   teacher?: { id: string; name?: string; avatarUrl?: string };
// };

// function isPast(dateString?: string) {
//   if (!dateString) return false;
//   return new Date(dateString).getTime() < Date.now();
// }

// export default function SessionPanel() {
//   const { id } = useLocalSearchParams<{ id: string }>();

//   const [loading, setLoading] = useState(true);
//   const [session, setSession] = useState<SessionDetail | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const [following, setFollowing] = useState(false);
//   const [followLoading, setFollowLoading] = useState(false);
//   const [reserveLoading, setReserveLoading] = useState(false);

//   useEffect(() => {
//     let alive = true;

//     (async () => {
//       try {
//         setLoading(true);
//         setError(null);

//         const res = await fetch(`${API_BASE_URL}/sessions/${id}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);

//         const data = (await res.json()) as SessionDetail;
//         console.log("SESSION MODAL DATA:", JSON.stringify(data, null, 2));
// console.log("SESSION MODAL IMAGE URLS:", data?.image_urls);

//         if (!alive) return;

//         setSession(data);

//         if (data?.teacher?.id) {
//           try {
//             const status = await getFollowStatus(data.teacher.id);
//             if (!alive) return;
//             setFollowing(status.following);
//           } catch (e) {
//             console.warn("Follow status failed", e);
//           }
//         }
//       } catch (e: any) {
//         if (!alive) return;
//         setError(e?.message ?? "Failed to load session");
//       } finally {
//         if (!alive) return;
//         setLoading(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//   }, [id]);

//   async function toggleFollow(teacherId: string) {
//     try {
//       setFollowLoading(true);

//       if (following) {
//         await unfollowTeacher(teacherId);
//         setFollowing(false);
//       } else {
//         await followTeacher(teacherId);
//         setFollowing(true);
//       }
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setFollowLoading(false);
//     }
//   }

//   const title = session?.class?.title ?? "Session";
//   const teacherName = session?.teacher?.name ?? "Teacher";
//   const start = session?.start_time
//     ? new Date(session.start_time).toLocaleString()
//     : "";

//   const price = session?.price ?? 0;
//   const spotsLeft = session?.spots_left ?? null;
//   const bookingsCount = session?.bookings_count ?? 0;
//   const attendeeFirstNames = session?.attendee_first_names ?? [];
// const imageUrls = Array.isArray(session?.image_urls)
//   ? session.image_urls.map((url) => mediaUrl(url)).filter(Boolean) as string[]
//   : [];

//   const sessionIsPast = useMemo(
//     () => isPast(session?.start_time),
//     [session?.start_time],
//   );

//   const sessionIsFull = useMemo(() => {
//     if (spotsLeft === null) return false;
//     return spotsLeft <= 0;
//   }, [spotsLeft]);

//   const canReserve =
//     !loading && !error && !!session?.id && !sessionIsPast && !sessionIsFull;

//   const reserveButtonLabel = useMemo(() => {
//     if (reserveLoading) return "Opening...";
//     if (loading) return "Loading...";
//     if (error) return "Unavailable";
//     if (sessionIsPast) return "Session started";
//     if (sessionIsFull) return "Full";
//     return "Reserve";
//   }, [reserveLoading, loading, error, sessionIsPast, sessionIsFull]);

//   async function handleReservePress() {
//     if (reserveLoading) return;

//     if (!session?.id) {
//       Alert.alert("Session unavailable", "This session could not be opened.");
//       return;
//     }

//     if (sessionIsPast) {
//       Alert.alert(
//         "Session unavailable",
//         "This session has already started or is in the past.",
//       );
//       return;
//     }

//     if (sessionIsFull) {
//       Alert.alert(
//         "Session full",
//         "This session is fully booked. Try another class nearby.",
//       );
//       return;
//     }

//     try {
//       setReserveLoading(true);
//       safePush(`/(modal)/booking/${session.id}`);
//     } finally {
//       setReserveLoading(false);
//     }
//   }

//   let attendanceLabel: string | null = null;

//   if (spotsLeft !== null) {
//     if (
//       attendeeFirstNames.length >= 2 &&
//       bookingsCount > attendeeFirstNames.length
//     ) {
//       attendanceLabel = `${attendeeFirstNames[0]} + ${
//         bookingsCount - 1
//       } others going · ${
//         spotsLeft === 0
//           ? "Full"
//           : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
//       }`;
//     } else if (attendeeFirstNames.length === 2) {
//       attendanceLabel = `${attendeeFirstNames[0]} and ${
//         attendeeFirstNames[1]
//       } going · ${
//         spotsLeft === 0
//           ? "Full"
//           : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
//       }`;
//     } else if (attendeeFirstNames.length === 1 && bookingsCount > 1) {
//       attendanceLabel = `${attendeeFirstNames[0]} + ${
//         bookingsCount - 1
//       } others going · ${
//         spotsLeft === 0
//           ? "Full"
//           : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
//       }`;
//     } else if (attendeeFirstNames.length === 1) {
//       attendanceLabel = `${attendeeFirstNames[0]} is going · ${
//         spotsLeft === 0
//           ? "Full"
//           : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
//       }`;
//     } else if (bookingsCount > 0) {
//       attendanceLabel = `${bookingsCount} ${
//         bookingsCount === 1 ? "person" : "people"
//       } going · ${
//         spotsLeft === 0
//           ? "Full"
//           : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
//       }`;
//     } else {
//       attendanceLabel = `Be the first to join · ${spotsLeft} spot${
//         spotsLeft === 1 ? "" : "s"
//       } left`;
//     }
//   }

//   return (
//     <Pressable
//       onPress={() => router.back()}
//       style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)" }}
//     >
//       <Pressable
//         onPress={() => {}}
//         style={{
//           flex: 1,
//           marginLeft: "0%",
//           backgroundColor: "white",
//           borderTopLeftRadius: 22,
//           borderBottomLeftRadius: 22,
//           overflow: "hidden",
//         }}
//       >
//         <View
//           style={{
//             padding: 16,
//             borderBottomWidth: 1,
//             borderColor: "rgba(0,0,0,0.08)",
//           }}
//         >
//           <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={2}>
//             {title}
//           </Text>

//           <View
//             style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
//           >
//             <Pressable
//               onPress={() => {
//                 if (session?.teacher?.id) {
//                   safePush(`/(modal)/teacher/${session.teacher.id}`);
//                 }
//               }}
//               style={{ flex: 1 }}
//             >
//               <Text style={{ fontWeight: "700" }}>{teacherName}</Text>
//             </Pressable>

//             {session?.teacher?.id ? (
//               <Pressable
//                 onPress={() => toggleFollow(session.teacher!.id)}
//                 disabled={followLoading}
//                 style={{
//                   backgroundColor: following ? "#eee" : "black",
//                   paddingHorizontal: 12,
//                   paddingVertical: 6,
//                   borderRadius: 8,
//                 }}
//               >
//                 <Text
//                   style={{
//                     color: following ? "black" : "white",
//                     fontWeight: "700",
//                   }}
//                 >
//                   {followLoading ? "..." : following ? "Following" : "Follow"}
//                 </Text>
//               </Pressable>
//             ) : null}
//           </View>

//           {start ? <Text style={{ marginTop: 6 }}>{start}</Text> : null}

//           <Text style={{ marginTop: 6, fontWeight: "800" }}>€{price}</Text>

//           {attendanceLabel ? (
//             <Text style={{ marginTop: 8, fontWeight: "800" }}>
//               {attendanceLabel}
//             </Text>
//           ) : null}

//           {sessionIsPast ? (
//             <Text style={{ marginTop: 8, color: "#9b2c2c", fontWeight: "700" }}>
//               This session has already started or is in the past.
//             </Text>
//           ) : null}

//           <Pressable
//             onPress={() => router.back()}
//             style={{ position: "absolute", right: 14, top: 14, padding: 8 }}
//           >
//             <Text style={{ fontWeight: "900" }}>✕</Text>
//           </Pressable>
//         </View>

//         <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
//           {loading ? (
//             <View style={{ paddingTop: 30, alignItems: "center" }}>
//               <ActivityIndicator />
//               <Text style={{ marginTop: 10 }}>Loading…</Text>
//             </View>
//           ) : error ? (
//             <View style={{ paddingTop: 20 }}>
//               <Text style={{ fontWeight: "900" }}>Couldn’t load session</Text>
//               <Text style={{ marginTop: 8 }}>{error}</Text>
//             </View>
//           ) : (
//             <>
//               {imageUrls.length > 0 ? (
//                 <ScrollView
//                   horizontal
//                   showsHorizontalScrollIndicator={false}
//                   style={{ marginBottom: 16 }}
//                   contentContainerStyle={{ gap: 10 }}
//                 >
//                   {imageUrls.map((url, index) => (
//                     <Image
//                       key={`${url}-${index}`}
//                       source={{ uri: url }}
//                       resizeMode="cover"
//                       style={{
//                         width: 260,
//                         height: 170,
//                         borderRadius: 18,
//                         backgroundColor: "#eee",
//                       }}
//                     />
//                   ))}
//                 </ScrollView>
//               ) : null}

//               {session?.class?.category ? (
//                 <Text style={{ marginBottom: 10 }}>
//                   Category: {session.class.category}
//                 </Text>
//               ) : null}

//               {session?.class?.description ? (
//                 <Text style={{ lineHeight: 20 }}>
//                   {session.class.description}
//                 </Text>
//               ) : (
//                 <Text style={{ opacity: 0.7 }}>No description yet.</Text>
//               )}
//             </>
//           )}
//         </ScrollView>

//         <View
//           style={{
//             position: "absolute",
//             left: 0,
//             right: 0,
//             bottom: 0,
//             padding: 16,
//             borderTopWidth: 1,
//             borderColor: "rgba(0,0,0,0.08)",
//             backgroundColor: "white",
//           }}
//         >
//           <Pressable
//             onPress={handleReservePress}
//             disabled={!canReserve || reserveLoading}
//             style={{
//               backgroundColor: !canReserve || reserveLoading ? "#666" : "black",
//               paddingVertical: 14,
//               borderRadius: 14,
//               alignItems: "center",
//             }}
//           >
//             <Text style={{ color: "white", fontWeight: "900" }}>
//               {reserveButtonLabel}
//             </Text>
//           </Pressable>
//         </View>
//       </Pressable>
//     </Pressable>
//   );
// }