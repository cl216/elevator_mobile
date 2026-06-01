import AuthScreenShell from "@/src/components/auth/AuthScreenShell";
import { safePush, safeReplace } from "@/src/utils/safeRouter";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { authStore } from "../../src/store/auth.store";

const COLORS = {
  bg: "#05070F",
  surfaceSoft: "#121A2C",
  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",
  border: "rgba(110,145,255,0.28)",
  button: "#3F6AE0",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Missing password", "Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email: cleanEmail,
        password,
      });

      if (!res.data?.access_token || !res.data?.refresh_token) {
        throw new Error("Missing auth tokens from /auth/login");
      }

  await authStore.getState().setAuth(
  res.data.access_token,
  res.data.refresh_token,
  !!res.data.user?.hasTeacherProfile,
  res.data.user?.is_admin === true,
  res.data.user?.image_url ?? null,
);

      await authStore.getState().refreshMe();

      safeReplace("/");
    } catch (e: any) {
      const rawMessage = e?.response?.data?.message ?? e?.message ?? "Login failed.";
      const message = Array.isArray(rawMessage)
        ? rawMessage.join("\n")
        : String(rawMessage);

      if (message.includes("Please verify your email before logging in")) {
        Alert.alert(
          "Verify your email",
          "Please check your email for your verification link before logging in.",
          [
            {
              text: "Resend verification",
              onPress: () =>
                safePush({
                  pathname: "/(auth)/verify-email",
                  params: { email: cleanEmail },
                }),
            },
            { text: "OK" },
          ],
        );
        return;
      }

      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
        <AuthScreenShell>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>

<TextInput
  value={email}
  onChangeText={setEmail}
  autoCapitalize="none"
  autoCorrect={false}
  keyboardType="email-address"
  autoComplete="email"
  textContentType="username"
  importantForAutofill="yes"
  placeholder="Email"
  placeholderTextColor={COLORS.textMuted}
  style={styles.input}
/>

<TextInput
  value={password}
  onChangeText={setPassword}
  secureTextEntry
  autoCapitalize="none"
  autoCorrect={false}
  autoComplete="password"
  textContentType="password"
  importantForAutofill="yes"
  placeholder="Password"
  placeholderTextColor={COLORS.textMuted}
  style={styles.input}
/>

        <Pressable
          onPress={onLogin}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {loading ? "Logging in..." : "Login"}
          </Text>
        </Pressable>

        <Pressable onPress={() => safePush("/(auth)/forgot-password")}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>

        <Pressable onPress={() => safePush("/(auth)/register")}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>
        </AuthScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  link: {
    color: COLORS.textSoft,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 6,
  },
});