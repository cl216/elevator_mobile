import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname, useSegments } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safePush } from "@/src/utils/safeRouter";
import { getMyNotifications } from "@/src/api/notifications";

const BLUE_BORDER = "#4E86FF";
const TEACHER_PURPLE = "#A855F7";
const BLACK_BG = "#000000";
const TEXT_PRIMARY = "#F5F8FF";
const NAV_HEIGHT = 68;
const BADGE_BLUE = "#4E86FF";

function ElevatorLogoMini({ accent }: { accent: string }) {
  return (
    <View style={[styles.logoBox, { borderColor: accent }]}>
      <Text style={styles.logoArrowUp}>△</Text>
      <Text style={styles.logoArrowDown}>▽</Text>
    </View>
  );
}

export default function Header() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const lastSegment = segments[segments.length - 1];

  const isNotifications =
    pathname.includes("notifications") ||
    segments.some((segment) => String(segment).includes("notifications"));

  const isTeacherRoute =
    pathname.includes("/(teacher)") ||
    segments.some((segment) => String(segment).includes("teacher"));

  const isLearnerProfile =
    pathname.includes("/(learner)/profile") ||
    (segments.some((segment) => String(segment).includes("learner")) &&
      lastSegment === "profile");

  const accent = isTeacherRoute ? TEACHER_PURPLE : BLUE_BORDER;

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const rows = await getMyNotifications();
      const unread = rows.filter((item) => !item.read).length;
      setUnreadNotificationsCount(unread);
    } catch (e) {
      console.log("loadUnreadNotificationsCount error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotificationsCount();
    }, [loadUnreadNotificationsCount]),
  );

  const handleNotificationsPress = () => {
    if (isNotifications) return;
    safePush("/(learner)/notifications");
  };

  const handleMenuPress = () => {
    if (isLearnerProfile) return;
    safePush("/(learner)/profile");
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: NAV_HEIGHT + insets.top,
          borderBottomColor: accent,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleNotificationsPress}
          style={styles.headerSideButton}
        >
          <View style={styles.notificationIconWrap}>
            <Ionicons
              name={isNotifications ? "notifications" : "notifications-outline"}
              size={26}
              color={isNotifications ? accent : "#FFFFFF"}
            />

            {unreadNotificationsCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 99
                    ? "99+"
                    : unreadNotificationsCount}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <View pointerEvents="none" style={styles.headerCenter}>
          <ElevatorLogoMini accent={accent} />

          <View style={styles.brandTextWrap}>
            <Text style={styles.headerBrandText}>Elevator</Text>

            {isTeacherRoute ? (
              <View style={styles.teacherBadge}>
                <Text style={styles.teacherBadgeText}>Teacher</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable onPress={handleMenuPress} style={styles.headerSideButton}>
          <Ionicons
            name="menu"
            size={26}
            color={isTeacherRoute ? TEACHER_PURPLE : "#FFFFFF"}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 4,
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

  brandTextWrap: {
    alignItems: "center",
    justifyContent: "center",
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

  teacherBadge: {
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(168,85,247,0.18)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.36)",
  },

  teacherBadgeText: {
    color: "#E9D5FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    includeFontPadding: false,
  },

  headerSideButton: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationIconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BADGE_BLUE,
    borderWidth: 2,
    borderColor: BLACK_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    includeFontPadding: false,
  },

  logoBox: {
    width: 30,
    height: 30,
    borderWidth: 1.4,
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