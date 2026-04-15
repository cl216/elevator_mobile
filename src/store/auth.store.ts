import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { api } from "../api/client";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const HAS_TEACHER_PROFILE_KEY = "has_teacher_profile";

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  hasTeacherProfile: boolean;
  hydrated: boolean;
  isRefreshingToken: boolean;

  hydrate: () => Promise<void>;
  setAuth: (
    token: string,
    refreshToken: string,
    hasTeacherProfile: boolean,
  ) => Promise<void>;
  setHasTeacherProfile: (hasTeacherProfile: boolean) => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

let refreshPromise: Promise<string | null> | null = null;
let refreshMePromise: Promise<void> | null = null;
let lastRefreshMeAt = 0;

export const authStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  hasTeacherProfile: false,
  hydrated: false,
  isRefreshingToken: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    const hasTeacherProfileRaw = await SecureStore.getItemAsync(
      HAS_TEACHER_PROFILE_KEY,
    );

    set({
      token: token ?? null,
      refreshToken: refreshToken ?? null,
      hasTeacherProfile: hasTeacherProfileRaw === "true",
      hydrated: true,
    });
  },

  setAuth: async (token, refreshToken, hasTeacherProfile) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(
      HAS_TEACHER_PROFILE_KEY,
      hasTeacherProfile ? "true" : "false",
    );

    set({ token, refreshToken, hasTeacherProfile });
  },

  setHasTeacherProfile: async (hasTeacherProfile) => {
    await SecureStore.setItemAsync(
      HAS_TEACHER_PROFILE_KEY,
      hasTeacherProfile ? "true" : "false",
    );

    set({ hasTeacherProfile });
  },

  refreshMe: async () => {
    const token = get().token;
    if (!token) return;

    const now = Date.now();

    if (refreshMePromise) {
      return refreshMePromise;
    }

    if (now - lastRefreshMeAt < 30_000) {
      return;
    }

    lastRefreshMeAt = now;

    refreshMePromise = (async () => {
      try {
        const res = await api.get("/auth/me");
        const hasTeacherProfile = !!res.data?.hasTeacherProfile;

        await SecureStore.setItemAsync(
          HAS_TEACHER_PROFILE_KEY,
          hasTeacherProfile ? "true" : "false",
        );

        set({ hasTeacherProfile });
      } catch (e: any) {
        const status = e?.response?.status;

        if (status === 429) {
          console.warn("refreshMe rate-limited, skipping");
          return;
        }

        console.error("refreshMe failed", e);
      } finally {
        refreshMePromise = null;
      }
    })();

    return refreshMePromise;
  },

  refreshAccessToken: async () => {
    const state = get();

    if (refreshPromise) {
      return refreshPromise;
    }

    if (!state.refreshToken) {
      return null;
    }

    refreshPromise = (async () => {
      set({ isRefreshingToken: true });

      try {
        const res = await api.post("/auth/refresh", {
          refresh_token: state.refreshToken,
        });

        const nextAccessToken = res.data?.access_token;
        const nextRefreshToken = res.data?.refresh_token;
        const hasTeacherProfile = !!res.data?.user?.hasTeacherProfile;

        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error("Missing refreshed tokens");
        }

        await SecureStore.setItemAsync(TOKEN_KEY, nextAccessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefreshToken);
        await SecureStore.setItemAsync(
          HAS_TEACHER_PROFILE_KEY,
          hasTeacherProfile ? "true" : "false",
        );

        set({
          token: nextAccessToken,
          refreshToken: nextRefreshToken,
          hasTeacherProfile,
        });

        return nextAccessToken;
      } catch (e: any) {
        const status = e?.response?.status;

        if (status === 429) {
          console.warn("refreshAccessToken rate-limited, keeping current token");
          return get().token;
        }

        console.error("refreshAccessToken failed", e);
        await get().logout();
        return null;
      } finally {
        set({ isRefreshingToken: false });
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  logout: async () => {
    const token = get().token;

    try {
      if (token) {
        await api.post("/auth/logout");
      }
    } catch (e) {
      console.log("logout request failed", e);
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(HAS_TEACHER_PROFILE_KEY);

    set({
      token: null,
      refreshToken: null,
      hasTeacherProfile: false,
    });
  },
}));