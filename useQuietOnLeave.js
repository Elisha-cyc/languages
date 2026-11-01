import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Runs `stop` whenever the screen loses focus (the user opens another page or
// tab) and, on the web, when the browser tab is hidden. Screens that are only
// covered by another page are NOT unmounted, so a normal "on unmount" cleanup
// is not enough to stop speech or the microphone.
//
// Returns a ref that is true only while this screen is in front, so late
// answers (e.g. an AI reply that arrives after you left) can skip speaking.
export function useQuietOnLeave(stop) {
  const stopRef = useRef(stop);
  stopRef.current = stop; // always the latest version
  const focused = useRef(true);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        stopRef.current();
      };
    }, []),
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) stopRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return focused;
}
