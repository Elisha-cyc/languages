import { useRef, useState, useEffect } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { API_URL } from "./config";
import { appendAsset } from "./upload";
import { canListen, listenOnce } from "./listen";

const native = Platform.OS !== "web";
const MAX_SECONDS = 20;

// On the web the recorder is not needed, so this stays a plain no-op there
const useRecorder = native
  ? () => useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  : () => null;

export function useVoice(language) {
  const recorder = useRecorder();
  const [state, setState] = useState("idle"); // idle, listening, working
  const stopWeb = useRef(null);
  const active = useRef(null); // the callbacks of the current listening
  const timer = useRef(null);

  const available = native || canListen();

  useEffect(() => () => cancel(), []);

  function cancel() {
    clearTimeout(timer.current);
    if (stopWeb.current) stopWeb.current();
    stopWeb.current = null;
    if (native && active.current && recorder) {
      try {
        recorder.stop();
      } catch (e) {
        // already stopped
      }
    }
    active.current = null;
    setState("idle");
  }

  async function startNative(callbacks) {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          "The microphone is blocked. Allow it for this app in the phone settings.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = callbacks;
      setState("listening");
      timer.current = setTimeout(stopNative, MAX_SECONDS * 1000);
    } catch (e) {
      callbacks.onError &&
        callbacks.onError(e.message || "Could not start the microphone.");
      callbacks.onEnd && callbacks.onEnd();
      setState("idle");
    }
  }

  async function stopNative() {
    clearTimeout(timer.current);
    const callbacks = active.current;
    if (!callbacks) return;
    setState("working");

    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const uri = recorder.uri;
      if (!uri) throw new Error("Nothing was recorded. Try again.");

      const form = new FormData();
      form.append("language", language); // text fields first, then the file
      await appendAsset(form, "audio", { uri }, "speech.m4a", "audio/m4a");

      const res = await fetch(`${API_URL}/speech/transcribe`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not understand the recording.");
      callbacks.onText && callbacks.onText(data.text);
    } catch (e) {
      callbacks.onError &&
        callbacks.onError(e.message || "Voice input failed.");
    } finally {
      active.current = null;
      setState("idle");
      callbacks.onEnd && callbacks.onEnd();
    }
  }

  // Tap once to start. On the phone, tap again to stop. In Chrome it stops by itself.
  function toggle({ onText, onError, onEnd }) {
    if (native) {
      if (state === "listening") return stopNative();
      if (state !== "idle") return;
      return startNative({ onText, onError, onEnd });
    }

    if (state === "listening") {
      if (stopWeb.current) stopWeb.current();
      return;
    }
    if (state !== "idle") return;

    setState("listening");
    stopWeb.current = listenOnce(language, {
      onResult: (heard) => onText && onText(heard),
      onError: (message) => onError && onError(message),
      onEnd: () => {
        stopWeb.current = null;
        setState("idle");
        onEnd && onEnd();
      },
    });
  }

  return { available, state, toggle, cancel };
}
