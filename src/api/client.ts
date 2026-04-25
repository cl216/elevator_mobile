import axios from "axios";
import { API_BASE_URL } from "./config";
import { authStore } from "../store/auth.store";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = authStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


api.interceptors.request.use((config) => {
  console.log("REQUEST URL DEBUG:", {
    baseURL: config.baseURL,
    url: config.url,
    full: `${config.baseURL}${config.url}`,
  });
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const url = String(originalRequest?.url || "");

    if (status === 429) {
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      const newToken = await authStore.getState().refreshAccessToken();

      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);