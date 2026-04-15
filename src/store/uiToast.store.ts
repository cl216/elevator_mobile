import { create } from "zustand";

type ToastType = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
};

export const uiToastStore = create<ToastState>((set) => ({
  visible: false,
  message: "",
  type: "success",
  showToast: (message, type = "success") =>
    set({
      visible: true,
      message,
      type,
    }),
  hideToast: () =>
    set({
      visible: false,
      message: "",
      type: "success",
    }),
}));