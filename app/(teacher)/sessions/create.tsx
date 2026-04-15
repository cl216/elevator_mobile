import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Mapbox from "@rnmapbox/maps";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { getApprovedCategories } from "../../../src/api/categories";
import { createSession } from "../../../src/api/sessions";
import { api } from "../../../src/api/client";
import { ExplainCard } from "../../../src/components/ui/ExplainCard";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../../src/utils/explainCard";
import { uiToastStore } from "../../../src/store/uiToast.store";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

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

type FieldCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!;
Mapbox.setAccessToken(MAPBOX_TOKEN);

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",

  button: "#3F6AE0",
  buttonPressed: "#355CC2",
  buttonSecondary: "#121A2C",

  warningBg: "rgba(255, 193, 7, 0.12)",
  warningBorder: "rgba(255, 193, 7, 0.22)",
  warningText: "#FFD666",

  divider: "rgba(255,255,255,0.06)",
};

function FieldCard({ title, subtitle, children }: FieldCardProps) {
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export default function CreateSessionScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");

  const [categories, setCategories] = useState<ApprovedCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [imageUrl3, setImageUrl3] = useState("");

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
  const [roughLocation, setRoughLocation] = useState("");
  const [arrivalInstructions, setArrivalInstructions] = useState("");

  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<MapboxFeature[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [showSessionExplainCard, setShowSessionExplainCard] = useState(false);

  async function loadCategories() {
    try {
      setLoadingCategories(true);

      const data = await getApprovedCategories();
      setCategories(data);

      if (!category && data.length > 0) {
        setCategory(data[0].slug);
      }
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load categories.";

      Alert.alert(
        "Category error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setStripeStatusLoading(true);
        const res = await api.get("/teacher/stripe/status");

        if (!alive) return;
        setStripeEnabled(!!res?.data?.stripe_enabled);
      } catch (e) {
        console.error("stripe status load failed", e);
        if (!alive) return;
        setStripeEnabled(false);
      } finally {
        if (!alive) return;
        setStripeStatusLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const seen = await hasSeenExplainCard("create-session-intro");
      setShowSessionExplainCard(!seen);
    })();
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

  const handleDismissSessionExplainCard = useCallback(async () => {
    await markExplainCardSeen("create-session-intro");
    setShowSessionExplainCard(false);
  }, []);

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

  async function handleContinueStripeOnboarding() {
    try {
      const res = await api.post("/teacher/stripe/onboard");
      const url: string | undefined = res?.data?.url;

      if (!url) {
        throw new Error("Missing Stripe onboarding URL");
      }

      await Linking.openURL(url);
    } catch (e: any) {
      const message =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        "Could not start Stripe onboarding.";

      Alert.alert("Stripe onboarding error", String(message));
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
      Alert.alert(
        "Invalid capacity",
        "Please enter a valid max participant count.",
      );
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

    if (!stripeEnabled) {
      Alert.alert(
        "Complete payouts setup first",
        "Before you can publish a session, you need to finish Stripe onboarding so we can send your payouts.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Continue onboarding",
            onPress: handleContinueStripeOnboarding,
          },
        ],
      );
      return;
    }

    try {
      setSaving(true);

      await createSession({
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

      uiToastStore.getState().showToast("Session created");
      router.replace("/(teacher)/sessions");
    } catch (e: any) {
      console.error(e);

      const status = e?.response?.status;
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not create session.";

      const normalizedMessage = Array.isArray(message)
        ? message.join("\n")
        : String(message);

      if (
        status === 403 &&
        normalizedMessage.toLowerCase().includes("stripe")
      ) {
        Alert.alert(
          "Complete payouts setup first",
          "Before you can publish a session, you need to finish Stripe onboarding so we can send your payouts.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Continue onboarding",
              onPress: handleContinueStripeOnboarding,
            },
          ],
        );
        return;
      }

      Alert.alert("Session error", normalizedMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Create session</Text>
            </View>

            <Text style={styles.heroTitle}>Create a bookable session</Text>
            <Text style={styles.heroSubtitle}>
              Add the title, price, time, images, and location learners will see.
            </Text>
          </View>

          {showSessionExplainCard ? (
            <ExplainCard
              title="Keep it simple"
              body="Teachers create one session here with title, price, time, and location. Learners only ever see bookable sessions."
              dismissText="Got it"
              onDismiss={handleDismissSessionExplainCard}
            />
          ) : null}

          {stripeStatusLoading ? (
            <View style={styles.infoOuter}>
              <View style={styles.infoInner}>
                <Text style={styles.infoTitle}>Checking payouts setup…</Text>
              </View>
            </View>
          ) : !stripeEnabled ? (
            <View style={styles.warningOuter}>
              <View style={styles.warningInner}>
                <Text style={styles.warningTitle}>Finish payouts setup first</Text>
                <Text style={styles.warningBody}>
                  You need to complete Stripe onboarding before you can publish
                  sessions and receive payouts.
                </Text>

                <Pressable
                  onPress={handleContinueStripeOnboarding}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    Continue onboarding
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <FieldCard title="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Watercolour Basics"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          </FieldCard>

          <FieldCard title="Category">
            {loadingCategories ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading categories…</Text>
              </View>
            ) : categories.length === 0 ? (
              <Text style={styles.bodyText}>
                No approved categories are available yet.
              </Text>
            ) : (
              <View style={styles.categoryList}>
                {categories.map((option) => {
                  const selected = category === option.slug;

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setCategory(option.slug)}
                      style={[
                        styles.categoryChip,
                        selected && styles.categoryChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </FieldCard>

          <FieldCard title="Description">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell learners what they’ll do and who it’s for."
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.textAreaLarge}
            />
          </FieldCard>

          <FieldCard
            title="Images"
            subtitle="You can add up to three image URLs for the session gallery."
          >
            <View style={styles.inputStack}>
              <TextInput
                value={imageUrl1}
                onChangeText={setImageUrl1}
                placeholder="Image 1 URL"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <TextInput
                value={imageUrl2}
                onChangeText={setImageUrl2}
                placeholder="Image 2 URL"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <TextInput
                value={imageUrl3}
                onChangeText={setImageUrl3}
                placeholder="Image 3 URL"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </FieldCard>

          <FieldCard title="Price (€)">
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="25"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
          </FieldCard>

          <FieldCard title="Date and time">
            <View style={styles.inputStack}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.selectInput}
              >
                <View>
                  <Text style={styles.selectLabel}>Session date</Text>
                  <Text style={styles.selectValue}>{formattedDate}</Text>
                </View>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={COLORS.textMuted}
                />
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={styles.selectInput}
              >
                <View>
                  <Text style={styles.selectLabel}>Session time</Text>
                  <Text style={styles.selectValue}>{formattedTime}</Text>
                </View>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.textMuted}
                />
              </Pressable>
            </View>
          </FieldCard>

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

          <FieldCard title="Capacity">
            <View style={styles.inputStack}>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="Duration (minutes)"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <TextInput
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                keyboardType="numeric"
                placeholder="Max participants"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
            </View>
          </FieldCard>

          <FieldCard title="Address">
            <TextInput
              value={selectedAddress ?? addressQuery}
              onChangeText={(text) => {
                setSelectedAddress(null);
                setLat("");
                setLng("");
                searchAddress(text);
              }}
              placeholder="Search address"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            {addressResults.length > 0 && !selectedAddress ? (
              <View style={styles.resultsWrap}>
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
                    style={[
                      styles.resultRow,
                      index === addressResults.length - 1 && styles.resultRowLast,
                    ]}
                  >
                    <Text style={styles.resultText}>{item.place_name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedAddress ? (
              <Text style={styles.helperInline}>Selected: {selectedAddress}</Text>
            ) : null}
          </FieldCard>

          <FieldCard
            title="Rough location shown before booking"
            subtitle="This is the safe area label learners see before booking. Do not enter the full exact address here."
          >
            <TextInput
              value={roughLocation}
              onChangeText={setRoughLocation}
              placeholder="Ranelagh, Dublin 6"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          </FieldCard>

          <FieldCard
            title="Arrival instructions"
            subtitle="Optional. Shared with booked learners closer to the session."
          >
            <TextInput
              value={arrivalInstructions}
              onChangeText={setArrivalInstructions}
              placeholder="Blue door, ring once, shoes off inside."
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.textArea}
            />
          </FieldCard>

          {previewCoordinate ? (
            <FieldCard title="Location preview">
              <View style={styles.mapPreview}>
                <Mapbox.MapView
                  style={styles.mapPreviewInner}
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
                    <View style={styles.mapPin} />
                  </Mapbox.PointAnnotation>
                </Mapbox.MapView>
              </View>
            </FieldCard>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving || stripeStatusLoading || loadingCategories}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.primaryButtonPressed,
              (saving || stripeStatusLoading || loadingCategories) &&
                styles.primaryButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Publish session</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: 40,
  flexGrow: 1,  },

  content: {
    paddingBottom: 24,
  },

  hero: {
    marginBottom: 18,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  heroTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  heroSubtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
    padding: 16,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  sectionSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  inputStack: {
    gap: 10,
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  textArea: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  textAreaLarge: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  selectInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },

  selectValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoryChip: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  categoryChipSelected: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
  },

  categoryChipText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  categoryChipTextSelected: {
    color: COLORS.text,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },

  loadingText: {
    color: COLORS.textSoft,
    marginTop: 10,
  },

  infoOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  infoInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  infoTitle: {
    color: COLORS.text,
    fontWeight: "700",
  },

  warningOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  warningInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  warningTitle: {
    color: COLORS.warningText,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  warningBody: {
    color: COLORS.textSoft,
    lineHeight: 20,
  },

  resultsWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  resultRowLast: {
    borderBottomWidth: 0,
  },

  resultText: {
    color: COLORS.text,
    lineHeight: 20,
  },

  helperInline: {
    marginTop: 8,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },

  mapPreview: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mapPreviewInner: {
    flex: 1,
  },

  mapPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.button,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
  },

  primaryButtonDisabled: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.buttonSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  secondaryButtonPressed: {
    opacity: 0.86,
  },

  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
});