import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../src/api/client';
import type { UserRole } from '../../src/types/auth';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('LEARNER');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    try {
      setLoading(true);
      await api.post('/auth/register', { email, password, role });
      Alert.alert('Success', 'Account created. Please log in.');
      router.replace('/(auth)/login');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        'Unknown error';
      Alert.alert('Register failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Register</Text>

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

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => setRole('LEARNER')}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: role === 'LEARNER' ? 'black' : 'white',
          }}
        >
          <Text style={{ textAlign: 'center', color: role === 'LEARNER' ? 'white' : 'black' }}>
            Learner
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setRole('TEACHER')}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: role === 'TEACHER' ? 'black' : 'white',
          }}
        >
          <Text style={{ textAlign: 'center', color: role === 'TEACHER' ? 'white' : 'black' }}>
            Teacher
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRegister}
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
          {loading ? 'Creating...' : 'Create account'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/(auth)/login')}>
        <Text style={{ textAlign: 'center' }}>Back to login</Text>
      </Pressable>
    </View>
  );
}
