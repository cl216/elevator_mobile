import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { authStore } from '../src/store/auth.store';

export default function Index() {
  const [hydrated, setHydrated] = useState(authStore.getState().hydrated);
  const [token, setToken] = useState(authStore.getState().token);
  const [role, setRole] = useState(authStore.getState().role);

  useEffect(() => {
    const unsub = authStore.subscribe((s) => {
      setHydrated(s.hydrated);
      setToken(s.token);
      setRole(s.role);
    });
    return () => unsub();
  }, []);

  if (!hydrated) return null;

  if (!token) return <Redirect href="/(auth)/login" />;

  if (role === 'TEACHER') return <Redirect href="/(teacher)/dashboard" />;

  return <Redirect href="/(learner)/map" />;
}
