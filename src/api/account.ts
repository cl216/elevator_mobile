import { api } from "./client";

export async function deleteMyAccount() {
  const { data } = await api.delete("/auth/me");
  return data;
}