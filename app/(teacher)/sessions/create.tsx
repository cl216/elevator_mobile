import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Mapbox from "@rnmapbox/maps";
import { getMyClasses } from "../../../src/api/classes";
import { createSession } from "../../../src/api/sessions";

type TeacherClass = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  price: number;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!;
Mapbox.setAccessToken(MAPBOX_TOKEN);

export default function CreateSessionScreen() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [duration, setDuration] = useState("90");
  const [maxParticipants, setMaxParticipants] = useState("6");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<MapboxFeature[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await getMyClasses();

        if (!alive) return;

        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        Alert.alert("Error", "Could not load your classes.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const formattedDate = useMemo(
    () =>
      startDate.toLocaleDateString([], {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [startDate],
  );

  const formattedTime = useMemo(
    () =>
      startDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [startDate],
  );

  const previewCoordinate = useMemo(() => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return null;
    }

    return [parsedLng, parsedLat] as [number, number];
  }, [lat, lng]);

  async function searchAddress(query: string) {
    setAddressQuery(query);

    if (query.trim().length < 3) {
      setAddressResults([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?autocomplete=true&limit=5&access_token=${MAPBOX_TOKEN}`,
      );

      const data = await res.json();
      setAddressResults((data.features ?? []) as MapboxFeature[]);
    } catch (e) {
      console.error("Address search failed", e);
    }
  }

  async function handleSave() {
    if (!selectedClassId) {
      Alert.alert("Missing class", "Please create a class first.");
      return;
    }

    const parsedDuration = Number(duration);
    const parsedMaxParticipants = Number(maxParticipants);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      Alert.alert("Invalid duration", "Please enter a valid duration in minutes.");
      return;
    }

    if (!Number.isFinite(parsedMaxParticipants) || parsedMaxParticipants <= 0) {
      Alert.alert("Invalid capacity", "Please enter a valid max participant count.");
      return;
    }

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      Alert.alert("Invalid location", "Please choose a valid address.");
      return;
    }

    if (startDate <= new Date()) {
      Alert.alert("Invalid start time", "Please choose a future date and time.");
      return;
    }

    try {
      setSaving(true);

      await createSession({
        classId: selectedClassId,
        start_time: startDate.toISOString(),
        duration: parsedDuration,
        max_participants: parsedMaxParticipants,
        lat: parsedLat,
        lng: parsedLng,
      });

      Alert.alert("Session created", "Your session is now live on the map.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not create session.";

      Alert.alert(
        "Session error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

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
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: "900" }}>Create session</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Schedule a live session from one of your classes.
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading classes…</Text>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>Class</Text>

            {classes.length === 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 14,
                  backgroundColor: "#fafafa",
                }}
              >
                <Text style={{ marginBottom: 12 }}>
                  You need to create a class before you can create a session.
                </Text>

                <Pressable
                  onPress={() => router.push("/(teacher)/classes/create")}
                  style={{
                    backgroundColor: "black",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800" }}>
                    Create class first
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {classes.map((cls) => {
                  const selected = selectedClassId === cls.id;

                  return (
                    <Pressable
                      key={cls.id}
                      onPress={() => setSelectedClassId(cls.id)}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? "black" : "rgba(0,0,0,0.12)",
                        backgroundColor: selected ? "#f6f6f6" : "white",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <Text style={{ fontWeight: "800" }}>{cls.title}</Text>
                      <Text style={{ marginTop: 4, opacity: 0.7 }}>
                        {cls.category} · €{cls.price}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Session date
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            >
              <Text>{formattedDate}</Text>
            </Pressable>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Session time
            </Text>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            >
              <Text>{formattedTime}</Text>
            </Pressable>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === "ios");
                if (!selected) return;

                const next = new Date(startDate);
                next.setFullYear(
                  selected.getFullYear(),
                  selected.getMonth(),
                  selected.getDate(),
                );
                setStartDate(next);
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                setShowTimePicker(Platform.OS === "ios");
                if (!selected) return;

                const next = new Date(startDate);
                next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                setStartDate(next);
              }}
            />
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Duration (minutes)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="90"
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Max participants
            </Text>
            <TextInput
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="numeric"
              placeholder="6"
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>
              Address
            </Text>

            <TextInput
              value={selectedAddress ?? addressQuery}
              onChangeText={(text) => {
                setSelectedAddress(null);
                setLat("");
                setLng("");
                searchAddress(text);
              }}
              placeholder="Search address"
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#fafafa",
              }}
            />

            {addressResults.length > 0 && !selectedAddress && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  marginTop: 6,
                  backgroundColor: "white",
                  overflow: "hidden",
                }}
              >
                {addressResults.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      const [lngValue, latValue] = item.center;

                      setLat(String(latValue));
                      setLng(String(lngValue));
                      setSelectedAddress(item.place_name);
                      setAddressQuery(item.place_name);
                      setAddressResults([]);
                    }}
                    style={{
                      padding: 12,
                      borderBottomWidth:
                        index === addressResults.length - 1 ? 0 : 1,
                      borderColor: "rgba(0,0,0,0.06)",
                    }}
                  >
                    <Text>{item.place_name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedAddress ? (
              <Text style={{ marginTop: 8, opacity: 0.7 }}>
                Selected: {selectedAddress}
              </Text>
            ) : null}
          </View>

          {previewCoordinate ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                Location preview
              </Text>

              <View
                style={{
                  height: 180,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                }}
              >
                <Mapbox.MapView
                  style={{ flex: 1 }}
                  styleURL="mapbox://styles/mapbox/standard"
                  logoEnabled={false}
                  attributionEnabled={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  <Mapbox.Camera
                    zoomLevel={14}
                    centerCoordinate={previewCoordinate}
                    animationMode="none"
                  />

                 <Mapbox.PointAnnotation
  id="session-location-preview"
  coordinate={previewCoordinate}
>
  <View
    style={{
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "black",
      borderWidth: 2,
      borderColor: "white",
    }}
  />
</Mapbox.PointAnnotation>
                </Mapbox.MapView>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving || classes.length === 0}
            style={{
              backgroundColor:
                saving || classes.length === 0 ? "#666" : "black",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white", fontWeight: "900" }}>
                Save session
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Cancel</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}