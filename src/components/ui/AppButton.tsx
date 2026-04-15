import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { APP_THEME } from "@/src/theme/appTheme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
}: Props) {
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        pressed && (isSecondary ? styles.secondaryPressed : styles.primaryPressed),
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: APP_THEME.buttonBg,
    borderWidth: 1,
    borderColor: APP_THEME.buttonBorder,
  },
  primaryPressed: {
    backgroundColor: APP_THEME.buttonPressed,
  },
  secondary: {
    backgroundColor: APP_THEME.destructiveBg,
    borderWidth: 1,
    borderColor: APP_THEME.destructiveBorder,
  },
  secondaryPressed: {
    backgroundColor: APP_THEME.destructivePressed,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});