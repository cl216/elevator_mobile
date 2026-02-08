import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { UserRole } from '../types/auth';

const TOKEN_KEY = 'auth_token';
const ROLE_KEY = 'auth_role';

type AuthState = {
  token: string | null;
  role: UserRole | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setAuth: (token: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

export const authStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  hydrated: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const role = (await SecureStore.getItemAsync(ROLE_KEY)) as UserRole | null;
    set({ token: token ?? null, role: role ?? null, hydrated: true });
  },

  setAuth: async (token, role) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(ROLE_KEY, role);
    set({ token, role });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(ROLE_KEY);
    set({ token: null, role: null });
  },
}));
