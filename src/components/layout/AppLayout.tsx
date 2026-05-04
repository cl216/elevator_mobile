import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "./Header";
import Footer from "./Footer";

const BLACK_BG = "#000000";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <Header />

      <View
        style={[
          styles.content,
          {
           
          },
        ]}
      >
        {children}
      </View>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK_BG,
  },
  content: {
    flex: 1,
        backgroundColor: "#000000",
  },
});