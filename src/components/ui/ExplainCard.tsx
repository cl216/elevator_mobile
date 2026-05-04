import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ExplainCardProps = {
  title: string;
  body: React.ReactNode;
  ctaText?: string;
  onPressCta?: () => void;
  dismissText?: string;
  onDismiss?: () => void;
};

export function ExplainCard({
  title,
  body,
  ctaText,
  onPressCta,
  dismissText = "Got it",
  onDismiss,
}: ExplainCardProps) {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        padding: 18,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "rgba(111,146,255,0.13)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name="map-outline" size={26} color="#3F6AE0" />
      </View>

      <Text style={{ fontWeight: "900", fontSize: 22, marginBottom: 16 }}>
        {title}
      </Text>

      <View style={{ marginBottom: 16 }}>{body}</View>

      <View style={{ gap: 10 }}>
        {ctaText && onPressCta ? (
          <Pressable
            onPress={onPressCta}
            style={{
              backgroundColor: "#3F6AE0",
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>
              {ctaText}
            </Text>
          </Pressable>
        ) : null}

        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            style={{
              backgroundColor: "#3F6AE0",
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>
              {dismissText}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}