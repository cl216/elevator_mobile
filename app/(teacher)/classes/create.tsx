import React, { useEffect, useState } from "react";
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
import { getApprovedCategories } from "../../../src/api/categories";
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
    router.push("/(modal)/propose-category");
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
      router.replace("/(teacher)/classes");
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
          Create a reusable class template like Watercolour Basics or Intro to
          Guitar.
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
            <Text style={{ marginBottom: 12 }}>
              No approved categories are available yet.
            </Text>

            <Pressable
              onPress={loadCategories}
              style={{
                backgroundColor: "black",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                Try again
              </Text>
            </Pressable>
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
                Propose new category
              </Text>
            </Pressable>

            <Text style={{ marginTop: 8, opacity: 0.65 }}>
              New categories are reviewed before they can be used in classes and
              filters.
            </Text>
          </>
        )}
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

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Image 1 URL
        </Text>
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Image 2 URL
        </Text>
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
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>
          Image 3 URL
        </Text>
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

        <Text style={{ marginTop: 8, opacity: 0.65 }}>
          Add up to 3 image URLs for the class gallery shown to learners.
        </Text>
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

      <Pressable
        onPress={handleSave}
        disabled={saving || loadingCategories || categories.length === 0}
        style={{
          backgroundColor:
            saving || loadingCategories || categories.length === 0
              ? "#666"
              : "black",
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