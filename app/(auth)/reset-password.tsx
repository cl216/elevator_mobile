import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { api } from "../../src/api/client";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    try {
      setLoading(true);

      const res = await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      const message = res?.data?.message ?? "Password reset successfully.";

      Alert.alert("Success", message, [
        {
          text: "Go to login",
          onPress: () => router.replace("/(auth)/login"),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        "Unknown error";

      Alert.alert("Reset failed", String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        Reset password
      </Text>

      <Text style={{ opacity: 0.7 }}>
        Choose a new password for your account.
      </Text>

      {!params.token ? (
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Reset token"
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />
      ) : null}

      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="New password"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <Pressable
        onPress={handleResetPassword}
        disabled={loading}
        style={{
          backgroundColor: "black",
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>
          {loading ? "Resetting..." : "Reset password"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/(auth)/login")}>
        <Text style={{ textAlign: "center" }}>Back to login</Text>
      </Pressable>
    </View>
  );
}