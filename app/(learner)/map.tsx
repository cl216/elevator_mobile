import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import Mapbox, { StyleImport } from "@rnmapbox/maps";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";

import { API_BASE_URL } from "../../src/config/api";
import { authStore } from "../../src/store/auth.store";
import {
  TeacherMarker,
  Category as MarkerCategory,
} from "../../src/components/map/TeacherMarker";

// -------- Mapbox setup --------
// Put your pk token here for now (fastest).
// Later we can move to .env / EAS secrets.

//Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

// const requestSeqRef = useRef(0);
// const [isMapLoading, setIsMapLoading] = useState(false);

type MapSessionPreview = {
  sessionId: string;
  lat: number;
  lng: number;
  title: string;
  price: number;
  startTimeISO: string;
  teacherName: string;
  teacherAvatarUrl?: string;
  sessionCategory?: string; // backend will later control this
  thumbnailUrl?: string;
  attendeeCount?: number;
};

// type MapSessionPoint = {
//   sessionId: string;
//   lat: number;
//   lng: number;
// };

// Dublin fallback
const DUBLIN_CENTER: [number, number] = [-6.2603, 53.3498];
const INITIAL_ZOOM = 14;

// Mapbox dark style URL
const MAP_STYLE_URL = "mapbox://styles/mapbox/standard";

function normalizeCategory(category?: string): MarkerCategory {
  if (category === "music" || category === "art") return category;
  return "other";
}

type BBox = { west: number; south: number; east: number; north: number };

function boundsToBBox(bounds: any): BBox | null {
  // Mapbox getVisibleBounds() => [[lng, lat], [lng, lat]] (SW, NE)
  if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) return null;
  const sw = bounds[0];
  const ne = bounds[1];
  if (!sw || !ne) return null;

  return {
    west: sw[0],
    south: sw[1],
    east: ne[0],
    north: ne[1],
  };
}

function bboxKey(b: BBox) {
  // round to avoid refetching constantly while panning
  const r = (n: number) => n.toFixed(4);
  return `${r(b.west)}|${r(b.south)}|${r(b.east)}|${r(b.north)}`;
}

export default function LearnerMap() {
  const currentZoomRef = useRef<number>(INITIAL_ZOOM);

  const requestSeqRef = useRef(0);
  const [isMapLoading, setIsMapLoading] = useState(false);


  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const mapRef = useRef<Mapbox.MapView | null>(null);
  const cameraRef = useRef<Mapbox.Camera | null>(null);

  const [selected, setSelected] = useState<MapSessionPreview | null>(null);
  // const [points, setPoints] = useState<MapSessionPoint[]>([]);
  const [sessions, setSessions] = useState<MapSessionPreview[]>([]);

  const [locError, setLocError] = useState<string | null>(null);

  // Android emulator -> your PC
  //const API_BASE_URL = "http://10.0.2.2:3000";

  const fetchForCurrentMap = useCallback(async () => {
    try {
      if (currentZoomRef.current < 10) {
        return; // keep existing markers; just don't refetch
      }
      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (!bbox) return;

      const key = bboxKey(bbox);
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      const myReq = ++requestSeqRef.current; // ✅ sequence id for stale response protection
      setIsMapLoading(true);

      const qs = new URLSearchParams({
        north: String(bbox.north),
        south: String(bbox.south),
        east: String(bbox.east),
        west: String(bbox.west),
      });

      const res = await fetch(`${API_BASE_URL}/sessions/map?${qs.toString()}`);

      if (!res.ok) {
        console.log("map fetch failed", res.status);
        return;
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : []; // ✅ avoid .map on non-array

      // ✅ Ignore stale responses
      if (myReq !== requestSeqRef.current) return;

      const next: MapSessionPreview[] = rows
        .map((r: any) => ({
          sessionId: String(r.session_id),
          lat: Number(r.lat),
          lng: Number(r.lng),
          title: r.title ?? "Session",
          price: Number(r.price ?? 0),
          startTimeISO: r.start_time ? new Date(r.start_time).toISOString() : new Date().toISOString(),
          teacherName: r.teacher_name ?? "Teacher",
          teacherAvatarUrl: r.teacher_avatar_url ?? undefined,
          sessionCategory: r.category ?? undefined,
          thumbnailUrl: undefined,
          attendeeCount: 0,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)); // ✅ never allow NaN/undefined coords
      console.log("next sessions:", next);

      setSessions(next);

    } catch (e) {
      console.log("fetchForCurrentMap error", e);
    } finally {
      setIsMapLoading(false);
    }
  }, [API_BASE_URL]);


  const onRegionDidChangeDebounced = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchForCurrentMap();
    }, 350);
  }, [fetchForCurrentMap]);

  // Bottom sheet
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["25%", "55%"], []);

  // Mock data (replace with backend later)
  // const sessions = useMemo<MapSessionPreview[]>(
  //   () => [
  //     {
  //       sessionId: "s1",
  //       lat: 53.3498,
  //       lng: -6.2603,
  //       title: "Watercolour Basics",
  //       price: 25,
  //       startTimeISO: "2026-02-10T10:00:00Z",
  //       teacherName: "Aoife",
  //       teacherAvatarUrl: "https://picsum.photos/seed/aoife/128",
  //       sessionCategory: "art",
  //       thumbnailUrl: "https://picsum.photos/200/120",
  //       attendeeCount: 7,
  //     },
  //     {
  //       sessionId: "s2",
  //       lat: 53.342,
  //       lng: -6.286,
  //       title: "Guitar Fundamentals",
  //       price: 40,
  //       startTimeISO: "2026-02-11T18:30:00Z",
  //       teacherName: "Niamh",
  //       teacherAvatarUrl: "https://picsum.photos/seed/niamh/128",
  //       sessionCategory: "music",
  //       thumbnailUrl: "https://picsum.photos/201/120",
  //       attendeeCount: 3,
  //     },
  //     {
  //       sessionId: "s3",
  //       lat: 53.36,
  //       lng: -6.245,
  //       title: "Pottery Wheel Intro",
  //       price: 55,
  //       startTimeISO: "2026-02-12T12:00:00Z",
  //       teacherName: "Eoin",
  //       teacherAvatarUrl: "https://picsum.photos/seed/eoin/128",
  //       sessionCategory: "art",
  //       thumbnailUrl: "https://picsum.photos/202/120",
  //       attendeeCount: 1,
  //     },
  //   ],
  //   []
  // );



  // Location permission + camera centering (replaces animateToRegion)
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location permission denied. Using Dublin fallback.");
        cameraRef.current?.setCamera({
          centerCoordinate: DUBLIN_CENTER,
          zoomLevel: INITIAL_ZOOM,
          pitch: 55,
          heading: -20,
          animationDuration: 700,
        });
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const center: [number, number] = [
        current.coords.longitude,
        current.coords.latitude,
      ];

      cameraRef.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: 12.5,
        animationDuration: 700,
      });
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    await authStore.getState().logout();
    router.replace("/");
  }, []);

  const formatStart = useCallback((iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  }, []);

  const openPreview = useCallback((s: MapSessionPreview) => {
    setSelected(s);
    requestAnimationFrame(() => {
      sheetRef.current?.present();
    });
  }, []);


  const closeSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  // useEffect(() => {
  //   const t = setTimeout(() => {
  //     fetchForCurrentMap();
  //   }, 600);

  //   return () => clearTimeout(t);
  // }, [fetchForCurrentMap]);


  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={{ flex: 1 }}
        styleURL={MAP_STYLE_URL}
        onDidFinishLoadingMap={() => {
          fetchForCurrentMap();
        }}
        onMapIdle={() => {
          fetchForCurrentMap();
        }} onCameraChanged={(e) => {
          const z = e?.properties?.zoom;
          if (typeof z === "number") {
            currentZoomRef.current = z;
          }
        }}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        scaleBarEnabled={false}
        rotateEnabled
        pitchEnabled

      >
        <Mapbox.Camera
          ref={(r) => {
            cameraRef.current = r;
          }}
          defaultSettings={{
            centerCoordinate: DUBLIN_CENTER,
            zoomLevel: INITIAL_ZOOM,
            pitch: 55,     // 0 = flat, ~45–65 feels 3D
            heading: -20,  // rotate a bit (optional)
          }}
        />

        <StyleImport
          id="basemap"
          existing
          config={
            {
              theme: "faded",
              lightPreset: "day", // or "day" | "dawn" | "night"
            } as any
          }
        />
        {/* <Mapbox.VectorSource id="composite" url="mapbox://mapbox.mapbox-streets-v8">
          <Mapbox.FillExtrusionLayer
            id="3d-buildings"
            sourceLayerID="building"
            minZoomLevel={14}
            maxZoomLevel={100}
            style={{
              fillExtrusionHeight: ["get", "height"],
              fillExtrusionBase: ["get", "min_height"],
              fillExtrusionOpacity: 0.6,
            }}
          />
        </Mapbox.VectorSource> */}

        {sessions
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          .map((s) => (
            <Mapbox.MarkerView key={s.sessionId} coordinate={[s.lng, s.lat]}>
              <View
                style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}
                collapsable={false}
              >
                {/* <Pressable onPress={() => openPreview(s)}> */}
                <Pressable
                  onPress={() => {
                    console.log("Navigating to", s.sessionId);
                    router.push(`/(modal)/session/${s.sessionId}`);
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TeacherMarker
                    avatarUrl={s.teacherAvatarUrl}
                    category={normalizeCategory(s.sessionCategory)}
                    selected={selected?.sessionId === s.sessionId}
                    onReady={() => { }}
                  />
                </Pressable>
              </View>
            </Mapbox.MarkerView>
          ))}
      </Mapbox.MapView>


      {isMapLoading ? (
        <View style={{ position: "absolute", top: 110, left: 16, padding: 8, backgroundColor: "white", borderRadius: 10 }}>
          <Text style={{ fontWeight: "700" }}>Loading…</Text>
        </View>
      ) : null}
      {/* Top bar */}
      <View
        style={{
          position: "absolute",
          top: Platform.select({ ios: 60, android: 40 }),
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            flex: 1,
            marginRight: 10,
          }}
        >
          <Text style={{ fontWeight: "700" }}>Browse classes near you</Text>
          {locError ? <Text style={{ marginTop: 4 }}>{locError}</Text> : null}
        </View>

        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: "black",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Logout</Text>
        </Pressable>
      </View>


      {/* Bottom Sheet */}
      {/* <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={() => setSelected(null)}
        backgroundStyle={{ backgroundColor: "white", borderWidth: 1 }}
        handleIndicatorStyle={{ opacity: 0.4 }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {!selected ? (
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "800" }}>
                Tap a marker to preview a class
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {selected.thumbnailUrl ? (
                <Image
                  source={{ uri: selected.thumbnailUrl }}
                  style={{ width: "100%", height: 130 }}
                  resizeMode="cover"
                />
              ) : null}

              <View style={{ padding: 14, gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  {selected.title}
                </Text>

                <Text>
                  €{selected.price} · {selected.teacherName}
                </Text>

                <Text>{formatStart(selected.startTimeISO)}</Text>

                <Text style={{ marginTop: 6 }}>
                  👥 {selected.attendeeCount ?? 0} attending
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      // Later: booking flow (guest/login gate, profile photo gate)
                      closeSheet();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "black",
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>
                      Reserve
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      // Later: navigate to teacher profile / session details
                      closeSheet();
                    }}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>Details</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={closeSheet}
                  style={{ marginTop: 10, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "600" }}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal> */}
    </View>
  );
}
