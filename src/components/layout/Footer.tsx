import { Ionicons } from "@expo/vector-icons";
import { usePathname, useSegments } from "expo-router";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safePush, safeReplace } from "@/src/utils/safeRouter";

const BLUE_BORDER = "#4E86FF";
const BLACK_BG = "#000000";
const NAV_HEIGHT = 68;
const ACTIVE = "#6F92FF";
const WHITE = "#FFFFFF";
const BADGE_RED = "#F05A67";

type FooterProps = {
  unreadNotificationsCount?: number;
  upcomingBookingsCount?: number;
};

export default function Footer({
  unreadNotificationsCount = 0,
  upcomingBookingsCount = 0,
}: FooterProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const navLockedRef = useRef(false);

  const segmentText = segments.join("/");

  const isMap = pathname.includes("map") || segmentText.includes("map");
  const isNotifications =
    pathname.includes("notifications") || segmentText.includes("notifications");
  const isBookings =
    pathname.includes("bookings") || segmentText.includes("bookings");

  const navigate = (target: string, isActive: boolean) => {
    if (isActive || navLockedRef.current) return;

    navLockedRef.current = true;

    if (isMap) {
      safePush(target as any);
    } else {
      safeReplace(target as any);
    }

    setTimeout(() => {
      navLockedRef.current = false;
    }, 700);
  };

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
        disabled={isNotifications}
        onPress={() => navigate("/(learner)/notifications", isNotifications)}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <View style={styles.footerIconWrap}>
            <Ionicons
              name={isNotifications ? "notifications" : "notifications-outline"}
              size={24}
              color={isNotifications ? ACTIVE : WHITE}
            />

            {unreadNotificationsCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationsCount > 99
                    ? "99+"
                    : unreadNotificationsCount}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.footerLabel, isNotifications && styles.activeLabel]}>
            Notifications
          </Text>
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable
        disabled={isMap}
        onPress={() => navigate("/(learner)/map", isMap)}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <Ionicons
            name={isMap ? "map" : "map-outline"}
            size={24}
            color={isMap ? ACTIVE : WHITE}
          />
          <Text style={[styles.footerLabel, isMap && styles.activeLabel]}>
            Map
          </Text>
        </View>
      </Pressable>

      <View style={styles.footerDivider} />

      <Pressable
        disabled={isBookings}
        onPress={() => navigate("/(learner)/bookings", isBookings)}
        style={styles.footerItem}
      >
        <View style={styles.footerItemInner}>
          <View style={styles.footerIconWrap}>
            <Ionicons
              name={isBookings ? "calendar" : "calendar-outline"}
              size={22}
              color={isBookings ? ACTIVE : WHITE}
            />

            {upcomingBookingsCount > 0 ? (
              <View style={styles.footerMiniBadge}>
                <Text style={styles.footerMiniBadgeText}>
                  {upcomingBookingsCount > 99 ? "99+" : upcomingBookingsCount}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.footerLabel, isBookings && styles.activeLabel]}>
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
    color: ACTIVE,
    fontWeight: "900",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: BADGE_RED,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
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