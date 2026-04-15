import React from "react";
import { Pressable, Text, View } from "react-native";

type ExplainCardProps = {
  title: string;
  body: string;
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        padding: 14,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontWeight: "800", marginBottom: 6 }}>
        {title}
      </Text>

      <Text style={{ opacity: 0.75, lineHeight: 20, marginBottom: 12 }}>
        {body}
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {ctaText && onPressCta ? (
          <Pressable
            onPress={onPressCta}
            style={{
              backgroundColor: "black",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>
              {ctaText}
            </Text>
          </Pressable>
        ) : null}

        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: "white",
            }}
          >
            <Text style={{ fontWeight: "800" }}>
              {dismissText}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}