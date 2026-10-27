import { Platform } from "react-native";
import { languageCode } from "./speech";

// Languages written without spaces between words are compared letter by letter
const CHARACTER_LANGUAGES = new Set(["Mandarin Chinese", "Japanese", "Thai"]);

function getRecognition() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// True where the device can turn speech into text (Chrome on the web, for now)
export function canListen() {
  return getRecognition() !== null;
}

const ERRORS = {
  "not-allowed":
    "The microphone is blocked. Allow it for this site in the browser settings.",
  "service-not-allowed":
    "The microphone is blocked. Allow it for this site in the browser settings.",
  "no-speech":
    "I did not hear anything. Try again a little closer to the microphone.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection in this browser.",
  aborted: null,
};

// Listens once and gives back the words it heard
export function listenOnce(language, { onResult, onError, onEnd }) {
  const Recognition = getRecognition();
  if (!Recognition) {
    onError && onError("Voice input is not available here.");
    onEnd && onEnd();
    return () => {};
  }

  const recognition = new Recognition();
  recognition.lang = languageCode(language) || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript =
      event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : "";
    onResult && onResult(transcript);
  };
  recognition.onerror = (event) => {
    const message =
      event.error in ERRORS
        ? ERRORS[event.error]
        : "Voice input failed. Try again.";
    if (message && onError) onError(message);
  };
  recognition.onend = () => onEnd && onEnd();

  try {
    recognition.start();
  } catch (e) {
    onError && onError("Voice input could not start. Try again.");
    onEnd && onEnd();
  }

  return () => {
    try {
      recognition.stop();
    } catch (e) {
      // already stopped
    }
  };
}

function tokens(text, language) {
  const base = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  if (CHARACTER_LANGUAGES.has(language)) return [...base.replace(/\s+/g, "")];
  return base.split(/\s+/).filter(Boolean);
}

function longestCommon(a, b) {
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      table[i][j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return table[a.length][b.length];
}

// How much of the target the recognizer heard. This measures whether you were understood,
// not how native you sound.
export function compareSpeech(target, heard, language) {
  const wanted = tokens(target, language);
  const got = tokens(heard, language);
  if (wanted.length === 0) return { score: 0, missed: [] };

  const common = longestCommon(wanted, got);

  const pool = new Map();
  for (const word of got) pool.set(word, (pool.get(word) || 0) + 1);
  const missed = [];
  for (const word of wanted) {
    const left = pool.get(word) || 0;
    if (left > 0) pool.set(word, left - 1);
    else missed.push(word);
  }

  return {
    score: Math.round((100 * common) / wanted.length),
    missed: [...new Set(missed)].slice(0, 8),
  };
}
