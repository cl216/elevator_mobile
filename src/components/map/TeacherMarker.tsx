import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type Category = "music" | "art" | "other";

type Props = {
  avatarUrl?: string | null;
  category: Category;
  selected?: boolean;
  /** Call when layout/image is ready so parent can safely set tracksViewChanges=false */
  onReady?: () => void;
};

const AVATAR_SIZE = 48;
const BADGE_SIZE = 16;
const RING = 3;
// Root must be big enough to include the badge so react-native-maps bitmap snapshot won't clip.
const OUTER_SIZE = AVATAR_SIZE + RING * 2 + BADGE_SIZE + 10;

export function TeacherMarker({ avatarUrl, category, selected, onReady }: Props) {
  return (
    <View style={styles.outer} collapsable={false} onLayout={onReady}>
      <View style={[styles.ring, selected && styles.ringSelected]} collapsable={false}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            // ✅ Mapbox/Android: ensure deterministic fill + cropping
            style={styles.avatar}
            resizeMode="cover" // ✅
            onLoadEnd={onReady}
          />
        ) : (
          <View style={styles.fallback}>
            <MaterialCommunityIcons name={categoryIcon(category)} size={24} color="white" />
          </View>
        )}
      </View>

      {/* Category badge (kept INSIDE outer bounds — no negative offsets) */}
      <View style={styles.categoryBadge} collapsable={false}>
        <MaterialCommunityIcons name={categoryIcon(category)} size={10} color="#111" />
      </View>
    </View>
  );
}

function categoryIcon(category: Category) {
  switch (category) {
    case "music":
      return "music-note";
    case "art":
      return "palette";
    default:
      return "shape";
  }
}

const styles = StyleSheet.create({
  outer: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
  },

  ring: {
    width: AVATAR_SIZE + RING * 2,
    height: AVATAR_SIZE + RING * 2,
    borderRadius: 999,
    backgroundColor: "white",
    padding: RING,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    overflow: "hidden", // ✅ critical: clip avatar reliably
  },

  ringSelected: {
    transform: [{ scale: 1.12 }],
  },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
    backgroundColor: "#222",
  },

  fallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },

  categoryBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 0,
    borderColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
