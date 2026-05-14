import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { autoCapitalize } from "@/src/utils/text";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { proposeCategory } from "../../src/api/categories";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

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

export default function ProposeCategoryScreen() {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = label.trim();

    if (!trimmed) {
      Alert.alert("Missing category", "Please enter a category name.");
      return;
    }

    try {
      setSaving(true);

      const result = await proposeCategory(trimmed);

      Alert.alert(
        "Category proposed",
        result?.message ??
          "Your category proposal has been submitted for review.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not propose category.";

      Alert.alert(
        "Proposal error",
        Array.isArray(message) ? message.join("\n") : String(message),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Learner</Text>
            </View>

            <Text style={styles.title}>Propose new category</Text>
            <Text style={styles.subtitle}>
              Suggest a new category for the marketplace. It will stay hidden
              until approved.
            </Text>
          </View>

          <View style={styles.cardOuter}>
            <View style={styles.cardInner}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="bulb-outline" size={18} color="#FFFFFF" />
                </View>

                <View style={styles.cardHeaderTextWrap}>
                  <Text style={styles.cardTitle}>Category idea</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.cardBody}>
                Tell us what learners should be able to discover next.
              </Text>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Category name</Text>

                <TextInput
                  value={label}
            onChangeText={setLabel}
          autoCapitalize="words"
                placeholder="Example: Fishing"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={80}
                  editable={!saving}
                  style={[styles.input, saving && styles.inputDisabled]}
                />

                <Text style={styles.helperText}>{label.length}/80 characters</Text>
              </View>

              <View style={styles.noticeBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={COLORS.accent}
                />
                <Text style={styles.noticeText}>
                  Proposals are reviewed before appearing in the app. Please check back in a few hours to see new categories.
                </Text>
              </View>
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
              {saving ? "Sending..." : "Submit proposal"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && !saving && styles.secondaryButtonPressed,
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

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
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
    marginRight: 12,
  },

  cardHeaderTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },

  cardBody: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },

  fieldBlock: {
    marginBottom: 14,
  },

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
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

  inputDisabled: {
    opacity: 0.7,
  },

  helperText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "right",
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

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
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
    fontWeight: "900",
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