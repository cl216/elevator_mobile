import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { api, markApiLogoutFinished } from "../api/client";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const HAS_TEACHER_PROFILE_KEY = "has_teacher_profile";
const IS_ADMIN_KEY = "is_admin";
const IMAGE_URL_KEY = "user_image_url";

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  hasTeacherProfile: boolean;
  isAdmin: boolean;
  imageUrl: string | null;
  hydrated: boolean;
  isRefreshingToken: boolean;
  isLoggingOut: boolean;

  clearAuthLocalOnly: () => Promise<void>;
  hydrate: () => Promise<void>;
  setAuth: (
    token: string,
    refreshToken: string,
    hasTeacherProfile: boolean,
    isAdmin?: boolean,
    imageUrl?: string | null,
  ) => Promise<void>;
  setHasTeacherProfile: (hasTeacherProfile: boolean) => Promise<void>;
  setImageUrl: (imageUrl: string | null) => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

let refreshPromise: Promise<string | null> | null = null;
let refreshMePromise: Promise<void> | null = null;
let lastRefreshMeAt = 0;

async function clearStoredAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(HAS_TEACHER_PROFILE_KEY);
  await SecureStore.deleteItemAsync(IS_ADMIN_KEY);
  await SecureStore.deleteItemAsync(IMAGE_URL_KEY);
}

async function storeImageUrl(imageUrl: string | null) {
  if (imageUrl?.trim()) {
    await SecureStore.setItemAsync(IMAGE_URL_KEY, imageUrl.trim());
  } else {
    await SecureStore.deleteItemAsync(IMAGE_URL_KEY);
  }
}

export const authStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  hasTeacherProfile: false,
  isAdmin: false,
  imageUrl: null,
  hydrated: false,
  isRefreshingToken: false,
  isLoggingOut: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    const hasTeacherProfileRaw = await SecureStore.getItemAsync(
      HAS_TEACHER_PROFILE_KEY,
    );
    const isAdminRaw = await SecureStore.getItemAsync(IS_ADMIN_KEY);
    const imageUrl = await SecureStore.getItemAsync(IMAGE_URL_KEY);

    set({
      token: token ?? null,
      refreshToken: refreshToken ?? null,
      hasTeacherProfile: hasTeacherProfileRaw === "true",
      isAdmin: isAdminRaw === "true",
      imageUrl: imageUrl?.trim() || null,
      hydrated: true,
    });
  },

  setAuth: async (
    token,
    refreshToken,
    hasTeacherProfile,
    isAdmin = false,
    imageUrl = null,
  ) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(
      HAS_TEACHER_PROFILE_KEY,
      hasTeacherProfile ? "true" : "false",
    );
    await SecureStore.setItemAsync(IS_ADMIN_KEY, isAdmin ? "true" : "false");
    await storeImageUrl(imageUrl);

    set({
      token,
      refreshToken,
      hasTeacherProfile,
      isAdmin,
      imageUrl: imageUrl?.trim() || null,
      isLoggingOut: false,
    });

    markApiLogoutFinished();
  },

  setHasTeacherProfile: async (hasTeacherProfile) => {
    await SecureStore.setItemAsync(
      HAS_TEACHER_PROFILE_KEY,
      hasTeacherProfile ? "true" : "false",
    );

    set({ hasTeacherProfile });
  },

  setImageUrl: async (imageUrl) => {
    await storeImageUrl(imageUrl);
    set({ imageUrl: imageUrl?.trim() || null });
  },

  refreshMe: async () => {
    const token = get().token;
    if (!token || get().isLoggingOut) return;

    const now = Date.now();

    if (refreshMePromise) return refreshMePromise;
    if (now - lastRefreshMeAt < 30_000) return;

    lastRefreshMeAt = now;

    refreshMePromise = (async () => {
      try {
        const res = await api.get("/auth/me");
        const hasTeacherProfile = !!res.data?.hasTeacherProfile;
        const isAdmin = res.data?.is_admin === true;
        const imageUrl = res.data?.image_url?.trim?.() || null;

        await SecureStore.setItemAsync(
          HAS_TEACHER_PROFILE_KEY,
          hasTeacherProfile ? "true" : "false",
        );
        await SecureStore.setItemAsync(IS_ADMIN_KEY, isAdmin ? "true" : "false");
        await storeImageUrl(imageUrl);

        set({ hasTeacherProfile, isAdmin, imageUrl });
      } catch (e: any) {
        if (e?.response?.status === 429) {
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

    if (state.isLoggingOut) return null;
    if (refreshPromise) return refreshPromise;
    if (!state.refreshToken) return null;

    refreshPromise = (async () => {
      set({ isRefreshingToken: true });

      try {
        const res = await api.post("/auth/refresh", {
          refresh_token: state.refreshToken,
        });

        const nextAccessToken = res.data?.access_token;
        const nextRefreshToken = res.data?.refresh_token;
        const hasTeacherProfile = !!res.data?.user?.hasTeacherProfile;
        const isAdmin = res.data?.user?.is_admin === true;
        const imageUrl = res.data?.user?.image_url?.trim?.() || null;

        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error("Missing refreshed tokens");
        }

        await SecureStore.setItemAsync(TOKEN_KEY, nextAccessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefreshToken);
        await SecureStore.setItemAsync(
          HAS_TEACHER_PROFILE_KEY,
          hasTeacherProfile ? "true" : "false",
        );
        await SecureStore.setItemAsync(IS_ADMIN_KEY, isAdmin ? "true" : "false");
        await storeImageUrl(imageUrl);

        set({
          token: nextAccessToken,
          refreshToken: nextRefreshToken,
          hasTeacherProfile,
          isAdmin,
          imageUrl,
        });

        return nextAccessToken;
      } catch (e: any) {
        if (e?.response?.status === 429) {
          console.warn("refreshAccessToken rate-limited, keeping current token");
          return get().token;
        }

        console.error("refreshAccessToken failed", e);

        await clearStoredAuth();

        set({
          token: null,
          refreshToken: null,
          hasTeacherProfile: false,
          isAdmin: false,
          imageUrl: null,
          isLoggingOut: false,
        });

        markApiLogoutFinished();

        return null;
      } finally {
        set({ isRefreshingToken: false });
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  clearAuthLocalOnly: async () => {
    refreshPromise = null;
    refreshMePromise = null;

    await clearStoredAuth();

    set({
      token: null,
      refreshToken: null,
      hasTeacherProfile: false,
      isAdmin: false,
      imageUrl: null,
      isRefreshingToken: false,
      isLoggingOut: false,
    });

    markApiLogoutFinished();
  },

  logout: async () => {
    const token = get().token;

    set({
      token: null,
      refreshToken: null,
      hasTeacherProfile: false,
      isAdmin: false,
      imageUrl: null,
      isLoggingOut: true,
    });

    await clearStoredAuth();

    try {
      if (token) {
        await api.post(
          "/auth/logout",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
    } catch (e) {
      console.log("logout request failed", e);
    } finally {
      refreshPromise = null;
      refreshMePromise = null;

      set({
        isAdmin: false,
        imageUrl: null,
        isLoggingOut: false,
      });

      markApiLogoutFinished();
    }
  },
}));