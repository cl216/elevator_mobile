import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";

const BLUE_BORDER = "#4E86FF";
const BLACK_BG = "#000000";
const TEXT_PRIMARY = "#F5F8FF";
const NAV_HEIGHT = 68;

function ElevatorLogoMini() {
  return (
    <View style={styles.logoMiniWrap}>
      <View style={styles.logoMiniBox}>
        <Text style={styles.logoMiniText}>▵</Text>
        <Text style={styles.logoMiniText}>▿</Text>
      </View>
    </View>
  );
}

export default function Header() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const lastSegment = segments[segments.length - 1];
  const isProfile = lastSegment === "profile";
  const isMap = lastSegment === "map";

  const handleHomePress = () => {
    if (isMap) return;
    router.push("/(learner)/map");
  };

  const handleMenuPress = () => {
    if (isProfile) return;
    router.push("/(learner)/profile");
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: NAV_HEIGHT + insets.top,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={handleHomePress} style={styles.headerSideButton}>
          <Ionicons name="home-outline" size={26} color="#FFFFFF" />
        </Pressable>

        <View pointerEvents="none" style={styles.headerCenter}>
          <ElevatorLogoMini />
          <Text style={styles.headerBrandText}>Elevator</Text>
        </View>

        <Pressable onPress={handleMenuPress} style={styles.headerSideButton}>
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 4,
    borderBottomColor: BLUE_BORDER,
    backgroundColor: BLACK_BG,
    paddingHorizontal: 10,
  },
  headerRow: {
    height: NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  headerCenter: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerSideButton: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrandText: {
    color: TEXT_PRIMARY,
    fontSize: 21,
    fontWeight: "900",
    fontStyle: "italic",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 22,
  },
  logoMiniWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoMiniBox: {
    width: 22,
    height: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  logoMiniText: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "900",
    includeFontPadding: false,
  },
});