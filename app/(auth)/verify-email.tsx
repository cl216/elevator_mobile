import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { api } from "../../src/api/client";

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
              onPress: () => router.replace("/(auth)/login"),
            },
          ]
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
        email,
      });

      const message =
        res?.data?.message ??
        "If an account exists for that email, a verification link has been sent.";

      Alert.alert("Check your email", message, [
        {
          text: "Back to login",
          onPress: () => router.replace("/(auth)/login"),
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
      <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: "700" }}>
          Verifying email
        </Text>

        <Text style={{ opacity: 0.7 }}>
          Please wait while we verify your email.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        Verify your email
      </Text>

      <Text style={{ opacity: 0.7 }}>
        Enter your email and we&apos;ll resend your verification link.
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <Pressable
        onPress={handleResendVerification}
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
          {loading ? "Sending..." : "Resend verification email"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/(auth)/login")}>
        <Text style={{ textAlign: "center" }}>Back to login</Text>
      </Pressable>
    </View>
  );
}