import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getClassById,
  updateClass,
} from "../../../../src/api/classes";
import { getApprovedCategories } from "../../../../src/api/categories";
import { uiToastStore } from "../../../../src/store/uiToast.store";

type ApprovedCategory = {
  id: string;
  slug: string;
  label: string;
};

export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [imageUrl3, setImageUrl3] = useState("");

  const [categories, setCategories] = useState<ApprovedCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [classData, categoryData] = await Promise.all([
          getClassById(String(id)),
          getApprovedCategories(),
        ]);

        if (!alive) return;

        setTitle(classData.title ?? "");
        setCategory(classData.category ?? "");
        setDescription(classData.description ?? "");
        setPrice(String(classData.price ?? ""));
        setImageUrl1(classData.image_url_1 ?? "");
        setImageUrl2(classData.image_url_2 ?? "");
        setImageUrl3(classData.image_url_3 ?? "");
        setCategories(categoryData);
      } catch (e: any) {
        console.error(e);
        Alert.alert("Error", "Could not load class.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingCategories(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

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

      await updateClass(String(id), {
        title: title.trim(),
        category,
        description: description.trim(),
        price: parsedPrice,
        image_url_1: imageUrl1.trim(),
        image_url_2: imageUrl2.trim(),
        image_url_3: imageUrl3.trim(),
      });

      uiToastStore.getState().showToast("Class updated");
      router.replace("/(teacher)/classes");
    } catch (e: any) {
      console.error(e);

      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not update class.";

      Alert.alert(
        "Class error",
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
        <Text style={{ marginTop: 10 }}>Loading class…</Text>
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
        <Text style={{ fontSize: 28, fontWeight: "900" }}>
          Edit class
        </Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Update your class details and gallery images.
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
          multiline
          placeholder="Tell learners what they’ll do in this class."
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
          keyboardType="numeric"
          placeholder="25"
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