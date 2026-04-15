import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
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
import { getApprovedCategories } from "../../../../src/api/categories";
import {
  getSessionById,
  updateSession,
} from "../../../../src/api/sessions";
import { uiToastStore } from "../../../../src/store/uiToast.store";

type ApprovedCategory = {
  id: string;
  slug: string;
  label: string;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!;
Mapbox.setAccessToken(MAPBOX_TOKEN);

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");

  const [categories, setCategories] = useState<ApprovedCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [imageUrl3, setImageUrl3] = useState("");

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [duration, setDuration] = useState("90");
  const [maxParticipants, setMaxParticipants] = useState("6");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [roughLocation, setRoughLocation] = useState("");
  const [arrivalInstructions, setArrivalInstructions] = useState("");

  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<MapboxFeature[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingCategories(true);

        const data = await getApprovedCategories();

        if (!alive) return;

        setCategories(data);
      } catch (e) {
        console.error("Could not load categories", e);
      } finally {
        if (!alive) return;
        setLoadingCategories(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await getSessionById(String(id));

        if (!alive) return;

        const nextDate = data?.start_time ? new Date(data.start_time) : new Date();

        setStartDate(nextDate);

        setTitle(data?.class?.title ?? "");
        setCategory(data?.class?.category ?? "");
        setDescription(data?.class?.description ?? "");

        setPrice(
          typeof data?.price === "number" && Number.isFinite(data.price)
            ? String(data.price)
            : "",
        );

        setImageUrl1(data?.image_urls?.[0] ?? "");
        setImageUrl2(data?.image_urls?.[1] ?? "");
        setImageUrl3(data?.image_urls?.[2] ?? "");

        setDuration(String(data?.duration ?? 90));
        setMaxParticipants(String(data?.max_participants ?? 6));

        setLat(
          typeof data?.lat === "number" && Number.isFinite(data.lat)
            ? String(data.lat)
            : "",
        );
        setLng(
          typeof data?.lng === "number" && Number.isFinite(data.lng)
            ? String(data.lng)
            : "",
        );

        setRoughLocation(data?.rough_location ?? "");
        setArrivalInstructions(data?.arrival_instructions ?? "");

        if (data?.rough_location) {
          setSelectedAddress(data.rough_location);
          setAddressQuery(data.rough_location);
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        Alert.alert("Error", "Could not load session.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

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
    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);
    const parsedMaxParticipants = Number(maxParticipants);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a session title.");
      return;
    }

    if (!category) {
      Alert.alert("Missing category", "Please select a category.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return;
    }

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

    if (!roughLocation.trim()) {
      Alert.alert(
        "Missing rough location",
        "Please enter a rough location label like Ranelagh, Dublin 6.",
      );
      return;
    }

    if (arrivalInstructions.trim().length > 300) {
      Alert.alert(
        "Arrival instructions too long",
        "Arrival instructions must be 300 characters or fewer.",
      );
      return;
    }

    if (startDate <= new Date()) {
      Alert.alert("Invalid start time", "Please choose a future date and time.");
      return;
    }

    try {
      setSaving(true);

      await updateSession(String(id), {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: parsedPrice,
        image_url_1: imageUrl1.trim() || undefined,
        image_url_2: imageUrl2.trim() || undefined,
        image_url_3: imageUrl3.trim() || undefined,
        start_time: startDate.toISOString(),
        duration: parsedDuration,
        max_participants: parsedMaxParticipants,
        lat: parsedLat,
        lng: parsedLng,
        rough_location: roughLocation.trim(),
        arrival_instructions: arrivalInstructions.trim() || undefined,
      });

      uiToastStore.getState().showToast("Session updated");
      router.replace("/(teacher)/sessions");
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not update session.";

      Alert.alert(
        "Session error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading session…</Text>
      </View>
    );
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
        <Text style={{ fontSize: 28, fontWeight: "900" }}>Edit session</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Update the session details learners see and book.
        </Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Watercolour Basics"
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Category</Text>

        {loadingCategories ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 14,
              backgroundColor: "#fafafa",
              alignItems: "center",
            }}
          >
            <ActivityIndicator />
            <Text style={{ marginTop: 8, opacity: 0.7 }}>
              Loading categories…
            </Text>
          </View>
        ) : categories.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 14,
              backgroundColor: "#fafafa",
            }}
          >
            <Text>No approved categories are available yet.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((option) => {
              const selected = category === option.slug;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setCategory(option.slug)}
                  style={{
                    backgroundColor: selected ? "black" : "white",
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.12)",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "white" : "black",
                      fontWeight: "700",
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell learners what they’ll do and who it’s for."
          multiline
          style={{
            minHeight: 130,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 12,
            textAlignVertical: "top",
            backgroundColor: "#fafafa",
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Image 1 URL</Text>
        <TextInput
          value={imageUrl1}
          onChangeText={setImageUrl1}
          placeholder="https://example.com/class-photo-1.jpg"
          autoCapitalize="none"
          autoCorrect={false}
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Image 2 URL</Text>
        <TextInput
          value={imageUrl2}
          onChangeText={setImageUrl2}
          placeholder="https://example.com/class-photo-2.jpg"
          autoCapitalize="none"
          autoCorrect={false}
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Image 3 URL</Text>
        <TextInput
          value={imageUrl3}
          onChangeText={setImageUrl3}
          placeholder="https://example.com/class-photo-3.jpg"
          autoCapitalize="none"
          autoCorrect={false}
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Price (€)</Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="25"
          keyboardType="numeric"
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

      <View style={{ marginBottom: 16 }}>
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

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Rough location shown before booking
        </Text>
        <TextInput
          value={roughLocation}
          onChangeText={setRoughLocation}
          placeholder="Ranelagh, Dublin 6"
          style={{
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fafafa",
          }}
        />
        <Text style={{ marginTop: 8, opacity: 0.65 }}>
          This is the safe area label learners see before booking. Do not enter the full exact address here.
        </Text>
      </View>

      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Arrival instructions
        </Text>
        <TextInput
          value={arrivalInstructions}
          onChangeText={setArrivalInstructions}
          placeholder="Blue door, ring once, shoes off inside."
          multiline
          style={{
            minHeight: 100,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 12,
            textAlignVertical: "top",
            backgroundColor: "#fafafa",
          }}
        />
        <Text style={{ marginTop: 8, opacity: 0.65 }}>
          Optional. Shared with booked learners closer to the session.
        </Text>
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
        disabled={saving}
        style={{
          backgroundColor: saving ? "#666" : "black",
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
            Save changes
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
    </ScrollView>
  );
}