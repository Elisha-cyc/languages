import { Platform } from "react-native";
import Constants from "expo-constants";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";

// The API carries bearer tokens, so production builds must never silently
// fall back to an unencrypted LAN address or accept an HTTP endpoint.
if (isProduction && !configuredApiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL must be set for production builds.");
}

if (isProduction && !/^https:\/\//i.test(configuredApiUrl)) {
  throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production.");
}

const host = Constants.expoConfig?.hostUri?.split(":")[0] || "172.20.10.4";

export const API_URL =
  configuredApiUrl ||
  (Platform.OS === "web"
    ? `http://${window.location.hostname}:3000`
    : `http://${host}:3000`);

export const USER_ID = 1;

export let NATIVE_LANGUAGE = "";

export function setNativeLanguage(language) {
  if (typeof language === "string" && language) {
    NATIVE_LANGUAGE = language;
  }
}
