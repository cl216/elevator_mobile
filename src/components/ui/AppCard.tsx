import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { APP_THEME } from "@/src/theme/appTheme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export function AppCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: APP_THEME.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    padding: 15,
    marginBottom: 14,
  },
});