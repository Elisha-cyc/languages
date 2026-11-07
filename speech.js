import * as Speech from "expo-speech";
import { createAudioPlayer } from "expo-audio";
import { AppState, Platform } from "react-native";
import { API_URL } from "./config";
import { getAuthToken } from "./auth";

// Language names must match the names in curriculum.js
const LANGUAGE_CODES = {
  French: "fr-FR",
  Spanish: "es-ES",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-BR",
  Dutch: "nl-NL",
  Swedish: "sv-SE",
  Polish: "pl-PL",
  Turkish: "tr-TR",
  Indonesian: "id-ID",
  Swahili: "sw-KE",
  Russian: "ru-RU",
  "Mandarin Chinese": "zh-CN",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Hindi: "hi-IN",
  Arabic: "ar-SA",
  Greek: "el-GR",
  Hebrew: "he-IL",
  Thai: "th-TH",
};

// Spoken (for meanings), but not a language to learn
const EXTRA_CODES = { English: "en-US" };

// Some systems use older codes for the same language
const CODE_ALIASES = { he: ["he", "iw"], id: ["id", "in"] };

const SPEAK_CHUNK = 180; // characters: browsers cut off long speech after about 15 seconds
const START_TIMEOUT_MS = 6000;

export function languageCode(language) {
  return LANGUAGE_CODES[language] || null;
}

export const SPEECH_LANGUAGES = Object.keys(LANGUAGE_CODES);

// ---------- A shared place to report problems, so one banner can show them ----------

const listeners = new Set();

export function onSpeechProblem(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function report(message) {
  listeners.forEach((listener) => listener(message));
}

// ---------- Voices ----------

let voiceCache = [];

async function loadVoices(refresh = false) {
  if (refresh) voiceCache = [];
  if (voiceCache.length > 0) return voiceCache;
  try {
    let voices = await Speech.getAvailableVoicesAsync();
    // Chrome and Safari fill their voice list a moment after the page opens.
    // Without it the phone may read French text with its English voice, which
    // sounds like gibberish, so wait for it (up to about 3 seconds).
    for (
      let tries = 0;
      (!voices || voices.length === 0) && tries < 12;
      tries++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      voices = await Speech.getAvailableVoicesAsync();
    }
    voiceCache = voices || [];
  } catch (e) {
    voiceCache = [];
  }
  return voiceCache;
}

const normalizeCode = (code) =>
  String(code || "")
    .replace("_", "-")
    .toLowerCase();

// Higher is clearer. Premium and Enhanced voices sound far more natural than
// the small default ones; novelty voices are never a good choice.
function voiceScore(voice) {
  const name = `${voice.name || ""} ${voice.identifier || ""}`.toLowerCase();
  let score = 0;
  if (/premium|siri/.test(name)) score += 4;
  if (voice.quality === "Enhanced" || /enhanced/.test(name)) score += 3;
  if (/google|natural|neural|online/.test(name)) score += 2;
  if (/compact/.test(name)) score -= 2;
  if (
    /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|trinoids|whisper|zarvox|superstar/.test(
      name,
    )
  )
    score -= 10;
  return score;
}

export async function findVoice(code) {
  const voices = await loadVoices();
  const wanted = normalizeCode(code);
  const prefix = wanted.split("-")[0];
  const prefixes = CODE_ALIASES[prefix] || [prefix];

  const matches = voices.filter((voice) =>
    prefixes.includes(normalizeCode(voice.language).split("-")[0]),
  );
  if (matches.length === 0) return null;

  const exact = matches.filter(
    (voice) => normalizeCode(voice.language) === wanted,
  );
  const pool = exact.length > 0 ? exact : matches;
  return [...pool].sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

// For the speech check screen: which of our languages have a voice on this device
export async function voiceReport({ refresh = false } = {}) {
  const voices = await loadVoices(refresh);
  let cloudReady = false;
  try {
    const response = await fetch(`${API_URL}/tts/status`);
    if (response.ok) {
      cloudReady = (await response.json()).configured === true;
      if (cloudReady) cloudOffUntil = 0;
    }
  } catch (e) {
    // Device voice reporting remains useful while the server is offline.
  }
  const rows = [];
  for (const language of SPEECH_LANGUAGES) {
    const voice = await findVoice(LANGUAGE_CODES[language]);
    rows.push({
      language,
      code: LANGUAGE_CODES[language],
      voice: voice ? voice.name || voice.identifier : null,
    });
  }
  return { total: voices.length, rows, cloudReady };
}

// ---------- Cleaning text before it is spoken ----------

// Languages whose own script is not Latin letters
const NON_LATIN = new Set([
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Arabic",
  "Greek",
  "Hebrew",
  "Thai",
  "Russian",
]);

// Symbols and notes that a voice would read out as noise
export function cleanForSpeech(text, language) {
  let clean = String(text || "");
  clean = clean.replace(/https?:\/\/\S+/g, " "); // web addresses
  clean = clean.replace(/[*_#`>~|]+/g, " "); // markdown marks
  clean = clean.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,
    " ",
  ); // emoji
  if (NON_LATIN.has(language)) {
    // Pinyin or romanization in brackets, e.g. "你好 (nǐ hǎo)", would be read
    // out by the Chinese voice as nonsense
    clean = clean.replace(
      /[(\[（【][^)\]）】]*[A-Za-z\u00C0-\u024F][^)\]）】]*[)\]）】]/g,
      " ",
    );
  }
  return clean.replace(/\s+/g, " ").trim();
}

// ---------- Cutting long text into pieces ----------

// Browsers stop long speech partway through, so we say it in short pieces, one after another
export function chunkText(text, max = SPEAK_CHUNK) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  const sentences = clean.match(/[^.!?。！？؟…]+[.!?。！？؟…]*\s*/g) || [clean];
  const chunks = [];
  let current = "";

  // A piece longer than max is cut at a space, or anywhere if it has no spaces
  function cutLong(piece) {
    let rest = piece.trim();
    while (rest.length > max) {
      let cut = rest.lastIndexOf(" ", max);
      if (cut < max * 0.5) cut = max;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    return rest;
  }

  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    const trailing = sentence.match(/\s*$/)[0];
    const rest = cutLong(sentence);
    current = rest ? rest + trailing : "";
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ---------- Speaking ----------

let run = 0; // numbers each request, so a new one can replace an older one

// Returns { ok: true } once speech starts, or { ok: false, reason } if it could not.
// options.onFinish runs when the last piece has been spoken.
// ---------- Cloud voice (web) ----------
// The server turns text into clear speech, so every phone sounds the same.
// If it is not set up, or fails, the device voice below is used instead.

let player = null; // one shared <audio>; the first tap "unlocks" it (needed on iPhone)
let stopPlayback = null; // ends the clip that is playing right now
let nativePlayer = null;
let nativeSubscription = null;
let stopNativePlayback = null;
let cloudOffUntil = 0; // when the server says "not set up", stop asking
let appIsActive = true;

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    appIsActive = state === "active";
    if (!appIsActive) stopSpeaking();
  });
}

// A silent half-empty sound, played once on the first tap to unlock audio
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function getPlayer() {
  if (!player && typeof Audio !== "undefined") player = new Audio();
  return player;
}

if (Platform.OS === "web" && typeof document !== "undefined") {
  const unlock = () => {
    const audio = getPlayer();
    if (!audio) return;
    try {
      audio.src = SILENT_WAV;
      const started = audio.play();
      if (started && started.catch) started.catch(() => {});
    } catch (e) {
      // not allowed yet; the next tap tries again
    }
  };
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("touchend", unlock, { once: true });
}

function stopCloud() {
  if (player) {
    try {
      player.pause();
      player.currentTime = 0;
    } catch (e) {
      // nothing playing
    }
  }
  if (stopPlayback) {
    const end = stopPlayback;
    stopPlayback = null;
    end();
  }
  if (stopNativePlayback) {
    const end = stopNativePlayback;
    stopNativePlayback = null;
    end();
  }
  setWebMediaState("paused");
}

let mediaHandlersInstalled = false;

function setWebMediaState(state) {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return;
  const session = navigator.mediaSession;
  if (!session) return;

  try {
    if (!mediaHandlersInstalled) {
      if (typeof MediaMetadata !== "undefined") {
        session.metadata = new MediaMetadata({
          title: "LinguaApp reading",
          artist: "LinguaApp",
        });
      }
      const setHandler = (action, handler) => {
        try {
          session.setActionHandler(action, handler);
        } catch (e) {
          // Some browsers implement only a subset of media actions.
        }
      };
      setHandler("play", () => {
        const audio = getPlayer();
        if (audio) audio.play().catch(() => {});
      });
      setHandler("pause", () => getPlayer()?.pause());
      setHandler("stop", () => stopSpeaking());
      mediaHandlersInstalled = true;
    }
    session.playbackState = state;
  } catch (e) {
    // Lock-screen controls are optional and not supported by every browser.
  }
}

// Returns a sound address for one piece of text, or null if unavailable
async function fetchCloudAudio(text, language, rate) {
  const res = await fetch(`${API_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, rate }),
  });
  if (res.status === 501) {
    cloudOffUntil = Date.now() + 5 * 60 * 1000;
    return null;
  }
  if (!res.ok) {
    cloudOffUntil = Date.now() + 60 * 1000; // trouble: rest for a minute
    return null;
  }
  return URL.createObjectURL(await res.blob());
}

async function prepareNativeCloudAudio(text, language, rate) {
  const res = await fetch(`${API_URL}/tts/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, rate }),
  });
  if (res.status === 501) {
    cloudOffUntil = Date.now() + 5 * 60 * 1000;
    return null;
  }
  if (!res.ok) {
    cloudOffUntil = Date.now() + 60 * 1000;
    return null;
  }
  const { key } = await res.json();
  if (!/^[a-f0-9]{64}$/i.test(key || "")) {
    cloudOffUntil = Date.now() + 60 * 1000;
    return null;
  }
  return `${API_URL}/tts/audio/${key}`;
}

function playNativeUrl(url, myRun) {
  return new Promise((resolve) => {
    let settled = false;
    let started = false;
    let timer;

    const player = createAudioPlayer(
      {
        uri: url,
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      },
      { updateInterval: 250 },
    );
    // Keep cloud narration at full media volume on every supported phone.
    player.volume = 1;
    nativePlayer = player;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      nativeSubscription?.remove();
      nativeSubscription = null;
      if (nativePlayer === player) nativePlayer = null;
      if (stopNativePlayback === stop) stopNativePlayback = null;
      try {
        player.pause();
        player.release();
      } catch (e) {
        // The player may already have been released after a native error.
      }
      resolve(ok);
    };
    const stop = () => finish(false);
    stopNativePlayback = stop;

    nativeSubscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.error) return finish(false);
      if (status.isLoaded && status.playing) started = true;
      if (status.didJustFinish) finish(true);
    });

    timer = setTimeout(() => finish(started), 30000);
    if (myRun !== run) return finish(false);
    try {
      player.play();
    } catch (e) {
      finish(false);
    }
  });
}

function playUrl(url) {
  const audio = getPlayer();
  audio.preload = "auto";
  audio.playsInline = true;
  let finish;
  const ended = new Promise((resolve) => (finish = resolve));
  audio.onplay = () => setWebMediaState("playing");
  audio.onpause = () => setWebMediaState("paused");
  audio.onended = () => {
    setWebMediaState("paused");
    finish(true);
  };
  audio.onerror = () => {
    setWebMediaState("none");
    finish(false);
  };
  stopPlayback = () => finish(false);
  audio.src = url;
  let started;
  try {
    started = Promise.resolve(audio.play()).then(
      () => true,
      () => false,
    );
  } catch (e) {
    started = Promise.resolve(false);
  }
  return { started, ended };
}

// Plays the text with the cloud voice. Returns false if it could not start,
// so the caller can use the device voice instead.
async function speakCloud(text, language, options, myRun) {
  const parts = chunkText(text, Platform.OS === "web" ? 450 : SPEAK_CHUNK);
  if (parts.length === 0) return false;
  if (Date.now() < cloudOffUntil) return false;
  // Use the voice's natural speaking pace unless a lesson explicitly asks for slow speech.
  const rate = typeof options.rate === "number" ? options.rate : 1;

  if (Platform.OS !== "web") {
    for (const part of parts) {
      let url;
      try {
        url = await prepareNativeCloudAudio(part, language, rate);
      } catch (e) {
        cloudOffUntil = Date.now() + 60 * 1000;
        return false;
      }
      if (!url) return false;
      if (myRun !== run) return true;
      const played = await playNativeUrl(url, myRun);
      if (!played) {
        if (myRun !== run) return true;
        cloudOffUntil = Date.now() + 60 * 1000;
        return false;
      }
      if (myRun !== run) return true;
    }
    if (options.onFinish) options.onFinish();
    return true;
  }

  if (typeof Audio === "undefined") return false;

  let firstUrl;
  try {
    firstUrl = await fetchCloudAudio(parts[0], language, rate);
  } catch (e) {
    cloudOffUntil = Date.now() + 60 * 1000;
    return false;
  }
  if (!firstUrl) return false;
  if (myRun !== run) {
    URL.revokeObjectURL(firstUrl);
    return true; // a newer request took over
  }

  const first = playUrl(firstUrl);
  if (!(await first.started)) {
    URL.revokeObjectURL(firstUrl);
    return false; // the browser would not play it: use the device voice
  }

  // The rest plays in the background, fetching the next piece while one plays
  (async () => {
    let current = first;
    let url = firstUrl;
    for (let i = 0; i < parts.length; i++) {
      const next =
        i + 1 < parts.length
          ? fetchCloudAudio(parts[i + 1], language, rate).catch(() => null)
          : null;

      const played = await current.ended;
      URL.revokeObjectURL(url);

      if (!played || myRun !== run || !next) {
        if (next)
          next.then((leftover) => leftover && URL.revokeObjectURL(leftover));
        break;
      }

      url = await next;
      if (!url) break;
      if (myRun !== run) {
        URL.revokeObjectURL(url);
        break;
      }
      current = playUrl(url);
      if (!(await current.started)) {
        URL.revokeObjectURL(url);
        break;
      }
    }
    if (myRun === run && options.onFinish) options.onFinish();
  })();

  return true;
}

export async function speak(text, language, options = {}) {
  const code = LANGUAGE_CODES[language] || EXTRA_CODES[language];
  if (!text || !code)
    return { ok: false, reason: "No language was chosen for speech." };
  if (Platform.OS !== "web" && !appIsActive) {
    return { ok: false, reason: "Reading pauses when the app is in the background." };
  }

  const { onFinish, ...speechOptions } = options;
  const myRun = ++run;
  Speech.stop();
  stopCloud();

  const cleaned = cleanForSpeech(text, language);
  const voice = await findVoice(code);
  if (myRun !== run) return { ok: true };

  // Prefer the hosted voice so all supported languages work without phone installs.
  if (
    cleaned &&
    (await speakCloud(
      cleaned,
      language,
      { rate: speechOptions.rate, onFinish },
      myRun,
    ))
  ) {
    report(null);
    return { ok: true };
  }
  if (myRun !== run) return { ok: true };

  const known = voiceCache.length > 0;
  if (myRun !== run) return { ok: true }; // a newer request took over

  if (known && !voice) {
    const reason = `This device has no ${language} voice. Open "Check speech" in Profile to see what to install.`;
    report(reason);
    return { ok: false, reason };
  }

  const chunks = chunkText(cleaned);
  if (chunks.length === 0) {
    onFinish && onFinish();
    return { ok: true };
  }

  return new Promise((resolve) => {
    let started = false;

    const timer = setTimeout(() => {
      if (started || myRun !== run) return;
      const reason = `No sound started for ${language}. Check the volume and the silent switch, and the voice in "Check speech".`;
      report(reason);
      resolve({ ok: false, reason });
    }, START_TIMEOUT_MS);

    function sayPiece(index) {
      if (myRun !== run || index >= chunks.length) return;

      Speech.speak(chunks[index], {
        language: code,
        ...(voice ? { voice: voice.identifier } : {}),
        rate: 1,
        volume: 1,
        useApplicationAudioSession: true,
        ...speechOptions,
        onStart: () => {
          if (started) return;
          started = true;
          clearTimeout(timer);
          report(null); // clears any earlier problem message
          resolve({ ok: true });
        },
        onDone: () => {
          if (index + 1 >= chunks.length) onFinish && onFinish();
          else sayPiece(index + 1);
        },
        onError: () => {
          clearTimeout(timer);
          const reason = `The ${language} voice could not play. Try again, or open "Check speech" in Profile.`;
          report(reason);
          resolve({ ok: false, reason });
          onFinish && onFinish();
        },
      });
    }

    // A short pause after stop() avoids a bug where Chrome drops the next utterance
    setTimeout(() => sayPiece(0), 80);
  });
}

// Speaks and waits until it has finished. Used for hands-free reading.
export function speakAndWait(text, language, options = {}) {
  return new Promise((resolve) => {
    const guard = setTimeout(resolve, 30 * 1000);
    const done = () => {
      clearTimeout(guard);
      resolve();
    };
    speak(text, language, { ...options, onFinish: done }).then((result) => {
      if (!result || !result.ok) done();
    });
  });
}

export function stopSpeaking() {
  run++;
  Speech.stop();
  stopCloud();
}
