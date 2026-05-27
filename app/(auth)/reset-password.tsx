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
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!normalizedEmail) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }

    if (trimmedCode.length !== 6) {
      Alert.alert("Code required", "Please enter the 6-digit reset code.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        "Password too short",
        "Your new password must be at least 8 characters.",
      );
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/reset-password", {
        email: normalizedEmail,
        code: trimmedCode,
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
        Enter the 6-digit code from your email and choose a new password.
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6-digit code"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

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