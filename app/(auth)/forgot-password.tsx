import AuthScreenShell, {
  AUTH_COLORS as COLORS,
} from "@/src/components/auth/AuthScreenShell";
import { authStyles as styles } from "@/src/components/auth/authStyles";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput } from "react-native";
import { api } from "../../src/api/client";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/forgot-password", {
        email: normalizedEmail,
      });

      const message =
        res?.data?.message ??
        "If an account exists for that email, a reset code has been sent.";

      Alert.alert("Check your email", message, [
        {
          text: "Enter code",
          onPress: () =>
            safePush({
              pathname: "/(auth)/reset-password",
              params: { email: normalizedEmail },
            }),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        "Unknown error";

      Alert.alert("Error", String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell>
      <Text style={styles.title}>Forgot password</Text>

      <Text style={styles.subtitle}>
        Enter your email and we&apos;ll send you a 6-digit reset code.
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

      <Pressable
        onPress={handleForgotPassword}
        disabled={loading}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending..." : "Send reset code"}
        </Text>
      </Pressable>

      <Pressable onPress={() => safeReplace("/(auth)/login")}>
        <Text style={styles.link}>Back to login</Text>
      </Pressable>
    </AuthScreenShell>
  );
}