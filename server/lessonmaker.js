"use strict";

const supabase = require("./supabase");
const { generateLesson } = require("./ai");
const {
  LESSONS_PER_UNIT,
  PRONUNCIATION_GUIDE,
} = require("./curriculum");
const { wordsForLesson, lessonPlan } = require("./hsk");

const pending = new Map();

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function saveLesson(lessonId, title, words) {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error("The generated lesson contains no words.");
  }

  const wordRows = words.map((word) => ({
    lesson_id: lessonId,
    word: word.word,
    meaning: word.meaning,
    pronunciation: word.pronunciation || null,
    focus: word.focus || null,
  }));

  if (
    wordRows.some(
      (word) =>
        typeof word.word !== "string" ||
        !word.word.trim() ||
        typeof word.meaning !== "string" ||
        !word.meaning.trim(),
    )
  ) {
    throw new Error("The generated lesson contains invalid words.");
  }

  const { data: existingWords, error: readError } = await supabase
    .from("words")
    .select("id")
    .eq("lesson_id", lessonId);

  throwIfError(readError, "Could not check existing lesson words");

  if (existingWords.length > 0) {
    throw new Error(
      "This lesson already has saved words; refusing to create duplicates.",
    );
  }

  const { data: updatedLesson, error: updateError } = await supabase
    .from("lessons")
    .update({
      title,
      status: "ready",
      format: "sentences",
    })
    .eq("id", lessonId)
    .select("id")
    .maybeSingle();

  throwIfError(updateError, "Could not update lesson");

  if (!updatedLesson) {
    throw new Error("Lesson not found");
  }

  const { error: insertError } = await supabase
    .from("words")
    .insert(wordRows);

  if (insertError) {
    // Best-effort recovery: restore the lesson's empty status.
    // Supabase JS does not make these two writes one transaction.
    const { error: rollbackError } = await supabase
      .from("lessons")
      .update({ status: "empty" })
      .eq("id", lessonId);

    if (rollbackError) {
      console.error(
        "Could not restore lesson status after word insert failure:",
        rollbackError.message,
      );
    }

    throw new Error(`Could not save lesson words: ${insertError.message}`);
  }
}

async function makeLesson(lessonId) {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(`
      id,
      status,
      position,
      unit_id,
      units!inner (
        title,
        language_id,
        level_id,
        languages!inner (name),
        levels!inner (name, cefr)
      )
    `)
    .eq("id", lessonId)
    .maybeSingle();

  throwIfError(lessonError, "Could not load lesson");

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  if (lesson.status === "ready") {
    return "ready";
  }

  const unit = lesson.units;
  const language = unit.languages.name;
  const level = unit.levels.name;

  const { data: previousLessons, error: previousError } = await supabase
    .from("lessons")
    .select("title")
    .eq("unit_id", lesson.unit_id)
    .eq("status", "ready")
    .order("position");

  throwIfError(previousError, "Could not load previous lessons");

  const request = {
    language,
    nativeLanguage: process.env.NATIVE_LANGUAGE || "English",
    level,
    cefr: unit.levels.cefr,
    unit: unit.title,
    number: lesson.position,
    total: LESSONS_PER_UNIT,
    previousTitles: previousLessons.map((row) => row.title),
    pronunciationGuide: PRONUNCIATION_GUIDE[language],
    targetWords: /chinese/i.test(language)
      ? wordsForLesson(unit.title, lesson.position)
      : null,
    hskGrade: /chinese/i.test(language)
      ? Number(unit.title.match(/^HSK ([1-6])/)?.[1])
      : null,
    hskGrammarFocus: /chinese/i.test(language)
      ? lessonPlan(unit.title, lesson.position, level)?.grammar
      : null,
  };

  let made;
  let lastError;

  for (let attempt = 1; attempt <= 2 && !made; attempt++) {
    try {
      made = await generateLesson(request);

      if (
        !made ||
        typeof made.title !== "string" ||
        !made.title.trim() ||
        !Array.isArray(made.words) ||
        made.words.length === 0
      ) {
        throw new Error("AI returned an invalid lesson structure");
      }
    } catch (err) {
      lastError = err;

      if (String(err.message).startsWith("429")) {
        throw err;
      }
    }
  }

  if (!made) {
    throw lastError || new Error("Could not generate lesson");
  }

  await saveLesson(lessonId, made.title, made.words);

  return "ready";
}

function ensureLesson(lessonId) {
  if (pending.has(lessonId)) {
    return pending.get(lessonId);
  }

  const job = makeLesson(lessonId).finally(() => {
    pending.delete(lessonId);
  });

  pending.set(lessonId, job);
  return job;
}

module.exports = { ensureLesson };
