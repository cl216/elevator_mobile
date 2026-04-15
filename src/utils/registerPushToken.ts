import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function registerPushToken(authToken: string) {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing Expo projectId");
  }

if (Platform.OS === "android") {
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const pushToken = tokenResponse.data;

  console.log("Expo push token:", pushToken);

  if (!API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_API_URL");
  }

  const response = await fetch(`${API_BASE_URL}/notifications/devices/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to register push token: ${response.status} ${text}`);
  }

  return pushToken;
}