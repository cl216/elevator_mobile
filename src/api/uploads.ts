import { API_BASE_URL } from "../config/api";
import { authStore } from "../store/auth.store";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadImage(uri: string) {
  const filename = uri.split("/").pop() || `image-${Date.now()}.jpg`;

  const ext = filename.split(".").pop()?.toLowerCase();

  const type = ext === "png" ? "image/png" : "image/jpeg";

  const token = authStore.getState().token;

  console.log("UPLOAD URL:", `${API_BASE_URL}/uploads/image`);
  console.log("UPLOAD TOKEN EXISTS:", !!token);

  let lastError: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const formData = new FormData();

      formData.append("file", {
        uri,
        name: filename,
        type,
      } as any);

      console.log(`UPLOAD ATTEMPT ${attempt}`);

      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 20000);

      const res = await fetch(`${API_BASE_URL}/uploads/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `Image upload failed with HTTP ${res.status}`);
      }

      const data = JSON.parse(text);

      console.log("UPLOAD SUCCESS");

      return data.url as string;
    } catch (e: any) {
      lastError = e;

      console.error(`UPLOAD FAILED ATTEMPT ${attempt}`, e);

      if (attempt < 3) {
        await sleep(1200 * attempt);
      }
    }
  }

  throw lastError ?? new Error("Image upload failed");
}