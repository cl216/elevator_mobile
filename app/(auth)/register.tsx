import AuthScreenShell, {
  AUTH_COLORS as COLORS,
} from "@/src/components/auth/AuthScreenShell";
import { authStyles as styles } from "@/src/components/auth/authStyles";
import { safeReplace } from "@/src/utils/safeRouter";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput } from "react-native";
import { api } from "../../src/api/client";

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    try {
      setLoading(true);

      const res = await api.post("/auth/register", {
        first_name: firstName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      const message =
        res?.data?.message ??
        "Account created. Please check your email to verify your account.";

      const devVerificationUrl: string | undefined =
        res?.data?.dev_verification_url;

      if (devVerificationUrl) {
        Alert.alert("Check your email", message, [
          {
            text: "Open verification link",
            onPress: async () => {
              try {
                await Linking.openURL(devVerificationUrl);
              } catch {
                Alert.alert(
                  "Could not open link",
                  `Open this manually:\n\n${devVerificationUrl}`,
                );
              }
            },
          },
          {
            text: "Go to login",
            onPress: () => safeReplace("/(auth)/login"),
          },
        ]);
        return;
      }

      Alert.alert("Check your email", message, [
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

      Alert.alert("Register failed", String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell>
      <Text style={styles.title}>Create account</Text>

      <Text style={styles.subtitle}>
        Start exploring classes now. You can become a teacher later.
      </Text>

      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="sentences"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <Pressable
        onPress={onRegister}
        disabled={loading}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "Create account"}
        </Text>
      </Pressable>

      <Pressable onPress={() => safeReplace("/(auth)/login")}>
        <Text style={styles.link}>Back to login</Text>
      </Pressable>
    </AuthScreenShell>
  );
}