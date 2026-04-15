import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { api } from '../../src/api/client';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    try {
      setLoading(true);

      const res = await api.post('/auth/register', {
        first_name: firstName,
        email,
        password,
      });

      const message =
        res?.data?.message ??
        'Account created. Please check your email to verify your account.';

      const devVerificationUrl: string | undefined =
        res?.data?.dev_verification_url;

      if (devVerificationUrl) {
        Alert.alert('Check your email', message, [
          {
            text: 'Open verification link',
            onPress: async () => {
              try {
                await Linking.openURL(devVerificationUrl);
              } catch {
                Alert.alert(
                  'Could not open link',
                  `Open this manually:\n\n${devVerificationUrl}`,
                );
              }
            },
          },
          {
            text: 'Go to login',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]);
        return;
      }

      Alert.alert('Check your email', message, [
        {
          text: 'Go to login',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message?.toString?.() ??
        e?.message ??
        'Unknown error';

      Alert.alert('Register failed', String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Create account</Text>

      <Text style={{ opacity: 0.7, marginBottom: 4 }}>
        Start exploring classes now. You can become a teacher later.
      </Text>

      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

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