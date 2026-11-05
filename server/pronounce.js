"use strict";

// Pronunciation check with Azure Speech. The app sends a short recording of
// the student and the phrase they should have said; Azure scores how close the
// pronunciation is to a native speaker's, word by word.
//
// Uses the same AZURE_SPEECH_KEY and AZURE_SPEECH_REGION as the cloud voice.

const express = require("express");
const { VOICES } = require("./tts");

const router = express.Router();

const MAX_BYTES = 2 * 1024 * 1024; // about 30 seconds of 16 kHz audio is 1 MB
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

const configured = () =>
  Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

// Turns Azure's answer into the small shape the app needs
function shape(json) {
  if (!json || json.RecognitionStatus !== "Success") {
    return {
      supported: true,
      heard: false,
      status: json && json.RecognitionStatus,
    };
  }

  const best = Array.isArray(json.NBest) ? json.NBest[0] : null;
  const recognized =
    (best && (best.Display || best.Lexical)) || json.DisplayText || "";
  const assessment = best && best.PronunciationAssessment;

  // This language or recording gave no scores: the app falls back to word matching
  if (!assessment || typeof assessment.PronScore !== "number") {
    return { supported: false, heard: true, recognized };
  }

  const words = (best.Words || []).map((word) => ({
    word: word.Word,
    score: Math.round(
      (word.PronunciationAssessment &&
        word.PronunciationAssessment.AccuracyScore) ||
        0,
    ),
    error:
      (word.PronunciationAssessment &&
        word.PronunciationAssessment.ErrorType) ||
      "None",
  }));

  return {
    supported: true,
    heard: true,
    recognized,
    score: Math.round(assessment.PronScore),
    accuracy: Math.round(assessment.AccuracyScore || 0),
    fluency: Math.round(assessment.FluencyScore || 0),
    completeness: Math.round(assessment.CompletenessScore || 0),
    words,
  };
}

router.get("/status", (req, res) => res.json({ enabled: configured() }));

router.post(
  "/check",
  express.raw({ type: "audio/wav", limit: MAX_BYTES }),
  async (req, res) => {
    if (!configured()) {
      return res
        .status(501)
        .json({ error: "Pronunciation check is not set up." });
    }

    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: "Please log in." });

    const voice = VOICES[req.query.language];
    const reference = String(req.query.text || "")
      .replace(/\s+/g, " ")
      .trim();
    const audio = req.body;

    if (!voice) return res.status(400).json({ error: "Unknown language." });
    if (!reference || reference.length > 200) {
      return res
        .status(400)
        .json({ error: "Send the phrase (1 to 200 characters)." });
    }
    if (
      !Buffer.isBuffer(audio) ||
      audio.length < 1000 ||
      audio.length > MAX_BYTES
    ) {
      return res.status(400).json({ error: "Send a short WAV recording." });
    }
    if (!underLimit(userId)) {
      return res
        .status(429)
        .json({ error: "Too many checks for one hour. Try again later." });
    }

    const parameters = {
      ReferenceText: reference,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    };

    try {
      const azure = await fetch(
        `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
          `?language=${encodeURIComponent(voice[0])}&format=detailed`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            Accept: "application/json",
            "Pronunciation-Assessment": Buffer.from(
              JSON.stringify(parameters),
            ).toString("base64"),
          },
          body: audio,
          signal: AbortSignal.timeout(20000),
        },
      );

      if (!azure.ok) {
        const detail = (await azure.text()).slice(0, 200);
        console.error(
          `Azure pronunciation ${azure.status} (${voice[0]}):`,
          detail,
        );
        return res
          .status(azure.status === 429 ? 429 : 502)
          .json({ error: "The pronunciation check is unavailable." });
      }

      res.json(shape(await azure.json()));
    } catch (err) {
      console.error("Pronunciation error:", String(err.message).slice(0, 200));
      res
        .status(502)
        .json({ error: "The pronunciation check is unavailable." });
    }
  },
);

module.exports = router;
module.exports.shape = shape;
