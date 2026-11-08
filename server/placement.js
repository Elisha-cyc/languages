"use strict";

const express = require("express");
const supabase = require("./supabase");
const { LANGUAGES } = require("./curriculum");

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

async function buildPlacementQuestions(language) {
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
    questions.push(...makeQuestions(wordsByLevel[level], level, usedIds));
  }

  if (questions.length < 6) {
    const error = new Error("There is not enough vocabulary to assess this language yet.");
    error.status = 422;
    throw error;
  }

  return shuffle(questions);
}

router.get("/questions", async (req, res) => {
  try {
    const language = String(req.query.language || "");
    const questions = await buildPlacementQuestions(language);
    res.json({ language, questions });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status ? error.message : "Could not prepare the placement assessment.",
    });
  }
});

module.exports = router;
module.exports.buildPlacementQuestions = buildPlacementQuestions;
module.exports.makeQuestions = makeQuestions;
