import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { uiToastStore } from "../../store/uiToast.store";

export function AppToast() {
  const { visible, message, type, hideToast } = uiToastStore();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -120,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start(() => {
          hideToast();
        });
      }, 2200);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [visible, translateY, opacity, hideToast]);

  if (!visible) return null;

  const backgroundColor =
    type === "success"
      ? "#111111"
      : type === "error"
        ? "#8B1E1E"
        : "#1F3A5F";

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 58,
        left: 16,
        right: 16,
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "800",
            fontSize: 15,
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}