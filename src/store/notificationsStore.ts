import { create } from "zustand";
import type { AppNotification } from "../api/notifications";

type NotificationsState = {
  notifications: AppNotification[];
  setNotifications: (items: AppNotification[]) => void;
  markAllReadLocal: () => void;
  markOneReadLocal: (id: string) => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  setNotifications: (items) => set({ notifications: items }),

  markAllReadLocal: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({
        ...item,
        read: true,
      })),
    })),

  markOneReadLocal: (id) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),
}));

export function getUnreadNotificationsCount(
  notifications: AppNotification[],
) {
  return notifications.filter((item) => !item.read).length;
}