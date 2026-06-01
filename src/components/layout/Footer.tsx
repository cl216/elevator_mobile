import { Ionicons } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { router, usePathname, useSegments } from "expo-router";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { authStore } from "@/src/store/auth.store";

const BLACK_BG = "#000000";
const NAV_HEIGHT = 68;
const LEARNER_BLUE = "#6F92FF";
const TEACHER_PURPLE = "#A855F7";
const WHITE = "#FFFFFF";
const BADGE_RED = "#F05A67";

type FooterProps = {
  unreadNotificationsCount?: number;
  upcomingBookingsCount?: number;
  teacherAttentionCount?: number;
};

export default function Footer({
  unreadNotificationsCount = 0,
  upcomingBookingsCount = 0,
  teacherAttentionCount = 0,
}: FooterProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const navigation = useNavigation();
  const navLockedRef = useRef(false);

  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);
  const segmentText = segments.join("/");

  const isMap = pathname.includes("/map") || segmentText.includes("map");

  const isBookings =
    pathname.includes("bookings") || segmentText.includes("bookings");

  const isTeacher =
    pathname.includes("/(teacher)") ||
    segmentText.includes("teacher") ||
    pathname.includes("dashboard");

  const accent = isTeacher ? TEACHER_PURPLE : LEARNER_BLUE;

  const formatBadgeCount = (count: number) => {
    if (count > 99) return "99+";
    return String(count);
  };

  const unlockNav = () => {
    setTimeout(() => {
      navLockedRef.current = false;
    }, 700);
  };

  const handleMapPress = () => {
    if (isMap || navLockedRef.current) return;

    navLockedRef.current = true;

    const isRequestClassModal =
      pathname.includes("request-class") ||
      segmentText.includes("request-class");

    if (isRequestClassModal && router.canGoBack()) {
      router.back();
      unlockNav();
      return;
    }

    navigation.dispatch((state) => {
      const mapIndex = state.routes.findIndex((route) => {
        const routeName = String(route.name);
        return routeName.includes("(learner)") && routeName.includes("map");
      });

if (mapIndex === -1) {
  safeReplace("/(learner)/map");
  return CommonActions.setParams({});
}

      return CommonActions.reset({
        ...state,
        index: mapIndex,
        routes: state.routes.slice(0, mapIndex + 1),
      });
    });

    unlockNav();
  };

  const handleBookingsPress = () => {
    if (isBookings || navLockedRef.current) return;

    navLockedRef.current = true;
    safePush("/(learner)/bookings");
    unlockNav();
  };

const handleTeachPress = () => {
  if (isTeacher || navLockedRef.current) return;

  navLockedRef.current = true;

  if (hasTeacherProfile) {
    safePush("/(teacher)/dashboard");
  } else {
    safePush("/(teacher)/profile");
  }

  unlockNav();
};

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: insets.bottom,
          height: NAV_HEIGHT + insets.bottom,
          borderTopColor: accent,
        },
      ]}
    >
<Pressable
  disabled={isTeacher}
  onPress={handleTeachPress}
  style={styles.footerItem}
>        <View style={styles.footerItemInner}>
          <View style={styles.footerIconWrap}>
            <Ionicons
              name={isTeacher ? "school" : "school-outline"}
              size={24}
              color={isTeacher ? accent : WHITE}
            />

            {teacherAttentionCount > 0 ? (
              <View style={styles.footerMiniBadge}>
                <Text style={styles.footerMiniBadgeText}>
                  {formatBadgeCount(teacherAttentionCount)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.footerLabel,
              isTeacher ? styles.activeLabel : null,
              isTeacher ? { color: accent } : null,
            ]}
          >
            Teach
          </Text>
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable disabled={isMap} onPress={handleMapPress} style={styles.footerItem}>
        <View style={styles.footerItemInner}>
          <Ionicons
            name={isMap ? "map" : "map-outline"}
            size={25}
            color={isMap ? accent : WHITE}
          />

          <Text
            style={[
              styles.footerLabel,
              isMap ? styles.activeLabel : null,
              isMap ? { color: accent } : null,
            ]}
          >
            Map
          </Text>
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable
        disabled={isBookings}
        onPress={handleBookingsPress}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <View style={styles.footerIconWrap}>
            <Ionicons
              name={isBookings ? "calendar" : "calendar-outline"}
              size={22}
              color={isBookings ? accent : WHITE}
            />

            {upcomingBookingsCount > 0 ? (
              <View style={styles.footerMiniBadge}>
                <Text style={styles.footerMiniBadgeText}>
                  {formatBadgeCount(upcomingBookingsCount)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.footerLabel,
              isBookings ? styles.activeLabel : null,
              isBookings ? { color: accent } : null,
            ]}
          >
            Bookings
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 4,
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

  footerIconWrap: {
    width: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  footerLabel: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    includeFontPadding: false,
  },

  activeLabel: {
    fontWeight: "900",
  },

  footerMiniBadge: {
    position: "absolute",
    top: -8,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: BADGE_RED,
    alignItems: "center",
    justifyContent: "center",
  },

  footerMiniBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
});