"use strict";

// Cloud voice: turns text into clear speech with Azure Speech, so every phone
// and browser sounds the same. Saved results are reused, so a phrase that is
// spoken twice is only paid for (or counted against the free amount) once.
//
// Needs two settings in the server environment:
//   AZURE_SPEECH_KEY     - a key of your Azure "Speech" resource
//   AZURE_SPEECH_REGION  - the region of that resource, e.g. "southafricanorth"
// Without them this route answers 501 and the app keeps using the device voice.

const express = require("express");
const crypto = require("node:crypto");
const supabase = require("./supabase");

const router = express.Router();

// Language name (as used in the app) -> Azure neural voice
const VOICES = {
  French: ["fr-FR", "fr-FR-DeniseNeural"],
  Spanish: ["es-ES", "es-ES-ElviraNeural"],
  German: ["de-DE", "de-DE-KatjaNeural"],
  Italian: ["it-IT", "it-IT-ElsaNeural"],
  Portuguese: ["pt-BR", "pt-BR-FranciscaNeural"],
  Dutch: ["nl-NL", "nl-NL-ColetteNeural"],
  Swedish: ["sv-SE", "sv-SE-SofieNeural"],
  Polish: ["pl-PL", "pl-PL-ZofiaNeural"],
  Turkish: ["tr-TR", "tr-TR-EmelNeural"],
  Indonesian: ["id-ID", "id-ID-GadisNeural"],
  Swahili: ["sw-KE", "sw-KE-ZuriNeural"],
  Russian: ["ru-RU", "ru-RU-SvetlanaNeural"],
  "Mandarin Chinese": ["zh-CN", "zh-CN-XiaoxiaoNeural"],
  Japanese: ["ja-JP", "ja-JP-NanamiNeural"],
  Korean: ["ko-KR", "ko-KR-SunHiNeural"],
  Hindi: ["hi-IN", "hi-IN-SwaraNeural"],
  Arabic: ["ar-SA", "ar-SA-ZariyahNeural"],
  Greek: ["el-GR", "el-GR-AthinaNeural"],
  Hebrew: ["he-IL", "he-IL-HilaNeural"],
  Thai: ["th-TH", "th-TH-PremwadeeNeural"],
  English: ["en-US", "en-US-JennyNeural"],
};

const MAX_CHARS = 600;
const LIMIT_PER_HOUR = 300;
const recent = new Map();

function underLimit(userId) {
  const now = Date.now();
  const times = (recent.get(userId) || []).filter((t) => now - t < 3600 * 1000);
  if (times.length >= LIMIT_PER_HOUR) {
    recent.set(userId, times);
    return false;
  }
  times.push(now);
  recent.set(userId, times);
  return true;
}

const escapeXml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

async function synthesize(req, res, returnAudioKey = false) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return res.status(501).json({ error: "Cloud voice is not set up." });
  }

  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: "Please log in." });

  const { text, language } = req.body || {};
  const spoken =
    typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  const voice = VOICES[language];

  if (!voice) return res.status(400).json({ error: "Unknown language." });
  if (!spoken || spoken.length > MAX_CHARS) {
    return res
      .status(400)
      .json({ error: `Send 1 to ${MAX_CHARS} characters.` });
  }

  // Speed: 1 is normal. Azure wants a percentage.
  const wanted = Number(req.body.rate);
  const rate = Number.isFinite(wanted)
    ? Math.min(1.3, Math.max(0.5, wanted))
    : 0.9;
  const percent = Math.round((rate - 1) * 100);

  const cacheKey = crypto
    .createHash("sha256")
    .update(`${voice[1]}|${percent}|clear-v2|${spoken}`)
    .digest("hex");

  try {
    // 1) Saved before? Use it (costs nothing)
    const { data: saved } = await supabase
      .from("tts_cache")
      .select("audio")
      .eq("key", cacheKey)
      .maybeSingle();

    if (saved && saved.audio) {
      if (returnAudioKey) return res.json({ key: cacheKey });
      res.set("Content-Type", "audio/mpeg");
      res.set("X-Voice-Cache", "hit");
      return res.send(Buffer.from(saved.audio, "base64"));
    }

    if (!underLimit(userId)) {
      return res
        .status(429)
        .json({ error: "Too much audio for one hour. Try again later." });
    }

    // 2) Ask Azure
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice[0]}">` +
      `<voice name="${voice[1]}"><prosody rate="${percent >= 0 ? "+" : ""}${percent}%" volume="+20%">` +
      `${escapeXml(spoken)}</prosody></voice></speak>`;

    const azure = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "LinguaApp",
        },
        body: ssml,
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!azure.ok) {
      const detail = (await azure.text()).slice(0, 200);
      console.error(`Azure Speech ${azure.status} (${voice[1]}):`, detail);
      return res
        .status(azure.status === 429 ? 429 : 502)
        .json({ error: "The cloud voice is unavailable." });
    }

    const audio = Buffer.from(await azure.arrayBuffer());

    // 3) Keep it for next time (a failure here must not stop the audio)
    const { error: saveError } = await supabase
      .from("tts_cache")
      .upsert({ key: cacheKey, language, audio: audio.toString("base64") });
    if (saveError) {
      console.error("Voice cache save failed:", saveError.message);
      if (returnAudioKey) {
        return res.status(502).json({ error: "The cloud voice could not be saved." });
      }
    }

    if (returnAudioKey) return res.json({ key: cacheKey });

    res.set("Content-Type", "audio/mpeg");
    res.set("X-Voice-Cache", "miss");
    res.send(audio);
  } catch (err) {
    console.error("Cloud voice error:", String(err.message).slice(0, 200));
    res.status(502).json({ error: "The cloud voice is unavailable." });
  }
}

router.get("/status", (req, res) => {
  res.json({
    configured: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    languages: Object.keys(VOICES).filter((language) => language !== "English").length,
  });
});

router.post("/", (req, res) => synthesize(req, res));
router.post("/url", (req, res) => synthesize(req, res, true));

router.get("/audio/:key", async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: "Please log in." });

  const key = String(req.params.key || "");
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    return res.status(400).json({ error: "Invalid audio key." });
  }

  try {
    const { data, error } = await supabase
      .from("tts_cache")
      .select("audio")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.audio) {
      return res.status(404).json({ error: "That voice clip is not available." });
    }

    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "private, no-store");
    return res.send(Buffer.from(data.audio, "base64"));
  } catch (err) {
    console.error("Voice clip error:", String(err.message).slice(0, 200));
    return res.status(502).json({ error: "The cloud voice is unavailable." });
  }
});

module.exports = router;
module.exports.VOICES = VOICES;
