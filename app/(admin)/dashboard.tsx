import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  approveCategory,
  approveClassRequest,
  approveLearnerNoShow,
  approveSession,
  approveTeacherNoShow,
  getAdminBookings,
  getAdminClassRequests,
  getAdminImages,
  getAdminUsers,
  getDisputedBookings,
  getPendingCategories,
  getPendingSessions,
  markBookingCompleted,
  rejectCategory,
  rejectClassRequest,
  rejectDispute,
  rejectSession,
  removeAdminImage,
  suspendUser,
  unsuspendUser,
} from "@/src/api/admin";

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

  successBg: "rgba(81, 207, 102, 0.12)",
  successBorder: "rgba(81, 207, 102, 0.22)",

  dangerBg: "rgba(255, 107, 107, 0.12)",
  dangerBorder: "rgba(255, 107, 107, 0.22)",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",

  infoBg: "rgba(111,146,255,0.12)",
  infoBorder: "rgba(111,146,255,0.22)",
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.sectionHeader}
      >
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>

          {typeof count === "number" ? (
            <Text style={styles.sectionCount}>{count} items</Text>
          ) : null}
        </View>

        <Text style={styles.expandText}>{open ? "Hide" : "Open"}</Text>
      </Pressable>

      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [classRequests, setClassRequests] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);

  async function load() {
    try {
      setLoading(true);

      const [
        usersData,
        categoriesData,
        sessionsData,
        bookingsData,
        imagesData,
        classRequestsData,
        disputesData,
      ] = await Promise.all([
        getAdminUsers(),
        getPendingCategories(),
        getPendingSessions(),
        getAdminBookings(),
        getAdminImages(),
        getAdminClassRequests(),
        getDisputedBookings(),
      ]);

      setUsers(usersData || []);
      setCategories(categoriesData || []);
      setSessions(sessionsData || []);
      setBookings(bookingsData || []);
      setImages(imagesData || []);
      setClassRequests(classRequestsData || []);
      setDisputes(disputesData || []);
    } catch (e) {
      console.log(e);

      Alert.alert("Error", "Could not load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "PENDING");
  }, [bookings]);

  const refundBookings = useMemo(() => {
    return bookings.filter((b) =>
      ["REFUND_PENDING", "REFUND_FAILED"].includes(b.status),
    );
  }, [bookings]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Admin Dashboard</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{users.length}</Text>
          <Text style={styles.summaryLabel}>Users</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{sessions.length}</Text>
          <Text style={styles.summaryLabel}>Pending Sessions</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{images.length}</Text>
          <Text style={styles.summaryLabel}>Images</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {disputes.length}
          </Text>
          <Text style={styles.summaryLabel}>Disputes</Text>
        </View>
      </View>

      <Section title="Disputes & No-Shows" count={disputes.length}>
        {disputes.map((booking) => {
          const isTeacherNoShow =
            booking.dispute_reason ===
            "teacher_no_show_reported";

          const isLearnerNoShow =
            booking.dispute_reason ===
            "learner_no_show_reported";

          return (
            <View
              key={booking.id}
              style={[
                styles.card,
                styles.warningCard,
              ]}
            >
              <Text style={styles.cardTitle}>
                {booking.session?.class?.title || "Booking"}
              </Text>

              <Text style={styles.cardText}>
                Learner: {booking.user?.email}
              </Text>

              <Text style={styles.cardText}>
                Teacher:{" "}
                {booking.session?.teacher?.email}
              </Text>

              <Text style={styles.cardMuted}>
                Reason:{" "}
                {booking.dispute_reason || "General dispute"}
              </Text>

              <View style={styles.financialBox}>
                <Text style={styles.financialText}>
                  Lesson: €
                  {(
                    (booking.lesson_amount || 0) / 100
                  ).toFixed(2)}
                </Text>

                <Text style={styles.financialText}>
                  Platform Fee: €
                  {(
                    (booking.platform_fee_amount || 0) / 100
                  ).toFixed(2)}
                </Text>

                <Text style={styles.financialText}>
                  Stripe Fee: €
                  {(
                    (booking.stripe_fee_amount || 0) / 100
                  ).toFixed(2)}
                </Text>

                <Text style={styles.financialTotal}>
                  Total: €
                  {(
                    (booking.total_amount || 0) / 100
                  ).toFixed(2)}
                </Text>
              </View>

              <View style={styles.rowWrap}>
                {isLearnerNoShow ? (
                  <Pressable
                    onPress={async () => {
                      await approveLearnerNoShow(
                        booking.id,
                      );

                      load();
                    }}
                    style={[
                      styles.actionButton,
                      styles.successButton,
                    ]}
                  >
                    <Text style={styles.actionButtonText}>
                      Approve Learner No-Show
                    </Text>
                  </Pressable>
                ) : null}

                {isTeacherNoShow ? (
                  <Pressable
                    onPress={async () => {
                      Alert.alert(
                        "Refund learner?",
                        "This will approve the teacher no-show and trigger a refund.",
                        [
                          {
                            text: "Cancel",
                            style: "cancel",
                          },
                          {
                            text: "Refund",
                            style: "destructive",
                            onPress: async () => {
                              await approveTeacherNoShow(
                                booking.id,
                              );

                              load();
                            },
                          },
                        ],
                      );
                    }}
                    style={[
                      styles.actionButton,
                      styles.dangerButton,
                    ]}
                  >
                    <Text style={styles.actionButtonText}>
                      Refund Learner
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={async () => {
                    await markBookingCompleted(
                      booking.id,
                    );

                    load();
                  }}
                  style={[
                    styles.actionButton,
                    styles.infoButton,
                  ]}
                >
                  <Text style={styles.actionButtonText}>
                    Mark Completed
                  </Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    await rejectDispute(booking.id);

                    load();
                  }}
                  style={[
                    styles.actionButton,
                    styles.successButton,
                  ]}
                >
                  <Text style={styles.actionButtonText}>
                    Reject Dispute
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </Section>

<Section title="Pending Sessions" count={sessions.length}>
  {sessions.map((session) => (
    <View key={session.id} style={styles.card}>
      <Text style={styles.cardTitle}>
        {session.class?.title}
      </Text>

      <Text style={styles.cardText}>
        Teacher: {session.teacher?.email}
      </Text>

      <View style={styles.rowWrap}>
        <Pressable
          onPress={async () => {
            await approveSession(session.id);
            load();
          }}
          style={[
            styles.actionButton,
            styles.successButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Approve
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await rejectSession(session.id);
            load();
          }}
          style={[
            styles.actionButton,
            styles.dangerButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Reject
          </Text>
        </Pressable>
      </View>
    </View>
  ))}
</Section>

<Section title="Image Moderation" count={images.length}>
  {images.map((img, index) => (
    <View key={index} style={styles.card}>
      <Image
        source={{ uri: img.image_url }}
        style={{
          width: "100%",
          height: 220,
          borderRadius: 14,
          marginBottom: 12,
        }}
        resizeMode="cover"
      />

      <Text style={styles.cardMuted}>
        {img.source_type}
      </Text>

      <Text style={styles.cardText}>
        Field: {img.field}
      </Text>

      <Pressable
        onPress={async () => {
          await removeAdminImage({
            source_type: img.source_type,
            source_id: img.source_id,
            field: img.field,
          });

          load();
        }}
        style={[
          styles.actionButton,
          styles.dangerButton,
        ]}
      >
        <Text style={styles.actionButtonText}>
          Remove Image
        </Text>
      </Pressable>
    </View>
  ))}
</Section>

<Section title="Pending Categories" count={categories.length}>
  {categories.map((category) => (
    <View key={category.id} style={styles.card}>
      <Text style={styles.cardTitle}>
        {category.label}
      </Text>

      <View style={styles.rowWrap}>
        <Pressable
          onPress={async () => {
            await approveCategory(category.id);
            load();
          }}
          style={[
            styles.actionButton,
            styles.successButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Approve
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await rejectCategory(category.id);
            load();
          }}
          style={[
            styles.actionButton,
            styles.dangerButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Reject
          </Text>
        </Pressable>
      </View>
    </View>
  ))}
</Section>

<Section
  title="Class Requests"
  count={classRequests.length}
>
  {classRequests.map((request) => (
    <View key={request.id} style={styles.card}>
      <Text style={styles.cardTitle}>
        {request.custom_title ||
          request.category}
      </Text>

      <Text style={styles.cardText}>
        Type: {request.request_type}
      </Text>

      <Text style={styles.cardMuted}>
        {request.note}
      </Text>

      <View style={styles.rowWrap}>
        <Pressable
          onPress={async () => {
            await approveClassRequest(
              request.id,
            );

            load();
          }}
          style={[
            styles.actionButton,
            styles.successButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Approve
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await rejectClassRequest(
              request.id,
            );

            load();
          }}
          style={[
            styles.actionButton,
            styles.dangerButton,
          ]}
        >
          <Text style={styles.actionButtonText}>
            Reject
          </Text>
        </Pressable>
      </View>
    </View>
  ))}
</Section>

<Section title="Users" count={users.length}>
  {users.map((user) => (
    <View key={user.id} style={styles.card}>
      <Text style={styles.cardTitle}>
        {user.email}
      </Text>

      <Text style={styles.cardMuted}>
        Role: {user.role}
      </Text>

      <View style={styles.rowWrap}>
        {user.is_suspended ? (
          <Pressable
            onPress={async () => {
              await unsuspendUser(user.id);
              load();
            }}
            style={[
              styles.actionButton,
              styles.successButton,
            ]}
          >
            <Text style={styles.actionButtonText}>
              Unsuspend
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={async () => {
              await suspendUser(user.id);
              load();
            }}
            style={[
              styles.actionButton,
              styles.dangerButton,
            ]}
          >
            <Text style={styles.actionButtonText}>
              Suspend
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  ))}
</Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 20,
    paddingBottom: 80,
  },

  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 20,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  summaryNumber: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },

  summaryLabel: {
    color: COLORS.textSoft,
    marginTop: 6,
  },

  section: {
    marginTop: 18,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
  },

  sectionHeader: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  sectionCount: {
    color: COLORS.textMuted,
    marginTop: 4,
  },

  expandText: {
    color: COLORS.accent,
    fontWeight: "800",
  },

  sectionBody: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },

  card: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  warningCard: {
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
  },

  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },

  cardText: {
    color: COLORS.textSoft,
    marginBottom: 4,
  },

  cardMuted: {
    color: COLORS.textMuted,
    marginTop: 6,
  },

  financialBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  financialText: {
    color: COLORS.textSoft,
    marginBottom: 4,
  },

  financialTotal: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 8,
  },

  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  actionButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  successButton: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },

  dangerButton: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  infoButton: {
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
  },

  actionButtonText: {
    color: COLORS.text,
    fontWeight: "800",
  },
});