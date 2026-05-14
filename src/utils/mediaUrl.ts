import { API_BASE_URL } from "@/src/config/api";

export function mediaUrl(path?: string | null) {
  if (!path) return null;

  const trimmed = path.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${API_BASE_URL}${trimmed}`;
  }

  return `${API_BASE_URL}/${trimmed}`;
}