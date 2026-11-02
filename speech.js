import * as Speech from "expo-speech";

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

async function loadVoices() {
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
export async function voiceReport() {
  const voices = await loadVoices();
  const rows = [];
  for (const language of SPEECH_LANGUAGES) {
    const voice = await findVoice(LANGUAGE_CODES[language]);
    rows.push({
      language,
      code: LANGUAGE_CODES[language],
      voice: voice ? voice.name || voice.identifier : null,
    });
  }
  return { total: voices.length, rows };
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
export async function speak(text, language, options = {}) {
  const code = LANGUAGE_CODES[language] || EXTRA_CODES[language];
  if (!text || !code)
    return { ok: false, reason: "No language was chosen for speech." };

  const { onFinish, ...speechOptions } = options;
  const myRun = ++run;
  Speech.stop();

  const voice = await findVoice(code);
  const known = voiceCache.length > 0;
  if (myRun !== run) return { ok: true }; // a newer request took over

  if (known && !voice) {
    const reason = `This device has no ${language} voice. Open "Check speech" in Profile to see what to install.`;
    report(reason);
    return { ok: false, reason };
  }

  const chunks = chunkText(cleanForSpeech(text, language));
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
        rate: 0.85,
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
}
