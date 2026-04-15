import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { APP_THEME } from "@/src/theme/appTheme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
};

export function AppScreen({ children, scroll = true }: Props) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, styles.content]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
});