"use strict";
const express = require("express");
const { completeJson } = require("./aijson");
const { LANGUAGES } = require("./curriculum");
const { isChinese, scopeFor } = require("./hsk");
const router = express.Router();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const requests = new Map();

function allowed(userId) {
  const now = Date.now();
  const recent = (requests.get(userId) || []).filter((time) => now - time < 3600000);
  if (recent.length >= 12) { requests.set(userId, recent); return false; }
  recent.push(now);
  requests.set(userId, recent);
  if (requests.size > 5000) {
    for (const [id, times] of requests) {
      if (!times.some((time) => now - time < 3600000)) requests.delete(id);
    }
  }
  return true;
}
function clean(value, max = 300) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function parseObject(reply) {
  const fence = new RegExp(String.fromCharCode(96) + "{3}(?:json)?", "gi");
  const source = String(reply || "").replace(/^\uFEFF/, "").replace(fence, "").trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a complete JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}
function stringArray(value, min, max, limit = 240) {
  if (!Array.isArray(value)) return [];
  const result = value.map((item) => clean(item, limit)).filter(Boolean).slice(0, max);
  return result.length >= min ? result : [];
}
function validateLesson(raw, language, level) {
  if (!raw || typeof raw !== "object") throw new Error("The lesson was not valid.");
  const vocabulary = (Array.isArray(raw.vocabulary) ? raw.vocabulary : []).map((item) => ({
    term: clean(item?.term, 80), pronunciation: clean(item?.pronunciation, 100),
    meaning: clean(item?.meaning, 180), example: clean(item?.example, 240),
    exampleTranslation: clean(item?.exampleTranslation, 240),
  })).filter((item) => item.term && item.meaning && item.example);
  const dialogue = (Array.isArray(raw.dialogue) ? raw.dialogue : []).map((item) => ({
    speaker: clean(item?.speaker, 40), text: clean(item?.text, 260),
    pronunciation: clean(item?.pronunciation, 140), translation: clean(item?.translation, 260),
  })).filter((item) => item.speaker && item.text && item.translation);
  const grammar = (Array.isArray(raw.grammar) ? raw.grammar : []).map((item) => ({
    name: clean(item?.name, 100), explanation: clean(item?.explanation, 600),
    pattern: clean(item?.pattern, 160),
    examples: (Array.isArray(item?.examples) ? item.examples : []).map((example) => ({
      target: clean(example?.target, 240), pronunciation: clean(example?.pronunciation, 140),
      translation: clean(example?.translation, 240),
    })).filter((example) => example.target && example.translation).slice(0, 4),
  })).filter((item) => item.name && item.explanation && item.pattern && item.examples.length >= 1);
  const questions = (value) => (Array.isArray(value) ? value : []).map((item) => ({
    question: clean(item?.question, 280), options: stringArray(item?.options, 3, 4, 180),
    answerIndex: Number.isInteger(item?.answerIndex) ? item.answerIndex : -1,
    explanation: clean(item?.explanation, 300),
  })).filter((item) => item.question && item.options.length === 4 &&
    item.answerIndex >= 0 && item.answerIndex < 4 && item.explanation).slice(0, 6);
  const lesson = {
    title: clean(raw.title, 100), level, language,
    objectives: stringArray(raw.objectives, 3, 6), vocabulary: vocabulary.slice(0, 12),
    grammar, dialogue: dialogue.slice(0, 8),
    listening: {
      instruction: clean(raw.listening?.instruction, 260),
      script: clean(raw.listening?.script, 1400),
      questions: questions(raw.listening?.questions),
    },
    reading: {
      instruction: clean(raw.reading?.instruction, 260), text: clean(raw.reading?.text, 1800),
      translation: clean(raw.reading?.translation, 1800),
      questions: questions(raw.reading?.questions),
    },
    speaking: {
      prompt: clean(raw.speaking?.prompt, 500),
      usefulPhrases: stringArray(raw.speaking?.usefulPhrases, 3, 6),
      modelAnswer: clean(raw.speaking?.modelAnswer, 900),
    },
    writing: {
      prompt: clean(raw.writing?.prompt, 500),
      requirements: stringArray(raw.writing?.requirements, 2, 5),
      modelAnswer: clean(raw.writing?.modelAnswer, 1000),
    },
    review: questions(raw.review),
  };
  if (!lesson.title || lesson.objectives.length < 3 || lesson.vocabulary.length < 6 ||
      lesson.grammar.length < 1 || lesson.dialogue.length < 4 ||
      !lesson.listening.script || lesson.listening.questions.length < 3 ||
      !lesson.reading.text || lesson.reading.questions.length < 3 ||
      !lesson.speaking.prompt || !lesson.writing.prompt || lesson.review.length < 4) {
    throw new Error("The lesson was incomplete. Please generate it again.");
  }
  return lesson;
}

router.post("/lesson", async (req, res) => {
  const userId = req.user?.id;
  const { language, level } = req.body || {};
  const topic = clean(req.body?.topic, 120);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  if (!LANGUAGES.includes(language)) return res.status(400).json({ error: "Choose a supported learning language." });
  if (!LEVELS.includes(level)) return res.status(400).json({ error: "Choose a course level." });
  if (topic.length < 3) return res.status(400).json({ error: "Enter a lesson topic." });
  if (!allowed(userId)) return res.status(429).json({ error: "You have reached the lesson-generation limit. Try again later." });

  const nativeLanguage = req.user.nativeLanguage || "English";
  const hsk = isChinese(language) ? scopeFor(level) : null;
  const system = [
    "You are LinguaApp's expert language-course designer and experienced language teacher.",
    "Create a complete, accurate, teachable lesson for one learner. Return exactly one JSON object and no markdown.",
    "Teach " + language + "; explain in " + nativeLanguage + ". Learner level: " + level + ".",
    "Use natural contemporary language, culturally appropriate examples, and a clear progression from recognition to independent use.",
    "Do not invent fake rules. Explain the actual grammar of the target language. Avoid translating word-for-word when a natural translation is different.",
    "Train vocabulary, grammar, listening comprehension, reading comprehension, spoken production, written production and retrieval practice.",
    "Keep all target-language material appropriate for the learner's level. Include translations for all dialogue and reading material.",
    isChinese(language) ? "For Mandarin Chinese, use simplified characters, tone-marked pinyin for every vocabulary item and dialogue line, and explain tones accurately. Keep vocabulary and grammar within the assigned HSK 2.0 band." : "",
    hsk ? "HSK scope: " + hsk.label + ". Allowed vocabulary pool (prioritise these words): " + hsk.vocabulary.slice(0, 180).join(", ") + ". Grammar range: " + hsk.grammar + ". Do not claim this is an official exam paper." : "",
  ].filter(Boolean).join("\n");
  const user = [
    "Build a complete " + level + " lesson about this learner-selected topic.",
    "<topic>" + topic + "</topic>",
    "Return this exact JSON shape:",
    '{"title":"...","objectives":["..."],"vocabulary":[{"term":"target-language word or phrase","pronunciation":"pinyin/transliteration or empty when not needed","meaning":"native-language meaning","example":"natural target-language example","exampleTranslation":"native-language translation"}],"grammar":[{"name":"grammar point","explanation":"clear explanation in native language","pattern":"reusable pattern","examples":[{"target":"target-language example","pronunciation":"pronunciation or empty","translation":"native-language translation"}]}],"dialogue":[{"speaker":"speaker label","text":"target-language line","pronunciation":"pronunciation or empty","translation":"native-language translation"}],"listening":{"instruction":"what to listen for","script":"a natural spoken dialogue or short talk in the target language","questions":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]},"reading":{"instruction":"reading strategy","text":"a level-appropriate target-language passage","translation":"natural full translation","questions":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]},"speaking":{"prompt":"a realistic open-ended speaking task","usefulPhrases":["..."],"modelAnswer":"a natural model response in target language with translation"},"writing":{"prompt":"a practical writing task","requirements":["..."],"modelAnswer":"a model response in target language with translation"},"review":[{"question":"question in native language","options":["A","B","C","D"],"answerIndex":0,"explanation":"why this is correct"}]}',
    "Requirements: 8–10 vocabulary items; 2 grammar points with at least 2 examples each; 6–8 dialogue turns; listening script 5–9 sentences; at least 3 listening questions; reading passage 100–180 target-language words at Beginner, 180–280 Intermediate, 250–400 Advanced; at least 3 reading questions; 4 review questions. Vary correct answer positions. No answer may be ambiguous.",
    "Model answers must be useful but not the only possible correct answers. Keep each section concise enough for a mobile learner.",
  ].join("\n");
  try {
    const reply = await completeJson([
      { role: "system", content: system }, { role: "user", content: user },
    ], 6500);
    const lesson = validateLesson(parseObject(reply), language, level);
    res.json({ lesson, generatedAt: new Date().toISOString(),
      curriculum: hsk ? "HSK 2.0-aligned practice" : "CEFR-informed guided practice" });
  } catch (error) {
    console.error("Course lesson generation failed:", String(error.message).slice(0, 300));
    const busy = /429|rate limit/i.test(String(error.message));
    res.status(busy ? 429 : 502).json({ error: busy
      ? "The AI teacher is busy. Please try again shortly."
      : "The lesson could not be prepared completely. Please try again." });
  }
});

router.post("/feedback", async (req, res) => {
  const userId = req.user?.id;
  const { language, level, kind } = req.body || {};
  const prompt = clean(req.body?.prompt, 700);
  const response = clean(req.body?.response, 1600);
  const modelAnswer = clean(req.body?.modelAnswer, 1200);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  if (!LANGUAGES.includes(language) || !LEVELS.includes(level) ||
      !["speaking", "writing"].includes(kind)) {
    return res.status(400).json({ error: "Invalid feedback request." });
  }
  if (!prompt || !response) return res.status(400).json({ error: "Your answer is empty." });
  if (!allowed(userId)) return res.status(429).json({ error: "Feedback limit reached. Try again later." });
  const nativeLanguage = req.user.nativeLanguage || "English";
  const system = [
    "You are a fair, supportive language assessor. Give specific, actionable feedback, not empty praise.",
    "Assess a " + level + " learner writing or speaking " + language + ". Explain in " + nativeLanguage + ".",
    "Judge communication, grammar, vocabulary, naturalness and task completion at the stated level.",
    "A transcript is not an acoustic pronunciation assessment. Never claim to have heard accent, intonation or pronunciation from text alone.",
    'Return JSON only: {"score":0,"strengths":["..."],"corrections":[{"original":"...","corrected":"...","explanation":"..."}],"nextPractice":"...","improvedExample":"..."}. Score is a formative practice estimate, not an official exam score.',
  ].join("\n");
  const user = [
    "Task: " + kind + ".", "<prompt>" + prompt + "</prompt>",
    "<learner_answer>" + response + "</learner_answer>",
    modelAnswer ? "<optional_model_answer>" + modelAnswer + "</optional_model_answer>" : "",
    "Correct only meaningful errors. If the answer is already good, explain what works and suggest one improvement.",
  ].filter(Boolean).join("\n");
  try {
    const reply = await completeJson([
      { role: "system", content: system }, { role: "user", content: user },
    ], 1800);
    const raw = parseObject(reply);
    const score = Number(raw.score);
    if (!Number.isFinite(score) || !Array.isArray(raw.strengths) ||
        !Array.isArray(raw.corrections)) throw new Error("The feedback response was incomplete.");
    res.json({
      score: Math.max(0, Math.min(100, Math.round(score))),
      strengths: stringArray(raw.strengths, 1, 5, 240),
      corrections: raw.corrections.slice(0, 6).map((item) => ({
        original: clean(item?.original, 240), corrected: clean(item?.corrected, 240),
        explanation: clean(item?.explanation, 320),
      })).filter((item) => item.corrected && item.explanation),
      nextPractice: clean(raw.nextPractice, 400),
      improvedExample: clean(raw.improvedExample, 500),
      scoreNote: "This is AI-generated formative feedback, not an official proficiency score.",
    });
  } catch (error) {
    console.error("Course feedback failed:", String(error.message).slice(0, 250));
    const busy = /429|rate limit/i.test(String(error.message));
    res.status(busy ? 429 : 502).json({ error: busy
      ? "The AI assessor is busy. Try again shortly."
      : "Feedback could not be prepared. Please try again." });
  }
});

module.exports = router;
module.exports.validateLesson = validateLesson;
module.exports.parseObject = parseObject;
