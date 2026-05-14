import React, { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import Header from "./Header";
import Footer from "./Footer";
import { getTeacherAttentionSummary } from "@/src/api/teacherAttention";
import { authStore } from "@/src/store/auth.store";

const BLACK_BG = "#000000";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasTeacherProfile = authStore((s) => s.hasTeacherProfile);
  const [teacherAttentionCount, setTeacherAttentionCount] = useState(0);

  const loadTeacherAttentionCount = useCallback(async () => {
    if (!hasTeacherProfile) {
      setTeacherAttentionCount(0);
      return;
    }

    try {
      const summary = await getTeacherAttentionSummary();
      setTeacherAttentionCount(Number(summary?.total_action_items ?? 0));
    } catch (e) {
      setTeacherAttentionCount(0);
    }
  }, [hasTeacherProfile]);

  useEffect(() => {
    void loadTeacherAttentionCount();
  }, [loadTeacherAttentionCount]);

  useFocusEffect(
    useCallback(() => {
      void loadTeacherAttentionCount();
    }, [loadTeacherAttentionCount]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadTeacherAttentionCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadTeacherAttentionCount]);

  return (
    <View style={styles.screen}>
      <Header />

      <View style={styles.content}>{children}</View>

      <Footer teacherAttentionCount={teacherAttentionCount} />
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
    backgroundColor: BLACK_BG,
  },
});