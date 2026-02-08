import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { authStore } from '../../src/store/auth.store';

type MapSessionPreview = {
  sessionId: string;
  lat: number;
  lng: number;
  title: string;
  price: number;
  startTimeISO: string;
  teacherName: string;
  thumbnailUrl?: string;
};

const DUBLIN_REGION: Region = {
  latitude: 53.3498,
  longitude: -6.2603,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export default function LearnerMap() {
  const mapRef = useRef<MapView | null>(null);

  const [region, setRegion] = useState<Region>(DUBLIN_REGION);
  const [selected, setSelected] = useState<MapSessionPreview | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  // Mock data for fast UI progress (we’ll replace with backend next)
  const sessions = useMemo<MapSessionPreview[]>(
    () => [
      {
        sessionId: 's1',
        lat: 53.3498,
        lng: -6.2603,
        title: 'Watercolour Basics',
        price: 25,
        startTimeISO: '2026-02-10T10:00:00Z',
        teacherName: 'Aoife',
        thumbnailUrl: 'https://picsum.photos/200/120',
      },
      {
        sessionId: 's2',
        lat: 53.342,
        lng: -6.286,
        title: 'Oil Painting — Portraits',
        price: 40,
        startTimeISO: '2026-02-11T18:30:00Z',
        teacherName: 'Niamh',
        thumbnailUrl: 'https://picsum.photos/201/120',
      },
      {
        sessionId: 's3',
        lat: 53.36,
        lng: -6.245,
        title: 'Pottery Wheel Intro',
        price: 55,
        startTimeISO: '2026-02-12T12:00:00Z',
        teacherName: 'Eoin',
        thumbnailUrl: 'https://picsum.photos/202/120',
      },
    ],
    []
  );

  useEffect(() => {
    (async () => {
      // Ask permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission denied. Using Dublin fallback.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const next: Region = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };

      setRegion(next);
      mapRef.current?.animateToRegion(next, 600);
    })();
  }, []);

  async function handleLogout() {
    await authStore.getState().logout();
    router.replace('/');
  }

  function formatStart(iso: string) {
    const d = new Date(iso);
    // simple readable format for now
    return d.toLocaleString();
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
ref={(r) => {
  mapRef.current = r;
}}        style={{ flex: 1 }}
        initialRegion={DUBLIN_REGION}
        onRegionChangeComplete={setRegion}
        // default provider is fine in Expo Go
      >
        {sessions.map((s) => (
          <Marker
            key={s.sessionId}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            onPress={() => setSelected(s)}
          >
            {/* Price pill */}
            <View
              style={{
                backgroundColor: 'white',
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 14,
                borderWidth: 1,
              }}
            >
              <Text style={{ fontWeight: '700' }}>€{s.price}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top bar (temporary) */}
      <View
        style={{
          position: 'absolute',
          top: Platform.select({ ios: 60, android: 40 }),
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            flex: 1,
            marginRight: 10,
          }}
        >
          <Text style={{ fontWeight: '700' }}>Browse classes near you</Text>
          {locError ? <Text style={{ marginTop: 4 }}>{locError}</Text> : null}
        </View>

        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: 'black',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Logout</Text>
        </Pressable>
      </View>

      {/* Dismissible preview (simple version) */}
      {selected && (
        <Pressable
          onPress={() => setSelected(null)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
          }}
        >
          {/* This inner view prevents closing when tapping card */}
          <Pressable
            onPress={() => {}}
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 24,
              backgroundColor: 'white',
              borderRadius: 18,
              borderWidth: 1,
              overflow: 'hidden',
            }}
          >
            {/* Image */}
            {selected.thumbnailUrl ? (
              <Image
                source={{ uri: selected.thumbnailUrl }}
                style={{ width: '100%', height: 130 }}
                resizeMode="cover"
              />
            ) : null}

            <View style={{ padding: 14, gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>
                {selected.title}
              </Text>

              <Text>
                €{selected.price} · {selected.teacherName}
              </Text>

              <Text>{formatStart(selected.startTimeISO)}</Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    // Later: go to booking flow
                    // For now: show that this would be the next action
                    setSelected(null);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: 'black',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>
                    Reserve
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    // Later: navigate to class/session detail
                    // router.push(`/(learner)/class/${selected.sessionId}`);
                    setSelected(null);
                  }}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>Details</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setSelected(null)}
                style={{ marginTop: 10, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600' }}>Dismiss</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
