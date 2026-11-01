const db = require("./database");
const { generateLesson } = require("./ai");
const { LESSONS_PER_UNIT, PRONUNCIATION_GUIDE } = require("./curriculum");

const pending = new Map(); // lessons being generated right now, so two requests share one AI call

function saveLesson(lessonId, title, words) {
  db.exec("BEGIN");
  try {
    db.prepare(
      "UPDATE lessons SET title = ?, status = 'ready', format = 'sentences' WHERE id = ?",
    ).run(title, lessonId);
    const add = db.prepare(
      "INSERT INTO words (lesson_id, word, meaning, pronunciation, focus) VALUES (?, ?, ?, ?, ?)",
    );
    for (const w of words) {
      add.run(
        lessonId,
        w.word,
        w.meaning,
        w.pronunciation || null,
        w.focus || null,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

async function makeLesson(lessonId) {
  const lesson = db
    .prepare(
      `SELECT lessons.id, lessons.status, lessons.position, lessons.unit_id,
              units.title AS unit, languages.name AS language,
              levels.name AS level, levels.cefr AS cefr
       FROM lessons
       JOIN units ON units.id = lessons.unit_id
       JOIN languages ON languages.id = units.language_id
       JOIN levels ON levels.id = units.level_id
       WHERE lessons.id = ?`,
    )
    .get(lessonId);

  if (!lesson) throw new Error("Lesson not found");
  if (lesson.status === "ready") return "ready";

  const previousTitles = db
    .prepare(
      "SELECT title FROM lessons WHERE unit_id = ? AND status = 'ready' ORDER BY position",
    )
    .all(lesson.unit_id)
    .map((row) => row.title);

  const request = {
    language: lesson.language,
    nativeLanguage: process.env.NATIVE_LANGUAGE || "English",
    level: lesson.level,
    cefr: lesson.cefr,
    unit: lesson.unit,
    number: lesson.position,
    total: LESSONS_PER_UNIT,
    previousTitles,
    pronunciationGuide: PRONUNCIATION_GUIDE[lesson.language],
  };

  // The AI sometimes returns a lesson in the wrong shape, so try twice
  let made;
  let lastError;
  for (let attempt = 1; attempt <= 2 && !made; attempt++) {
    try {
      made = await generateLesson(request);
    } catch (err) {
      lastError = err;
      if (String(err.message).startsWith("429")) throw err; // busy: do not retry
    }
  }
  if (!made) throw lastError;

  saveLesson(lessonId, made.title, made.words);
  return "ready";
}

function ensureLesson(lessonId) {
  if (pending.has(lessonId)) return pending.get(lessonId);
  const job = makeLesson(lessonId).finally(() => pending.delete(lessonId));
  pending.set(lessonId, job);
  return job;
}

module.exports = { ensureLesson };
