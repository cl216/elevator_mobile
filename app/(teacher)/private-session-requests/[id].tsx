import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import Mapbox from "@rnmapbox/maps";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { autoCapitalize } from "@/src/utils/text";
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
import { safeReplace } from "@/src/utils/safeRouter";
import { getApprovedCategories } from "@/src/api/categories";
import {
  acceptPrivateSessionRequest,
  declinePrivateSessionRequest,
  getMyTeacherPrivateSessionRequests,
  type PrivateSessionRequest,
} from "@/src/api/privateSessionRequests";
import {
  getMySessions,
  getSessionById,
  type SessionDetail,
  type TeacherSessionRow,
} from "@/src/api/sessions";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#12051F",
  surface: "#241032",
  surfaceSoft: "#321447",
  surfaceDeep: "#0B0314",

  text: "#FDF7FF",
  textSoft: "rgba(244,229,255,0.76)",
  textMuted: "rgba(244,229,255,0.52)",

  border: "rgba(216,180,254,0.16)",
  borderStrong: "rgba(216,180,254,0.42)",

  accent: "#C084FC",
  accentStrong: "#A855F7",
  accentSoft: "rgba(192,132,252,0.18)",
  accentBorder: "rgba(216,180,254,0.38)",

  button: "#7C3AED",
  buttonPressed: "#6D28D9",

  danger: "#FF7B7B",
  dangerSoft: "rgba(255,123,123,0.12)",
  dangerBorder: "rgba(255,123,123,0.24)",

  divider: "rgba(255,255,255,0.07)",
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!;
Mapbox.setAccessToken(MAPBOX_TOKEN);

type PrivateSessionRequestRow = PrivateSessionRequest;

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

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatDateOnly(date: Date) {
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeOnly(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inferCategoryFromRequest(request: PrivateSessionRequestRow | null) {
  const text = `${request?.message ?? ""} ${request?.learner_note ?? ""}`.toLowerCase();

  if (text.includes("piano") || text.includes("guitar") || text.includes("sing") || text.includes("music")) {
    return "music";
  }

  if (text.includes("cook") || text.includes("baking") || text.includes("food")) {
    return "cooking";
  }

  if (text.includes("spanish") || text.includes("french") || text.includes("english") || text.includes("language")) {
    return "language";
  }

  if (text.includes("paint") || text.includes("drawing") || text.includes("art")) {
    return "art";
  }

  if (text.includes("craft") || text.includes("sew") || text.includes("knit")) {
    return "crafts";
  }

  return "";
}

function getFirstValidRequestedDate(request: PrivateSessionRequestRow | null): Date {
  const options = [
    request?.requested_date_1,
    request?.requested_date_2,
    request?.requested_date_3,
  ];

  for (const value of options) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fallback = new Date();
  fallback.setMinutes(0, 0, 0);
  fallback.setHours(fallback.getHours() + 2);
  return fallback;
}

function DateTimeField({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.selectInput}>
      <View>
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.selectValue}>{value}</Text>
      </View>

      <Ionicons name={icon} size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function TeacherPrivateSessionRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<PrivateSessionRequestRow | null>(null);

  const [categories, setCategories] = useState<ApprovedCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("40");
  const [duration, setDuration] = useState("60");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [roughLocation, setRoughLocation] = useState("");
  const [arrivalInstructions, setArrivalInstructions] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<MapboxFeature[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [searchingAddress, setSearchingAddress] = useState(false);

  async function searchAddress(query: string) {
    setAddressQuery(query);

    if (query.trim().length < 3) {
      setAddressResults([]);
      return;
    }

    try {
      setSearchingAddress(true);

      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?autocomplete=true&limit=5&access_token=${MAPBOX_TOKEN}`,
      );

      const data = await res.json();
      setAddressResults((data.features ?? []) as MapboxFeature[]);
    } catch (e) {
      console.error("Address search failed", e);
      setAddressResults([]);
    } finally {
      setSearchingAddress(false);
    }
  }

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const data = await getApprovedCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadCategories failed", e);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function load() {
    try {
      setLoading(true);

      const [requestRows, teacherSessions] = await Promise.all([
        getMyTeacherPrivateSessionRequests(),
        getMySessions(),
      ]);

      const found = Array.isArray(requestRows)
        ? requestRows.find((item) => item.id === id) ?? null
        : null;

      setRequest(found);

      if (found) {
        const suggestedStart = getFirstValidRequestedDate(found);

        setStartDate(suggestedStart);
        setDuration(String(found.requested_duration_minutes || 60));
        setCategory(inferCategoryFromRequest(found));
        setTitle("Private 1:1 session");
        setDescription(found.message || "");
      }

      const mostRecentReusableSession = Array.isArray(teacherSessions)
        ? teacherSessions
            .filter(
              (item: TeacherSessionRow) =>
                item.status !== "CANCELLED" && item.session_type !== "PRIVATE",
            )
            .sort(
              (a, b) =>
                new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
            )[0]
        : undefined;

      if (mostRecentReusableSession?.id) {
        const detail: SessionDetail = await getSessionById(mostRecentReusableSession.id);
        const inferredCategory = inferCategoryFromRequest(found);

        const nextCategory =
          detail?.class?.category?.trim() ||
          mostRecentReusableSession.category?.trim() ||
          inferredCategory;

        if (nextCategory) {
          setCategory((prev) => prev.trim() || nextCategory);
        }

        const nextTitle =
          detail?.class?.title?.trim() ||
          mostRecentReusableSession.title?.trim() ||
          "Private 1:1 session";

        if (nextTitle) {
          setTitle((prev) => prev.trim() || nextTitle);
        }

        if (detail?.class?.description?.trim()) {
          setDescription((prev) => prev.trim() || detail.class?.description?.trim() || "");
        }

        if (
          typeof detail?.price === "number" &&
          Number.isFinite(detail.price) &&
          (!price.trim() || Number(price) <= 0)
        ) {
          setPrice(String(detail.price));
        }

if (detail?.rough_location?.trim()) {
  const nextRough = detail.rough_location.trim();

  setRoughLocation((prev) => prev.trim() || nextRough);
  setAddressQuery((prev) => prev.trim() || nextRough);

  if (Number.isFinite(detail?.lat) && Number.isFinite(detail?.lng)) {
    setSelectedAddress((prev) => prev || nextRough);
  }
}

        if (detail?.arrival_instructions?.trim()) {
          setArrivalInstructions((prev) => prev.trim() || detail.arrival_instructions!.trim());
        }

        if (
          Number.isFinite(detail?.lat) &&
          Number.isFinite(detail?.lng) &&
          (!lat.trim() || !lng.trim())
        ) {
          setLat(String(detail.lat));
          setLng(String(detail.lng));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
    void load();
  }, [id]);

  const canAct = useMemo(() => request?.status === "OPEN", [request?.status]);

  const requestedTimes = useMemo(() => {
    return [
      request?.requested_date_1,
      request?.requested_date_2,
      request?.requested_date_3,
    ].filter(Boolean) as string[];
  }, [request]);

  const previewCoordinate = useMemo(() => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return null;
    }

    return [parsedLng, parsedLat] as [number, number];
  }, [lat, lng]);

  async function handleDecline() {
    if (!request) return;

    if (declineMessage.trim().length > 500) {
      Alert.alert("Message too long", "Decline message must be 500 characters or fewer.");
      return;
    }

    try {
      setSaving(true);
      await declinePrivateSessionRequest(request.id, declineMessage.trim() || undefined);
      Alert.alert("Declined", "Request declined.");
      router.back();
    } catch (e: any) {
      const rawMessage =
        e?.response?.data?.message ?? e?.message ?? "Could not decline request.";

      Alert.alert(
        "Error",
        Array.isArray(rawMessage) ? rawMessage.join("\n") : String(rawMessage),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAccept() {
    if (!request) return;

    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a title.");
      return;
    }

    if (!category.trim()) {
      Alert.alert("Missing category", "Please choose a category.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return;
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      Alert.alert("Invalid duration", "Please enter a valid duration.");
      return;
    }

if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
  Alert.alert("Missing location", "Please search and select an address.");
  return;
}

    if (!roughLocation.trim()) {
      Alert.alert("Missing location", "Please enter a rough location.");
      return;
    }

    if (startDate.getTime() <= Date.now()) {
      Alert.alert("Invalid start time", "Please choose a future date and time.");
      return;
    }

    try {
      setSaving(true);

      await acceptPrivateSessionRequest(request.id, {
        title: title.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        start_time: startDate.toISOString(),
        duration: parsedDuration,
        lat: parsedLat,
        lng: parsedLng,
        rough_location: roughLocation.trim(),
        arrival_instructions: arrivalInstructions.trim() || undefined,
      });

      Alert.alert("Accepted", "Private session created successfully.", [
        {
          text: "OK",
          onPress: () => safeReplace("/(teacher)/sessions"),
        },
      ]);
    } catch (e: any) {
      const rawMessage =
        e?.response?.data?.message ?? e?.message ?? "Could not accept request.";

      Alert.alert(
        "Accept failed",
        Array.isArray(rawMessage) ? rawMessage.join("\n") : String(rawMessage),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInnerCentered}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading request…</Text>
              </View>
            </View>
          ) : !request ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <Text style={styles.heroTitle}>Request not found</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.hero}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Teacher mode</Text>
                </View>

                <Text style={styles.heroTitle}>Private request</Text>
                <Text style={styles.heroSubtitle}>
                  From {request.learner?.first_name?.trim() || "Learner"}
                </Text>
              </View>

              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Learner request</Text>
                  </View>

                  <Text style={styles.body}>{request.message}</Text>

                  {!!request.learner_note && (
                    <>
                      <Text style={styles.sectionTitle}>Extra note</Text>
                      <Text style={styles.body}>{request.learner_note}</Text>
                    </>
                  )}

                  <Text style={styles.sectionTitle}>Suggested times</Text>

                  <View style={styles.requestedTimesWrap}>
                    {requestedTimes.map((value, index) => (
                      <Pressable
                        key={`${value}-${index}`}
                        onPress={() => {
                          const next = new Date(value);
                          if (!Number.isNaN(next.getTime())) setStartDate(next);
                        }}
                        style={styles.requestedTimePill}
                      >
                        <Ionicons name="calendar-outline" size={14} color={COLORS.text} />
                        <Text style={styles.requestedTimePillText}>
                          {formatDate(value)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {canAct ? (
                <>
                  <View style={styles.cardOuter}>
                    <View style={styles.cardInner}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.iconCircle}>
                          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionTitle}>Create private session</Text>
                          <Text style={styles.sectionSubtitle}>
                            Turn this request into a paid private session in the app.
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.label}>Title</Text>
                      <TextInput
                        value={title}
          onChangeText={setTitle}
          autoCapitalize="words"  
                     placeholder="Private 1:1 session"
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.input}
                      />

                      <Text style={styles.label}>Category</Text>
                      {loadingCategories ? (
                        <View style={styles.loadingCategoriesWrap}>
                          <ActivityIndicator color={COLORS.accent} />
                          <Text style={styles.loadingCategoriesText}>Loading categories…</Text>
                        </View>
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

                      <Text style={styles.label}>Description</Text>
                      <TextInput
                        value={description}
          onChangeText={setDescription}
          autoCapitalize="words"     
                           placeholder="What will you cover in this session?"
                        placeholderTextColor={COLORS.textMuted}
                        multiline
                        style={styles.textArea}
                      />

                      <Text style={styles.label}>Price (€)</Text>
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        placeholder="40"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.input}
                      />

                      <Text style={styles.label}>Date and time</Text>
                      <View style={styles.inputStack}>
                        <DateTimeField
                          label="Session date"
                          value={formatDateOnly(startDate)}
                          icon="calendar-outline"
                          onPress={() => setShowDatePicker(true)}
                        />

                        <DateTimeField
                          label="Session time"
                          value={formatTimeOnly(startDate)}
                          icon="time-outline"
                          onPress={() => setShowTimePicker(true)}
                        />
                      </View>

                      <Text style={styles.label}>Duration (minutes)</Text>
                      <TextInput
                        value={duration}
                        onChangeText={setDuration}
                        placeholder="60"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.input}
                      />

                      <Text style={styles.label}>Address</Text>
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

                      {searchingAddress ? (
                        <Text style={styles.helperInline}>Searching…</Text>
                      ) : null}

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

                                const rough =
                                  item.place_name.split(",").slice(0, 2).join(",").trim() ||
                                  item.place_name;

                                setRoughLocation(rough);
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

                      <Text style={styles.label}>Rough location</Text>
                      <TextInput
                        value={roughLocation}
          onChangeText={setRoughLocation}
          autoCapitalize="sentences"        
                           placeholder="Ranelagh, Dublin 6"
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.input}
                      />

                      <Text style={styles.label}>Arrival instructions</Text>
                      <TextInput
                        value={arrivalInstructions}
          onChangeText={setArrivalInstructions}
          autoCapitalize="sentences"  
                                  placeholder="Blue door, ring once..."
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.input}
                      />

                      {previewCoordinate ? (
                        <>
                          <Text style={styles.label}>Location preview</Text>
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
                                id="private-session-location-preview"
                                coordinate={previewCoordinate}
                              >
                                <View style={styles.mapPin} />
                              </Mapbox.PointAnnotation>
                            </Mapbox.MapView>
                          </View>
                        </>
                      ) : null}

                      <Pressable
                        onPress={handleAccept}
                        disabled={saving}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          pressed && !saving && styles.primaryButtonPressed,
                          saving && styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          {saving ? "Saving..." : "Accept and create session"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.dangerCardOuter}>
                    <View style={styles.cardInner}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.dangerIconCircle}>
                          <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
                            Decline request
                          </Text>
                          <Text style={styles.sectionSubtitle}>
                            Optionally send a short message explaining why.
                          </Text>
                        </View>
                      </View>

                      <TextInput
                        value={declineMessage}
                        onChangeText={setDeclineMessage}
                        autoCapitalize="sentences"
                        placeholder="Optional message to learner"
                        placeholderTextColor={COLORS.textMuted}
                        multiline
                        maxLength={500}
                        style={styles.declineTextArea}
                      />

                      <Text style={styles.charCount}>{declineMessage.length}/500</Text>

                      <Pressable
                        onPress={handleDecline}
                        disabled={saving}
                        style={({ pressed }) => [
                          styles.declineButton,
                          pressed && !saving && styles.declineButtonPressed,
                          saving && styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.declineButtonText}>
                          {saving ? "Saving..." : "Decline request"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.cardOuter}>
                  <View style={styles.cardInner}>
                    <Text style={styles.body}>
                      This request is {request.status.toLowerCase()}.
                    </Text>

                    {!!request.teacher_response_message && (
                      <>
                        <Text style={styles.sectionTitle}>Teacher response</Text>
                        <Text style={styles.body}>{request.teacher_response_message}</Text>
                      </>
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {showDatePicker ? (
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

              if (Platform.OS !== "ios") {
                setShowTimePicker(true);
              }
            }}
          />
        ) : null}

        {showTimePicker ? (
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
        ) : null}
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    flexGrow: 1,
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
    fontWeight: "900",
  },

  heroTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
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

  dangerCardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  cardInnerCentered: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  dangerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 8,
  },

  sectionSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },

  body: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 12,
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
    minHeight: 110,
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

  declineTextArea: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  charCount: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "right",
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
    fontWeight: "800",
  },

  requestedTimesWrap: {
    gap: 10,
    marginTop: 4,
  },

  requestedTimePill: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  requestedTimePillText: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 18,
    flex: 1,
  },

  loadingCategoriesWrap: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingCategoriesText: {
    marginTop: 8,
    color: COLORS.textSoft,
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
    fontWeight: "800",
  },

  categoryChipTextSelected: {
    color: COLORS.text,
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
    marginTop: 4,
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
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.buttonPressed,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  declineButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  declineButtonPressed: {
    opacity: 0.86,
  },

  declineButtonText: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 15,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSoft,
  },
});