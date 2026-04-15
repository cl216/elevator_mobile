import React, { useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { proposeCategory } from "../../src/api/categories";

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
        result?.message ?? "Your category proposal has been submitted for review.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not propose category.";

      Alert.alert(
        "Proposal error",
        Array.isArray(message) ? message.join("\n") : String(message)
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
      <Text style={{ fontSize: 28, fontWeight: "900" }}>
        Propose new category
      </Text>

      <Text style={{ marginTop: 8, opacity: 0.7 }}>
        Suggest a new category for the marketplace. It will stay hidden until approved.
      </Text>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Category name
        </Text>

        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Example: Fishing"
          maxLength={80}
          autoCapitalize="words"
          style={{
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fafafa",
          }}
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        style={{
          marginTop: 24,
          backgroundColor: saving ? "#666" : "black",
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "900" }}>
          {saving ? "Sending..." : "Submit proposal"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        disabled={saving}
        style={{
          marginTop: 12,
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