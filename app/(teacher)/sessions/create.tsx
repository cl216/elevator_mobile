import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Mapbox from "@rnmapbox/maps";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

import { getApprovedCategories } from "../../../src/api/categories";
import { api } from "../../../src/api/client";
import {
  createSession,
  getSessionById,
  updateSession,
} from "../../../src/api/sessions";
import { uploadImage } from "../../../src/api/uploads";
import { ExplainCard } from "../../../src/components/ui/ExplainCard";
import { uiToastStore } from "../../../src/store/uiToast.store";
import {
  hasSeenExplainCard,
  markExplainCardSeen,
} from "../../../src/utils/explainCard";

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

  successBg: "rgba(80, 200, 120, 0.14)",
  successBorder: "rgba(80, 200, 120, 0.28)",

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

type CreateSessionScreenProps = {
  mode?: "create" | "edit";
  sessionId?: string;
};

export default function CreateSessionScreen({
  mode = "create",
  sessionId,
}: CreateSessionScreenProps) {


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
  const [loadingSession, setLoadingSession] = useState(mode === "edit");
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true);
  const [stripeReady, setStripeReady] = useState(false);
  const [showSessionExplainCard, setShowSessionExplainCard] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

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

  async function pickImage(setter: (uri: string) => void) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access to choose images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.55,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setter(result.assets[0].uri);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);


  useEffect(() => {
    if (mode !== "edit" || !sessionId) return;

    let alive = true;

    (async () => {
      try {
        setLoadingSession(true);

        const data = await getSessionById(sessionId);

        if (!alive) return;

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

        setStartDate(data?.start_time ? new Date(data.start_time) : new Date());
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
      } catch (e: any) {
        console.error(e);
        Alert.alert("Session error", "Could not load this session.");
        router.back();
      } finally {
        if (alive) setLoadingSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mode, sessionId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setStripeStatusLoading(true);
        const res = await api.get("/teacher/stripe/status");

        if (!alive) return;

        setStripeReady(
          !!res?.data?.stripe_enabled &&
          !!res?.data?.charges_enabled &&
          !!res?.data?.payouts_enabled,
        );
      } catch (e) {
        console.error("stripe status load failed", e);
        if (!alive) return;
        setStripeReady(false);
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
      setShowSessionExplainCard(mode === "create" && !seen);
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

  const selectedCategoryLabel = useMemo(() => {
    return categories.find((item) => item.slug === category)?.label ?? category;
  }, [categories, category]);

  const selectedImages = useMemo(
    () =>
      [imageUrl1, imageUrl2, imageUrl3]
        .map((item) => item.trim())
        .filter(Boolean),
    [imageUrl1, imageUrl2, imageUrl3],
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

  function validateBeforeReview() {
    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);
    const parsedMaxParticipants = Number(maxParticipants);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a session title.");
      return false;
    }

    if (!category) {
      Alert.alert("Missing category", "Please select a category.");
      return false;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return false;
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      Alert.alert("Invalid duration", "Please enter a valid duration in minutes.");
      return false;
    }

    if (!Number.isFinite(parsedMaxParticipants) || parsedMaxParticipants <= 0) {
      Alert.alert("Invalid capacity", "Please enter a valid max participant count.");
      return false;
    }

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      Alert.alert("Invalid location", "Please choose a valid exact address.");
      return false;
    }

    if (!roughLocation.trim()) {
      Alert.alert(
        "Missing public location",
        "Please enter the rough location learners will see before booking.",
      );
      return false;
    }

    if (arrivalInstructions.trim().length > 300) {
      Alert.alert(
        "Arrival instructions too long",
        "Arrival instructions must be 300 characters or fewer.",
      );
      return false;
    }

    if (startDate <= new Date()) {
      Alert.alert("Invalid start time", "Please choose a future date and time.");
      return false;
    }

    if (!stripeReady) {
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
      return false;
    }

    return true;
  }

  function handleReview() {
    if (!validateBeforeReview()) return;
    setShowReviewModal(true);
  }

  async function handlePublish() {
    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);
    const parsedMaxParticipants = Number(maxParticipants);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    try {
      setSaving(true);

      const uploadedImages: string[] = [];

      for (const image of selectedImages) {
        const trimmed = image.trim();

        if (!trimmed) continue;

        if (trimmed.startsWith("file://")) {
          console.log("UPLOADING LOCAL IMAGE URI:", trimmed);
          const uploadedUrl = await uploadImage(trimmed);
          uploadedImages.push(uploadedUrl);
        } else {
          console.log("KEEPING EXISTING IMAGE URL:", trimmed);
          uploadedImages.push(trimmed);
        }
      }

      const payload = {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: parsedPrice,
        image_url_1: uploadedImages[0],
        image_url_2: uploadedImages[1],
        image_url_3: uploadedImages[2],
        start_time: startDate.toISOString(),
        duration: parsedDuration,
        max_participants: parsedMaxParticipants,
        lat: parsedLat,
        lng: parsedLng,
        rough_location: roughLocation.trim(),
        arrival_instructions: arrivalInstructions.trim() || undefined,
      };

      if (mode === "edit" && sessionId) {
        await updateSession(sessionId, payload);
        uiToastStore.getState().showToast("Session updated");
      } else {
        await createSession(payload);
        uiToastStore.getState().showToast("Session created");
      }

      setShowReviewModal(false);
      safeReplace("/(teacher)/sessions");
    } catch (e: any) {
      console.error(e);

      const status = e?.response?.status;
      const message =
        e?.response?.data?.message ??
        e?.message ??
        (mode === "edit" ? "Could not update session." : "Could not create session.");

      const normalizedMessage = Array.isArray(message)
        ? message.join("\n")
        : String(message);

      if (status === 403 && normalizedMessage.toLowerCase().includes("stripe")) {
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

  if (mode === "edit" && loadingSession) {
    return (
      <AppLayout>
        <AppScreen>
          <View style={styles.loadingFullScreen}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading session…</Text>
          </View>
        </AppScreen>
      </AppLayout>
    );
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
              <Text style={styles.heroBadgeText}>
                {mode === "edit" ? "Edit session" : "Create session"}
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              {mode === "edit" ? "Edit your session" : "Create a bookable session"}
            </Text>
            <Text style={styles.heroSubtitle}>
              Add the title, price, time, photos, and location learners will see.
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
          ) : !stripeReady ? (
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
                  <Text style={styles.primaryButtonText}>Continue onboarding</Text>
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
            ) : (
              <>
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

                <Pressable
                  onPress={() => safePush("/(modal)/propose-category")}
                  style={styles.suggestCategoryButton}
                >
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.text} />
                  <Text style={styles.suggestCategoryButtonText}>
                    Suggest new category
                  </Text>
                </Pressable>

                <Text style={styles.suggestCategoryHelper}>
                  Suggestions are reviewed before being added to the platform.
                </Text>
              </>
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
            title="Photos"
            subtitle="Choose up to three photos for the session gallery."
          >
            <View style={styles.galleryPickerStack}>
              {[setImageUrl1, setImageUrl2, setImageUrl3].map((setter, index) => {
                const value = [imageUrl1, imageUrl2, imageUrl3][index];

                return (
                  <View key={index} style={styles.imagePickerBlock}>
                    <Pressable
                      onPress={() => pickImage(setter)}
                      style={styles.ctaButton}
                    >
                      <Ionicons name="images-outline" size={18} color={COLORS.text} />
                      <Text style={styles.ctaButtonText}>
                        {value ? `Change photo ${index + 1}` : `Choose photo ${index + 1}`}
                      </Text>
                    </Pressable>

                    {value.trim() ? (
                      <Image
                        source={{ uri: value.trim() }}
                        style={styles.sessionImagePreview}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                );
              })}
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
                <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={styles.selectInput}
              >
                <View>
                  <Text style={styles.selectLabel}>Session time</Text>
                  <Text style={styles.selectValue}>{formattedTime}</Text>
                </View>
                <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
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

          <FieldCard
            title="Session size"
            subtitle="Set how long the session lasts and how many learners can book."
          >
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.helperText}>How long will this class run?</Text>

              <View style={styles.presetRow}>
                {["60", "90", "120"].map((value) => {
                  const selected = duration === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDuration(value)}
                      style={[styles.presetChip, selected && styles.presetChipSelected]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          selected && styles.presetChipTextSelected,
                        ]}
                      >
                        {value} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="Custom duration, e.g. 75"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldBlockLast}>
              <Text style={styles.label}>Learner capacity</Text>
              <Text style={styles.helperText}>
                Maximum number of learners who can book this session.
              </Text>

              <View style={styles.presetRow}>
                {["1", "4", "6", "10"].map((value) => {
                  const selected = maxParticipants === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setMaxParticipants(value)}
                      style={[styles.presetChip, selected && styles.presetChipSelected]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          selected && styles.presetChipTextSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                keyboardType="numeric"
                placeholder="Custom capacity, e.g. 8"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
            </View>
          </FieldCard>

          <FieldCard
            title="Exact address"
            subtitle="Needed for bookings. Learners only see this after they book."
          >
            <View style={styles.noticeBox}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.accent} />
              <Text style={styles.noticeText}>
                This exact address is private while learners browse. It is shared
                only with booked learners.
              </Text>
            </View>

            <TextInput
              value={selectedAddress ?? addressQuery}
              onChangeText={(text) => {
                setSelectedAddress(null);
                setLat("");
                setLng("");
                searchAddress(text);
              }}
              placeholder="Search full address"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputTopGap]}
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
              <View style={styles.selectedAddressBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.accent} />
                <Text style={styles.selectedAddressText}>{selectedAddress}</Text>
              </View>
            ) : null}

            {previewCoordinate ? (
              <View style={styles.mapPreviewInline}>
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
            ) : null}
          </FieldCard>

          <FieldCard
            title="Public location"
            subtitle="This is the rough area learners see while browsing."
          >
            <View style={styles.noticeBox}>
              <Ionicons name="eye-outline" size={16} color={COLORS.accent} />
              <Text style={styles.noticeText}>
                Use a safe, helpful area label. For example: “Galway Docks”,
                “Ranelagh, Dublin 6”, or “Beside Jervis Centre”.
              </Text>
            </View>

            <TextInput
              value={roughLocation}
              onChangeText={setRoughLocation}
              placeholder="Example: Galway Docks"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputTopGap]}
            />
          </FieldCard>

          <FieldCard
            title="Arrival instructions"
            subtitle="Optional. Shared with booked learners so they can find you easily."
          >
            <TextInput
              value={arrivalInstructions}
              onChangeText={setArrivalInstructions}
              placeholder="Example: Blue door, ring once, shoes off inside."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={300}
              style={styles.textArea}
            />

            <Text style={styles.helperInline}>
              {arrivalInstructions.trim().length}/300 characters
            </Text>
          </FieldCard>

          <FieldCard
            title="Review before publishing"
            subtitle="Check exactly what learners will see before this goes live."
          >
            <View style={styles.previewCard}>
              {selectedImages[0] ? (
                <Image
                  source={{ uri: selectedImages[0] }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewImagePlaceholder}>
                  <Ionicons name="image-outline" size={28} color={COLORS.textMuted} />
                  <Text style={styles.previewImagePlaceholderText}>No photo selected</Text>
                </View>
              )}

              <View style={styles.previewBody}>
                <Text style={styles.previewTitle}>
                  {title.trim() || "Your session title"}
                </Text>
                <Text style={styles.previewMeta}>
                  {selectedCategoryLabel || "Category"} • €{price || "0"} • {duration} min
                </Text>
                <Text style={styles.previewMeta}>
                  {formattedDate} at {formattedTime}
                </Text>
                <Text style={styles.previewMeta}>
                  {maxParticipants || "0"} learner capacity
                </Text>
                <Text style={styles.previewLocation}>
                  {roughLocation.trim() || "Public location will appear here"}
                </Text>
              </View>
            </View>
          </FieldCard>

          <Pressable
            onPress={handleReview}
            disabled={saving || stripeStatusLoading || loadingCategories}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.primaryButtonPressed,
              (saving || stripeStatusLoading || loadingCategories) &&
              styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {mode === "edit" ? "Review and save" : "Review and publish"}
            </Text>
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

        <Modal
          transparent
          visible={showReviewModal}
          animationType="fade"
          onRequestClose={() => {
            if (!saving) setShowReviewModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {mode === "edit" ? "Save changes?" : "Publish this session?"}
              </Text>
              <Text style={styles.modalSubtitle}>
                Confirm the details below before making it bookable.
              </Text>

              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryTitle}>{title.trim()}</Text>
                <Text style={styles.modalSummaryText}>
                  {selectedCategoryLabel} • €{price} • {duration} min
                </Text>
                <Text style={styles.modalSummaryText}>
                  {formattedDate} at {formattedTime}
                </Text>
                <Text style={styles.modalSummaryText}>
                  Public location: {roughLocation.trim()}
                </Text>
                <Text style={styles.modalSummaryMuted}>
                  Exact address is only shared after booking.
                </Text>
              </View>

              <Pressable
                onPress={handlePublish}
                disabled={saving}
                style={[
                  styles.primaryButton,
                  saving && styles.primaryButtonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === "edit" ? "Save changes" : "Publish session"}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowReviewModal(false)}
                disabled={saving}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Keep editing</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    flexGrow: 1,
  },

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

  inputTopGap: {
    marginTop: 12,
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

  suggestCategoryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  suggestCategoryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  suggestCategoryHelper: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },

  galleryPickerStack: {
    gap: 12,
  },

  imagePickerBlock: {
    gap: 10,
  },

  ctaButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  ctaButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  sessionImagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },

  fieldBlock: {
    marginBottom: 18,
  },

  fieldBlockLast: {
    marginBottom: 0,
  },

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },

  helperText: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },

  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  presetChipSelected: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
  },

  presetChipText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800",
  },

  presetChipTextSelected: {
    color: COLORS.text,
  },

  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  noticeText: {
    flex: 1,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },

  selectedAddressBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },

  selectedAddressText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  loadingFullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: COLORS.bg,
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

  mapPreviewInline: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
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

  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    overflow: "hidden",
  },

  previewImage: {
    width: "100%",
    height: 170,
  },

  previewImagePlaceholder: {
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
    gap: 8,
  },

  previewImagePlaceholderText: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },

  previewBody: {
    padding: 14,
  },

  previewTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  previewMeta: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  previewLocation: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.bg,
    padding: 18,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  modalSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  modalSummary: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    padding: 14,
    marginBottom: 14,
  },

  modalSummaryTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },

  modalSummaryText: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },

  modalSummaryMuted: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});