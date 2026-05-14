import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { autoCapitalize } from "@/src/utils/text";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createClassRequest } from "../../src/api/classRequests";
import {
  getApprovedCategories,
  type ApprovedCategory,
} from "../../src/api/categories";

import AppLayout from "@/src/components/layout/AppLayout";

type RequestType = "existing_category" | "new_class";

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

  divider: "rgba(255,255,255,0.06)",
};

export default function RequestClassScreen() {
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    category?: string;
  }>();

  const [requestType, setRequestType] =
    useState<RequestType>("existing_category");

  const [approvedCategories, setApprovedCategories] = useState<
    ApprovedCategory[]
  >([]);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [category, setCategory] = useState(params.category ?? "");
  const [customTitle, setCustomTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadCategories() {
      try {
        setLoadingCategories(true);

        const rows = await getApprovedCategories();

        if (!alive) return;

        setApprovedCategories(rows);

        if (!category) {
          setCategory(rows[0]?.slug ?? "");
        } else {
          const exists = rows.some((row) => row.slug === category);

          if (!exists) {
            setCategory(rows[0]?.slug ?? "");
          }
        }
      } catch (e: any) {
        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Could not load categories.";

        Alert.alert(
          "Category error",
          Array.isArray(message) ? message.join("\n") : String(message),
        );
      } finally {
        if (alive) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit() {
    const lat = Number(params.lat);
    const lng = Number(params.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert(
        "Missing location",
        "Could not determine the request location.",
      );
      return;
    }

    if (requestType === "existing_category" && !category) {
      Alert.alert("Missing category", "Please choose a category.");
      return;
    }

    if (requestType === "new_class" && !customTitle.trim()) {
      Alert.alert(
        "Missing class idea",
        "Please enter the class you want to suggest.",
      );
      return;
    }

    try {
      setSaving(true);

      await createClassRequest({
        request_type: requestType,
        category: requestType === "existing_category" ? category : undefined,
        custom_title:
          requestType === "new_class" ? customTitle.trim() : undefined,
        note: note.trim() || undefined,
        lat,
        lng,
      });

      Alert.alert(
        "Request sent",
        requestType === "new_class"
          ? "Thanks — your class idea has been submitted for review."
          : "Thanks — this helps show demand for classes in this area.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not send class request.";

      Alert.alert(
        "Could not send request",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Request a class</Text>
            </View>

            <Text style={styles.title}>Tell us what you want nearby</Text>

            <Text style={styles.subtitle}>
              Ask for an existing category or suggest a brand new class idea for
              this area.
            </Text>
          </View>

          <View style={styles.cardOuter}>
            <View style={styles.cardInner}>
              <Text style={styles.sectionTitle}>Request type</Text>

              <View style={styles.optionList}>
                <Pressable
                  onPress={() => setRequestType("existing_category")}
                  style={[
                    styles.optionCard,
                    requestType === "existing_category" &&
                      styles.optionCardSelected,
                  ]}
                >
                  <Text style={styles.optionTitle}>
                    Request an existing category
                  </Text>

                  <Text style={styles.optionBody}>
                    Choose from categories already supported in the app.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setRequestType("new_class")}
                  style={[
                    styles.optionCard,
                    requestType === "new_class" && styles.optionCardSelected,
                  ]}
                >
                  <Text style={styles.optionTitle}>
                    Suggest a new class idea
                  </Text>

                  <Text style={styles.optionBody}>
                    Share something new that is not listed yet.
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {requestType === "existing_category" ? (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <Text style={styles.sectionTitle}>Choose a category</Text>

                {loadingCategories ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={COLORS.accent} />

                    <Text style={styles.loadingText}>
                      Loading categories…
                    </Text>
                  </View>
                ) : approvedCategories.length === 0 ? (
                  <Text style={styles.bodyText}>
                    No approved categories are available yet.
                  </Text>
                ) : (
                  <View style={styles.optionList}>
                    {approvedCategories.map((item) => {
                      const selected = category === item.slug;

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setCategory(item.slug)}
                          style={[
                            styles.optionCard,
                            selected && styles.optionCardSelected,
                          ]}
                        >
                          <Text style={styles.optionTitle}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.cardOuter}>
              <View style={styles.cardInner}>
                <Text style={styles.sectionTitle}>New class idea</Text>

                <TextInput
                  value={customTitle}
                            onChangeText={setCustomTitle}
                  autoCapitalize="words"
                  placeholder="Example: Fishing, Gaming, Gardening"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={80}
                  style={styles.input}
                />
              </View>
            </View>
          )}

          <View style={styles.cardOuter}>
            <View style={styles.cardInner}>
              <Text style={styles.sectionTitle}>Optional note</Text>

              <Text style={styles.helperText}>
                Add any preferences, level, or timing that could help teachers.
              </Text>

              <TextInput
                value={note}
                          onChangeText={setNote}
                autoCapitalize="sentences"
                placeholder="Example: Beginner-friendly evening class"
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={300}
                style={styles.textArea}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.primaryButtonPressed,
              saving && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Sending..." : "Send request"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  scroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
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

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
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
    marginBottom: 12,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  helperText: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },

  optionList: {
    gap: 10,
  },

  optionCard: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 15,
  },

  optionCardSelected: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
  },

  optionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },

  optionBody: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
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
    minHeight: 120,
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

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },

  loadingText: {
    color: COLORS.textSoft,
    fontSize: 14,
    marginTop: 10,
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