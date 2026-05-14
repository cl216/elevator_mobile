import AuthScreenShell, {
  AUTH_COLORS as COLORS,
} from "@/src/components/auth/AuthScreenShell";
import { authStyles as styles } from "@/src/components/auth/authStyles";
import { safeReplace } from "@/src/utils/safeRouter";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput } from "react-native";
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
          onPress: () => safeReplace("/(auth)/login"),
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
    <AuthScreenShell>
      <Text style={styles.title}>Reset password</Text>

      <Text style={styles.subtitle}>
        Choose a new password for your account.
      </Text>

      {!params.token ? (
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="sentences"
          placeholder="Reset token"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
        />
      ) : null}

      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="New password"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <Pressable
        onPress={handleResetPassword}
        disabled={loading}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Resetting..." : "Reset password"}
        </Text>
      </Pressable>

      <Pressable onPress={() => safeReplace("/(auth)/login")}>
        <Text style={styles.link}>Back to login</Text>
      </Pressable>
    </AuthScreenShell>
  );
}