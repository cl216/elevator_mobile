import { router } from "expo-router";
import { View, Text, Pressable } from "react-native";

export default function PaymentCancel() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "white",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "900", marginBottom: 16 }}>
        Payment cancelled
      </Text>

      <Text style={{ textAlign: "center", marginBottom: 30 }}>
        Your booking was not completed. You can try again anytime.
      </Text>

      <Pressable
        onPress={() => router.replace("/(learner)/map")}
        style={{
          backgroundColor: "black",
          paddingVertical: 14,
          paddingHorizontal: 22,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>
          Back to map
        </Text>
      </Pressable>
    </View>
  );
}