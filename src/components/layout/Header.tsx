import { Ionicons } from "@expo/vector-icons";
import { useSegments } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { authStore } from "@/src/store/auth.store";

const BLUE_BORDER = "#4E86FF";
const BLACK_BG = "#000000";
const TEXT_PRIMARY = "#F5F8FF";
const NAV_HEIGHT = 68;

function ElevatorLogoMini() {
  return (
    <View style={styles.logoBox}>
      <Text style={styles.logoArrowUp}>△</Text>
      <Text style={styles.logoArrowDown}>▽</Text>
    </View>
  );
}

export default function Header() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);

  const lastSegment = segments[segments.length - 1];
  const isProfile = lastSegment === "profile";

  // ✅ NEW: Teach button behavior (matches map screen)
  const handleTeachPress = () => {
    if (hasTeacherProfile) {
      safePush("/(teacher)/dashboard");
    } else {
      safePush("/(teacher)/profile");
    }
  };

  const handleMenuPress = () => {
    if (isProfile) return;
    safePush("/(learner)/profile");
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
        {/* ✅ LEFT: Teach instead of Map */}
        <Pressable onPress={handleTeachPress} style={styles.headerSideButton}>
          <Ionicons name="school-outline" size={26} color="#FFFFFF" />
        </Pressable>

        <View pointerEvents="none" style={styles.headerCenter}>
          <ElevatorLogoMini />
          <Text style={styles.headerBrandText}>Elevator</Text>
        </View>

        {/* RIGHT: Menu */}
        <Pressable onPress={handleMenuPress} style={styles.headerSideButton}>
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1.2, // 🔥 matches your newer screens (less harsh)
    borderBottomColor: "rgba(110,145,255,0.28)",
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
  gap: 9,
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],

},

headerBrandText: {
  color: TEXT_PRIMARY,
  fontSize: 22,
  fontWeight: "900",
  fontStyle: "italic",
  includeFontPadding: false,
  textAlignVertical: "center",
  lineHeight: 24,
  letterSpacing: -0.4,
},
  headerSideButton: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
logoBox: {
  width: 30,
  height: 30,
  borderWidth: 1.4,
  borderColor: "rgba(255,255,255,0.92)",
  borderRadius: 6,
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  
},

logoArrowUp: {
  position: "absolute",
  top: -1,
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "900",
  lineHeight: 14,
  transform: [{ scaleX: 1.25 }],
},

logoArrowDown: {
  position: "absolute",
  bottom: 1,
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "900",
  lineHeight: 14,
  transform: [{ scaleX: 1.25 }],
},
});