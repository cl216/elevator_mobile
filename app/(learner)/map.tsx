import * as Location from "expo-location";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useMapViewStore } from "../../src/store/mapView.store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Mapbox from "@rnmapbox/maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { API_BASE_URL } from "../../src/config/api";
import { api } from "../../src/api/client";
import { authStore } from "../../src/store/auth.store";
import {
  getApprovedCategories,
  type ApprovedCategory,
} from "../../src/api/categories";
import { getMyNotifications } from "../../src/api/notifications";
import { ExplainCard } from "../../src/components/ui/ExplainCard";
import { SessionBottomSheet } from "../../src/components/session/sessionBottomSheet";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../src/utils/explainCard";

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

function ElevatorLogoMini() {
  return (
    <View style={styles.logoMiniWrap}>
      <View style={styles.logoMiniBox}>
        <Text style={styles.logoMiniText}>▵</Text>
        <Text style={styles.logoMiniText}>▿</Text>
      </View>
    </View>
  );
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
}: {
  avatarUrl?: string;
  category?: MarkerCategory;
  selected?: boolean;
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
            <Image source={{ uri: avatarUrl }} style={styles.customMarkerAvatarImage} />
          ) : (
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

  const pathname = usePathname();
  const isProfile = pathname === "/(learner)/profile";

  const savedMapCenter = useMapViewStore((s) => s.center);
  const savedMapZoom = useMapViewStore((s) => s.zoom);
  const hasHydratedView = useMapViewStore((s) => s.hasHydratedView);
  const setMapView = useMapViewStore((s) => s.setMapView);

  const hasFocusSessionParam =
    typeof params.focusSessionId === "string" && !!params.focusSessionId;

  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);

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
  const isFetchingMapRef = useRef(false);

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
  const [locError, setLocError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const [visibleBBox, setVisibleBBox] = useState<BBox | null>(null);

  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [pendingBBox, setPendingBBox] = useState<BBox | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const showClusterSource = zoomLevel < CLUSTER_SWITCH_ZOOM;
  const showCustomMarkers = zoomLevel >= CLUSTER_SWITCH_ZOOM;

  const sessionFeatureCollection = useMemo(
    () => sessionsToFeatureCollection(sessions),
    [sessions],
  );

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

      const upcomingCount = rows.filter((booking) => {
        const status = booking.status ?? "";
        const startTime =
          booking.session_start_time ??
          booking.start_time ??
          booking.session?.start_time;

        if (!startTime) return false;

        const isUpcoming = new Date(startTime).getTime() > Date.now();
        const isActiveStatus =
          status === "PENDING" || status === "CONFIRMED" || status === "";

        return isUpcoming && isActiveStatus;
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

  const handleOpenTeach = useCallback(() => {
    if (hasTeacherProfile) {
      router.push("/(teacher)/dashboard");
      return;
    }
    router.push("/(learner)/profile");
  }, [hasTeacherProfile]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotificationsCount();
      loadUpcomingBookingsCount();
    }, [loadUnreadNotificationsCount, loadUpcomingBookingsCount]),
  );

  useEffect(() => {
    (async () => {
      const seen = await hasSeenExplainCard("learner-map-intro");
      setShowMapExplainCard(!seen);
    })();
  }, []);

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
          setNearbySuggestions([]);
          return;
        }

        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];

        const centerLat = (bbox.north + bbox.south) / 2;
        const centerLng = (bbox.east + bbox.west) / 2;

        const sorted = rows
          .map((row: any) => {
            const rowLat = Number(row.lat);
            const rowLng = Number(row.lng);

            const distance_meters = Math.sqrt(
              Math.pow((rowLat - centerLat) * 111_000, 2) +
                Math.pow(
                  (rowLng - centerLng) *
                    111_000 *
                    Math.cos((centerLat * Math.PI) / 180),
                  2,
                ),
            );

            return {
              session_id: String(row.session_id),
              lat: rowLat,
              lng: rowLng,
              title: row.title ?? "Session",
              category: row.category ?? "other",
              price: Number(row.price ?? 0),
              start_time: row.start_time,
              teacher_name: row.teacher_name ?? "Teacher",
              teacher_avatar_url: row.teacher_avatar_url ?? null,
              distance_meters: Math.round(distance_meters),
            };
          })
          .filter((row) => row.distance_meters <= 20_000)
          .sort((a, b) => a.distance_meters - b.distance_meters)
          .slice(0, 3);

        setNearbySuggestions(sorted);
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
        if (!res.ok) return [];

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

  const fetchForCurrentMapNow = useCallback(async () => {
    try {
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

  const handleShapeSourcePress = useCallback(
    async (event: any) => {
      const feature = event?.features?.[0];
      if (!feature) return;

      const props = feature.properties ?? {};
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates)) return;

      if (props.cluster) {
        if (shapeSourceRef.current) {
          try {
            const expansionZoom =
              await shapeSourceRef.current.getClusterExpansionZoom(feature);

            setSelectedSessionId(null);

            cameraRef.current?.setCamera({
              centerCoordinate: coordinates as [number, number],
              zoomLevel: expansionZoom,
              animationDuration: 250,
            });
          } catch (e) {
            console.log("cluster expansion failed", e);
          }
        }
        return;
      }

      if (props.sessionId) {
        const sessionId = String(props.sessionId);
        setSelectedSessionId(sessionId);
        openSessionSheet(sessionId);
      }

      cameraRef.current?.setCamera({
        centerCoordinate: coordinates as [number, number],
        zoomLevel: Math.max(
          CLUSTER_SWITCH_ZOOM + 0.5,
          currentZoomRef.current + 1,
        ),
        animationDuration: 250,
      });
    },
    [openSessionSheet],
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;

        if (status !== "granted") {
          setLocError("Location permission denied.");
          setIsInitialLocationResolved(true);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!alive) return;

        const center: [number, number] = [
          current.coords.longitude,
          current.coords.latitude,
        ];

        setUserLocation(center);
        setLocError(null);
        setIsInitialLocationResolved(true);

        if (hasFocusSessionParam) return;

        if (hasHydratedView && savedMapCenter && typeof savedMapZoom === "number") {
          cameraRef.current?.setCamera({
            centerCoordinate: savedMapCenter,
            zoomLevel: savedMapZoom,
            animationDuration: 0,
          });
        } else {
          cameraRef.current?.setCamera({
            centerCoordinate: center,
            zoomLevel: 13.5,
            animationDuration: 700,
          });
        }

        if (initialUserFetchTimerRef.current) {
          clearTimeout(initialUserFetchTimerRef.current);
        }

        initialUserFetchTimerRef.current = setTimeout(() => {
          fetchForCurrentMapNow();
        }, 900);
      } catch (e) {
        console.log("initial location error", e);
        if (!alive) return;
        setLocError("Could not get your current location.");
        setIsInitialLocationResolved(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [hasFocusSessionParam, hasHydratedView, savedMapCenter, savedMapZoom, fetchForCurrentMapNow]);

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
    const interval = setInterval(() => {
      const active = activeSearchRef.current;
      if (!active) return;
      if (showSearchThisArea) return;
      if (isMapLoading) return;
      if (isFetchingMapRef.current) return;

      fetchSessionsForBBox(active.bbox, active.category, { silent: true });
    }, SILENT_REFRESH_MS);

    return () => clearInterval(interval);
  }, [fetchSessionsForBBox, showSearchThisArea, isMapLoading]);

  useEffect(() => {
    return () => {
      if (focusFetchTimerRef.current) clearTimeout(focusFetchTimerRef.current);
      if (initialUserFetchTimerRef.current) clearTimeout(initialUserFetchTimerRef.current);
    };
  }, []);

  const handleDismissMapExplainCard = useCallback(async () => {
    await markExplainCardSeen("learner-map-intro");
    setShowMapExplainCard(false);
  }, []);

  const handleSearchThisArea = useCallback(async () => {
    if (!pendingBBox || !pendingKey) return;
    if (isMapLoading || isFetchingMapRef.current) return;

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

    router.push({
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

  const handleRecenterToUser = useCallback(() => {
    if (!userLocation) return;

    setSelectedSessionId(null);
    closeSessionSheet();

    cameraRef.current?.setCamera({
      centerCoordinate: userLocation,
      zoomLevel: Math.max(currentZoomRef.current, 13),
      animationDuration: 500,
    });
  }, [userLocation, closeSessionSheet]);

  function formatDistance(meters: number) {
    if (meters < 1000) return `${meters} m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: NAV_HEIGHT + insets.top,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => {}} style={styles.headerSideButton}>
            <Ionicons name="home-outline" size={26} color="#FFFFFF" />
          </Pressable>

          <View pointerEvents="none" style={styles.headerCenter}>
            <ElevatorLogoMini />
            <Text style={styles.headerBrandText}>Elevator</Text>
          </View>

          <Pressable
            onPress={() => {
              if (isProfile) return;
              router.push("/(learner)/profile");
            }}
            style={[
              styles.headerSideButton,
              isProfile && { opacity: 0.4 },
            ]}
          >
            <Ionicons
              name={isProfile ? "menu" : "menu-outline"}
              size={26}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.mapFrame}>
        <Mapbox.MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={styles.map}
          styleURL={MAP_STYLE_URL}
          onDidFinishLoadingMap={() => {
            if (hasHandledInitialMapLoadRef.current) return;

            if (!hasFocusSessionParam && isInitialLocationResolved && userLocation) {
              hasHandledInitialMapLoadRef.current = true;
              fetchForCurrentMapNow();
            }
          }}
          onMapIdle={() => {
            prepareSearchThisArea();
            updateVisibleBBox();
          }}
          onPress={() => {
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
              zoomLevel: INITIAL_ZOOM,
              pitch: 0,
              heading: 0,
            }}
          />

          <Mapbox.UserLocation
            visible
            androidRenderMode="gps"
            showsUserHeadingIndicator={false}
            onUpdate={() => {}}
          />

          {showClusterSource ? (
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
                filter={["has", "point_count"]}
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
                filter={["has", "point_count"]}
                style={{
                  textField: ["get", "point_count_abbreviated"],
                  textSize: 13,
                  textColor: "#FFFFFF",
                  textIgnorePlacement: true,
                  textAllowOverlap: true,
                }}
              />
              <Mapbox.CircleLayer
                id="singleton-circles"
                filter={["!", ["has", "point_count"]]}
                style={{
                  circleColor: "#101623",
                  circleOpacity: 0.96,
                  circleStrokeWidth: 2,
                  circleStrokeColor: COLORS.accent,
                  circleRadius: 18,
                }}
              />
              <Mapbox.SymbolLayer
                id="singleton-count"
                filter={["!", ["has", "point_count"]]}
                style={{
                  textField: "1",
                  textSize: 12,
                  textColor: "#FFFFFF",
                  textIgnorePlacement: true,
                  textAllowOverlap: true,
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {showCustomMarkers &&
            sessions
              .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
              .map((s) => {
                const isSelected = selectedSessionId === s.sessionId;

                return (
                  <Mapbox.MarkerView
                    key={s.sessionId}
                    coordinate={[s.lng, s.lat]}
                    allowOverlap
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <View style={styles.markerWrap} collapsable={false}>
                      <Pressable
                        onPress={() => {
                          setSelectedSessionId(s.sessionId);

                          cameraRef.current?.setCamera({
                            centerCoordinate: [s.lng, s.lat],
                            zoomLevel: Math.max(
                              currentZoomRef.current,
                              CLUSTER_SWITCH_ZOOM + 0.5,
                            ),
                            animationDuration: 250,
                          });

                          openSessionSheet(s.sessionId);
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
                      </Pressable>
                    </View>
                  </Mapbox.MarkerView>
                );
              })}
        </Mapbox.MapView>

        <View style={styles.topMapOverlay}>
          <View style={styles.topActionsRow}>
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

            <Pressable onPress={handleOpenRequestClass} style={styles.requestButton}>
              <Text style={styles.requestButtonText}>Request class in this area</Text>
            </Pressable>
          </View>

          <View style={styles.resultsPillWrap}>
            <View style={styles.resultsPill}>
              <Ionicons
                name={visibleSessionCount > 0 ? "sparkles-outline" : "search-outline"}
                size={14}
                color={COLORS.text}
              />
              <Text style={styles.resultsPillText}>{foundCountLabel}</Text>
            </View>
          </View>

          <Animated.View
            pointerEvents={showCategoryMenu ? "auto" : "none"}
            style={[
              styles.categoryMenuAnimated,
              {
                opacity: categoryMenuAnim,
                transform: [
                  {
                    translateY: categoryMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                  {
                    scaleY: categoryMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {showCategoryMenu ? (
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
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={COLORS.accent}
                        />
                      ) : (
                        <View style={styles.categoryMenuSpacer} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Animated.View>

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

          {locError ? (
            <View style={styles.infoPanel}>
              <Text style={styles.infoPanelTitle}>Location</Text>
              <Text style={styles.infoPanelBody}>{locError}</Text>
            </View>
          ) : null}

          {showMapExplainCard ? (
            <View style={styles.explainWrap}>
              <ExplainCard
                title="How discovery works"
                body="Move the map, then tap Search this area to load classes there. If nothing fits, you can request a class in that area."
                ctaText="Request class in this area"
                onPressCta={handleOpenRequestClass}
                dismissText="Got it"
                onDismiss={handleDismissMapExplainCard}
              />
            </View>
          ) : null}

          {shouldShowNoSessionsBanner ? (
            <Animated.View
              style={[
                styles.emptyFloating,
                {
                  opacity: emptyBannerOpacity,
                  transform: [{ translateY: emptyBannerTranslateY }],
                },
              ]}
            >
              <Text style={styles.emptyFloatingText}>
                No sessions within 20 km
              </Text>

              <Pressable onPress={handleCloseNearbySuggestions}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          ) : null}

          {shouldShowNearbyCompactList ? (
            <View style={styles.nearbySuggestionsCompact}>
              <Text style={styles.nearbySuggestionsTitle}>Closest nearby</Text>
              {nearbySuggestions.map((item) => (
                <Pressable
                  key={item.session_id}
                  onPress={() => handleFocusNearbySession(item)}
                  style={styles.nearbyCompactCard}
                >
                  <Text style={styles.nearbyCompactTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.nearbyCompactMeta} numberOfLines={1}>
                    {item.teacher_name} · {formatDistance(item.distance_meters)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {!isInitialLocationResolved ? (
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingBadgeText}>Getting your location…</Text>
          </View>
        ) : isMapLoading ? (
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingBadgeText}>Loading…</Text>
          </View>
        ) : null}

        {userLocation ? (
          <View
            style={[
              styles.recenterWrap,
              { bottom: 88 + insets.bottom },
            ]}
          >
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

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom,
            height: NAV_HEIGHT + insets.bottom,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/(learner)/notifications")}
          style={styles.footerItem}
        >
          <View style={styles.footerItemInner}>
            <View style={styles.footerIconBadgeWrap}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        <View style={styles.footerDivider} />

        <Pressable onPress={handleOpenTeach} style={styles.footerItem}>
          <View style={styles.footerItemInner}>
            <Ionicons name="school-outline" size={24} color="#FFFFFF" />
            <Text style={styles.footerLabel}>Teach</Text>
          </View>
        </Pressable>

        <View style={styles.footerDivider} />

        <Pressable
          onPress={() => router.push("/(learner)/bookings")}
          style={styles.footerItem}
        >
          <View style={styles.footerItemInner}>
            <View style={styles.footerScheduleWrap}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    borderBottomWidth: 1.2,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.bg,
    paddingTop: 0,
    paddingHorizontal: 10,
  },
  headerRow: {
    height: NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  headerCenter: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerBrandText: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    fontStyle: "italic",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 22,
  },
  headerSideButton: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },

  logoMiniWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoMiniBox: {
    width: 22,
    height: 28,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: COLORS.surface,
  },
  logoMiniText: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "900",
    includeFontPadding: false,
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
    alignItems: "center",
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
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.panelBg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  requestButtonText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 14,
  },

  resultsPillWrap: {
    alignItems: "flex-start",
    marginBottom: 10,
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

  emptyFloating: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 50,
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

  markerWrap: {
    width: 82,
    height: 100,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  markerPressable: {
    width: 82,
    height: 100,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  markerPressableSelected: {
    transform: [{ translateY: -6 }, { scale: 1.03 }],
  },

  customMarkerWrap: {
    width: 74,
    height: 92,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  customMarkerWrapSelected: {
    transform: [{ translateY: -4 }],
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
    shadowOpacity: 0.45,
    shadowRadius: 14,
    transform: [{ scale: 1.04 }],
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

  footer: {
    borderTopWidth: 1.2,
    borderTopColor: COLORS.borderStrong,
    backgroundColor: COLORS.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 0,
    paddingHorizontal: 8,
  },
  footerItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  footerItemInner: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  footerLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    includeFontPadding: false,
  },
  footerIconBadgeWrap: {
    position: "relative",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  footerScheduleWrap: {
    position: "relative",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  footerMiniBadge: {
    position: "absolute",
    top: -6,
    right: -14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: COLORS.badgeRed,
    alignItems: "center",
    justifyContent: "center",
  },
  footerMiniBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -16,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: COLORS.badgeRed,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  divider: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});