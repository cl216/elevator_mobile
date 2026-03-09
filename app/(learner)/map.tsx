import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Mapbox, { StyleImport } from "@rnmapbox/maps";

import { API_BASE_URL } from "../../src/config/api";
import { authStore } from "../../src/store/auth.store";
import {
  TeacherMarker,
  Category as MarkerCategory,
} from "../../src/components/map/TeacherMarker";

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

const DUBLIN_CENTER: [number, number] = [-6.2603, 53.3498];
const INITIAL_ZOOM = 14;
const CLUSTER_RADIUS = 90;
const CLUSTER_SWITCH_ZOOM = 11.5;

const MAP_STYLE_URL = "mapbox://styles/mapbox/standard";

const CATEGORY_OPTIONS = [
  "all",
  "art",
  "music",
  "cooking",
  "language",
  "crafts",
] as const;

type CategoryFilter = (typeof CATEGORY_OPTIONS)[number];

function normalizeCategory(category?: string): MarkerCategory {
  if (category === "music" || category === "art") return category;
  return "other";
}

type BBox = { west: number; south: number; east: number; north: number };

function boundsToBBox(bounds: any): BBox | null {
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

function padBBox(b: BBox, factor = 0.75): BBox {
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
  sessions: MapSessionPreview[]
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

export default function LearnerMap() {
  const currentZoomRef = useRef<number>(INITIAL_ZOOM);
  const requestSeqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const mapRef = useRef<Mapbox.MapView | null>(null);
  const cameraRef = useRef<Mapbox.Camera | null>(null);
  const shapeSourceRef = useRef<Mapbox.ShapeSource | null>(null);

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("all");
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [sessions, setSessions] = useState<MapSessionPreview[]>([]);
  const [locError, setLocError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);

  const showClusterSource = zoomLevel < CLUSTER_SWITCH_ZOOM;
  const showCustomMarkers = zoomLevel >= CLUSTER_SWITCH_ZOOM;

  const sessionFeatureCollection = useMemo(
    () => sessionsToFeatureCollection(sessions),
    [sessions]
  );

  const fetchForCurrentMap = useCallback(async () => {
    try {
      if (currentZoomRef.current < 10) {
        return;
      }

      const bounds = await mapRef.current?.getVisibleBounds();
      const bbox = boundsToBBox(bounds);
      if (!bbox) return;

      const paddedBBox = padBBox(bbox, 0.75);
      const key = bboxKey(paddedBBox, selectedCategory);

      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      const myReq = ++requestSeqRef.current;
      setIsMapLoading(true);

      const qs = new URLSearchParams({
        north: String(paddedBBox.north),
        south: String(paddedBBox.south),
        east: String(paddedBBox.east),
        west: String(paddedBBox.west),
      });

      if (selectedCategory !== "all") {
        qs.append("category", selectedCategory);
      }

      const res = await fetch(`${API_BASE_URL}/sessions/map?${qs.toString()}`);

      if (!res.ok) {
        console.log("map fetch failed", res.status);
        return;
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];

      if (myReq !== requestSeqRef.current) return;

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
    } catch (e) {
      console.log("fetchForCurrentMap error", e);
    } finally {
      setIsMapLoading(false);
    }
  }, [selectedCategory]);

  const onRegionDidChangeDebounced = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchForCurrentMap();
    }, 350);
  }, [fetchForCurrentMap]);

  const handleShapeSourcePress = useCallback(async (event: any) => {
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

    cameraRef.current?.setCamera({
      centerCoordinate: coordinates as [number, number],
      zoomLevel: Math.max(
        CLUSTER_SWITCH_ZOOM + 0.5,
        currentZoomRef.current + 1
      ),
      animationDuration: 250,
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocError("Location permission denied. Using Dublin fallback.");
        cameraRef.current?.setCamera({
          centerCoordinate: DUBLIN_CENTER,
          zoomLevel: INITIAL_ZOOM,
          pitch: 35,
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

  useEffect(() => {
    lastKeyRef.current = null;
    fetchForCurrentMap();
  }, [selectedCategory, fetchForCurrentMap]);

  const handleLogout = useCallback(async () => {
    await authStore.getState().logout();
    router.replace("/");
  }, []);

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
          onRegionDidChangeDebounced();
        }}
        onCameraChanged={(e) => {
          const z = e?.properties?.zoom;
          if (typeof z === "number") {
            currentZoomRef.current = z;
            setZoomLevel(z);
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
            pitch: 55,
            heading: -20,
          }}
        />

        <StyleImport
          id="basemap"
          existing
          config={{ theme: "faded", lightPreset: "day" } as any}
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
            {[
              <Mapbox.CircleLayer
                key="cluster-circles"
                id="cluster-circles"
                filter={["has", "point_count"]}
                style={{
                  circleColor: "#111111",
                  circleOpacity: 0.9,
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#ffffff",
                  circleRadius: [
                    "step",
                    ["get", "point_count"],
                    22,
                    8,
                    26,
                    20,
                    30,
                    40,
                    36,
                  ],
                }}
              />,
              <Mapbox.SymbolLayer
                key="cluster-count"
                id="cluster-count"
                filter={["has", "point_count"]}
                style={{
                  textField: ["get", "point_count_abbreviated"],
                  textSize: 13,
                  textColor: "#ffffff",
                  textIgnorePlacement: true,
                  textAllowOverlap: true,
                }}
              />,
              <Mapbox.CircleLayer
                key="singleton-circles"
                id="singleton-circles"
                filter={["!", ["has", "point_count"]]}
                style={{
                  circleColor: "#111111",
                  circleOpacity: 0.9,
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#ffffff",
                  circleRadius: 18,
                }}
              />,
              <Mapbox.SymbolLayer
                key="singleton-count"
                id="singleton-count"
                filter={["!", ["has", "point_count"]]}
                style={{
                  textField: "1",
                  textSize: 12,
                  textColor: "#ffffff",
                  textIgnorePlacement: true,
                  textAllowOverlap: true,
                }}
              />,
            ]}
          </Mapbox.ShapeSource>
        ) : null}

        {showCustomMarkers &&
          sessions
            .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
            .map((s) => (
              <Mapbox.MarkerView
                key={s.sessionId}
                coordinate={[s.lng, s.lat]}
                allowOverlap={true}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  collapsable={false}
                >
                  <Pressable
                    onPress={() => {
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
                      selected={false}
                      onReady={() => {}}
                    />
                  </Pressable>
                </View>
              </Mapbox.MarkerView>
            ))}
      </Mapbox.MapView>

      {isMapLoading ? (
        <View
          style={{
            position: "absolute",
            top: Platform.select({ ios: 165, android: 145 }),
            left: 16,
            backgroundColor: "white",
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Loading…</Text>
        </View>
      ) : null}

      <View
        style={{
          position: "absolute",
          top: Platform.select({ ios: 60, android: 40 }),
          left: 16,
          right: 16,
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
            marginBottom: 10,
          }}
        >
          <Text style={{ fontWeight: "700" }}>Browse classes near you</Text>
          {locError ? <Text style={{ marginTop: 4 }}>{locError}</Text> : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
          style={{ marginBottom: 10 }}
        >
          {CATEGORY_OPTIONS.map((category) => {
            const selected = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={{
                  backgroundColor: selected ? "black" : "white",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    color: selected ? "white" : "black",
                    fontWeight: "700",
                    textTransform: "capitalize",
                  }}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ alignItems: "flex-end" }}>
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
      </View>
    </View>
  );
}