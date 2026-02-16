import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";

import { authStore } from "../../src/store/auth.store";
import {
  TeacherMarker,
  Category as MarkerCategory,
} from "../../src/components/map/TeacherMarker";

// -------- Mapbox setup --------
// Put your pk token here for now (fastest).
// Later we can move to .env / EAS secrets.
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);


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



// Dublin fallback
const DUBLIN_CENTER: [number, number] = [-6.2603, 53.3498];
const INITIAL_ZOOM = 11.5;

// Mapbox dark style URL
const DARK_STYLE_URL = "mapbox://styles/mapbox/dark-v11";

function normalizeCategory(category?: string): MarkerCategory {
  if (category === "music" || category === "art") return category;
  return "other";
}

export default function LearnerMap() {
  const mapRef = useRef<Mapbox.MapView | null>(null);
  const cameraRef = useRef<Mapbox.Camera | null>(null);

  const [selected, setSelected] = useState<MapSessionPreview | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  // Bottom sheet
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["25%", "55%"], []);

  // Mock data (replace with backend later)
  const sessions = useMemo<MapSessionPreview[]>(
    () => [
      {
        sessionId: "s1",
        lat: 53.3498,
        lng: -6.2603,
        title: "Watercolour Basics",
        price: 25,
        startTimeISO: "2026-02-10T10:00:00Z",
        teacherName: "Aoife",
        teacherAvatarUrl: "https://picsum.photos/seed/aoife/128",
        sessionCategory: "art",
        thumbnailUrl: "https://picsum.photos/200/120",
        attendeeCount: 7,
      },
      {
        sessionId: "s2",
        lat: 53.342,
        lng: -6.286,
        title: "Guitar Fundamentals",
        price: 40,
        startTimeISO: "2026-02-11T18:30:00Z",
        teacherName: "Niamh",
        teacherAvatarUrl: "https://picsum.photos/seed/niamh/128",
        sessionCategory: "music",
        thumbnailUrl: "https://picsum.photos/201/120",
        attendeeCount: 3,
      },
      {
        sessionId: "s3",
        lat: 53.36,
        lng: -6.245,
        title: "Pottery Wheel Intro",
        price: 55,
        startTimeISO: "2026-02-12T12:00:00Z",
        teacherName: "Eoin",
        teacherAvatarUrl: "https://picsum.photos/seed/eoin/128",
        sessionCategory: "art",
        thumbnailUrl: "https://picsum.photos/202/120",
        attendeeCount: 1,
      },
    ],
    []
  );

  // Location permission + camera centering (replaces animateToRegion)
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location permission denied. Using Dublin fallback.");
        cameraRef.current?.setCamera({
          centerCoordinate: DUBLIN_CENTER,
          zoomLevel: INITIAL_ZOOM,
          animationDuration: 600,
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

  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={{ flex: 1 }}
        styleURL={DARK_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={(r) => {
            cameraRef.current = r;
          }}
          defaultSettings={{
            centerCoordinate: DUBLIN_CENTER,
            zoomLevel: INITIAL_ZOOM,
          }}
        />


 {sessions.map((s) => (
   <Mapbox.MarkerView key={s.sessionId} coordinate={[s.lng, s.lat]}>
     <Pressable
       onPress={() => openPreview(s)}
       style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}
    >
       <TeacherMarker
         avatarUrl={s.teacherAvatarUrl}
         category={normalizeCategory(s.sessionCategory)}
         selected={selected?.sessionId === s.sessionId}
         onReady={() => {}}
       />
     </Pressable>
   </Mapbox.MarkerView>
        ))}
      </Mapbox.MapView>

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
      <BottomSheetModal
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
      </BottomSheetModal>
    </View>
  );
}
