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
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function onRegister() {
    const cleanEmail = email.trim().toLowerCase();

    if (!firstName.trim()) {
      Alert.alert("Missing first name", "Please enter your first name.");
      return;
    }

    if (!cleanEmail) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }

    if (!password) {
      Alert.alert("Missing password", "Please enter a password.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please enter the same password twice.",
      );
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/register", {
        first_name: firstName.trim(),
        email: cleanEmail,
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
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        placeholder="First name"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
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
        autoComplete="new-password"
        textContentType="newPassword"
        importantForAutofill="yes"
        placeholder="Password"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        importantForAutofill="yes"
        placeholder="Confirm password"
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