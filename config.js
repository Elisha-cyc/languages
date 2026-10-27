import { Platform } from "react-native";
import Constants from "expo-constants";

// On a phone, use the same address the Expo bundler uses (your PC on the Wi-Fi)
const host =
  Constants.expoConfig && Constants.expoConfig.hostUri
    ? Constants.expoConfig.hostUri.split(":")[0]
    : "172.20.10.4";

export const API_URL =
  Platform.OS === "web" ? "http://localhost:3000" : `http://${host}:3000`;

export const USER_ID = 1; // the server uses the logged-in user instead

// The language explanations are written in. It is set from the account after login.
export let NATIVE_LANGUAGE = "English";
export function setNativeLanguage(language) {
  if (typeof language === "string" && language) NATIVE_LANGUAGE = language;
}
