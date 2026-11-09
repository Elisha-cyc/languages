const express = require("express");
const supabase = require("./supabase");
const { extractVocabulary } = require("./ai");
const { LANGUAGES, PRONUNCIATION_GUIDE } = require("./curriculum");

const router = express.Router();

const MIN_WORDS = 8;
const MAX_WORDS = 16;
const MIN_WORDS_AFTER_REMOVING = 6;
const RECENT_LESSONS = 4;
const MIN_TEXT = 150;
const MAX_TEXT = 6000;
const MAX_TEXT_SESSIONS_PER_DAY = 5;
const DEFAULT_NATIVE_LANGUAGE = "English";

// ---------- Helpers ----------

function shuffle(list) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function validId(value) {
  return Number.isInteger(value) && value > 0;
}

async function getUser(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getSession(id, userId) {
  if (!validId(id) || !validId(userId)) return null;

  const { data, error } = await supabase
    .from("sleep_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function sessionWords(sessionId) {
  const { data, error } = await supabase
    .from("sleep_items")
    .select("id, word, meaning, pronunciation, cued, evening_correct")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

function makeQuestions(words) {
  const meanings = [...new Set(words.map((w) => w.meaning))];

  return shuffle(words).map((word) => {
    const wrong = shuffle(
      meanings.filter((meaning) => meaning !== word.meaning),
    ).slice(0, 3);

    return {
      wordId: word.id,
      prompt: word.word,
      pronunciation: word.pronunciation,
      options: shuffle([word.meaning, ...wrong]),
    };
  });
}

function grade(words, answers) {
  if (!Array.isArray(answers)) return null;

  const given = new Map();

  for (const answer of answers) {
    if (!answer || answer.wordId === undefined) continue;
    given.set(answer.wordId, answer.answer);
  }

  if (!words.every((word) => given.has(word.id))) {
    return null;
  }

  return words.map((word) => ({
    wordId: word.id,
    word: word.word,
    correctAnswer: word.meaning,
    correct: given.get(word.id) === word.meaning,
    cued: Number(word.cued) === 1,
  }));
}

async function createSession(userId, language, source, label, items) {
  const chosen = shuffle(items).slice(0, MAX_WORDS);
  const half = Math.floor(chosen.length / 2);
  const used = chosen.slice(0, half * 2);

  const sessionItems = used.map((item, index) => ({
    word: item.word,
    meaning: item.meaning,
    pronunciation: item.pronunciation || null,
    cued: index < half ? 1 : 0,
  }));

  const { data, error } = await supabase.rpc("create_sleep_session", {
    p_user_id: userId,
    p_language: language,
    p_source: source,
    p_label: label,
    p_items: sessionItems,
  });

  if (error) throw error;

  const sessionId = Number(data);

  if (!validId(sessionId)) {
    throw new Error("Supabase did not return a valid sleep session ID.");
  }

  return sessionId;
}

async function saveEveningQuiz(sessionId, results) {
  return supabase.rpc("save_sleep_evening_quiz", {
    p_session_id: sessionId,
    p_results: results,
  });
}

// ---------- Source 1: Our lessons ----------

router.post("/sessions", async (req, res) => {
  try {
    const { user_id, language } = req.body || {};

    if (!validId(user_id) || !language) {
      return res.status(400).json({
        error: "user_id and language are required",
      });
    }

    const user = await getUser(user_id);

    if (!user) {
      return res.status(404).json({
        error: "That user does not exist",
      });
    }

    const needMore = `Pass a few more ${language} lessons first. This source uses words you have just learned.`;

    // Fetch completed progress. Filter by language before selecting the newest
    // matching lessons so unrelated courses do not hide eligible lessons.
    const { data: progress, error: progressError } = await supabase
      .from("progress")
      .select("lesson_id, completed_at")
      .eq("user_id", user_id)
      .order("completed_at", { ascending: false });

    if (progressError) throw progressError;

    const allLessonIds = [
      ...new Set((progress || []).map((row) => row.lesson_id)),
    ];

    if (allLessonIds.length === 0) {
      return res.status(400).json({ error: needMore });
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, unit_id")
      .in("id", allLessonIds);

    if (lessonsError) throw lessonsError;

    const unitIds = [
      ...new Set((lessons || []).map((lesson) => lesson.unit_id)),
    ];

    if (unitIds.length === 0) {
      return res.status(400).json({ error: needMore });
    }

    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select("id, language_id")
      .in("id", unitIds);

    if (unitsError) throw unitsError;

    const languageIds = [
      ...new Set((units || []).map((unit) => unit.language_id)),
    ];

    if (languageIds.length === 0) {
      return res.status(400).json({ error: needMore });
    }

    const { data: languages, error: languagesError } = await supabase
      .from("languages")
      .select("id, name")
      .in("id", languageIds);

    if (languagesError) throw languagesError;

    const matchingLanguageIds = new Set(
      (languages || [])
        .filter((item) => item.name === language)
        .map((item) => item.id),
    );

    const matchingUnitIds = new Set(
      (units || [])
        .filter((unit) => matchingLanguageIds.has(unit.language_id))
        .map((unit) => unit.id),
    );

    const matchingLessonIds = (progress || [])
      .filter((row) => {
        const lesson = (lessons || []).find(
          (item) => item.id === row.lesson_id,
        );

        return lesson && matchingUnitIds.has(lesson.unit_id);
      })
      .slice(0, RECENT_LESSONS)
      .map((row) => row.lesson_id);

    if (matchingLessonIds.length === 0) {
      return res.status(400).json({ error: needMore });
    }

    const { data: items, error: wordsError } = await supabase
      .from("words")
      .select("word, meaning, pronunciation")
      .in("lesson_id", matchingLessonIds);

    if (wordsError) throw wordsError;

    if (!items || items.length < MIN_WORDS) {
      return res.status(400).json({ error: needMore });
    }

    const sessionId = await createSession(
      user_id,
      language,
      "lessons",
      null,
      items,
    );

    return res.status(201).json({ sessionId, language });
  } catch (err) {
    console.error("Sleep session error:", err);

    return res.status(500).json({
      error: "Could not prepare the session.",
    });
  }
});

// ---------- Sources 2 and 3: A book or user's own text ----------

router.post("/sessions/from-text", async (req, res) => {
  try {
    const { user_id, language, text, label, native_language } = req.body || {};

    if (!validId(user_id) || !language || typeof text !== "string") {
      return res.status(400).json({
        error: "user_id, language and text are required",
      });
    }

    if (!LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: `Choose one of these languages: ${LANGUAGES.join(", ")}`,
      });
    }

    const user = await getUser(user_id);

    if (!user) {
      return res.status(404).json({
        error: "That user does not exist",
      });
    }

    const clean = text.replace(/\s+/g, " ").trim();

    if (clean.length < MIN_TEXT) {
      return res.status(400).json({
        error: "That text is too short. Use a few full sentences.",
      });
    }

    if (clean.length > MAX_TEXT) {
      return res.status(400).json({
        error: "That text is too long. Use one part at a time.",
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from("sleep_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("source", "text")
      .gte("created_at", since);

    if (countError) throw countError;

    if ((count || 0) >= MAX_TEXT_SESSIONS_PER_DAY) {
      return res.status(429).json({
        error:
          "You have made enough text sessions for today. Try again tomorrow.",
      });
    }

    const nativeLanguage =
      typeof native_language === "string" && native_language.trim()
        ? native_language.trim()
        : DEFAULT_NATIVE_LANGUAGE;

    let items;

    try {
      items = await extractVocabulary({
        text: clean,
        language,
        nativeLanguage,
        count: MAX_WORDS,
        pronunciationGuide: PRONUNCIATION_GUIDE[language],
      });
    } catch (err) {
      console.error("Vocabulary error:", err.message);

      if (err.message.startsWith("429")) {
        return res.status(429).json({
          error: "The AI is very busy right now. Try again in a few minutes.",
        });
      }

      return res.status(502).json({
        error: "The AI could not pick words from that text. Try again.",
      });
    }

    if (!Array.isArray(items) || items.length < MIN_WORDS) {
      return res.status(422).json({
        error:
          "Could not find enough usable words in that text. Try a longer or different passage.",
      });
    }

    const cleanLabel =
      typeof label === "string" ? label.trim().slice(0, 120) : null;

    const sessionId = await createSession(
      user_id,
      language,
      "text",
      cleanLabel || null,
      items,
    );

    return res.status(201).json({ sessionId, language });
  } catch (err) {
    console.error("Sleep text session error:", err);

    return res.status(500).json({
      error: "Could not prepare the session.",
    });
  }
});

// ---------- Get one session ----------

router.get("/sessions/:id", async (req, res) => {
  try {
    const session = await getSession(
      Number(req.params.id),
      Number(req.query.user),
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const words = await sessionWords(session.id);

    return res.json({
      id: session.id,
      language: session.language,
      source: session.source,
      label: session.label,
      tested: session.tested_at !== null,
      words: shuffle(words),
    });
  } catch (err) {
    console.error("Get sleep session error:", err);

    return res.status(500).json({
      error: "Could not load the session.",
    });
  }
});

// ---------- Remove a word before the evening quiz ----------

router.delete("/sessions/:id/items/:itemId", async (req, res) => {
  try {
    const session = await getSession(
      Number(req.params.id),
      Number(req.query.user),
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (session.tested_at !== null) {
      return res.status(409).json({
        error: "This session is already finished.",
      });
    }

    const words = await sessionWords(session.id);

    if (words.some((word) => word.evening_correct !== null)) {
      return res.status(409).json({
        error: "Words can only be removed before the evening quiz.",
      });
    }

    if (words.length <= MIN_WORDS_AFTER_REMOVING) {
      return res.status(400).json({
        error: `Keep at least ${MIN_WORDS_AFTER_REMOVING} words.`,
      });
    }

    const { data, error } = await supabase
      .from("sleep_items")
      .delete()
      .eq("id", Number(req.params.itemId))
      .eq("session_id", session.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Word not found." });
    }

    return res.json({ removed: true });
  } catch (err) {
    console.error("Remove sleep word error:", err);

    return res.status(500).json({
      error: "Could not remove the word.",
    });
  }
});

// ---------- Evening quiz: starting score ----------

router.get("/sessions/:id/evening", async (req, res) => {
  try {
    const session = await getSession(
      Number(req.params.id),
      Number(req.query.user),
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (session.tested_at !== null) {
      return res.status(409).json({
        error: "This session is already finished.",
      });
    }

    const words = await sessionWords(session.id);

    if (words.some((word) => word.evening_correct !== null)) {
      return res.status(409).json({
        error: "You already took the evening quiz for this session.",
      });
    }

    return res.json(makeQuestions(words));
  } catch (err) {
    console.error("Get evening quiz error:", err);

    return res.status(500).json({
      error: "Could not load the evening quiz.",
    });
  }
});

router.post("/sessions/:id/evening", async (req, res) => {
  try {
    const { user_id, answers } = req.body || {};

    const session = await getSession(Number(req.params.id), Number(user_id));

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (session.tested_at !== null) {
      return res.status(409).json({
        error: "This session is already finished.",
      });
    }

    const words = await sessionWords(session.id);

    if (words.some((word) => word.evening_correct !== null)) {
      return res.status(409).json({
        error: "You already took the evening quiz for this session.",
      });
    }

    const graded = grade(words, answers);

    if (!graded) {
      return res.status(400).json({
        error: "Answer every question",
      });
    }

    const results = graded.map((item) => ({
      item_id: item.wordId,
      is_correct: item.correct,
    }));

    const { data, error } = await saveEveningQuiz(session.id, results);

    if (error) throw error;

    if (data !== true) {
      return res.status(409).json({
        error:
          "The evening quiz could not be saved. The session may already have been updated.",
      });
    }

    return res.json({
      score: graded.filter((item) => item.correct).length,
      total: graded.length,
      missed: graded
        .filter((item) => !item.correct)
        .map((item) => ({
          wordId: item.wordId,
          word: item.word,
          correctAnswer: item.correctAnswer,
        })),
    });
  } catch (err) {
    console.error("Evening quiz error:", err);

    return res.status(500).json({
      error: "Could not save the quiz.",
    });
  }
});

// ---------- Morning test ----------

router.get("/sessions/:id/test", async (req, res) => {
  try {
    const session = await getSession(
      Number(req.params.id),
      Number(req.query.user),
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (session.tested_at !== null) {
      return res.status(409).json({
        error: "You already took the test for this session.",
      });
    }

    const words = await sessionWords(session.id);

    return res.json(makeQuestions(words));
  } catch (err) {
    console.error("Get morning test error:", err);

    return res.status(500).json({
      error: "Could not load the morning test.",
    });
  }
});

router.post("/sessions/:id/test", async (req, res) => {
  try {
    const { user_id, answers, sleep_quality, cues_woke_me } = req.body || {};

    const session = await getSession(Number(req.params.id), Number(user_id));

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (session.tested_at !== null) {
      return res.status(409).json({
        error: "You already took the test for this session.",
      });
    }

    const words = await sessionWords(session.id);
    const graded = grade(words, answers);

    if (!graded) {
      return res.status(400).json({
        error: "Answer every question",
      });
    }

    const eveningDone = words.every((word) => word.evening_correct !== null);

    const cued = {
      score: 0,
      total: 0,
      evening: eveningDone ? 0 : null,
    };

    const uncued = {
      score: 0,
      total: 0,
      evening: eveningDone ? 0 : null,
    };

    // Match each graded answer to its actual word by ID, rather than relying
    // on array position.
    const wordById = new Map(words.map((word) => [word.id, word]));

    for (const item of graded) {
      const group = item.cued ? cued : uncued;
      const originalWord = wordById.get(item.wordId);

      group.total++;

      if (item.correct) {
        group.score++;
      }

      if (eveningDone && Number(originalWord?.evening_correct) === 1) {
        group.evening++;
      }
    }

    const quality =
      Number.isInteger(sleep_quality) &&
      sleep_quality >= 1 &&
      sleep_quality <= 5
        ? sleep_quality
        : null;

    const woke = cues_woke_me === true ? 1 : cues_woke_me === false ? 0 : null;

    const { data, error } = await supabase.rpc("finish_sleep_test", {
      p_session_id: session.id,
      p_cued_score: cued.score,
      p_cued_total: cued.total,
      p_uncued_score: uncued.score,
      p_uncued_total: uncued.total,
      p_cued_evening_score: cued.evening,
      p_uncued_evening_score: uncued.evening,
      p_sleep_quality: quality,
      p_cues_woke_me: woke,
    });

    if (error) throw error;

    if (data !== true) {
      return res.status(409).json({
        error: "The test could not be saved. It may already be finished.",
      });
    }

    return res.json({
      cued,
      uncued,
      results: graded.map((item) => ({
        wordId: item.wordId,
        word: item.word,
        correctAnswer: item.correctAnswer,
        correct: item.correct,
      })),
    });
  } catch (err) {
    console.error("Morning test error:", err);

    return res.status(500).json({
      error: "Could not save the morning test.",
    });
  }
});

// ---------- Sleep history ----------

router.get("/history", async (req, res) => {
  try {
    const userId = Number(req.query.user);

    if (!validId(userId)) {
      return res.status(400).json({
        error: "user is required",
      });
    }

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: pendingRows, error: pendingError } = await supabase
      .from("sleep_sessions")
      .select("id, language, source, label, created_at")
      .eq("user_id", userId)
      .is("tested_at", null)
      .gt("created_at", since)
      .order("id", { ascending: false })
      .limit(1);

    if (pendingError) throw pendingError;

    const { data: results, error: resultsError } = await supabase
      .from("sleep_sessions")
      .select(
        `id, language, source, label, created_at,
         cued_score, cued_total,
         uncued_score, uncued_total,
         cued_evening_score, uncued_evening_score,
         sleep_quality, cues_woke_me`,
      )
      .eq("user_id", userId)
      .not("tested_at", "is", null)
      .order("id", { ascending: false })
      .limit(14);

    if (resultsError) throw resultsError;

    return res.json({
      pending: pendingRows?.[0] || null,
      results: results || [],
    });
  } catch (err) {
    console.error("Sleep history error:", err);

    return res.status(500).json({
      error: "Could not load sleep history.",
    });
  }
});

module.exports = router;
module.exports.saveEveningQuiz = saveEveningQuiz;
