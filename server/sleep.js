const express = require("express");
const db = require("./database");
const { extractVocabulary } = require("./ai");
const { LANGUAGES, PRONUNCIATION_GUIDE } = require("./curriculum");

const router = express.Router();

const MIN_WORDS = 8; // 4 replayed + 4 not replayed
const MAX_WORDS = 16; // 8 replayed + 8 not replayed
const MIN_WORDS_AFTER_REMOVING = 6;
const RECENT_LESSONS = 4;
const MIN_TEXT = 150; // characters
const MAX_TEXT = 6000;
const MAX_TEXT_SESSIONS_PER_DAY = 5; // each one uses AI tokens

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSession(id, userId) {
  if (!Number.isInteger(id) || !Number.isInteger(userId)) return null;
  return db
    .prepare("SELECT * FROM sleep_sessions WHERE id = ? AND user_id = ?")
    .get(id, userId);
}

function sessionWords(sessionId) {
  return db
    .prepare(
      `SELECT id, word, meaning, pronunciation, cued, evening_correct
       FROM sleep_items
       WHERE session_id = ?`,
    )
    .all(sessionId);
}

// Multiple-choice questions for every word, with no answers and no cued flags
function makeQuestions(words) {
  const meanings = [...new Set(words.map((w) => w.meaning))];

  return shuffle(words).map((w) => {
    const wrong = shuffle(meanings.filter((m) => m !== w.meaning)).slice(0, 3);
    return {
      wordId: w.id,
      prompt: w.word,
      pronunciation: w.pronunciation,
      options: shuffle([w.meaning, ...wrong]),
    };
  });
}

// Grades answers in the same order as `words`. Returns null if any question is unanswered.
function grade(words, answers) {
  if (!Array.isArray(answers)) return null;

  const given = new Map();
  for (const a of answers) given.set(a.wordId, a.answer);
  if (!words.every((w) => given.has(w.id))) return null;

  return words.map((w) => ({
    wordId: w.id,
    word: w.word,
    correctAnswer: w.meaning,
    correct: given.get(w.id) === w.meaning,
    cued: w.cued === 1,
  }));
}

// Saves a session. Half of the words are replayed during sleep, half are not.
function createSession(userId, language, source, label, items) {
  const chosen = shuffle(items).slice(0, MAX_WORDS);
  const half = Math.floor(chosen.length / 2);
  const used = chosen.slice(0, half * 2);

  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        "INSERT INTO sleep_sessions (user_id, language, source, label) VALUES (?, ?, ?, ?)",
      )
      .run(userId, language, source, label);
    const sessionId = Number(result.lastInsertRowid);

    const add = db.prepare(
      `INSERT INTO sleep_items (session_id, word, meaning, pronunciation, cued)
       VALUES (?, ?, ?, ?, ?)`,
    );
    used.forEach((item, index) =>
      add.run(
        sessionId,
        item.word,
        item.meaning,
        item.pronunciation || null,
        index < half ? 1 : 0,
      ),
    );

    db.exec("COMMIT");
    return sessionId;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------- Source 1: our lessons ----------
// Prepare tonight's session from the words the user passed most recently
router.post("/sessions", (req, res) => {
  const { user_id, language } = req.body;
  if (!user_id || !language) {
    return res.status(400).json({ error: "user_id and language are required" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  const lessonIds = db
    .prepare(
      `SELECT lessons.id
       FROM lessons
       JOIN progress ON progress.lesson_id = lessons.id AND progress.user_id = ?
       JOIN units ON units.id = lessons.unit_id
       JOIN languages ON languages.id = units.language_id
       WHERE languages.name = ?
       ORDER BY progress.completed_at DESC
       LIMIT ${RECENT_LESSONS}`,
    )
    .all(user_id, language)
    .map((row) => row.id);

  const needMore = `Pass a few more ${language} lessons first. This source uses words you have just learned.`;
  if (lessonIds.length === 0) return res.status(400).json({ error: needMore });

  const marks = lessonIds.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT word, meaning, pronunciation FROM words WHERE lesson_id IN (${marks})`,
    )
    .all(...lessonIds);

  if (items.length < MIN_WORDS)
    return res.status(400).json({ error: needMore });

  try {
    const sessionId = createSession(user_id, language, "lessons", null, items);
    res.status(201).json({ sessionId, language });
  } catch (err) {
    console.error("Sleep session error:", err);
    res.status(500).json({ error: "Could not prepare the session." });
  }
});

// ---------- Sources 2 and 3: a book, or the user's own text ----------
router.post("/sessions/from-text", async (req, res) => {
  const { user_id, language, text, label } = req.body;
  if (!user_id || !language || typeof text !== "string") {
    return res
      .status(400)
      .json({ error: "user_id, language and text are required" });
  }
  if (!LANGUAGES.includes(language)) {
    return res
      .status(400)
      .json({
        error: `Choose one of these languages: ${LANGUAGES.join(", ")}`,
      });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "That user does not exist" });

  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < MIN_TEXT) {
    return res
      .status(400)
      .json({ error: "That text is too short. Use a few full sentences." });
  }
  if (clean.length > MAX_TEXT) {
    return res
      .status(400)
      .json({ error: "That text is too long. Use one part at a time." });
  }

  // Each text session costs AI tokens, so there is a daily limit
  const today = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sleep_sessions
       WHERE user_id = ? AND source = 'text' AND created_at > datetime('now', '-1 day')`,
    )
    .get(user_id).n;
  if (today >= MAX_TEXT_SESSIONS_PER_DAY) {
    return res
      .status(429)
      .json({
        error:
          "You have made enough text sessions for today. Try again tomorrow.",
      });
  }

  let items;
  try {
    items = await extractVocabulary({
      text: clean,
      language,
      count: MAX_WORDS,
      pronunciationGuide: PRONUNCIATION_GUIDE[language],
    });
  } catch (err) {
    console.error("Vocabulary error:", err.message);
    if (err.message.startsWith("429")) {
      return res
        .status(429)
        .json({
          error: "The AI is very busy right now. Try again in a few minutes.",
        });
    }
    return res
      .status(502)
      .json({
        error: "The AI could not pick words from that text. Try again.",
      });
  }

  if (items.length < MIN_WORDS) {
    return res.status(422).json({
      error:
        "Could not find enough usable words in that text. Try a longer or different passage.",
    });
  }

  try {
    const cleanLabel =
      typeof label === "string" ? label.trim().slice(0, 120) : null;
    const sessionId = createSession(
      user_id,
      language,
      "text",
      cleanLabel || null,
      items,
    );
    res.status(201).json({ sessionId, language });
  } catch (err) {
    console.error("Sleep session error:", err);
    res.status(500).json({ error: "Could not prepare the session." });
  }
});

// One session with its words: /sleep/sessions/3?user=1
router.get("/sessions/:id", (req, res) => {
  const session = getSession(Number(req.params.id), Number(req.query.user));
  if (!session) return res.status(404).json({ error: "Session not found." });

  res.json({
    id: session.id,
    language: session.language,
    source: session.source,
    label: session.label,
    tested: session.tested_at !== null,
    words: shuffle(sessionWords(session.id)),
  });
});

// Remove a word that looks wrong, before the evening quiz
router.delete("/sessions/:id/items/:itemId", (req, res) => {
  const session = getSession(Number(req.params.id), Number(req.query.user));
  if (!session) return res.status(404).json({ error: "Session not found." });
  if (session.tested_at) {
    return res.status(409).json({ error: "This session is already finished." });
  }

  const words = sessionWords(session.id);
  if (words.some((w) => w.evening_correct !== null)) {
    return res
      .status(409)
      .json({ error: "Words can only be removed before the evening quiz." });
  }
  if (words.length <= MIN_WORDS_AFTER_REMOVING) {
    return res
      .status(400)
      .json({ error: `Keep at least ${MIN_WORDS_AFTER_REMOVING} words.` });
  }

  const result = db
    .prepare("DELETE FROM sleep_items WHERE id = ? AND session_id = ?")
    .run(Number(req.params.itemId), session.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Word not found." });

  res.json({ removed: true });
});

// ---------- Evening quiz: a starting score for every word ----------

router.get("/sessions/:id/evening", (req, res) => {
  const session = getSession(Number(req.params.id), Number(req.query.user));
  if (!session) return res.status(404).json({ error: "Session not found." });
  if (session.tested_at) {
    return res.status(409).json({ error: "This session is already finished." });
  }

  const words = sessionWords(session.id);
  if (words.some((w) => w.evening_correct !== null)) {
    return res
      .status(409)
      .json({ error: "You already took the evening quiz for this session." });
  }

  res.json(makeQuestions(words));
});

router.post("/sessions/:id/evening", (req, res) => {
  const { user_id, answers } = req.body;
  const session = getSession(Number(req.params.id), Number(user_id));
  if (!session) return res.status(404).json({ error: "Session not found." });
  if (session.tested_at) {
    return res.status(409).json({ error: "This session is already finished." });
  }

  const words = sessionWords(session.id);
  if (words.some((w) => w.evening_correct !== null)) {
    return res
      .status(409)
      .json({ error: "You already took the evening quiz for this session." });
  }

  const graded = grade(words, answers);
  if (!graded) return res.status(400).json({ error: "Answer every question" });

  db.exec("BEGIN");
  try {
    const mark = db.prepare(
      "UPDATE sleep_items SET evening_correct = ? WHERE session_id = ? AND id = ?",
    );
    for (const g of graded) mark.run(g.correct ? 1 : 0, session.id, g.wordId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("Evening quiz error:", err);
    return res.status(500).json({ error: "Could not save the quiz." });
  }

  res.json({
    score: graded.filter((g) => g.correct).length,
    total: graded.length,
    missed: graded
      .filter((g) => !g.correct)
      .map((g) => ({
        wordId: g.wordId,
        word: g.word,
        correctAnswer: g.correctAnswer,
      })),
  });
});

// ---------- Morning test ----------

router.get("/sessions/:id/test", (req, res) => {
  const session = getSession(Number(req.params.id), Number(req.query.user));
  if (!session) return res.status(404).json({ error: "Session not found." });
  if (session.tested_at) {
    return res
      .status(409)
      .json({ error: "You already took the test for this session." });
  }

  res.json(makeQuestions(sessionWords(session.id)));
});

router.post("/sessions/:id/test", (req, res) => {
  const { user_id, answers, sleep_quality, cues_woke_me } = req.body;
  const session = getSession(Number(req.params.id), Number(user_id));
  if (!session) return res.status(404).json({ error: "Session not found." });
  if (session.tested_at) {
    return res
      .status(409)
      .json({ error: "You already took the test for this session." });
  }

  const words = sessionWords(session.id);
  const graded = grade(words, answers);
  if (!graded) return res.status(400).json({ error: "Answer every question" });

  // The evening quiz is optional: only compare with it if every word has an evening result
  const eveningDone = words.every((w) => w.evening_correct !== null);

  const cued = { score: 0, total: 0, evening: eveningDone ? 0 : null };
  const uncued = { score: 0, total: 0, evening: eveningDone ? 0 : null };

  graded.forEach((g, index) => {
    const group = g.cued ? cued : uncued;
    group.total++;
    if (g.correct) group.score++;
    if (eveningDone && words[index].evening_correct === 1) group.evening++;
  });

  const quality =
    Number.isInteger(sleep_quality) && sleep_quality >= 1 && sleep_quality <= 5
      ? sleep_quality
      : null;
  const woke = cues_woke_me === true ? 1 : cues_woke_me === false ? 0 : null;

  db.prepare(
    `UPDATE sleep_sessions
     SET tested_at = CURRENT_TIMESTAMP,
         cued_score = ?, cued_total = ?, uncued_score = ?, uncued_total = ?,
         cued_evening_score = ?, uncued_evening_score = ?,
         sleep_quality = ?, cues_woke_me = ?
     WHERE id = ?`,
  ).run(
    cued.score,
    cued.total,
    uncued.score,
    uncued.total,
    cued.evening,
    uncued.evening,
    quality,
    woke,
    session.id,
  );

  res.json({
    cued,
    uncued,
    results: graded.map((g) => ({
      wordId: g.wordId,
      word: g.word,
      correctAnswer: g.correctAnswer,
      correct: g.correct,
    })),
  });
});

// A session waiting for its morning test, and past results: /sleep/history?user=1
router.get("/history", (req, res) => {
  const userId = Number(req.query.user);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: "user is required" });
  }

  const pending =
    db
      .prepare(
        `SELECT id, language, source, label, created_at
         FROM sleep_sessions
         WHERE user_id = ? AND tested_at IS NULL
           AND created_at > datetime('now', '-48 hours')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(userId) || null;

  const results = db
    .prepare(
      `SELECT id, language, source, label, created_at, cued_score, cued_total,
              uncued_score, uncued_total, cued_evening_score, uncued_evening_score,
              sleep_quality, cues_woke_me
       FROM sleep_sessions
       WHERE user_id = ? AND tested_at IS NOT NULL
       ORDER BY id DESC LIMIT 14`,
    )
    .all(userId);

  res.json({ pending, results });
});

module.exports = router;
