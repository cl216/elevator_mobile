import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { authStore } from '../src/store/auth.store';

export default function Index() {
  const [hydrated, setHydrated] = useState(authStore.getState().hydrated);
  const [token, setToken] = useState(authStore.getState().token);

  useEffect(() => {
    const unsub = authStore.subscribe((s) => {
      setHydrated(s.hydrated);
      setToken(s.token);
    });

    return () => unsub();
  }, []);

  if (!hydrated) return null;

  if (!token) return <Redirect href="/(auth)/login" />;

  return <Redirect href="/(learner)/map" />;
}