import axios from "axios";
import { API_BASE_URL } from "./config";
import { authStore } from "../store/auth.store";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<string | null> | null = null;
let isLoggingOut = false;

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

    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    if (url.includes("/auth/logout")) {
      isLoggingOut = true;
      return Promise.reject(error);
    }

    if (status === 429) {
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute &&
      !isLoggingOut
    ) {
      originalRequest._retry = true;

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
    }

    return Promise.reject(error);
  },
);

export function markApiLogoutFinished() {
  isLoggingOut = false;
}