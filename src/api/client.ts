import axios from "axios";
import { router } from "expo-router";
import { API_BASE_URL } from "./config";
import { authStore } from "../store/auth.store";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<string | null> | null = null;
let isLoggingOut = false;
let hasRedirectedToLogin = false;

async function forceLogoutAndRedirect() {
  if (hasRedirectedToLogin) return;

  hasRedirectedToLogin = true;
  isLoggingOut = true;

  try {
    await authStore.getState().logout?.();
  } catch (e) {
    console.log("forceLogoutAndRedirect logout error", e);
  } finally {
    refreshPromise = null;
    router.replace("/(auth)/login");

    setTimeout(() => {
      isLoggingOut = false;
      hasRedirectedToLogin = false;
    }, 1000);
  }
}

api.interceptors.request.use((config) => {
  const token = authStore.getState().token;

  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const url = String(originalRequest?.url || "");

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isLoginOrRegisterRoute =
      url.includes("/auth/login") || url.includes("/auth/register");

    const isRefreshRoute = url.includes("/auth/refresh");
    const isLogoutRoute = url.includes("/auth/logout");

    if (isLogoutRoute) {
      return Promise.reject(error);
    }

    if (status === 429) {
      return Promise.reject(error);
    }

    if (status === 401 && isRefreshRoute) {
      await forceLogoutAndRedirect();
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      !originalRequest._retry &&
      !isLoginOrRegisterRoute &&
      !isLoggingOut
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = authStore
            .getState()
            .refreshAccessToken()
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise;

        if (newToken && !isLoggingOut) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        await forceLogoutAndRedirect();
      } catch (e) {
        await forceLogoutAndRedirect();
      }
    }

    return Promise.reject(error);
  },
);

export function markApiLogoutFinished() {
  isLoggingOut = false;
}