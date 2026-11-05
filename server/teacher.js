"use strict";

// "Learn with a teacher": the AI plans a short spoken lesson. The app then
// plays teacher and student: the teacher explains, says the phrase, the
// student repeats, and the app checks what was heard.

const express = require("express");
const { PERSONAS } = require("./ai");
const { completeJson } = require("./aijson");
const { LANGUAGES, PRONUNCIATION_GUIDE } = require("./curriculum");

const router = express.Router();

const LEVELS = {
  Beginner: "A1-A2",
  Intermediate: "B1-B2",
  Advanced: "C1-C2",
};

// Each level has its own topics (the app shows the same lists)
const TOPICS = {
  Beginner: [
    "Greetings",
    "Introducing yourself",
    "Polite words",
    "Numbers 1 to 10",
    "Food and drink",
    "Getting around",
  ],
  Intermediate: [
    "Ordering at a restaurant",
    "Shopping and prices",
    "Asking for directions",
    "Talking about your day",
    "Making plans with a friend",
    "At the doctor",
  ],
  Advanced: [
    "Job interview",
    "Giving and defending opinions",
    "Talking about the news",
    "Telling a story about the past",
    "Negotiating and persuading",
    "Culture and traditions",
  ],
};

// How long the phrases should be at each level
const PHRASE_LENGTH = {
  Beginner: "very short phrases of 2 to 6 words",
  Intermediate: "complete everyday sentences of 6 to 12 words",
  Advanced: "natural, longer sentences of 10 to 20 words with richer grammar",
};

// Higher levels get more steps and a stronger grammar focus
const STEPS_BY_LEVEL = { Beginner: 5, Intermediate: 5, Advanced: 6 };

const GRAMMAR_FOCUS = {
  Beginner: "Stay in the present tense with very common words.",
  Intermediate:
    'Each step practises one grammar point, such as the past tense, the future, comparisons or polite requests. Name that grammar point in the "teach" line.',
  Advanced:
    'Use connecting words, idioms and complex structures such as conditionals or the subjunctive. Each step has one nuance point, explained in the "tip" line.',
};
const LIMIT_PER_HOUR = 15;
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

function text(value, max) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function parseObject(reply) {
  const cleaned = String(reply || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI returned no lesson.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("The AI returned a lesson that could not be read.");
  }
}

// Keeps only well-formed steps, so a half-broken answer cannot reach the app
function checkLesson(data) {
  if (!data || !Array.isArray(data.steps)) {
    throw new Error("The AI returned a lesson in the wrong shape.");
  }

  const steps = [];
  for (const raw of data.steps) {
    const step = {
      phrase: text(raw && raw.phrase, 200),
      meaning: text(raw && raw.meaning, 200),
      pronunciation: text(raw && raw.pronunciation, 160),
      teach: text(raw && raw.teach, 320),
      tip: text(raw && raw.tip, 320),
      praise: text(raw && raw.praise, 200),
      perfect: text(raw && raw.perfect, 200),
      retry: text(raw && raw.retry, 200),
    };
    if (
      step.phrase &&
      step.meaning &&
      step.teach &&
      step.praise &&
      step.retry
    ) {
      steps.push(step);
    }
  }

  if (steps.length < 3) {
    throw new Error("The AI returned too few usable steps.");
  }

  return {
    title: text(data.title, 80) || "Your lesson",
    greeting: text(data.greeting, 320),
    steps: steps.slice(0, 8),
    closing: text(data.closing, 320),
  };
}

router.post("/lesson", async (req, res) => {
  const { language, level, topic } = req.body || {};
  const userId = req.user && req.user.id;

  if (!userId) {
    return res.status(401).json({ error: "Please log in." });
  }
  if (!LANGUAGES.includes(language)) {
    return res
      .status(400)
      .json({
        error: `Choose one of these languages: ${LANGUAGES.join(", ")}`,
      });
  }
  if (!Object.keys(LEVELS).includes(level)) {
    return res.status(400).json({ error: "Choose a level." });
  }
  const levelTopics = TOPICS[level];
  const chosenTopic = levelTopics.includes(topic) ? topic : levelTopics[0];

  if (!underLimit(userId)) {
    return res.status(429).json({
      error:
        "That is a lot of lessons for one hour. Take a break and come back later.",
    });
  }

  const nativeLanguage = req.user.nativeLanguage || "English";
  const teacher = PERSONAS[language] || "Alex";
  const guide = PRONUNCIATION_GUIDE[language];
  const isChinese = /chinese/i.test(language);

  const system = [
    `You are ${teacher}, a warm, patient, encouraging ${language} teacher, teaching a student whose language is ${nativeLanguage}.`,
    "You are an AI playing a teacher, and you say so honestly if asked.",
    "Return one valid JSON object only, with no markdown.",
  ].join("\n");

  const user = [
    `Plan a short spoken lesson of exactly ${STEPS_BY_LEVEL[level]} steps on the topic "${chosenTopic}" for a ${level} (${LEVELS[level]}) student.`,
    `Each step teaches ONE ${language} phrase that the student will repeat aloud. Use ${PHRASE_LENGTH[level]}, useful for this topic.`,
    GRAMMAR_FOCUS[level],
    "Each step must be different from the others and a little harder than the one before.",
    "Fields for every step:",
    `- "phrase": the phrase, written in ${language}.`,
    `- "meaning": its meaning in ${nativeLanguage}.`,
    guide ? `- "pronunciation": the phrase written with ${guide}.` : "",
    `- "teach": 1 or 2 short sentences, in ${nativeLanguage}, that you say to introduce the phrase like a real classroom teacher.`,
    isChinese
      ? `- "tip": one sentence in ${nativeLanguage} about the tone of each syllable.`
      : `- "tip": one sentence in ${nativeLanguage} about stress or the trickiest sound.`,
    `- "praise": one short encouraging line in ${nativeLanguage}, for a good attempt.`,
    `- "perfect": one short, delighted line in ${nativeLanguage} for a perfect attempt.`,
    `- "retry": one short, kind line in ${nativeLanguage} asking the student to try again.`,
    `Top-level fields: "title" (in ${nativeLanguage}), "greeting" (you introduce yourself as ${teacher} and the topic, 1 or 2 sentences in ${nativeLanguage}), "closing" (a short, warm goodbye in ${nativeLanguage}).`,
    `IMPORTANT: your spoken lines (teach, tip, praise, retry, greeting, closing) must contain no ${language} words and no phrase text. Say "this phrase" instead. The phrase is spoken separately.`,
    `Return exactly: {"title":"...","greeting":"...","steps":[{"phrase":"...","meaning":"...",${guide ? '"pronunciation":"...",' : ""}"teach":"...","tip":"...","praise":"...","perfect":"...","retry":"..."}],"closing":"..."}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const reply = await completeJson(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      4000, // room for the model's own thinking as well as the lesson
    );

    const lesson = checkLesson(parseObject(reply));
    res.json({ ...lesson, teacher, language, level, topic: chosenTopic });
  } catch (err) {
    console.error("Teacher error:", String(err.message).slice(0, 300));
    const busy = /rate limit|\b429\b/i.test(String(err.message));
    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy. Try again in a minute."
        : "Could not prepare the lesson. Try again.",
    });
  }
});

router.get("/topics", (req, res) => {
  const level = String(req.query.level || "Beginner");
  res.json(TOPICS[level] || TOPICS.Beginner);
});

module.exports = router;
module.exports.checkLesson = checkLesson;
