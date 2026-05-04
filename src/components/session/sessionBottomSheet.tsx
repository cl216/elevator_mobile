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
    LayoutChangeEvent,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/src/config/api";

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

type SessionDetail = {
  id: string;
  start_time: string;
  duration: number;
  price: number;
  max_participants: number;
  bookings_count?: number;
  spots_left?: number;
  attendee_first_names?: string[];
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
    const heroScrollRef = useRef<ScrollView | null>(null);
    const viewerScrollRef = useRef<ScrollView | null>(null);

    const [heroWidth, setHeroWidth] = useState(0);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);

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
        setCurrentIndex(0);
        setViewerVisible(false);
        setViewerIndex(0);
        return;
      }

      (async () => {
        try {
          setLoading(true);
          setError(null);

          const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
          if (!res.ok) throw new Error("Failed to load session");

          const data = (await res.json()) as SessionDetail;
          if (!alive) return;

          setSession(data);
          setCurrentIndex(0);
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
    }, [sessionId, visible]);

    const images = useMemo<string[]>(() => {
      return (
        session?.image_urls?.filter(
          (u: string) => typeof u === "string" && u.trim().length > 0,
        ) ?? []
      ).slice(0, 3);
    }, [session]);

    const slides: (string | null)[] = useMemo(() => {
      if (images.length >= 3) return images.slice(0, 3);
      if (images.length === 2) return [images[0], images[1], null];
      if (images.length === 1) return [images[0], null, null];
      return [null, null, null];
    }, [images]);

    const teacherId = session?.teacher?.id ?? null;

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!heroWidth) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
      setCurrentIndex(index);
    };

    const openViewer = (index: number) => {
      if (!images.length) return;
      setViewerIndex(index);
      setViewerVisible(true);
    };

    useEffect(() => {
      if (!viewerVisible) return;
      const id = requestAnimationFrame(() => {
        viewerScrollRef.current?.scrollTo({
          x: viewerIndex * SCREEN_WIDTH,
          animated: false,
        });
      });
      return () => cancelAnimationFrame(id);
    }, [viewerVisible, viewerIndex]);

    const handleReserve = () => {
      if (!session?.id || (session?.spots_left ?? 1) <= 0) return;

      modalRef.current?.dismiss();
      onClose();

      requestAnimationFrame(() => {
         safePush(`/(modal)/booking/${session.id}`);
      });
    };

    const handleTeacherPress = () => {
      if (!teacherId) return;

      modalRef.current?.dismiss();
      onClose();

      requestAnimationFrame(() => {
         safePush(`/(modal)/teacher/${teacherId}`);
      });
    };

    const handleHeroLayout = (e: LayoutChangeEvent) => {
      const width = Math.round(e.nativeEvent.layout.width);
      if (width > 0 && width !== heroWidth) {
        setHeroWidth(width);
      }
    };

    const title = session?.class?.title?.trim() || "Session";
    const description =
      session?.class?.description?.trim() || "No description added yet.";
    const category = session?.class?.category?.trim() || null;
    const location =
      session?.rough_location?.trim() || "Exact location shared after booking";
    const teacherName = session?.teacher?.name?.trim() || "Teacher";
    const teacherBio =
      session?.teacher?.bio?.trim() ||
      "Tap to view the teacher profile and learn more.";
    const teacherAvatar =
      session?.teacher?.avatarUrl?.trim() ||
      session?.teacher?.image_url?.trim() ||
      null;

    const attendanceLabel = buildAttendanceLabel(session);
    const isFull = (session?.spots_left ?? 1) <= 0;

    return (
      <>
        <BottomSheetModal
          ref={modalRef}
          index={0}
          snapPoints={["72%", "92%"]}
          enablePanDownToClose
          onDismiss={onClose}
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
                  paddingBottom: 120 + insets.bottom,
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
                      <View onLayout={handleHeroLayout} style={styles.heroInner}>
                        {heroWidth > 0 ? (
                          <ScrollView
                            ref={heroScrollRef}
                            key={`${session?.id ?? "session"}-${slides.length}-${heroWidth}`}
                            horizontal
                            pagingEnabled
                            decelerationRate="fast"
                            snapToInterval={heroWidth}
                            snapToAlignment="start"
                            disableIntervalMomentum
                            onMomentumScrollEnd={handleScroll}
                            showsHorizontalScrollIndicator={false}
                            style={styles.heroScroll}
                          >
                            {slides.map((uri: string | null, i: number) => (
                              <Pressable
                                key={`${session?.id ?? "session"}-image-${i}`}
                                onPress={() => {
                                  if (uri) openViewer(i);
                                }}
                                style={[styles.heroSlide, { width: heroWidth }]}
                              >
                                {uri ? (
                                  <Image
                                    source={{ uri }}
                                    style={styles.heroImage}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={styles.heroPlaceholder}>
                                    <Text style={styles.heroPlaceholderText}>
                                      No image
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.heroOverlay} />
                              </Pressable>
                            ))}
                          </ScrollView>
                        ) : null}

                        <View style={styles.dotsWrap}>
                          {slides.map((_: string | null, i: number) => (
                            <View
                              key={`dot-${i}`}
                              style={[
                                styles.dot,
                                currentIndex === i ? styles.dotActive : null,
                              ]}
                            />
                          ))}
                        </View>

                        <View style={styles.heroHintWrap}>
                          <Text style={styles.heroHintText}>
                            Swipe photos · Tap to expand
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.contentWrap}>
                      <View style={styles.infoCardOuter}>
                        <View style={styles.infoCardInner}>
                          <View style={styles.headerRow}>
                            <View style={styles.titleBlock}>
                              <Text style={styles.title}>{title}</Text>
                              <Text style={styles.locationText}>{location}</Text>
                            </View>

                            <View style={styles.pricePill}>
                              <Text style={styles.priceText}>
                                €{session?.price ?? 0}
                              </Text>
                            </View>
                          </View>

                        <View style={styles.sectionCardInner}>
                          <Text style={styles.sectionLabel}>Description</Text>
                          <Text style={styles.descriptionText}>{description}</Text>
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
                          <Text style={styles.sectionLabel}>Session details</Text>

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

                          <View style={styles.detailRowLast}>
                            <Text style={styles.detailKey}>Capacity</Text>
                            <Text style={styles.detailValue}>
                              Max {session?.max_participants ?? 0}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {attendanceLabel ? (
                        <View style={styles.attendanceBar}>
                          <Ionicons
                            name="people-outline"
                            size={16}
                            color={COLORS.accent}
                          />
                          <Text style={styles.attendanceText}>
                            {attendanceLabel}
                          </Text>
                        </View>
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
              {images.map((uri: string, i: number) => (
                <View key={i} style={styles.viewerSlide}>
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

  heroInner: {
    height: HERO_HEIGHT,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSoft,
    position: "relative",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  heroScroll: {
    flex: 1,
  },

  heroSlide: {
    height: HERO_HEIGHT,
    overflow: "hidden",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
  },

  heroPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.heroOverlay,
  },

  dotsWrap: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    opacity: 0.38,
  },

  dotActive: {
    width: 16,
    opacity: 1,
  },

  heroHintWrap: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  heroHintText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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

  divider: {
    marginTop: 18,
    marginBottom: 18,
    height: 1,
    backgroundColor: COLORS.divider,
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

  attendanceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },

  attendanceText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
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