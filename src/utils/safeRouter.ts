// src/utils/safeRouter.ts
import { router } from "expo-router";

let isNavigating = false;

export function safePush(path: Parameters<typeof router.push>[0]) {
  if (isNavigating) return;

  isNavigating = true;
  router.push(path);

  setTimeout(() => {
    isNavigating = false;
  }, 700);
}

export function safeReplace(path: Parameters<typeof router.replace>[0]) {
  if (isNavigating) return;

  isNavigating = true;
  router.replace(path);

  setTimeout(() => {
    isNavigating = false;
  }, 700);
}