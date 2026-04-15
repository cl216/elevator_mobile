import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { api } from "../../../src/api/client";
import { getSessionBookings } from "../../../src/api/sessions";

type SessionBookingRow = {
  id: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED_BY_LEARNER"
    | "CANCELLED_BY_TEACHER"
    | "REFUND_PENDING"
    | "REFUNDED"
    | "EXPIRED"
    | string;
  intro_message?: string | null;
  created_at: string;
  learner_id: string;
  learner_first_name: string;
};

type SessionDetails = {
  id: string;
  title: string;
  start_time: string;
  duration: number;
  max_participants: number;
  price: number;
  arrival_instructions?: string | null;
};

type SessionBookingsResponse = {
  session: SessionDetails | null;
  bookings: SessionBookingRow[];
};

function statusLabel(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "PENDING":
      return "Pending payment";
    case "CANCELLED_BY_LEARNER":
      return "Cancelled by learner";
    case "CANCELLED_BY_TEACHER":
      return "Cancelled by teacher";
    case "REFUND_PENDING":
      return "Refund in progress";
    case "REFUNDED":
      return "Refund completed";
    case "EXPIRED":
      return "Expired";
    default:
      return status || "Unknown";
  }
}

function getStatusStyles(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return {
        backgroundColor: "#eef8f0",
        borderColor: "#d7eadb",
        textColor: "#1f6b37",
      };
    case "PENDING":
      return {
        backgroundColor: "#fff7e8",
        borderColor: "#f0dfb5",
        textColor: "#8a5a00",
      };
    case "CANCELLED_BY_LEARNER":
    case "CANCELLED_BY_TEACHER":
      return {
        backgroundColor: "#fff0f0",
        borderColor: "#f0d4d4",
        textColor: "#9b2c2c",
      };
    case "REFUND_PENDING":
      return {
        backgroundColor: "#fff8e6",
        borderColor: "#f0e0aa",
        textColor: "#8a6a00",
      };
    case "REFUNDED":
      return {
        backgroundColor: "#eef5ff",
        borderColor: "#d9e5ff",
        textColor: "#2457a6",
      };
    case "EXPIRED":
      return {
        backgroundColor: "#f5f5f5",
        borderColor: "#e5e5e5",
        textColor: "#777",
      };
    default:
      return {
        backgroundColor: "#f5f5f5",
        borderColor: "#e5e5e5",
        textColor: "#333",
      };
  }
}

function getTeacherBookingStatusDescription(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return "This learner’s place is confirmed.";
    case "PENDING":
      return "This learner has started checkout but has not completed payment yet.";
    case "CANCELLED_BY_LEARNER":
      return "The learner cancelled this booking.";
    case "CANCELLED_BY_TEACHER":
      return "You cancelled this booking.";
    case "REFUND_PENDING":
      return "The learner’s refund is being processed.";
    case "REFUNDED":
      return "The learner’s refund has been completed.";
    case "EXPIRED":
      return "This booking expired before payment was completed.";
    default:
      return null;
  }
}

export default function TeacherSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionBookingsResponse | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const loadSessionBookings = useCallback(async () => {
    const result = (await getSessionBookings(id!)) as SessionBookingsResponse;
    setData(result);
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const result = (await getSessionBookings(id!)) as SessionBookingsResponse;

        if (!alive) return;
        setData(result);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        Alert.alert("Error", "Could not load session bookings.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const session = data?.session;
  const bookings: SessionBookingRow[] = data?.bookings ?? [];

  const canTeacherCancelBooking = useCallback(
    (bookingStatus?: string) => {
      if (!session?.start_time) return false;
      const isFutureSession = new Date(session.start_time).getTime() > Date.now();
      return bookingStatus === "CONFIRMED" && isFutureSession;
    },
    [session?.start_time],
  );

  const handleCancelBooking = useCallback(
    (bookingId: string, learnerName?: string | null) => {
      Alert.alert(
        "Cancel learner booking",
        `Are you sure you want to cancel this booking${learnerName ? ` for ${learnerName}` : ""}?\n\nIf you cancel, the learner will lose their place and any eligible refund will be processed automatically.`,
        [
          { text: "Keep booking", style: "cancel" },
          {
            text: "Cancel booking",
            style: "destructive",
            onPress: async () => {
              try {
                setBusyBookingId(bookingId);

                await api.post(`/bookings/${bookingId}/cancel/teacher`);
                await loadSessionBookings();

                Alert.alert(
                  "Booking cancelled",
                  "The learner booking has been cancelled and any eligible refund will be processed automatically.",
                );
              } catch (e: any) {
                console.error(e);
                const message =
                  e?.response?.data?.message ??
                  e?.message ??
                  "Could not cancel booking.";

                Alert.alert(
                  "Cancel error",
                  Array.isArray(message) ? message.join("\n") : String(message),
                );
              } finally {
                setBusyBookingId(null);
              }
            },
          },
        ],
      );
    },
    [loadSessionBookings],
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
    >
      <View
        style={{
          marginBottom: 24,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: "900" }}>
            Session Bookings
          </Text>
          <Text style={{ marginTop: 6, opacity: 0.7 }}>
            View learners booked into this session.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => router.push(`/(teacher)/sessions/${id}/edit`)}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: "white",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Edit</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: "800" }}>Back</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading bookings…</Text>
        </View>
      ) : !session ? (
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
            Session not found
          </Text>
          <Text style={{ opacity: 0.75 }}>
            This session could not be loaded.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: 16,
              backgroundColor: "white",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800" }}>
              {session.title}
            </Text>

            <Text style={{ marginTop: 6 }}>
              {new Date(session.start_time).toLocaleDateString()} ·{" "}
              {new Date(session.start_time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            <Text style={{ marginTop: 6, opacity: 0.75 }}>
              {session.duration} min · €{session.price} · Max {session.max_participants}
            </Text>

            <Text style={{ marginTop: 10, fontWeight: "700" }}>
              {bookings.length} booking{bookings.length === 1 ? "" : "s"}
            </Text>

            <Pressable
              onPress={() => router.push(`/(teacher)/sessions/${id}/edit`)}
              style={{
                marginTop: 14,
                alignSelf: "flex-start",
                backgroundColor: "#111",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                Edit this session
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "#e8e1c2",
              borderRadius: 18,
              padding: 16,
              backgroundColor: "#fffaf0",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Cancellation policy
            </Text>

            <Text style={{ lineHeight: 20, opacity: 0.8 }}>
              If you cancel a confirmed learner booking, the learner will lose
              their place immediately.
            </Text>

            <Text style={{ lineHeight: 20, opacity: 0.8, marginTop: 6 }}>
              Teacher-initiated cancellations automatically trigger any eligible
              refund for the learner.
            </Text>

            <Text style={{ lineHeight: 20, opacity: 0.8, marginTop: 6 }}>
              Cancel bookings carefully, especially close to session start.
            </Text>
          </View>

          {bookings.length === 0 ? (
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
                No bookings yet
              </Text>
              <Text style={{ opacity: 0.75 }}>
                Learners who book this session will appear here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {bookings.map((booking: SessionBookingRow) => {
                const statusStyles = getStatusStyles(booking.status);
                const showCancelButton = canTeacherCancelBooking(booking.status);
                const isBusy = busyBookingId === booking.id;
                const statusDescription = getTeacherBookingStatusDescription(
                  booking.status,
                );

                return (
                  <View
                    key={booking.id}
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.08)",
                      borderRadius: 18,
                      padding: 16,
                      backgroundColor: "white",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: "800" }}>
                          {booking.learner_first_name || "Learner"}
                        </Text>

                        <Text style={{ marginTop: 6, opacity: 0.75 }}>
                          Booked {new Date(booking.created_at).toLocaleString()}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: statusStyles.backgroundColor,
                          borderColor: statusStyles.borderColor,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "800",
                            color: statusStyles.textColor,
                          }}
                        >
                          {statusLabel(booking.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ marginTop: 10, lineHeight: 20 }}>
                      {booking.intro_message?.trim()
                        ? booking.intro_message
                        : "No intro message."}
                    </Text>

                    {statusDescription ? (
                      <View
                        style={{
                          marginTop: 12,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: "#fafafa",
                          borderWidth: 1,
                          borderColor: "rgba(0,0,0,0.06)",
                        }}
                      >
                        <Text style={{ lineHeight: 20, opacity: 0.8 }}>
                          {statusDescription}
                        </Text>
                      </View>
                    ) : null}

                    {showCancelButton ? (
                      <View
                        style={{
                          marginTop: 14,
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderColor: "rgba(0,0,0,0.06)",
                          flexDirection: "row",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            handleCancelBooking(
                              booking.id,
                              booking.learner_first_name || null,
                            )
                          }
                          disabled={isBusy}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#e7bcbc",
                            backgroundColor: isBusy ? "#f3f3f3" : "#fff5f5",
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "800",
                              color: isBusy ? "#777" : "#9b2c2c",
                            }}
                          >
                            {isBusy ? "Cancelling..." : "Cancel booking"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}