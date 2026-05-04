import { api } from "./client";

export async function uploadImage(uri: string) {
  const filename = uri.split("/").pop() || `image-${Date.now()}.jpg`;
  const ext = filename.split(".").pop()?.toLowerCase();

  const type =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    "image/jpeg";

  const formData = new FormData();

  formData.append("file", {
    uri,
    name: filename,
    type,
  } as any);

  const res = await api.post("/uploads/image", formData, {
    timeout: 60000,
    transformRequest: (data) => data,
  });

  return res.data.url as string;
}