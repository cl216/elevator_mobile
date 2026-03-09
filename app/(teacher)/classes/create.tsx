import React, { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createClass } from "../../../src/api/classes";

const CATEGORY_OPTIONS = [
  "art",
  "music",
  "cooking",
  "language",
  "crafts",
] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

export default function CreateClassScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryOption>("art");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsedPrice = Number(price);

    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a class title.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return;
    }

    try {
      setSaving(true);

      await createClass({
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: parsedPrice,
      });

      Alert.alert("Class created", "Your class has been created.", [
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
        "Could not create class.";

      Alert.alert(
        "Class error",
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
        <Text style={{ fontSize: 28, fontWeight: "900" }}>
          Create class
        </Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Create a reusable class template like Watercolour Basics or Intro to Guitar.
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORY_OPTIONS.map((option) => {
            const selected = category === option;

            return (
              <Pressable
                key={option}
                onPress={() => setCategory(option)}
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
                    textTransform: "capitalize",
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell learners what they’ll do in this class and who it’s for."
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

      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Price (€)
        </Text>
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
            Save class
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