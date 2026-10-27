import { Platform } from "react-native";
import Constants from "expo-constants";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

const host = Constants.expoConfig?.hostUri?.split(":")[0] || "172.20.10.4";

export const API_URL =
  configuredApiUrl ||
  (Platform.OS === "web" ? "http://localhost:3000" : `http://${host}:3000`);

export const USER_ID = 1;

export let NATIVE_LANGUAGE = "English";

export function setNativeLanguage(language) {
  if (typeof language === "string" && language) {
    NATIVE_LANGUAGE = language;
  }
}
