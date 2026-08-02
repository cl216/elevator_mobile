import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TeacherProfileBottomSheet } from "@/src/components/teacher/TeacherProfileBottomSheet";
import { API_BASE_URL } from "@/src/config/api";
import { mediaUrl } from "@/src/utils/mediaUrl";
import { safePush } from "@/src/utils/safeRouter";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HERO_HEIGHT = 240;
const SHEET_INNER_GAP = 8;

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",
  surfaceElevated: "#162033",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",
  accentBorder: "rgba(111,146,255,0.25)",

  chipBg: "#121A2C",
  chipBorder: "rgba(110,145,255,0.18)",

  heroPlaceholder: "#171E31",
  heroOverlay: "rgba(0,0,0,0.14)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentSoftStrong: "rgba(111,146,255,0.16)",

  reserve: "#3F6AE0",
  reservePressed: "#355CC2",
  reserveDisabled: "#2A3558",

  indicator: "rgba(255,255,255,0.55)",
  divider: "rgba(255,255,255,0.06)",
};

type SessionAttendee = {
  id: string;
  first_name: string;
  image_url?: string | null;
};

type SessionDetail = {
  id: string;
  start_time: string;
  duration: number;
  price: number;
  max_participants: number;
  bookings_count?: number;
  confirmed_attendees_count?: number;
  spots_left?: number;
  attendee_first_names?: string[];
  attendees?: SessionAttendee[];
  rough_location?: string | null;
  image_urls?: string[];
  class?: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
  };
  teacher?: {
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    image_url?: string | null;
  };
};

type Props = {
  sessionId: string | null;
  visible: boolean;
  onClose: () => void;
};

function formatDate(dateString?: string) {
  if (!dateString) return "TBC";

  return new Date(dateString).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(dateString?: string, durationMinutes?: number) {
  if (!dateString) return "TBC";

  const start = new Date(dateString);
  const end = new Date(start.getTime() + (durationMinutes ?? 0) * 60_000);

  const startLabel = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const endLabel = end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startLabel}–${endLabel}`;
}

function buildAttendanceLabel(session: SessionDetail | null) {
  if (!session) return null;

  const spotsLeft = session.spots_left;
  const bookingsCount = session.bookings_count ?? 0;
  const attendeeFirstNames = session.attendee_first_names ?? [];

  if (spotsLeft == null) return null;

  if (
    attendeeFirstNames.length >= 2 &&
    bookingsCount > attendeeFirstNames.length
  ) {
    return `${attendeeFirstNames[0]} + ${bookingsCount - 1} others going · ${
      spotsLeft === 0
        ? "Full"
        : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
    }`;
  }

  if (attendeeFirstNames.length === 2) {
    return `${attendeeFirstNames[0]} and ${attendeeFirstNames[1]} going · ${
      spotsLeft === 0
        ? "Full"
        : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
    }`;
  }

  if (attendeeFirstNames.length === 1 && bookingsCount > 1) {
    return `${attendeeFirstNames[0]} + ${bookingsCount - 1} others going · ${
      spotsLeft === 0
        ? "Full"
        : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
    }`;
  }

  if (attendeeFirstNames.length === 1) {
    return `${attendeeFirstNames[0]} is going · ${
      spotsLeft === 0
        ? "Full"
        : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
    }`;
  }

  if (bookingsCount > 0) {
    return `${bookingsCount} ${
      bookingsCount === 1 ? "person" : "people"
    } going · ${
      spotsLeft === 0
        ? "Full"
        : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
    }`;
  }

  return `Be the first to join · ${spotsLeft} spot${
    spotsLeft === 1 ? "" : "s"
  } left`;
}

export const SessionBottomSheet = forwardRef<any, Props>(
  function SessionBottomSheet({ sessionId, visible, onClose }, ref) {
    const insets = useSafeAreaInsets();

    const modalRef = useRef<BottomSheetModal | null>(null);
    const teacherSheetRef = useRef<any>(null);
    const viewerScrollRef = useRef<ScrollView | null>(null);

    const openingTeacherRef = useRef(false);
    const sessionDismissedForTeacherRef = useRef(false);
    const navigatingAwayFromTeacherRef = useRef(false);

    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [acceptedPolicy, setAcceptedPolicy] = useState(false);

    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [attendeesVisible, setAttendeesVisible] = useState(false);

    const [teacherProfileId, setTeacherProfileId] = useState<string | null>(
      null,
    );

    useImperativeHandle(ref, () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
      close: () => modalRef.current?.close(),
      snapToIndex: (index: number) => modalRef.current?.snapToIndex(index),
    }));

    useEffect(() => {
      let alive = true;

      if (!visible || !sessionId) {
        setSession(null);
        setLoading(false);
        setError(null);
        setViewerVisible(false);
        setViewerIndex(0);
        setAttendeesVisible(false);
        setTeacherProfileId(null);
        return;
      }

      async function loadSession() {
        try {
          setLoading(true);
          setError(null);

          const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
          if (!res.ok) throw new Error("Failed to load session");

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
      }

      loadSession();

      return () => {
        alive = false;
      };
    }, [sessionId, visible]);

    const images = useMemo<string[]>(() => {
      return (
        (session?.image_urls
          ?.map((u) => mediaUrl(u))
          .filter(Boolean) as string[]) ?? []
      ).slice(0, 3);
    }, [session]);

    const slides: (string | null)[] = useMemo(() => {
      if (images.length >= 3) return images.slice(0, 3);
      if (images.length === 2) return [images[0], images[1], null];
      if (images.length === 1) return [images[0], null, null];
      return [null, null, null];
    }, [images]);

    const attendees = session?.attendees ?? [];
    const confirmedAttendeesCount =
      session?.confirmed_attendees_count ?? attendees.length;

    const teacherId = session?.teacher?.id ?? null;

    const openViewer = (index: number) => {
      if (!images.length) return;
      setViewerIndex(index);
      setViewerVisible(true);
    };

    useEffect(() => {
      if (!viewerVisible) return;

      const frame = requestAnimationFrame(() => {
        viewerScrollRef.current?.scrollTo({
          x: viewerIndex * SCREEN_WIDTH,
          animated: false,
        });
      });

      return () => cancelAnimationFrame(frame);
    }, [viewerVisible, viewerIndex]);

const [showBookingConfirm, setShowBookingConfirm] = useState(false);

const handleReserve = () => {
  if (!session?.id || (session?.spots_left ?? 1) <= 0) return;

  setAcceptedPolicy(false);
  setShowBookingConfirm(true);
};

const continueBooking = () => {
  setShowBookingConfirm(false);

  navigatingAwayFromTeacherRef.current = true;
  modalRef.current?.dismiss();
  onClose();

  requestAnimationFrame(() => {
    safePush(`/(modal)/booking/${session!.id}`);
  });
};

    const handleTeacherPress = () => {
      if (!teacherId) return;

      openingTeacherRef.current = true;
      setTeacherProfileId(teacherId);

      requestAnimationFrame(() => {
        teacherSheetRef.current?.present?.();

        setTimeout(() => {
          openingTeacherRef.current = false;
        }, 500);
      });
    };

    const title = session?.class?.title?.trim() || "Session";

    const description =
      session?.class?.description?.trim() || "No description added yet.";

    const category = session?.class?.category?.trim() || null;

const location = session?.rough_location?.trim() || null;
    const teacherName = session?.teacher?.name?.trim() || "Teacher";

    const teacherBio =
      session?.teacher?.bio?.trim() ||
      "Tap to view the teacher profile and learn more.";

    const teacherAvatar = mediaUrl(
      session?.teacher?.avatarUrl?.trim() ||
        session?.teacher?.image_url?.trim() ||
        null,
    );

    const attendanceLabel = buildAttendanceLabel(session);
    const isFull = (session?.spots_left ?? 1) <= 0;

    return (
      <>
        <BottomSheetModal
          ref={modalRef}
          index={0}
snapPoints={["82%", "96%"]}
          stackBehavior="push"
          enablePanDownToClose
          onDismiss={() => {
            if (navigatingAwayFromTeacherRef.current) {
              navigatingAwayFromTeacherRef.current = false;
              openingTeacherRef.current = false;
              sessionDismissedForTeacherRef.current = false;
              setTeacherProfileId(null);
              setSession(null);
              onClose();
              return;
            }

            if (openingTeacherRef.current || teacherProfileId) {
              sessionDismissedForTeacherRef.current = true;
              return;
            }

            onClose();
          }}
          style={styles.sheetModal}
          handleIndicatorStyle={styles.handleIndicator}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              pressBehavior="close"
              opacity={0.3}
            />
          )}
          backgroundStyle={styles.sheetBackground}
        >
          <View style={styles.sheetRoot}>
            <View style={styles.sheetInner}>
              <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: 190 + insets.bottom,
                }}
              >
                {loading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading session…</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorWrap}>
                    <Text style={styles.errorTitle}>Couldn’t load session</Text>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.heroOuter}>
                      <View style={styles.heroGrid}>
                        {slides.map((uri, index) => (
                          <Pressable
                            key={`${session?.id ?? "session"}-image-${index}`}
                            onPress={() => {
                              if (uri) openViewer(index);
                            }}
                            style={styles.heroTile}
                          >
                            {uri ? (
                              <Image
                                source={{ uri }}
                                style={styles.heroTileImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.heroTilePlaceholder}>
                                <Ionicons
                                  name="image-outline"
                                  size={22}
                                  color={COLORS.textMuted}
                                />
                                <Text style={styles.heroTilePlaceholderText}>
                                  No image
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.heroGridHint}>
                        Tap a photo to expand
                      </Text>
                    </View>

                    <View style={styles.contentWrap}>
                      <View style={styles.infoCardOuter}>
                        <View style={styles.infoCardInner}>
<View style={styles.headerRow}>
  <View style={styles.titleBlock}>
    <Text style={styles.title}>{title}</Text>
  </View>

  <View style={styles.pricePill}>
    <Text style={styles.priceText}>€{session?.price ?? 0}</Text>
  </View>
</View>

<View style={styles.locationInfoBox}>
  <View style={styles.locationInfoHeader}>
    <Ionicons name="location-outline" size={16} color={COLORS.accent} />
    <Text style={styles.locationInfoTitle}>Location</Text>
  </View>

  <Text style={styles.locationInfoText}>{location}</Text>

  <Text style={styles.locationInfoHint}>
    Exact address and arrival instructions are shared after your booking is confirmed.
  </Text>
</View>



<View style={styles.descriptionBox}>
  <Text style={styles.sectionLabel}>Description</Text>
  <Text style={styles.descriptionText}>
    {description}
  </Text>
</View>

                          <View style={styles.chipsRow}>
                            <View style={styles.chip}>
                              <Ionicons
                                name="calendar-outline"
                                size={14}
                                color={COLORS.text}
                              />
                              <Text style={styles.chipText}>
                                {formatDate(session?.start_time)}
                              </Text>
                            </View>

                            <View style={styles.chip}>
                              <Ionicons
                                name="time-outline"
                                size={14}
                                color={COLORS.text}
                              />
                              <Text style={styles.chipText}>
                                {formatTimeRange(
                                  session?.start_time,
                                  session?.duration,
                                )}
                              </Text>
                            </View>

                            {category ? (
                              <View style={styles.chip}>
                                <Ionicons
                                  name="pricetag-outline"
                                  size={14}
                                  color={COLORS.text}
                                />
                                <Text style={styles.chipText}>{category}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <Pressable
                        onPress={handleTeacherPress}
                        style={styles.sectionCardOuter}
                      >
                        <View style={styles.sectionCardInner}>
                          <View style={styles.teacherRow}>
                            {teacherAvatar ? (
                              <Image
                                source={{ uri: teacherAvatar }}
                                style={styles.teacherAvatar}
                              />
                            ) : (
                              <View style={styles.teacherAvatarFallback}>
                                <Text style={styles.teacherAvatarFallbackText}>
                                  {teacherName.slice(0, 1).toUpperCase()}
                                </Text>
                              </View>
                            )}

                            <View style={styles.teacherTextWrap}>
                              <Text style={styles.teacherName}>
                                Hosted by {teacherName}
                              </Text>
                              <Text style={styles.teacherBio} numberOfLines={2}>
                                {teacherBio}
                              </Text>
                            </View>

                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={COLORS.textMuted}
                            />
                          </View>
                        </View>
                      </Pressable>

                      <View style={styles.sectionCardOuter}>
                        <View style={styles.sectionCardInner}>
                          <Text style={styles.sectionLabel}>
                            Session details
                          </Text>

                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Price</Text>
                            <Text style={styles.detailValue}>
                              €{session?.price ?? 0}
                            </Text>
                          </View>

                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Date</Text>
                            <Text style={styles.detailValue}>
                              {formatDate(session?.start_time)}
                            </Text>
                          </View>

                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Time</Text>
                            <Text style={styles.detailValue}>
                              {formatTimeRange(
                                session?.start_time,
                                session?.duration,
                              )}
                            </Text>
                          </View>

                        <View style={styles.detailRow}>
  <Text style={styles.detailKey}>Duration</Text>
  <Text style={styles.detailValue}>
    {session?.duration ?? 0} min
  </Text>
</View>

<View style={styles.detailRow}>
  <Text style={styles.detailKey}>Location</Text>

  <View style={styles.locationDetailWrap}>
    <Text style={styles.detailValue}>
      {location || "Shared after booking"}
    </Text>

    <Text style={styles.locationDetailHint}>
      Exact address shared after confirmation
    </Text>
  </View>
</View>

<View style={styles.detailRowLast}>
  <Text style={styles.detailKey}>Capacity</Text>
  <Text style={styles.detailValue}>
    Max {session?.max_participants ?? 0}
  </Text>
</View>
                        </View>
                      </View>

                      {attendanceLabel ? (
                        <Pressable
                          onPress={() => {
                            if (attendees.length > 0) {
                              setAttendeesVisible(true);
                            }
                          }}
                          disabled={attendees.length === 0}
                          style={({ pressed }) => [
                            styles.attendanceBar,
                            pressed && attendees.length > 0
                              ? styles.attendanceBarPressed
                              : null,
                          ]}
                        >
                          {attendees.length > 0 ? (
                            <View style={styles.attendeeAvatarStack}>
                              {attendees.slice(0, 4).map((attendee, index) => {
                                const avatar = mediaUrl(attendee.image_url ?? null);

                                return avatar ? (
                                  <Image
                                    key={attendee.id}
                                    source={{ uri: avatar }}
                                    style={[
                                      styles.attendeeAvatar,
                                      index > 0 ? styles.attendeeAvatarOverlap : null,
                                    ]}
                                  />
                                ) : (
                                  <View
                                    key={attendee.id}
                                    style={[
                                      styles.attendeeAvatar,
                                      styles.attendeeAvatarFallback,
                                      index > 0 ? styles.attendeeAvatarOverlap : null,
                                    ]}
                                  >
                                    <Text style={styles.attendeeAvatarInitial}>
                                      {(attendee.first_name || "?")
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </Text>
                                  </View>
                                );
                              })}

                              {confirmedAttendeesCount > 4 ? (
                                <View
                                  style={[
                                    styles.attendeeAvatar,
                                    styles.attendeeAvatarMore,
                                    styles.attendeeAvatarOverlap,
                                  ]}
                                >
                                  <Text style={styles.attendeeAvatarMoreText}>
                                    +{confirmedAttendeesCount - 4}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : (
                            <View style={styles.attendanceEmptyIcon}>
                              <Ionicons
                                name="people-outline"
                                size={18}
                                color={COLORS.accent}
                              />
                            </View>
                          )}

                          <View style={styles.attendanceTextWrap}>
                            <Text style={styles.attendanceText}>
                              {attendanceLabel}
                            </Text>

                            {attendees.length > 0 ? (
                              <Text style={styles.attendanceHint}>
                                Tap to view attendees
                              </Text>
                            ) : null}
                          </View>

                          {attendees.length > 0 ? (
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={COLORS.textMuted}
                            />
                          ) : null}
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                )}
              </BottomSheetScrollView>

              <View
                style={[
                  styles.reserveBar,
                  { paddingBottom: 12 + insets.bottom },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.reserveButton,
                    pressed && !isFull && styles.reserveButtonPressed,
                    isFull ? styles.reserveButtonDisabled : null,
                  ]}
                  onPress={handleReserve}
                  disabled={isFull}
                >
                  <Text style={styles.reserveButtonText}>
                    {isFull ? "Full" : "Reserve"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </BottomSheetModal>

        <Modal
          visible={viewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={styles.viewerRoot}>
            <Pressable
              onPress={() => setViewerVisible(false)}
              style={styles.viewerClose}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>

            <ScrollView
              ref={viewerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {images.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.viewerSlide}>
                  <Image
                    source={{ uri }}
                    style={styles.viewerImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        <Modal
          visible={attendeesVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAttendeesVisible(false)}
        >
          <View style={styles.attendeesModalBackdrop}>
            <View
              style={[
                styles.attendeesModalCard,
                { paddingBottom: 18 + insets.bottom },
              ]}
            >
              <View style={styles.attendeesModalHeader}>
                <View>
                  <Text style={styles.attendeesModalTitle}>Who's attending</Text>
                  <Text style={styles.attendeesModalSubtitle}>
                    {confirmedAttendeesCount} confirmed attendee
                    {confirmedAttendeesCount === 1 ? "" : "s"}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setAttendeesVisible(false)}
                  style={styles.attendeesModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close attendee list"
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.attendeesListContent}
              >
                {attendees.map((attendee) => {
                  const avatar = mediaUrl(attendee.image_url ?? null);

                  return (
                    <View key={attendee.id} style={styles.attendeeListRow}>
                      {avatar ? (
                        <Image
                          source={{ uri: avatar }}
                          style={styles.attendeeListAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.attendeeListAvatar,
                            styles.attendeeAvatarFallback,
                          ]}
                        >
                          <Text style={styles.attendeeListInitial}>
                            {(attendee.first_name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.attendeeListTextWrap}>
                        <Text style={styles.attendeeListName}>
                          {attendee.first_name || "Attendee"}
                        </Text>
                        <Text style={styles.attendeeListStatus}>Confirmed</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

<Modal
  visible={showBookingConfirm}
  transparent
  animationType="fade"
  onRequestClose={() => setShowBookingConfirm(false)}
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      padding: 22,
    }}
  >
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 22,
      }}
    >
      <Text
        style={{
          color: COLORS.text,
          fontSize: 22,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        Before you book
      </Text>

      <Text
        style={{
          color: COLORS.textSoft,
          lineHeight: 23,
        }}
      >
Please review the booking terms below before continuing to payment.
      </Text>

      <View style={{ marginTop: 18 }}>

        <Text style={{ color: COLORS.textSoft, lineHeight: 24 }}>
• Teacher cancels → 100% refund.

• You cancel at least 12 hours before the lesson →
Lesson price and Elevator service fee refunded.

• Stripe's payment processing fee is non-refundable.

• Less than 12 hours before the lesson →
No refund.
        </Text>

        <Text style={{ color: COLORS.textSoft, lineHeight: 24 }}>
          • You cancel 12+ hours before → Lesson price and Elevator fee refunded.
        </Text>

        <Text style={{ color: COLORS.textSoft, lineHeight: 24 }}>
          • Stripe processing fees are non-refundable.
        </Text>

        <Text style={{ color: COLORS.textSoft, lineHeight: 24 }}>
          • Less than 12 hours before the lesson → No refund.
        </Text>

      </View>

      <Pressable
        onPress={() => setAcceptedPolicy(!acceptedPolicy)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 22,
        }}
      >
        <Ionicons
          name={
            acceptedPolicy
              ? "checkbox"
              : "square-outline"
          }
          size={24}
          color={COLORS.accent}
        />

        <Text
          style={{
            color: COLORS.textSoft,
            marginLeft: 10,
            flex: 1,
            lineHeight: 22,
          }}
        >
I have read and agree to the Cancellation Policy, Refund Policy and Terms of Service.        </Text>
      </Pressable>

<Text
  style={{
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  }}
>
  By continuing, you agree that any refunds will be processed according to
  the Cancellation Policy and Refund Policy above.
</Text>

      <View
        style={{
          flexDirection: "row",
          marginTop: 16,
          gap: 18,
        }}
      >
        <Pressable
          onPress={() =>
Linking.openURL(
  "https://cl216.github.io/elevator-legal/refund-policy.html"
)
          }
        >
          <Text
            style={{
              color: COLORS.accent,
              fontWeight: "700",
            }}
          >
            Refund Policy
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Linking.openURL(
  "https://cl216.github.io/elevator-legal/terms.html"
           )
          }
        >
          <Text
            style={{
              color: COLORS.accent,
              fontWeight: "700",
            }}
          >
            Terms of Service
          </Text>
        </Pressable>
      </View>

      <Pressable
        disabled={!acceptedPolicy}
        onPress={continueBooking}
        style={{
          marginTop: 24,
          backgroundColor: acceptedPolicy
            ? COLORS.reserve
            : COLORS.reserveDisabled,
          paddingVertical: 15,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
          }}
        >
          Continue to Payment
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setShowBookingConfirm(false)}
        style={{
          marginTop: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: COLORS.textMuted,
            fontWeight: "700",
          }}
        >
          Cancel
        </Text>
      </Pressable>
    </View>
  </View>
</Modal>
        <TeacherProfileBottomSheet
          ref={teacherSheetRef}
          teacherId={teacherProfileId}
          onBeforeNavigateAway={() => {
            navigatingAwayFromTeacherRef.current = true;
            openingTeacherRef.current = false;
            sessionDismissedForTeacherRef.current = false;
            setTeacherProfileId(null);
            modalRef.current?.dismiss?.();
            onClose();
          }}
          onClose={() => {
            setTeacherProfileId(null);

            if (
              !navigatingAwayFromTeacherRef.current &&
              sessionDismissedForTeacherRef.current
            ) {
              sessionDismissedForTeacherRef.current = false;

              requestAnimationFrame(() => {
                modalRef.current?.present?.();
              });
            }
          }}
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  sheetModal: {
    marginHorizontal: 0,
  },

  handleIndicator: {
    width: 44,
    height: 5,
    backgroundColor: COLORS.indicator,
  },

  sheetBackground: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },

  sheetRoot: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SHEET_INNER_GAP,
  },

  sheetInner: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "relative",
  },

  loadingWrap: {
    paddingTop: 40,
    alignItems: "center",
  },

  loadingText: {
    color: COLORS.textSoft,
    marginTop: 10,
  },

  errorWrap: {
    paddingHorizontal: 18,
    paddingTop: 28,
  },

  errorTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  errorText: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  heroOuter: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },

  heroGrid: {
    height: HERO_HEIGHT,
    flexDirection: "row",
    gap: 8,
  },

  heroTile: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  heroTileImage: {
    width: "100%",
    height: "100%",
  },

  heroTilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
    gap: 6,
  },

  heroTilePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  heroGridHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },

  contentWrap: {
    padding: 16,
    gap: 14,
  },

  infoCardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  infoCardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  sectionCardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  sectionCardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  descriptionBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  titleBlock: {
    flex: 1,
  },

  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },

  locationText: {
    color: COLORS.textSoft,
    marginTop: 4,
    lineHeight: 20,
  },

  locationWrap: {
  marginTop: 8,
},

locationRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},

locationSubtext: {
  marginTop: 6,
  color: COLORS.textMuted,
  fontSize: 12,
  lineHeight: 18,
},

locationCard: {
  marginTop: 18,
  borderRadius: 18,
  padding: 14,
  backgroundColor: COLORS.surfaceSoft,
  borderWidth: 1,
  borderColor: COLORS.border,
},

locationCardHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
},

locationCardTitle: {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "800",
},

locationCardText: {
  color: COLORS.text,
  fontSize: 15,
  lineHeight: 22,
  fontWeight: "700",
},

locationCardHint: {
  marginTop: 8,
  color: COLORS.textSoft,
  fontSize: 13,
  lineHeight: 20,
},

  pricePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  priceText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },

  descriptionText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 23,
  },

  teacherRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  teacherAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },

  teacherAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: COLORS.accentSoftStrong,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  locationInfoBox: {
  marginTop: 14,
  borderRadius: 18,
  backgroundColor: COLORS.surfaceSoft,
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
  padding: 14,
},

locationInfoHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 7,
  marginBottom: 8,
},

locationInfoTitle: {
  color: COLORS.text,
  fontSize: 14,
  fontWeight: "900",
},

locationInfoText: {
  color: COLORS.text,
  fontSize: 14,
  fontWeight: "800",
  lineHeight: 20,
},

locationInfoHint: {
  color: COLORS.textSoft,
  fontSize: 13,
  lineHeight: 19,
  marginTop: 6,
},
  teacherAvatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  teacherTextWrap: {
    flex: 1,
  },

  teacherName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  teacherBio: {
    color: COLORS.textSoft,
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  detailRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 0,
  },

  detailKey: {
    color: COLORS.textSoft,
    fontSize: 15,
  },

  detailValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },

  locationDetailWrap: {
  flex: 1,
  alignItems: "flex-end",
},

locationDetailHint: {
  marginTop: 4,
  color: COLORS.textMuted,
  fontSize: 11,
  textAlign: "right",
  lineHeight: 16,
},
  attendanceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
  },

  attendanceBarPressed: {
    backgroundColor: COLORS.accentSoftStrong,
    borderColor: COLORS.borderStrong,
  },

  attendanceEmptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  attendeeAvatarStack: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 2,
  },

  attendeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.bg,
    backgroundColor: COLORS.surfaceElevated,
  },

  attendeeAvatarOverlap: {
    marginLeft: -12,
  },

  attendeeAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceElevated,
  },

  attendeeAvatarInitial: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },

  attendeeAvatarMore: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },

  attendeeAvatarMoreText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  attendanceTextWrap: {
    flex: 1,
  },

  attendanceText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  attendanceHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  attendeesModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.68)",
  },

  attendeesModalCard: {
    maxHeight: "78%",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  attendeesModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  attendeesModalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },

  attendeesModalSubtitle: {
    color: COLORS.textSoft,
    fontSize: 13,
    marginTop: 4,
  },

  attendeesModalClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  attendeesListContent: {
    paddingVertical: 10,
  },

  attendeeListRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 76,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  attendeeListAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceElevated,
  },

  attendeeListInitial: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  attendeeListTextWrap: {
    flex: 1,
  },

  attendeeListName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },

  attendeeListStatus: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },

  reserveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  reserveButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.reserve,
    alignItems: "center",
    justifyContent: "center",
  },

  reserveButtonPressed: {
    backgroundColor: COLORS.reservePressed,
  },

  reserveButtonDisabled: {
    backgroundColor: COLORS.reserveDisabled,
  },

  reserveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  viewerRoot: {
    flex: 1,
    backgroundColor: "#000",
  },

  viewerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },

  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});