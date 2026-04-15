import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { api } from '../../src/api/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleForgotPassword() {
    try {
      setLoading(true);

      const res = await api.post('/auth/forgot-password', {
        email,
      });

      const message =
        res?.data?.message ??
        'If an account exists for that email, a reset link has been sent.';

      const devResetUrl: string | undefined = res?.data?.dev_reset_url;

      if (devResetUrl) {
        Alert.alert('Check your email', message, [
          {
            text: 'Open reset link',
            onPress: async () => {
              try {
                await Linking.openURL(devResetUrl);
              } catch {
                Alert.alert(
                  'Could not open link',
                  `Open this manually:\n\n${devResetUrl}`,
                );
              }
            },
          },
          {
            text: 'Back to login',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]);
        return;
      }

      Alert.alert('Check your email', message, [
        {
          text: 'Back to login',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        'Unknown error';

      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>
        Forgot password
      </Text>

      <Text style={{ opacity: 0.7 }}>
        Enter your email and we&apos;ll send you a password reset link.
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
        onPress={handleForgotPassword}
        disabled={loading}
        style={{
          backgroundColor: 'black',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {loading ? 'Sending...' : 'Send reset link'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/(auth)/login')}>
        <Text style={{ textAlign: 'center' }}>Back to login</Text>
      </Pressable>
    </View>
  );
}