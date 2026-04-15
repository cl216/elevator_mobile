import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { authStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);

      const res = await api.post('/auth/login', { email, password });
      const token: string | undefined = res.data?.access_token;
      const hasTeacherProfile: boolean = !!res.data?.user?.hasTeacherProfile;

      if (!token) {
        throw new Error('No access_token returned from /auth/login');
      }

await authStore.getState().setAuth(
  res.data.access_token,
  res.data.refresh_token,
  !!res.data.user?.hasTeacherProfile,
);      await authStore.getState().refreshMe();

      router.replace('/');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        'Unknown error';

      const normalizedMsg = String(msg);

      if (normalizedMsg.includes('Please verify your email before logging in')) {
        Alert.alert(
          'Verify your email',
          'Please check your email for your verification link before logging in.',
          [
            {
              text: 'Resend verification',
              onPress: () =>
                router.push({
                  pathname: '/(auth)/verify-email',
                  params: { email },
                }),
            },
            { text: 'OK' },
          ],
        );
        return;
      }

      Alert.alert('Login failed', normalizedMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Login</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <Pressable
        onPress={onLogin}
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
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={{ textAlign: 'center' }}>Forgot password?</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/register')}>
        <Text style={{ textAlign: 'center' }}>Create an account</Text>
      </Pressable>
    </View>
  );
}