import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput } from "react-native";
import { api } from "../../src/api/client";
import { safeReplace } from "@/src/utils/safeRouter";
import AuthScreenShell, {
  AUTH_COLORS as COLORS,
} from "@/src/components/auth/AuthScreenShell";
import { authStyles as styles } from "@/src/components/auth/authStyles";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleForgotPassword() {
    try {
      setLoading(true);

      const res = await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });

      const message =
        res?.data?.message ??
        "If an account exists for that email, a reset link has been sent.";

      const devResetUrl: string | undefined = res?.data?.dev_reset_url;

      if (devResetUrl) {
        Alert.alert("Check your email", message, [
          {
            text: "Open reset link",
            onPress: async () => {
              try {
                await Linking.openURL(devResetUrl);
              } catch {
                Alert.alert(
                  "Could not open link",
                  `Open this manually:\n\n${devResetUrl}`,
                );
              }
            },
          },
          {
            text: "Back to login",
            onPress: () => safeReplace("/(auth)/login"),
          },
        ]);
        return;
      }

      Alert.alert("Check your email", message, [
        {
          text: "Back to login",
          onPress: () => safeReplace("/(auth)/login"),
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
        Enter your email and we&apos;ll send you a password reset link.
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
          {loading ? "Sending..." : "Send reset link"}
        </Text>
      </Pressable>

      <Pressable onPress={() => safeReplace("/(auth)/login")}>
        <Text style={styles.link}>Back to login</Text>
      </Pressable>
    </AuthScreenShell>
  );
}