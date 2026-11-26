import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

/** Asks for permission, gets an Expo push token and registers it with the API. Returns a message for the user. */
export async function registerForPush(): Promise<string> {
  if (Platform.OS === "web") return "Push notifications are available in the Android and iOS apps.";
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return "Notifications are off. You can turn them on later in your phone's settings.";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.DEFAULT });
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return "Permission granted. Push delivery needs an EAS project ID in app.json before tokens can be issued (see docs/MOBILE.md).";
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.raw("POST", "/v1/me/push-tokens", { token, platform: Platform.OS });
    return "Notifications are on for this device.";
  } catch { return "Could not register this device for notifications. Try again later."; }
}
