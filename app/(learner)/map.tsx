import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Mapbox from "@rnmapbox/maps";
import { useLocalSearchParams, usePathname } from "expo-router";
import * as Location from "expo-location";
import { mediaUrl } from "@/src/utils/mediaUrl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TouchableOpacity } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMapViewStore } from "../../src/store/mapView.store";
import {
  getApprovedCategories,
  type ApprovedCategory,
} from "../../src/api/categories";
import { api } from "../../src/api/client";
import { getMyNotifications } from "../../src/api/notifications";
import { SessionBottomSheet } from "../../src/components/session/sessionBottomSheet";
import { API_BASE_URL } from "../../src/config/api";
import { authStore } from "../../src/store/auth.store";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "@/src/utils/explainCard";
import { ExplainCard } from "@/src/components/ui/ExplainCard";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

type MapSessionPreview = {
  sessionId: string;
  lat: number;
  lng: number;
  title: string;
  price: number;
  startTimeISO: string;
  teacherName: string;
  teacherAvatarUrl?: string;
  sessionCategory?: string;
  thumbnailUrl?: string;
  attendeeCount?: number;
};

type NearbySessionPreview = {
  session_id: string;
  lat: number;
  lng: number;
  title: string;
  category?: string;
  price: number;
  start_time: string;
  teacher_name: string;
  teacher_avatar_url?: string | null;
  distance_meters: number;
};

type BookingRow = {
  id: string;
  status?: string;
  session_start_time?: string;
  start_time?: string;
  session?: {
    start_time?: string;
  };
};

const INITIAL_ZOOM = 14;
const CLUSTER_RADIUS = 90;
const CLUSTER_SWITCH_ZOOM = 11.5;

const MAP_STYLE_URL = "mapbox://styles/mapbox/dark-v11";
const MARKER_FETCH_PAD = 0.05;
const NEARBY_SUGGESTION_PAD = 2.0;
const SILENT_REFRESH_MS = 30000;
const FALLBACK_LOCATION: [number, number] = [-9.0568, 53.2707];

const PRIMARY_CATEGORY_SLUGS = [
  "art",
  "music",
  "cooking",
  "language",
  "crafts",
] as const;

const NAV_HEIGHT = 68;

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",
  divider: "rgba(255,255,255,0.06)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",
  accentStrong: "#3F6AE0",

  panelBg: "rgba(13,20,36,0.94)",
  panelBgSoft: "rgba(18,26,44,0.94)",

  badgeRed: "#F05A67",
};

type CategoryFilter = "all" | "other" | string;
type MarkerCategory =
  | "art"
  | "music"
  | "cooking"
  | "language"
  | "crafts"
  | "other";

function normalizeCategory(category?: string): MarkerCategory {
  if (
    category === "art" ||
    category === "music" ||
    category === "cooking" ||
    category === "language" ||
    category === "crafts"
  ) {
    return category;
  }
  return "other";
}

type BBox = { west: number; south: number; east: number; north: number };

function boundsToBBox(bounds: any): BBox | null {
  if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) return null;

  const a = bounds[0];
  const b = bounds[1];
  if (!a || !b) return null;

  return {
    west: Math.min(a[0], b[0]),
    east: Math.max(a[0], b[0]),
    south: Math.min(a[1], b[1]),
    north: Math.max(a[1], b[1]),
  };
}

function padBBox(b: BBox, factor = 1.0): BBox {
  const latPad = (b.north - b.south) * factor;
  const lngPad = (b.east - b.west) * factor;

  return {
    west: b.west - lngPad,
    south: b.south - latPad,
    east: b.east + lngPad,
    north: b.north + latPad,
  };
}

function bboxKey(b: BBox, category: CategoryFilter) {
  const r = (n: number) => n.toFixed(4);
  return `${category}|${r(b.west)}|${r(b.south)}|${r(b.east)}|${r(b.north)}`;
}

function getBBoxCenter(b: BBox) {
  return {
    lng: (b.west + b.east) / 2,
    lat: (b.south + b.north) / 2,
  };
}

function getBBoxSize(b: BBox) {
  return {
    lngSpan: Math.abs(b.east - b.west),
    latSpan: Math.abs(b.north - b.south),
  };
}

function isEffectivelySameArea(current: BBox, previous: BBox) {
  const currentCenter = getBBoxCenter(current);
  const previousCenter = getBBoxCenter(previous);

  const currentSize = getBBoxSize(current);
  const previousSize = getBBoxSize(previous);

  const lngTolerance =
    Math.max(currentSize.lngSpan, previousSize.lngSpan) * 0.4;
  const latTolerance =
    Math.max(currentSize.latSpan, previousSize.latSpan) * 0.4;

  return (
    Math.abs(currentCenter.lng - previousCenter.lng) <= lngTolerance &&
    Math.abs(currentCenter.lat - previousCenter.lat) <= latTolerance
  );
}

type SessionFeature = {
  type: "Feature";
  id: string;
  properties: {
    sessionId: string;
    title: string;
    price: number;
    category: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

type SessionFeatureCollection = {
  type: "FeatureCollection";
  features: SessionFeature[];
};

function sessionsToFeatureCollection(
  sessions: MapSessionPreview[],
): SessionFeatureCollection {
  return {
    type: "FeatureCollection",
    features: sessions
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({
        type: "Feature",
        id: s.sessionId,
        properties: {
          sessionId: s.sessionId,
          title: s.title,
          price: s.price,
          category: s.sessionCategory ?? "other",
        },
        geometry: {
          type: "Point",
          coordinates: [s.lng, s.lat],
        },
      })),
  };
}

function CurrentLocationIcon() {
  return <Ionicons name="locate" size={22} color="#FFFFFF" />;
}


function getCategoryBadge(category?: MarkerCategory) {
  switch (category) {
    case "art":
      return {
        bg: "#FF7A1A",
        icon: <Ionicons name="color-palette" size={13} color="#fff" />,
      };
    case "music":
      return {
        bg: "#E94B7B",
        icon: <Ionicons name="musical-notes" size={13} color="#fff" />,
      };
    case "cooking":
      return {
        bg: "#F59E0B",
        icon: <Ionicons name="restaurant" size={13} color="#fff" />,
      };
    case "language":
      return {
        bg: "#14B8A6",
        icon: <Ionicons name="language" size={13} color="#fff" />,
      };
    case "crafts":
      return {
        bg: "#8B5CF6",
        icon: (
          <MaterialCommunityIcons
            name="hammer-screwdriver"
            size={13}
            color="#fff"
          />
        ),
      };
    default:
      return {
        bg: "#5C7CFA",
        icon: (
          <MaterialCommunityIcons
            name="book-open-variant"
            size={13}
            color="#fff"
          />
        ),
      };
  }
}

function CategoryMenuIcon({ category }: { category: MarkerCategory | "all" }) {
  if (category === "all") {
    return (
      <View
        style={[
          styles.categoryMenuIconWrap,
          { backgroundColor: "rgba(111,146,255,0.16)" },
        ]}
      >
        <Ionicons name="apps" size={13} color="#fff" />
      </View>
    );
  }

  const badge = getCategoryBadge(category);
  return (
    <View style={[styles.categoryMenuIconWrap, { backgroundColor: badge.bg }]}>
      {badge.icon}
    </View>
  );
}

function TeacherMarker({
  avatarUrl,
  category = "other",
  selected = false,
  onImageLoad,
}: {
  avatarUrl?: string;
  category?: MarkerCategory;
  selected?: boolean;
  onImageLoad?: () => void;
}) {
  const badge = getCategoryBadge(category);

  return (
    <View style={[styles.customMarkerWrap, selected && styles.customMarkerWrapSelected]}>
      <View
        style={[
          styles.customMarkerAvatarOuter,
          selected && styles.customMarkerAvatarOuterSelected,
        ]}
      >
        <View style={styles.customMarkerAvatarInner}>
          {avatarUrl ? (
<Image
              source={{ uri: mediaUrl(avatarUrl)! }}
              style={styles.customMarkerAvatarImage}
              onLoad={onImageLoad}
            />          ) : (
            <View style={styles.customMarkerAvatarFallback}>
              <Ionicons name="person" size={26} color="#dbe7ff" />
            </View>
          )}
        </View>
      </View>

      <View style={[styles.customMarkerBadge, { backgroundColor: badge.bg }]}>
        {badge.icon}
      </View>

      <View style={styles.customMarkerPointer} />
    </View>
  );
}

export default function LearnerMap() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ focusSessionId?: string }>();

  const isManualSearchRef = useRef(false);
const isFetchingMapRef = useRef(false);

  const hasCenteredOnInitialLocationRef = useRef(false);

  const pathname = usePathname();
  const isProfile = pathname === "/(learner)/profile";

  const savedMapCenter = useMapViewStore((s) => s.center);
  const savedMapZoom = useMapViewStore((s) => s.zoom);
  const hasHydratedView = useMapViewStore((s) => s.hasHydratedView);
  const setMapView = useMapViewStore((s) => s.setMapView);

  const hasFocusSessionParam =
    typeof params.focusSessionId === "string" && !!params.focusSessionId;


  const currentZoomRef = useRef<number>(INITIAL_ZOOM);
  const requestSeqRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);
  const lastSearchedBBoxRef = useRef<BBox | null>(null);
  const focusFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUserFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledFocusSessionIdRef = useRef<string | null>(null);
  const hasShownInitialSuggestionsRef = useRef(false);
  const hasMountedCategoryEffectRef = useRef(false);
  const hasHandledInitialMapLoadRef = useRef(false);

  const activeSearchRef = useRef<{
    bbox: BBox;
    category: CategoryFilter;
  } | null>(null);

  const mapRef = useRef<Mapbox.MapView | null>(null);
  const cameraRef = useRef<Mapbox.Camera | null>(null);
  const shapeSourceRef = useRef<Mapbox.ShapeSource | null>(null);
  const sessionSheetRef = useRef<{
    present?: () => void;
    dismiss?: () => void;
    close?: () => void;
    snapToIndex?: (index: number) => void;
  } | null>(null);

  const categoryMenuAnim = useRef(new Animated.Value(0)).current;
  const searchPillAnim = useRef(new Animated.Value(0)).current;
  const emptyBannerOpacity = useRef(new Animated.Value(0)).current;
  const emptyBannerTranslateY = useRef(new Animated.Value(-8)).current;

  const [approvedCategories, setApprovedCategories] = useState<ApprovedCategory[]>([]);
  const [nearbySuggestions, setNearbySuggestions] = useState<NearbySessionPreview[]>([]);
  const [emptyAreaStateVisible, setEmptyAreaStateVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showMapExplainCard, setShowMapExplainCard] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [upcomingBookingsCount, setUpcomingBookingsCount] = useState(0);
  const [isInitialLocationResolved, setIsInitialLocationResolved] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sheetSessionId, setSheetSessionId] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [sessions, setSessions] = useState<MapSessionPreview[]>([]);
  const [markerRenderNonce, setMarkerRenderNonce] = useState(0);
  const [locError, setLocError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const [visibleBBox, setVisibleBBox] = useState<BBox | null>(null);

  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [pendingBBox, setPendingBBox] = useState<BBox | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

const effectiveZoom = zoomLevel || currentZoomRef.current || INITIAL_ZOOM;

const showClusterSource = effectiveZoom < CLUSTER_SWITCH_ZOOM;
const showCustomMarkers = effectiveZoom >= CLUSTER_SWITCH_ZOOM;

  const sessionFeatureCollection = useMemo(
    () => sessionsToFeatureCollection(sessions),
    [sessions],
  );

useEffect(() => {
  let alive = true;

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!alive) return;

      if (status !== "granted") {
        setLocError("Location permission denied");
        setUserLocation(FALLBACK_LOCATION);
        setIsInitialLocationResolved(true);



        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!alive) return;

      const nextLocation: [number, number] = [
        current.coords.longitude,
        current.coords.latitude,
      ];

      setUserLocation(nextLocation);
      setLocError(null);
      setIsInitialLocationResolved(true);

      if (
        !hasCenteredOnInitialLocationRef.current &&
        !hasFocusSessionParam &&
        !hasHydratedView &&
        !savedMapCenter
      ) {
        hasCenteredOnInitialLocationRef.current = true;

        cameraRef.current?.setCamera({
          centerCoordinate: nextLocation,
          zoomLevel: 13.5,
          animationDuration: 0,
        });
      }
    } catch (e) {
      console.log("requestLocation error", e);

      if (!alive) return;

      setLocError("Could not get location");
      setUserLocation(FALLBACK_LOCATION);
      setIsInitialLocationResolved(true);


    }
  }

  requestLocation();

  return () => {
    alive = false;
  };
}, []);

useEffect(() => {
  const timeout = setTimeout(() => {
    setIsInitialLocationResolved(true);

    if (!userLocation) {
      setUserLocation(FALLBACK_LOCATION);
    }
  }, 10000);

  return () => clearTimeout(timeout);
}, []);

  const primaryCategoriesToShow = useMemo(() => {
    return PRIMARY_CATEGORY_SLUGS
      .map((slug) => approvedCategories.find((c) => c.slug === slug))
      .filter(Boolean) as ApprovedCategory[];
  }, [approvedCategories]);

  const categoryMenuItems = useMemo(() => {
    const primary = primaryCategoriesToShow.map((category) => ({
      key: category.slug,
      label: category.label,
      markerCategory: category.slug as MarkerCategory,
    }));

    return [
      { key: "all", label: "All categories", markerCategory: "all" as const },
      ...primary,
      { key: "other", label: "Other", markerCategory: "other" as const },
    ];
  }, [primaryCategoriesToShow]);

  const selectedCategoryLabel = useMemo(() => {
    return (
      categoryMenuItems.find((item) => item.key === selectedCategory)?.label ??
      "All categories"
    );
  }, [categoryMenuItems, selectedCategory]);

  const visibleSessions = useMemo(() => {
    if (!visibleBBox) return [];

    return sessions.filter((s) => {
      return (
        s.lng >= visibleBBox.west &&
        s.lng <= visibleBBox.east &&
        s.lat >= visibleBBox.south &&
        s.lat <= visibleBBox.north
      );
    });
  }, [sessions, visibleBBox]);

  const visibleSessionCount = visibleSessions.length;

  const foundCountLabel = useMemo(() => {
    if (!isInitialLocationResolved) return "Finding sessions...";
    if (isMapLoading) return "Searching...";
    if (visibleSessionCount === 0) return "No sessions found";
    if (visibleSessionCount === 1) return "1 session found";
    return `${visibleSessionCount} sessions found`;
  }, [isInitialLocationResolved, isMapLoading, visibleSessionCount]);

  const shouldShowNearbyCompactList =
    emptyAreaStateVisible &&
    !showSearchThisArea &&
    nearbySuggestions.length > 0;

  const shouldShowNoSessionsBanner =
    emptyAreaStateVisible &&
    !showSearchThisArea &&
    nearbySuggestions.length === 0;

  const updateVisibleBBox = useCallback(async () => {
    try {
      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (bbox) {
        setVisibleBBox(bbox);
      }
    } catch (e) {
      console.log("updateVisibleBBox error", e);
    }
  }, []);

  useEffect(() => {
    Animated.timing(categoryMenuAnim, {
      toValue: showCategoryMenu ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showCategoryMenu, categoryMenuAnim]);

  useEffect(() => {
    Animated.spring(searchPillAnim, {
      toValue: showSearchThisArea ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [showSearchThisArea, searchPillAnim]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(emptyBannerOpacity, {
        toValue: shouldShowNoSessionsBanner ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(emptyBannerTranslateY, {
        toValue: shouldShowNoSessionsBanner ? 0 : -8,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    shouldShowNoSessionsBanner,
    emptyBannerOpacity,
    emptyBannerTranslateY,
  ]);

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const rows = await getMyNotifications();
      const unread = rows.filter((item) => !item.read).length;
      setUnreadNotificationsCount(unread);
    } catch (e) {
      console.log("loadUnreadNotificationsCount error", e);
    }
  }, []);

const loadUpcomingBookingsCount = useCallback(async () => {
  try {
    const res = await api.get("/bookings/me");
    const rows: BookingRow[] = Array.isArray(res.data) ? res.data : [];

    const upcomingCount = rows.filter((booking: any) => {
      const status =
        booking.booking_status ??
        booking.status ??
        "";

      const startTime =
        booking.session_start_time ??
        booking.start_time ??
        booking.session?.start_time;

      if (!startTime) return false;

      const startMs = new Date(startTime).getTime();

      if (Number.isNaN(startMs)) return false;

      const isUpcoming = startMs > Date.now();

      const isConfirmed = status === "CONFIRMED";

      const createdAt =
        booking.booking_created_at ??
        booking.created_at;

      let isPendingNotExpired = false;

      if (status === "PENDING" && createdAt) {
        const createdMs = new Date(createdAt).getTime();

        if (!Number.isNaN(createdMs)) {
          const expiresAt = createdMs + 15 * 60 * 1000;

          isPendingNotExpired = Date.now() < expiresAt;
        }
      }

      return isUpcoming && (isConfirmed || isPendingNotExpired);
    }).length;

    setUpcomingBookingsCount(upcomingCount);
  } catch (e) {
    console.log("loadUpcomingBookingsCount error", e);
    setUpcomingBookingsCount(0);
  }
}, []);

  const openSessionSheet = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSheetSessionId(sessionId);

    requestAnimationFrame(() => {
      sessionSheetRef.current?.present?.();
    });
  }, []);

  const closeSessionSheet = useCallback(() => {
    sessionSheetRef.current?.dismiss?.();
    sessionSheetRef.current?.close?.();
    setSheetSessionId(null);
  }, []);



  useFocusEffect(
    useCallback(() => {
      loadUnreadNotificationsCount();
      loadUpcomingBookingsCount();
    }, [loadUnreadNotificationsCount, loadUpcomingBookingsCount]),
  );

  

  

 ////FOR TESTING EXPLAINCARD
// useEffect(() => {
//   setShowMapExplainCard(true);
// }, []);

// useEffect(() => {
//   (async () => {
//     const seen = await hasSeenExplainCard("learner-map-intro");
//     setShowMapExplainCard(!seen);
//   })();
// }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getApprovedCategories();
        setApprovedCategories(rows);
      } catch (e) {
        console.log("load categories error", e);
      }
    })();
  }, []);

const fetchNearbySuggestions = useCallback(
  async (bbox: BBox, category: CategoryFilter) => {
    try {
      const centerLat = (bbox.north + bbox.south) / 2;
      const centerLng = (bbox.east + bbox.west) / 2;

      const qs = new URLSearchParams({
        lat: String(centerLat),
        lng: String(centerLng),
        limit: "3",
      });

      if (category !== "all") {
        qs.append("category", category);
      }

      const res = await fetch(`${API_BASE_URL}/sessions/nearby?${qs.toString()}`);

      if (!res.ok) {
        setNearbySuggestions([]);
        return;
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];

      setNearbySuggestions(
        rows
          .map((row: any) => ({
            session_id: String(row.session_id),
            lat: Number(row.lat),
            lng: Number(row.lng),
            title: row.title ?? "Session",
            category: row.category ?? "other",
            price: Number(row.price ?? 0),
            start_time: row.start_time,
            teacher_name: row.teacher_name ?? "Teacher",
            teacher_avatar_url: row.teacher_avatar_url ?? null,
            distance_meters: Number(row.distance_meters ?? 0),
          }))
          .filter((row) => row.distance_meters <= 20_000),
      );
    } catch (e) {
      console.log("fetchNearbySuggestions error", e);
      setNearbySuggestions([]);
    }
  },
  [],
);

  const fetchSessionsForBBox = useCallback(
    async (
      bbox: BBox,
      category: CategoryFilter,
      options?: { silent?: boolean; commitActiveSearch?: boolean },
    ) => {
      const silent = options?.silent ?? false;
      const commitActiveSearch = options?.commitActiveSearch ?? false;

      if (isFetchingMapRef.current && !silent) {
        return [];
      }

      try {
        const key = bboxKey(bbox, category);
        const myReq = ++requestSeqRef.current;

        if (!silent) {
          isFetchingMapRef.current = true;
          setIsMapLoading(true);
        }

        const qs = new URLSearchParams({
          north: String(bbox.north),
          south: String(bbox.south),
          east: String(bbox.east),
          west: String(bbox.west),
        });

        if (category !== "all") {
          qs.append("category", category);
        }

        const res = await fetch(`${API_BASE_URL}/sessions/map?${qs.toString()}`);
        if (!res.ok) {
          if (!silent) {
            Alert.alert(
              "Could not search this area",
              "Something went wrong while loading classes. Please try again.",
            );
          }
          return [];
        }
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];

        if (myReq !== requestSeqRef.current) return [];

        const next: MapSessionPreview[] = rows
          .map((r: any) => ({
            sessionId: String(r.session_id),
            lat: Number(r.lat),
            lng: Number(r.lng),
            title: r.title ?? "Session",
            price: Number(r.price ?? 0),
            startTimeISO: r.start_time
              ? new Date(r.start_time).toISOString()
              : new Date().toISOString(),
            teacherName: r.teacher_name ?? "Teacher",
            teacherAvatarUrl: r.teacher_avatar_url ?? undefined,
            sessionCategory: r.category ?? undefined,
            thumbnailUrl: undefined,
            attendeeCount: 0,
          }))
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

setSessions(next);
setZoomLevel(currentZoomRef.current || INITIAL_ZOOM);
setMarkerRenderNonce((n) => n + 1);

setTimeout(() => {
  setMarkerRenderNonce((n) => n + 1);
}, 80);

        if (commitActiveSearch) {
          activeSearchRef.current = { bbox, category };
          lastSearchedBBoxRef.current = bbox;
          lastKeyRef.current = key;
        }

        setPendingBBox(null);
        setPendingKey(null);
        setShowSearchThisArea(false);

        return next;
      } catch (e) {
        console.log("fetchSessionsForBBox error", e);

        if (!silent) {
          Alert.alert(
            "Could not search this area",
            "Something went wrong while loading classes. Please try again.",
          );
        }

        return [];
      } finally {
        if (!silent) {
          isFetchingMapRef.current = false;
          setIsMapLoading(false);
        }
      }
    },
    [],
  );

  useFocusEffect(
  useCallback(() => {
    if (!isInitialLocationResolved) return;
    if (!lastSearchedBBoxRef.current) return;
    if (isFetchingMapRef.current) return;
if (!activeSearchRef.current) return;
    void fetchSessionsForBBox(
      lastSearchedBBoxRef.current,
      selectedCategory,
      {
        silent: true,
        commitActiveSearch: true,
      },
    );
  }, [fetchSessionsForBBox, isInitialLocationResolved, selectedCategory]),
);

  const fetchForCurrentMapNow = useCallback(async () => {
    try {
          if (isManualSearchRef.current) return;
      if (!isInitialLocationResolved) return;
      if (currentZoomRef.current < 10) return;
      if (isFetchingMapRef.current) return;

      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (!bbox) return;

      setVisibleBBox(bbox);

      const markerBBox = padBBox(bbox, MARKER_FETCH_PAD);
      const next = await fetchSessionsForBBox(markerBBox, selectedCategory, {
        commitActiveSearch: true,
      });

      if (next.length > 0) {
        setNearbySuggestions([]);
        setEmptyAreaStateVisible(false);
      } else if (!hasShownInitialSuggestionsRef.current) {
        hasShownInitialSuggestionsRef.current = true;
        setEmptyAreaStateVisible(true);
        setNearbySuggestions([]);
        await fetchNearbySuggestions(
          padBBox(markerBBox, NEARBY_SUGGESTION_PAD),
          selectedCategory,
        );
      }
    } catch (e) {
      console.log("fetchForCurrentMapNow error", e);
    }
  }, [
    fetchNearbySuggestions,
    fetchSessionsForBBox,
    isInitialLocationResolved,
    selectedCategory,
  ]);

  const focusSessionFromNotification = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
        if (!res.ok) return;

        const session = await res.json();
        const coordinates = session?.location?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return;

        const [lng, lat] = coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setSelectedSessionId(sessionId);

        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: Math.max(CLUSTER_SWITCH_ZOOM + 1, 13),
          animationDuration: 700,
        });

        setShowSearchThisArea(false);
        setPendingBBox(null);
        setPendingKey(null);
        setEmptyAreaStateVisible(false);
        setNearbySuggestions([]);

        if (focusFetchTimerRef.current) {
          clearTimeout(focusFetchTimerRef.current);
        }

        focusFetchTimerRef.current = setTimeout(() => {
          fetchForCurrentMapNow();
        }, 800);
      } catch (e) {
        console.log("focusSessionFromNotification error", e);
      }
    },
    [fetchForCurrentMapNow],
  );

  const prepareSearchThisArea = useCallback(async () => {
    try {
          if (isManualSearchRef.current) return;
      if (currentZoomRef.current < 10) {
        setShowSearchThisArea(false);
        setPendingBBox(null);
        setPendingKey(null);
        return;
      }

      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (!bbox) return;

      setVisibleBBox(bbox);

      const markerBBox = padBBox(bbox, MARKER_FETCH_PAD);
      const key = bboxKey(markerBBox, selectedCategory);
      const lastSearchedBBox = lastSearchedBBoxRef.current;

      if (
        lastSearchedBBox &&
        isEffectivelySameArea(markerBBox, lastSearchedBBox) &&
        activeSearchRef.current?.category === selectedCategory
      ) {
        setShowSearchThisArea(false);
        setPendingBBox(null);
        setPendingKey(null);
        return;
      }

      setPendingBBox(markerBBox);
      setPendingKey(key);
      setShowSearchThisArea(true);
      setEmptyAreaStateVisible(false);
      setNearbySuggestions([]);
    } catch (e) {
      console.log("prepareSearchThisArea error", e);
    }
  }, [selectedCategory]);

  const handleShapeSourcePress = useCallback(async (event: any) => {
    const feature = event?.features?.[0];
    if (!feature) return;

    const props = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates)) return;

    if (!props.cluster) return;

    if (shapeSourceRef.current) {
      try {
        const expansionZoom =
          await shapeSourceRef.current.getClusterExpansionZoom(feature);

        setSelectedSessionId(null);

        cameraRef.current?.setCamera({
          centerCoordinate: coordinates as [number, number],
          zoomLevel: Math.max(expansionZoom, CLUSTER_SWITCH_ZOOM + 0.75),
          animationDuration: 250,
        });
      } catch (e) {
        console.log("cluster expansion failed", e);

        cameraRef.current?.setCamera({
          centerCoordinate: coordinates as [number, number],
          zoomLevel: CLUSTER_SWITCH_ZOOM + 0.75,
          animationDuration: 250,
        });
      }
    }
  }, []);

   //FOR TESTING EXPLAINCARD
// useEffect(() => {
//   setShowMapExplainCard(true);
// }, []);


useEffect(() => {
  let alive = true;

  (async () => {
    const seen = await hasSeenExplainCard("learner-map-intro");

    if (alive) {
      setShowMapExplainCard(!seen);
    }
  })();

  return () => {
    alive = false;
  };
}, []);

  useEffect(() => {
    if (!isInitialLocationResolved) return;
    if (hasFocusSessionParam) return;
    if (isFetchingMapRef.current) return;

    if (!hasMountedCategoryEffectRef.current) {
      hasMountedCategoryEffectRef.current = true;
      return;
    }

    activeSearchRef.current = null;
    lastKeyRef.current = null;
    lastSearchedBBoxRef.current = null;
    hasShownInitialSuggestionsRef.current = false;

    setPendingBBox(null);
    setPendingKey(null);
    setShowSearchThisArea(false);
    setNearbySuggestions([]);
    setEmptyAreaStateVisible(false);
    setSelectedSessionId(null);
    setSheetSessionId(null);
    setShowCategoryMenu(false);

    sessionSheetRef.current?.dismiss?.();
    sessionSheetRef.current?.close?.();

    const run = async () => {
      try {
        const bounds = await mapRef.current?.getVisibleBounds();
        const bbox = boundsToBBox(bounds);
        if (!bbox) return;

        setVisibleBBox(bbox);

        const markerBBox = padBBox(bbox, MARKER_FETCH_PAD);

        const next = await fetchSessionsForBBox(markerBBox, selectedCategory, {
          commitActiveSearch: true,
        });

        if (next.length > 0) {
          setNearbySuggestions([]);
          setEmptyAreaStateVisible(false);
          return;
        }

        await fetchNearbySuggestions(
          padBBox(markerBBox, NEARBY_SUGGESTION_PAD),
          selectedCategory,
        );

        setEmptyAreaStateVisible(true);
      } catch (e) {
        console.log("category auto-refresh error", e);
      }
    };

    run();
  }, [
    selectedCategory,
    isInitialLocationResolved,
    hasFocusSessionParam,
    fetchSessionsForBBox,
    fetchNearbySuggestions,
  ]);

  useEffect(() => {
    const focusSessionId =
      typeof params.focusSessionId === "string"
        ? params.focusSessionId
        : undefined;

    if (!focusSessionId) return;
    if (handledFocusSessionIdRef.current === focusSessionId) return;

    handledFocusSessionIdRef.current = focusSessionId;
    focusSessionFromNotification(focusSessionId);
  }, [params.focusSessionId, focusSessionFromNotification]);

  useEffect(() => {
    if (!selectedSessionId) return;

    const stillVisible = sessions.some((s) => s.sessionId === selectedSessionId);
    if (!stillVisible) {
      setSelectedSessionId(null);
      closeSessionSheet();
    }
  }, [sessions, selectedSessionId, closeSessionSheet]);

  useEffect(() => {
    return () => {
      if (focusFetchTimerRef.current) clearTimeout(focusFetchTimerRef.current);
      if (initialUserFetchTimerRef.current) clearTimeout(initialUserFetchTimerRef.current);
    };
  }, []);

const handleDismissMapExplainCard = useCallback(() => {
  setShowMapExplainCard(false);

  void markExplainCardSeen("learner-map-intro").catch((e) => {
    console.log("mark map explain card seen error", e);
  });
}, []);

  const handleSearchThisArea = useCallback(async () => {
  if (!pendingBBox || !pendingKey) return;
  if (isMapLoading || isFetchingMapRef.current) return;

  isManualSearchRef.current = true;

  try {
    setEmptyAreaStateVisible(false);
    setNearbySuggestions([]);
    setShowSearchThisArea(false);

    await updateVisibleBBox();
    const next = await fetchSessionsForBBox(pendingBBox, selectedCategory, {
      commitActiveSearch: true,
    });

    if (next.length > 0) {
      return;
    }

    await fetchNearbySuggestions(
      padBBox(pendingBBox, NEARBY_SUGGESTION_PAD),
      selectedCategory,
    );

    setEmptyAreaStateVisible(true);
  } finally {
    setTimeout(() => {
      isManualSearchRef.current = false;
    }, 300);
  }
}, [
  fetchNearbySuggestions,
  fetchSessionsForBBox,
  pendingBBox,
  pendingKey,
  selectedCategory,
  isMapLoading,
  updateVisibleBBox,
]);

  const handleCloseNearbySuggestions = useCallback(() => {
    setEmptyAreaStateVisible(false);
    setNearbySuggestions([]);
  }, []);

  const handleFocusNearbySession = useCallback(
    (item: NearbySessionPreview) => {
      if (focusFetchTimerRef.current) {
        clearTimeout(focusFetchTimerRef.current);
      }

      setSelectedSessionId(item.session_id);

      cameraRef.current?.setCamera({
        centerCoordinate: [item.lng, item.lat],
        zoomLevel: Math.max(CLUSTER_SWITCH_ZOOM + 1, 13),
        animationDuration: 500,
      });

      setEmptyAreaStateVisible(false);
      setNearbySuggestions([]);
      setShowSearchThisArea(false);
      setPendingBBox(null);
      setPendingKey(null);

      focusFetchTimerRef.current = setTimeout(() => {
        fetchForCurrentMapNow();
      }, 650);
    },
    [fetchForCurrentMapNow],
  );

  const handleOpenRequestClass = useCallback(async () => {
    let centerLat: number | undefined;
    let centerLng: number | undefined;

    if (pendingBBox) {
      centerLat = (pendingBBox.north + pendingBBox.south) / 2;
      centerLng = (pendingBBox.east + pendingBBox.west) / 2;
    } else {
      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (bbox) {
        centerLat = (bbox.north + bbox.south) / 2;
        centerLng = (bbox.east + bbox.west) / 2;
      } else if (userLocation) {
        centerLng = userLocation[0];
        centerLat = userLocation[1];
      }
    }

    if (typeof centerLat !== "number" || typeof centerLng !== "number") return;

    const defaultCategory =
      selectedCategory !== "all" && selectedCategory !== "other"
        ? selectedCategory
        : primaryCategoriesToShow[0]?.slug ?? "art";

    safePush({
      pathname: "/(modal)/request-class",
      params: {
        lat: String(centerLat),
        lng: String(centerLng),
        category: defaultCategory,
        title: "Request a class in this area",
        helper:
          "Tell us what you want to learn here. We’ll save your request for the area currently shown on the map so teachers can see local demand.",
      },
    });
  }, [pendingBBox, primaryCategoriesToShow, selectedCategory, userLocation]);

const handleRecenterToUser = useCallback(async () => {
  try {
    setSelectedSessionId(null);
    closeSessionSheet();

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Location permission needed",
        "Please allow location access to center the map on your current location.",
      );
      return;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const nextLocation: [number, number] = [
      current.coords.longitude,
      current.coords.latitude,
    ];

    setUserLocation(nextLocation);
    setLocError(null);

    cameraRef.current?.setCamera({
      centerCoordinate: nextLocation,
      zoomLevel: Math.max(currentZoomRef.current, 13),
      animationDuration: 500,
    });
  } catch (e) {
    console.log("handleRecenterToUser error", e);
    Alert.alert(
      "Could not get location",
      "Please check location permissions and try again.",
    );
  }
}, [closeSessionSheet]);

  function formatDistance(meters: number) {
    if (meters < 1000) return `${meters} m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  }

  return (
    <View style={styles.screen}>
    <Header />

      <View style={styles.mapFrame}>
        <Mapbox.MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={styles.map}
          styleURL={MAP_STYLE_URL}
          onDidFinishLoadingMap={() => {
            hasHandledInitialMapLoadRef.current = true;
          }}
          onMapIdle={() => {
            prepareSearchThisArea();
            updateVisibleBBox();
          }}
onPress={() => {
  if (isManualSearchRef.current) return;

  setSelectedSessionId(null);
  closeSessionSheet();
  setShowCategoryMenu(false);
}}
          onCameraChanged={(e) => {
            const z = e?.properties?.zoom;
            const center = e?.properties?.center;

            if (typeof z === "number") {
              currentZoomRef.current = z;
              setZoomLevel(z);
            }

            if (
              Array.isArray(center) &&
              center.length >= 2 &&
              Number.isFinite(center[0]) &&
              Number.isFinite(center[1]) &&
              typeof z === "number"
            ) {
              setMapView({
                center: [center[0], center[1]],
                zoom: z,
              });
            }
          }}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
<Mapbox.Camera
  ref={(r) => {
    cameraRef.current = r;
  }}
defaultSettings={{
    centerCoordinate: userLocation ?? FALLBACK_LOCATION,
    zoomLevel: 13.5,
    pitch: 0,
    heading: 0,
  }}
/>

<Mapbox.UserLocation
  visible={true}
/>

          

<Mapbox.ShapeSource
  id="sessions-clusters"
  ref={(r) => {
    shapeSourceRef.current = r;
  }}
  shape={sessionFeatureCollection}
  cluster
  clusterRadius={CLUSTER_RADIUS}
  clusterMaxZoomLevel={CLUSTER_SWITCH_ZOOM}
  onPress={handleShapeSourcePress}
>
  <Mapbox.CircleLayer
    id="cluster-circles"
    filter={[
      "all",
      ["has", "point_count"],
      ["<", ["zoom"], CLUSTER_SWITCH_ZOOM],
    ]}
    style={{
      circleColor: "#101623",
      circleOpacity: 0.96,
      circleStrokeWidth: 2,
      circleStrokeColor: COLORS.accent,
      circleRadius: ["step", ["get", "point_count"], 22, 8, 26, 20, 30, 40, 36],
    }}
  />

  <Mapbox.SymbolLayer
    id="cluster-count"
    filter={[
      "all",
      ["has", "point_count"],
      ["<", ["zoom"], CLUSTER_SWITCH_ZOOM],
    ]}
    style={{
      textField: ["get", "point_count_abbreviated"],
      textSize: 13,
      textColor: "#FFFFFF",
      textIgnorePlacement: true,
      textAllowOverlap: true,
    }}
  />
</Mapbox.ShapeSource>

{showCustomMarkers &&
  sessions
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s, index) => ({ session: s, originalIndex: index }))
    .sort((a, b) => {
      const aSelected = a.session.sessionId === selectedSessionId;
      const bSelected = b.session.sessionId === selectedSessionId;

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    })
    .map(({ session: s, originalIndex }) => {
      const isSelected = selectedSessionId === s.sessionId;

      const markerLng =
        s.lng + ((originalIndex % 3) - 1) * 0.00008;

      const markerLat =
        s.lat + (Math.floor(originalIndex / 3) % 3 - 1) * 0.00008;

      return (
        <Mapbox.MarkerView
key={`${s.sessionId}-${markerRenderNonce}`}
          coordinate={[markerLng, markerLat]}
          allowOverlap
          anchor={{ x: 0.5, y: 1 }}
        >
          <TouchableOpacity
  activeOpacity={0.85}
  onPress={() => {
              isManualSearchRef.current = true;

              setSelectedSessionId(s.sessionId);

              cameraRef.current?.setCamera({
                centerCoordinate: [s.lng, s.lat],
                zoomLevel: Math.max(currentZoomRef.current, 13.5),
                animationDuration: 250,
              });

              openSessionSheet(s.sessionId);

              setTimeout(() => {
                isManualSearchRef.current = false;
              }, 500);
            }}
            style={[
              styles.markerPressable,
              isSelected && styles.markerPressableSelected,
            ]}
          >
            <TeacherMarker
              avatarUrl={s.teacherAvatarUrl}
              category={normalizeCategory(s.sessionCategory)}
              selected={isSelected}
            />
          </TouchableOpacity>
        </Mapbox.MarkerView>
      );
    })}
        </Mapbox.MapView>


{!isInitialLocationResolved ? (
            <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.loadingText}>Getting your location…</Text>
          </View>
        ) : null}

        <View style={styles.topMapOverlay}>
          <View style={styles.topActionsRow}>
            <View style={styles.topColumn}>
              <Pressable
                onPress={() => setShowCategoryMenu((prev) => !prev)}
                style={styles.filterButton}
              >
                <Ionicons name="options-outline" size={18} color={COLORS.text} />
                <Text style={styles.filterButtonText}>{selectedCategoryLabel}</Text>
                <Ionicons
                  name={showCategoryMenu ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={COLORS.text}
                />
              </Pressable>

{showCategoryMenu ? (
  <Animated.View
    style={[
      styles.categoryMenuAnimated,
      {
        opacity: categoryMenuAnim,
        transform: [
          {
            translateY: categoryMenuAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      },
    ]}
  >
    <View style={styles.categoryMenu}>
      {categoryMenuItems.map((item, index) => {
        const selected = selectedCategory === item.key;
        const isLast = index === categoryMenuItems.length - 1;

        return (
          <Pressable
            key={item.key}
            onPress={() => {
              setSelectedCategory(item.key);
              setShowCategoryMenu(false);
            }}
            style={[
              styles.categoryMenuItem,
              isLast && styles.categoryMenuItemLast,
            ]}
          >
            <View style={styles.categoryMenuItemLeft}>
              <CategoryMenuIcon category={item.markerCategory} />
              <Text
                style={[
                  styles.categoryMenuItemText,
                  selected && styles.categoryMenuItemTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </View>

            {selected ? (
              <Ionicons name="checkmark" size={18} color={COLORS.accent} />
            ) : (
              <View style={styles.categoryMenuSpacer} />
            )}
          </Pressable>
        );
      })}
    </View>
  </Animated.View>
) : null}
              <View style={styles.resultsPill}>
                <Ionicons
                  name={visibleSessionCount > 0 ? "sparkles-outline" : "search-outline"}
                  size={14}
                  color={COLORS.text}
                />
                <Text style={styles.resultsPillText}>{foundCountLabel}</Text>
              </View>
            </View>

            <View style={styles.topColumnRight}>
              <Pressable onPress={handleOpenRequestClass} style={styles.requestButton}>
                <Ionicons name="trending-up-outline" size={16} color={COLORS.text} />
                <Text style={styles.requestButtonText}>Request class in this area</Text>
              </Pressable>

              {shouldShowNoSessionsBanner ? (
                <Animated.View
                  style={[
                    styles.topRightStatus,
                    {
                      opacity: emptyBannerOpacity,
                      transform: [{ translateY: emptyBannerTranslateY }],
                    },
                  ]}
                >
                  <Ionicons name="location-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.topRightStatusText}>No sessions within 20 km</Text>

                  <Pressable onPress={handleCloseNearbySuggestions}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
          </View>

          {showSearchThisArea ? (
            <Animated.View
              pointerEvents="auto"
              style={[
                styles.searchTopWrap,
                {
                  opacity: searchPillAnim,
                  transform: [
                    {
                      translateY: searchPillAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0],
                      }),
                    },
                    {
                      scale: searchPillAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                onPress={handleSearchThisArea}
                disabled={isMapLoading}
                style={[
                  styles.searchTopButton,
                  isMapLoading && styles.searchTopButtonDisabled,
                ]}
              >
                <Ionicons name="search" size={16} color="#FFFFFF" />
                <Text style={styles.searchTopButtonText}>
                  {isMapLoading ? "Searching..." : "Search this area"}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
          {shouldShowNearbyCompactList ? (
  <View style={styles.nearbySuggestionsCompact}>
    <Text style={styles.nearbySuggestionsTitle}>
      Nearby sessions within 20 km
    </Text>

    {nearbySuggestions.map((item) => (
      <Pressable
        key={item.session_id}
        onPress={() => handleFocusNearbySession(item)}
        style={styles.nearbyCompactCard}
      >
        <Text style={styles.nearbyCompactTitle}>{item.title}</Text>
        <Text style={styles.nearbyCompactMeta}>
          €{item.price} · {formatDistance(item.distance_meters)}
        </Text>
      </Pressable>
    ))}
  </View>
) : null}
        </View>



        {isMapLoading ? (
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingBadgeText}>Loading…</Text>
          </View>
        ) : null}

        {userLocation ? (
          <View style={[styles.recenterWrap, { bottom: 88 + insets.bottom }]}>
            <Pressable onPress={handleRecenterToUser} style={styles.recenterButton}>
              <CurrentLocationIcon />
            </Pressable>
          </View>
        ) : null}

        <SessionBottomSheet
          ref={sessionSheetRef}
          sessionId={sheetSessionId}
          visible={!!sheetSessionId}
          onClose={() => {
            setSheetSessionId(null);
          }}
        />
      </View>

<Footer
  unreadNotificationsCount={unreadNotificationsCount}
  upcomingBookingsCount={upcomingBookingsCount}
/>

{showMapExplainCard ? (
<Modal transparent visible={showMapExplainCard} animationType="fade">
      <View style={styles.explainModalBackdrop}>
      <View style={styles.explainModalCard}>
        <ExplainCard
          title="Explore classes near you"
          body={
            <View style={{ gap: 14 }}>
              <View style={styles.explainRow}>
                <View style={styles.explainIconCircle}>
                  <Ionicons name="map-outline" size={22} color="#3F6AE0" />
                </View>

                <Text style={styles.explainText}>
                  Use the map to find{" "}
                  <Text style={styles.explainStrong}>nearby classes</Text>{" "}
                  hosted by local teachers.
                </Text>
              </View>

              <View style={styles.explainDivider} />

              <View style={styles.explainRow}>
                <View style={styles.explainIconCircle}>
                  <Ionicons name="search-outline" size={22} color="#3F6AE0" />
                </View>

                <Text style={styles.explainText}>
                  Move around the map, then tap{" "}
                  <Text style={styles.explainStrong}>Search this area</Text>{" "}
                  to refresh results. Choose a category to filter results.
                </Text>
              </View>

              <View style={styles.explainDivider} />

              <View style={styles.explainRow}>
                <View style={styles.explainIconCircle}>
                  <Ionicons name="trending-up-outline" size={22} color="#3F6AE0" />
                </View>

                <Text style={styles.explainText}>
                  If nothing is nearby, use{" "}
                  <Text style={styles.explainStrong}>Request class in this area</Text>{" "}
                  so teachers can see local demand... or become a teacher yourself!
                </Text>
              </View>

              <View style={styles.explainDivider} />

<View style={styles.explainRow}>
  <View style={styles.explainIconCircle}>
    <Ionicons name="person-outline" size={22} color="#3F6AE0" />
  </View>

  <Text style={styles.explainText}>
    Don&apos;t forget — you can also book{" "}
    <Text style={styles.explainStrong}>1:1 sessions</Text>{" "}
    directly through a teacher&apos;s profile.
  </Text>
</View>
            </View>
          }
          dismissText="Got it"
          onDismiss={handleDismissMapExplainCard}
      />
      </View>
    </View>
  </Modal>
) : null}
      {/* <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom,
            height: NAV_HEIGHT + insets.bottom,
          },
        ]}
      >
        <Pressable
          onPress={() => safeReplace("/(learner)/notifications")}
          style={styles.footerItem}
        >
          <View style={styles.footerItemInner}>
            <View style={styles.footerIconWrap}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.footerLabel}>Notifications</Text>
          </View>
        </Pressable>

        <View style={styles.footerDivider} />

        <Pressable onPress={handleOpenTeach} style={styles.footerItem}>
          <View style={styles.footerItemInner}>
            <Ionicons name="school-outline" size={24} color="#ffffff" />
            <Text style={styles.footerLabel}>Teach</Text>
          </View>
        </Pressable>

        <View style={styles.footerDivider} />

        <Pressable
          onPress={() => safeReplace("/(learner)/bookings")}
          style={styles.footerItem}
        >
          <View style={styles.footerItemInner}>
            <View style={styles.footerIconWrap}>
              <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
              {upcomingBookingsCount > 0 ? (
                <View style={styles.footerMiniBadge}>
                  <Text style={styles.footerMiniBadgeText}>
                    {upcomingBookingsCount > 99 ? "99+" : upcomingBookingsCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.footerLabel}>Bookings</Text>
          </View>
        </Pressable>
      </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  mapFrame: {
    flex: 1,
    borderLeftWidth: 1.2,
    borderRightWidth: 1.2,
    borderColor: COLORS.borderStrong,
    position: "relative",
    overflow: "hidden",
    backgroundColor: COLORS.bg,
  },
  map: {
    flex: 1,
  },

  topMapOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
    elevation: 20,
  },
  topActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  filterButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  filterButtonText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 14,
  },
  requestButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  requestButtonText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 14,
  },

  resultsPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  resultsPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",

  },

  categoryMenuAnimated: {
    marginBottom: 10,
  },
  categoryMenu: {
    backgroundColor: "rgba(10, 14, 24, 0.98)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  categoryMenuItem: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  categoryMenuItemLast: {
    borderBottomWidth: 0,
  },
  categoryMenuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryMenuIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryMenuItemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  categoryMenuItemTextSelected: {
    color: COLORS.accent,
  },
  categoryMenuSpacer: {
    width: 18,
  },

  searchTopWrap: {
    alignItems: "center",
    marginBottom: 10,
  },

  searchTopButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: COLORS.accentStrong,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  searchTopButtonDisabled: {
    opacity: 0.7,
  },
  searchTopButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  explainWrap: {
    marginTop: 8,
  },

  infoPanel: {
    marginTop: 8,
    backgroundColor: COLORS.panelBgSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 14,
    borderRadius: 16,
  },
  infoPanelTitle: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 6,
  },
  infoPanelBody: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },


  emptyFloatingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  nearbySuggestionsCompact: {
    marginTop: 8,
    gap: 6,
  },
  nearbySuggestionsTitle: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    paddingLeft: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nearbyCompactCard: {
    backgroundColor: "rgba(12,16,28,0.9)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nearbyCompactTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  nearbyCompactMeta: {
    color: COLORS.textSoft,
    fontSize: 12,
    marginTop: 2,
  },

  loadingBadge: {
    position: "absolute",
    top: 14,
    right: 10,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  loadingBadgeText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  recenterWrap: {
    position: "absolute",
    right: 14,
    zIndex: 24,
    elevation: 24,
  },
  recenterButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(8,16,24,0.96)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },


markerPressable: {
  width: 74,
  height: 92,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  markerPressableSelected: {
    transform: [{ translateY: -14 }, { scale: 1.12 }],
  },

  customMarkerWrap: {
    width: 74,
    height: 92,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  customMarkerWrapSelected: {
    transform: [{ translateY: -16 }, { scale: 1.18 }],
  },
  customMarkerAvatarOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  customMarkerAvatarOuterSelected: {
    borderColor: "#A9C7FF",
    borderWidth: 4,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 14,
  },
  customMarkerAvatarInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: "#172132",
  },
  customMarkerAvatarImage: {
    width: "100%",
    height: "100%",
  },
  customMarkerAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  customMarkerBadge: {
    position: "absolute",
    bottom: 16,
    left: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
mapLoadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: COLORS.bg,
  zIndex: 1,
  elevation: 1,
},
  customMarkerPointer: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: COLORS.surface,
  },

  topColumn: {
    flex: 1,
    alignItems: "flex-start",
    gap: 8,
  },

  
  divider: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  topRightStatus: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  topRightStatusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  topColumnRight: {
    flex: 1.25,
    alignItems: "flex-end",
    gap: 8,
  },

  explainModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  explainModalCard: {
    width: "100%",
  },

  explainRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  explainIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(111,146,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },

  explainText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  explainStrong: {
    color: "#3F6AE0",
    fontWeight: "900",
  },

  explainDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  loadingText: {
    color: COLORS.textSoft,
    fontSize: 14,
    marginTop: 10,
  },
});