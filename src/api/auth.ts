import { api } from "./client";

export async function deleteAccount() {
  const res = await api.post("/auth/delete-account");
  return res.data;
}

export async function uploadProfileImage(imageUri: string) {
  const formData = new FormData();

  formData.append("file", {
    uri: imageUri,
    name: "profile.jpg",
    type: "image/jpeg",
  } as any);

  const res = await api.post("/auth/profile-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}

export async function removeProfileImage() {
  const res = await api.delete("/auth/profile-image");
  return res.data;
}