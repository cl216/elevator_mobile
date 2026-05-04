import { api } from "./client";

export async function deleteAccount() {
  const res = await api.post("/auth/delete-account");
  return res.data;
}