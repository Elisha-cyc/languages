"use strict";

const express = require("express");
const { LANGUAGES } = require("./curriculum");
const { completeJson } = require("./aijson");
const { parseObject } = require("./course-validation");

const router = express.Router();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeQuestions(words, level, usedIds) {
  const available = shuffle(words.filter((word) =>
    !usedIds.has(word.id) && typeof word.word === "string" && word.word.trim() &&
    typeof word.meaning === "string" && word.meaning.trim()
  ));
  const questions = [];

  for (const word of available) {
    const wrong = shuffle(
      [...new Set(words
        .filter((candidate) => candidate.id !== word.id && typeof candidate.meaning === "string" && candidate.meaning.trim() && candidate.meaning !== word.meaning)
        .map((candidate) => candidate.meaning))]
    ).slice(0, 3);

    if (wrong.length < 2) continue;

    const options = shuffle([word.meaning, ...wrong]);
    questions.push({
      id: String(word.id),
      level,
      prompt: word.word,
      pronunciation: word.pronunciation || "",
      options,
      answerIndex: options.indexOf(word.meaning),
    });
    usedIds.add(word.id);
    if (questions.length === 5) break;
  }

  return questions;
}


function normalizeGeneratedQuestions(rawQuestions, level) {
  if (!Array.isArray(rawQuestions)) throw new Error("The placement assessment could not be generated.");
  const questions = rawQuestions.slice(0, 5).map((item, index) => {
    const options = Array.isArray(item.options)
      ? item.options.map((option) => typeof option === "string" ? option.trim() : "")
      : [];
    const answerIndex = Number(item.answerIndex);
    if (
      typeof item.prompt !== "string" || !item.prompt.trim() ||
      options.length !== 4 || options.some((option) => !option) ||
      new Set(options).size !== 4 ||
      !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3
    ) return null;
    return {
      id: "ai-" + level.toLowerCase() + "-" + index,
      level,
      prompt: item.prompt.trim().slice(0, 120),
      pronunciation: typeof item.pronunciation === "string" ? item.pronunciation.trim().slice(0, 120) : "",
      options: options.map((option) => option.slice(0, 180)),
      answerIndex,
    };
  }).filter(Boolean);

  if (questions.length < 5) throw new Error("The placement assessment returned incomplete questions.");
  return questions;
}

async function generateLevelQuestions(language, nativeLanguage, level) {
  const reply = await completeJson([
    {
      role: "system",
      content: [
        "You are an expert language assessment designer.",
        "Create five accurate multiple-choice vocabulary questions for a language placement diagnostic.",
        "Return one JSON object only. Every question must have exactly four distinct options and one unambiguous correct answer.",
        "Write the prompt in the target language and the answer options in the learner's explanation language.",
        "For Mandarin Chinese include simplified characters and tone-marked pinyin in pronunciation.",
        "Do not use obscure, regional, archaic or disputed translations.",
      ].join("\\n"),
    },
    {
      role: "user",
      content: [
        "Target language: " + language,
        "Learner explanation language: " + nativeLanguage,
        "Level: " + level,
        "Generate five different words or short phrases suitable for this level.",
        'Return {"questions":[{"prompt":"target-language word","pronunciation":"transliteration or empty string","options":["meaning 1","meaning 2","meaning 3","meaning 4"],"answerIndex":0}]}',
        "Use answerIndex from 0 to 3 and vary its position. Do not include the answer in the prompt.",
      ].join("\\n"),
    },
  ], 2200);

  const parsed = parseObject(reply);
  return normalizeGeneratedQuestions(parsed.questions, level);
}
async function buildPlacementQuestions(language, nativeLanguage = "English") {
  const supabase = require("./supabase");
  if (!LANGUAGES.includes(language)) {
    const error = new Error("Choose one of the 20 supported languages.");
    error.status = 400;
    throw error;
  }

  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id, position, levels!inner(name), languages!inner(name)")
    .eq("languages.name", language)
    .order("position");
  if (unitsError) throw unitsError;

  const unitIds = (units || []).map((unit) => unit.id);
  if (!unitIds.length) {
    const error = new Error("There is no course content for this language yet.");
    error.status = 404;
    throw error;
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, unit_id, position")
    .in("unit_id", unitIds)
    .order("position");
  if (lessonsError) throw lessonsError;

  const lessonIds = (lessons || []).map((lesson) => lesson.id);
  if (!lessonIds.length) {
    const error = new Error("Lessons are not available for this language yet.");
    error.status = 404;
    throw error;
  }

  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, lesson_id, word, meaning, pronunciation")
    .in("lesson_id", lessonIds)
    .limit(1000);
  if (wordsError) throw wordsError;

  const unitLevels = new Map((units || []).map((unit) => [unit.id, unit.levels.name]));
  const lessonLevels = new Map((lessons || []).map((lesson) => [
    lesson.id,
    unitLevels.get(lesson.unit_id),
  ]));
  const wordsByLevel = Object.fromEntries(LEVELS.map((level) => [level, []]));

  for (const word of words || []) {
    const level = lessonLevels.get(word.lesson_id);
    if (wordsByLevel[level]) wordsByLevel[level].push(word);
  }

  const usedIds = new Set();
  const questions = [];
  for (const level of LEVELS) {
    const seeded = makeQuestions(wordsByLevel[level], level, usedIds);
    if (seeded.length >= 3) {
      questions.push(...seeded);
    } else {
      // Several supported languages have course scaffolding but not a seeded
      // word bank yet. Generate a small level-specific diagnostic instead of
      // making placement unavailable for those learners.
      questions.push(...await generateLevelQuestions(language, nativeLanguage, level));
    }
  }

  return shuffle(questions);
}

router.get("/questions", async (req, res) => {
  try {
    const language = String(req.query.language || "");
    const questions = await buildPlacementQuestions(language, req.user?.nativeLanguage || "English");
    res.json({ language, questions });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status ? error.message : "Could not prepare the placement assessment.",
    });
  }
});

router.post("/complete", async (req, res) => {
  const supabase = require("./supabase");
  const userId = req.user?.id;
  const { language, level } = req.body || {};
  if (!userId || !LANGUAGES.includes(language) || !LEVELS.includes(level)) {
    return res.status(400).json({ error: "A valid language and recommended level are required." });
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("course_enrollments")
      .upsert({
        user_id: userId,
        language,
        level,
        status: "active",
        last_activity_at: now,
        updated_at: now,
      }, { onConflict: "user_id,language,level" })
      .select("user_id, language, level, status, started_at, last_activity_at")
      .single();

    if (error) throw error;
    return res.json({ enrollment: data });
  } catch (error) {
    console.error("Placement enrollment failed:", error.message);
    return res.status(502).json({ error: "Your recommended course could not be saved. Please try again." });
  }
});

module.exports = router;
module.exports.buildPlacementQuestions = buildPlacementQuestions;
module.exports.makeQuestions = makeQuestions;
module.exports.generateLevelQuestions = generateLevelQuestions;
module.exports.normalizeGeneratedQuestions = normalizeGeneratedQuestions;
