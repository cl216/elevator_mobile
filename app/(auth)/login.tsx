import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { authStore } from '../../src/store/auth.store';
import type { UserRole } from '../../src/types/auth';

// Decode JWT payload (base64url) in Expo Go without extra libs
function decodeJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');

  const payload = parts[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  const json = globalThis.atob(padded);
  return JSON.parse(json);
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);

      const res = await api.post('/auth/login', { email, password });
      const token: string | undefined = res.data?.access_token;

      if (!token) throw new Error('No access_token returned from /auth/login');

      const payload = decodeJwtPayload(token);
      const role: UserRole = payload?.role ?? 'LEARNER';

      await authStore.getState().setAuth(token, role);

      // Send user to the routing gate, which redirects based on role
      router.replace('/');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        'Unknown error';
      Alert.alert('Login failed', msg);
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

      <Pressable onPress={() => router.push('/(auth)/register')}>
        <Text style={{ textAlign: 'center' }}>Create an account</Text>
      </Pressable>
    </View>
  );
}
