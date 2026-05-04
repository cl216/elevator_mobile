import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput } from "react-native";
import { api } from "../../src/api/client";
import { safeReplace } from "@/src/utils/safeRouter";
import AuthScreenShell, {
  AUTH_COLORS as COLORS,
} from "@/src/components/auth/AuthScreenShell";
import { authStyles as styles } from "@/src/components/auth/authStyles";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(!!params.token);

  useEffect(() => {
    if (!params.token) return;

    let active = true;

    (async () => {
      try {
        setVerifyingToken(true);

        const res = await api.post("/auth/verify-email", {
          token: params.token,
        });

        if (!active) return;

        Alert.alert(
          "Email verified",
          res?.data?.message ?? "Your email has been verified.",
          [
            {
              text: "Go to login",
              onPress: () => safeReplace("/(auth)/login"),
            },
          ],
        );
      } catch (e: any) {
        if (!active) return;

        const msg =
          e?.response?.data?.message?.toString?.() ??
          e?.message ??
          "Verification failed";

        Alert.alert("Verification failed", String(msg));
      } finally {
        if (active) {
          setVerifyingToken(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [params.token]);

  async function handleResendVerification() {
    try {
      setLoading(true);

      const res = await api.post("/auth/send-verification", {
        email: email.trim().toLowerCase(),
      });

      const message =
        res?.data?.message ??
        "If an account exists for that email, a verification link has been sent.";

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
        "Could not send verification email";

      Alert.alert("Error", String(msg));
    } finally {
      setLoading(false);
    }
  }

  if (verifyingToken) {
    return (
      <AuthScreenShell>
        <Text style={styles.title}>Verifying email</Text>
        <Text style={styles.subtitle}>
          Please wait while we verify your email.
        </Text>
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell>
      <Text style={styles.title}>Verify your email</Text>

      <Text style={styles.subtitle}>
        Enter your email and we&apos;ll resend your verification link.
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
        onPress={handleResendVerification}
        disabled={loading}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending..." : "Resend verification email"}
        </Text>
      </Pressable>

      <Pressable onPress={() => safeReplace("/(auth)/login")}>
        <Text style={styles.link}>Back to login</Text>
      </Pressable>
    </AuthScreenShell>
  );
}