import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

import { getApprovedCategories } from "../../../src/api/categories";
import { createClass } from "../../../src/api/classes";
import { uiToastStore } from "../../../src/store/uiToast.store";

type ApprovedCategory = {
  id: string;
  slug: string;
  label: string;
};

export default function CreateClassScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");

  const [categories, setCategories] = useState<ApprovedCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [imageUrl3, setImageUrl3] = useState("");

  const [saving, setSaving] = useState(false);

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

  function handleProposeCategory() {
    safePush("/(modal)/propose-category");
  }

  async function handleSave() {
    const parsedPrice = Number(price);

    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a class title.");
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

    try {
      setSaving(true);

      await createClass({
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: parsedPrice,
        image_url_1: imageUrl1.trim() || undefined,
        image_url_2: imageUrl2.trim() || undefined,
        image_url_3: imageUrl3.trim() || undefined,
      });

      uiToastStore.getState().showToast("Class created");
      safeReplace("/(teacher)/classes");
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

      {/* TITLE */}
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

      {/* CATEGORY */}
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
        ) : (
          <>
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

            {/* ALWAYS SHOW THIS */}
            <Pressable
              onPress={handleProposeCategory}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: "white",
              }}
            >
              <Text style={{ fontWeight: "800" }}>
                Suggest new category
              </Text>
            </Pressable>

            <Text style={{ marginTop: 8, opacity: 0.65 }}>
              Suggestions are reviewed before being added to the platform.
            </Text>
          </>
        )}
      </View>

      {/* DESCRIPTION */}
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

      {/* PRICE */}
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

      {/* SAVE */}
      <Pressable
        onPress={handleSave}
        disabled={saving || loadingCategories}
        style={{
          backgroundColor:
            saving || loadingCategories ? "#666" : "black",
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

      {/* CANCEL */}
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