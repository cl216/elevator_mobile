import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { authStore } from '../../src/store/auth.store';

export default function TeacherDashboard() {
  async function handleLogout() {
    await authStore.getState().logout();
    router.replace('/');
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '600' }}>
        Teacher Dashboard
      </Text>

      <Pressable
        onPress={handleLogout}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 10,
          backgroundColor: '#000',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}
