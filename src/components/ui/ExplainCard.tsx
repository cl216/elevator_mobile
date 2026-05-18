import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ExplainCardProps = {
  title: string;
  body: React.ReactNode;
  ctaText?: string;
  onPressCta?: () => void;
  dismissText?: string;
  onDismiss?: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
};

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",
  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",
  borderStrong: "rgba(110,145,255,0.28)",
  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",
  button: "#3F6AE0",
};

export function ExplainCard({
  title,
  body,
  ctaText,
  onPressCta,
  dismissText = "Got it",
  onDismiss,
  iconName = "shield-checkmark-outline",
}: ExplainCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={iconName} size={24} color={COLORS.accent} />
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.bodyWrap}>
        {typeof body === "string" ? (
          <Text style={styles.bodyText}>{body}</Text>
        ) : (
          body
        )}
      </View>

      <View style={styles.buttonStack}>
        {ctaText && onPressCta ? (
          <Pressable
            onPress={onPressCta}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{ctaText}</Text>
          </Pressable>
        ) : null}

        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              ctaText && onPressCta
                ? styles.secondaryButton
                : styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={
                ctaText && onPressCta
                  ? styles.secondaryButtonText
                  : styles.primaryButtonText
              }
            >
              {dismissText}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 22,
  },

  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 16,
  },

  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },

  bodyWrap: {
    marginTop: 8,
    marginBottom: 20,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 21,
  },

  buttonStack: {
    gap: 12,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  secondaryButtonText: {
    color: COLORS.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },

  buttonPressed: {
    opacity: 0.88,
  },
});
