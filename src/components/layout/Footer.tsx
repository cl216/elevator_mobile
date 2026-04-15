import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const BLUE_BORDER = "#4E86FF";
const BLACK_BG = "#000000";
const NAV_HEIGHT = 68;

export default function Footer() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: insets.bottom,
          height: NAV_HEIGHT + insets.bottom,
        },
      ]}
    >
      <Pressable
        onPress={() => router.push("/(learner)/notifications")}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable
        onPress={() => router.push("/(teacher)/dashboard")}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <Ionicons name="school-outline" size={24} color="#FFFFFF" />
          <Text style={styles.footerLabel}>Teach</Text>
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable
        onPress={() => router.push("/(learner)/bookings")}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
          <Text style={styles.footerLabel}>Bookings</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 4,
    borderTopColor: BLUE_BORDER,
    backgroundColor: BLACK_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  footerItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  footerItemInner: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  footerLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    includeFontPadding: false,
  },
});