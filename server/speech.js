const express = require("express");
const multer = require("multer");
const { LANGUAGES } = require("./curriculum");
const { speechTip } = require("./ai");

const router = express.Router();

// Whisper language codes for our 20 languages
const WHISPER_CODES = {
  French: "fr",
  Spanish: "es",
  German: "de",
  Italian: "it",
  Portuguese: "pt",
  Dutch: "nl",
  Swedish: "sv",
  Polish: "pl",
  Turkish: "tr",
  Indonesian: "id",
  Swahili: "sw",
  Russian: "ru",
  "Mandarin Chinese": "zh",
  Japanese: "ja",
  Korean: "ko",
  Hindi: "hi",
  Arabic: "ar",
  Greek: "el",
  Hebrew: "he",
  Thai: "th",
};
const CHARACTER_LANGUAGES = new Set(["Mandarin Chinese", "Japanese", "Thai"]);
const MIN_AUDIO_BYTES = 3000; // less than this is silence or a tap
const LIMIT_PER_HOUR = 150;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const recent = new Map();
function underLimit(userId) {
  const now = Date.now();
  const times = (recent.get(userId) || []).filter(
    (t) => now - t < 60 * 60 * 1000,
  );
  if (times.length >= LIMIT_PER_HOUR) {
    recent.set(userId, times);
    return false;
  }
  times.push(now);
  recent.set(userId, times);
  return true;
}

// ---------- Speech to text (Whisper on Groq) ----------
async function transcribe(file, language) {
  const form = new FormData();
  const name = /\.(m4a|mp3|mp4|wav|webm|ogg|flac)$/i.test(
    file.originalname || "",
  )
    ? file.originalname
    : "speech.m4a";
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "audio/m4a" }),
    name,
  );
  form.append("model", process.env.WHISPER_MODEL || "whisper-large-v3-turbo");
  form.append("language", WHISPER_CODES[language]);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(30 * 1000),
    },
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

  const data = await res.json();
  return String(data.text || "").trim();
}

// ---------- Comparing what was said with what was meant ----------
function tokens(text, language) {
  const base = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Latin accents
    .replace(/[\u064B-\u065F\u0670\u0591-\u05C7]/g, "") // Arabic and Hebrew marks
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ");
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

function compare(target, heard, language) {
  const wanted = tokens(target, language);
  const got = tokens(heard, language);
  if (wanted.length === 0) return { score: 0, missed: [] };

  const pool = new Map();
  for (const word of got) pool.set(word, (pool.get(word) || 0) + 1);
  const missed = [];
  for (const word of wanted) {
    const left = pool.get(word) || 0;
    if (left > 0) pool.set(word, left - 1);
    else missed.push(word);
  }

  return {
    score: Math.round((100 * longestCommon(wanted, got)) / wanted.length),
    missed: [...new Set(missed)].slice(0, 8),
  };
}

function busyOrFail(res, err, what) {
  console.error(`${what} error:`, String(err.message).slice(0, 300));
  const busy = String(err.message).startsWith("429");
  res.status(busy ? 429 : 502).json({
    error: busy
      ? "The AI is busy right now. Try again in a minute."
      : `${what} is unavailable right now.`,
  });
}

// ---------- Routes ----------

// A recording in, the words out
router.post("/transcribe", (req, res) => {
  upload.single("audio")(req, res, async (uploadError) => {
    if (uploadError) {
      return res
        .status(400)
        .json({ error: "The recording was too large or failed to upload." });
    }
    const language = req.body && req.body.language;
    if (!LANGUAGES.includes(language)) {
      return res.status(400).json({ error: "Choose one of the 20 languages." });
    }
    if (!req.file)
      return res.status(400).json({ error: "No recording was received." });
    if (req.file.buffer.length < MIN_AUDIO_BYTES) {
      return res
        .status(422)
        .json({
          error:
            "I did not hear anything. Hold the phone closer and try again.",
        });
    }
    if (!underLimit(req.user.id)) {
      return res
        .status(429)
        .json({
          error: "That is a lot of voice input for one hour. Take a break.",
        });
    }

    try {
      const text = await transcribe(req.file, language);
      if (!text)
        return res
          .status(422)
          .json({ error: "I did not hear anything. Try again." });
      res.json({ text });
    } catch (err) {
      busyOrFail(res, err, "Speech recognition");
    }
  });
});

// Compares what the learner said with the sentence, and adds a short tip
router.post("/compare", async (req, res) => {
  const { language, target, heard } = req.body || {};
  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({ error: "Choose one of the 20 languages." });
  }
  if (
    typeof target !== "string" ||
    typeof heard !== "string" ||
    target.length > 500 ||
    heard.length > 500
  ) {
    return res
      .status(400)
      .json({ error: "target and heard must be short texts." });
  }

  const result = compare(target, heard, language);

  let tip = null;
  if (result.score < 100 && underLimit(req.user.id)) {
    try {
      tip = await speechTip({
        language,
        nativeLanguage: req.user.nativeLanguage || "English",
        target,
        heard: heard || "(nothing)",
      });
    } catch (err) {
      console.error("Speech tip error:", String(err.message).slice(0, 200));
    }
  }

  res.json({ ...result, tip });
});

module.exports = router;
