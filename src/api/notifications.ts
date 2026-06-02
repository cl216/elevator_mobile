import { api } from "./client";

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  payload?: any;
  read: boolean;
  created_at: string;
};

export async function getMyNotifications() {
  const { data } = await api.get("/notifications");
  return data as AppNotification[];
}

export async function markAllNotificationsRead() {
  const { data } = await api.post("/notifications/read-all");
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await api.post("/notifications/read-one", {
    notificationId,
  });
  return data;
}
export async function deleteNotification(notificationId: string) {
  const res = await api.delete(`/notifications/${notificationId}`);
  return res.data;
}

export async function clearNotifications() {
  const res = await api.delete("/notifications");
  return res.data;
}