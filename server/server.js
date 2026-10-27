const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const { askTutor, MODES, retellBook } = require("./ai");
const db = require("./database");
const { imageToText, OCR_LANGUAGES } = require("./ocr");
const { ensureLesson } = require("./lessonmaker");
const {
  searchFreeBooks,
  searchDetailBooks,
  browseFreeBooks,
  searchWikisource,
  loadWikisource,
  loadBook,
  BOOK_LANGUAGES,
  BookError,
} = require("./books");

// pdf-parse version 2 is required (version 1 has a different API)
if (typeof PDFParse !== "function") {
  console.error(
    "pdf-parse is an old version. Run: npm install pdf-parse@latest",
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const { router: authRouter, requireAuth } = require("./auth");
app.use("/auth", authRouter);
app.use(requireAuth);
app.get("/", (req, res) => {
  res.send("LinguaApp server is running");
});

app.use("/chat", require("./chat"));
app.use("/hanzi", require("./hanzi"));

app.use("/speech", require("./speech"));
// ---------- Curriculum ----------

// All languages, ready ones first. "ready" means at least one finished lesson.
// Every language is available: lessons are written by the AI when first opened
// Every language is open: lessons are written by the AI when a student first opens them
// ---------- Curriculum ----------

// Every language is open: lessons are written by the AI when a student first opens them
app.get("/languages", (req, res) => {
  const rows = db.prepare("SELECT name FROM languages ORDER BY name").all();
  res.json(rows.map((row) => ({ name: row.name, ready: true })));
});

// All levels, in order
app.get("/levels", (req, res) => {
  const levels = db
    .prepare("SELECT id, name, cefr FROM levels ORDER BY position")
    .all();
  res.json(levels);
});

// Every unit in a level, plus whether it is locked for this user:
// /units?language=Arabic&level=Beginner&user=1
app.get("/units", (req, res) => {
  const { language, level, user } = req.query;
  if (!language || !level) {
    return res.status(400).json({ error: "language and level are required" });
  }

  const rows = db
    .prepare(
      `SELECT units.id, units.title,
              (SELECT COUNT(*) FROM lessons
                WHERE lessons.unit_id = units.id) AS total,
              (SELECT COUNT(*) FROM lessons
                JOIN progress ON progress.lesson_id = lessons.id AND progress.user_id = ?
                WHERE lessons.unit_id = units.id) AS done
       FROM units
       JOIN languages ON units.language_id = languages.id
       JOIN levels ON units.level_id = levels.id
       WHERE languages.name = ? AND levels.name = ?
       ORDER BY units.position`,
    )
    .all(user || 0, language, level);

  let previousComplete = true;
  const units = rows.map((unit) => {
    const locked = !previousComplete;
    previousComplete = unit.done >= unit.total;
    return {
      id: unit.id,
      title: unit.title,
      done: unit.done,
      total: unit.total,
      locked,
    };
  });

  res.json(units);
});

// Every lesson in one unit, with completion for one user:
// /lessons?unit=1&user=1
app.get("/lessons", (req, res) => {
  const { unit, user } = req.query;
  if (!unit) {
    return res.status(400).json({ error: "unit is required" });
  }

  const lessons = db
    .prepare(
      `SELECT lessons.id, lessons.title,
              progress.lesson_id IS NOT NULL AS completed
       FROM lessons
       LEFT JOIN progress
         ON progress.lesson_id = lessons.id AND progress.user_id = ?
       WHERE lessons.unit_id = ?
       ORDER BY lessons.position`,
    )
    .all(user || 0, unit);

  res.json(lessons);
});

// Words in one lesson. If the lesson has not been written yet, the AI writes it now.
app.get("/lessons/:id/words", async (req, res) => {
  const lessonId = Number(req.params.id);

  try {
    await ensureLesson(lessonId);
  } catch (err) {
    console.error("Lesson error:", err.message);
    if (err.message === "Lesson not found") {
      return res.status(404).json({ error: "That lesson does not exist." });
    }
    const busy = String(err.message).startsWith("429");
    return res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy right now. Try again in a few minutes."
        : "Could not prepare this lesson. Try again.",
    });
  }

  const words = db
    .prepare(
      "SELECT id, word, meaning, pronunciation, focus FROM words WHERE lesson_id = ?",
    )
    .all(lessonId);

  res.json(words);
});

// Words in one lesson. If the lesson has not been written yet, the AI writes it now.
app.get("/lessons/:id/words", async (req, res) => {
  const lessonId = Number(req.params.id);

  try {
    await ensureLesson(lessonId);
  } catch (err) {
    console.error("Lesson error:", err.message);
    if (err.message === "Lesson not found") {
      return res.status(404).json({ error: "That lesson does not exist." });
    }
    const busy = String(err.message).startsWith("429");
    return res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy right now. Try again in a few minutes."
        : "Could not prepare this lesson. Try again.",
    });
  }

  const words = db
    .prepare(
      "SELECT id, word, meaning, pronunciation, focus FROM words WHERE lesson_id = ?",
    )
    .all(lessonId);

  res.json(words);
});

// Builds a lesson on demand if it is still empty
app.post("/lessons/:id/generate", async (req, res) => {
  try {
    const status = await ensureLesson(Number(req.params.id));
    res.json({ status });
  } catch (err) {
    console.error("Generate error:", err.message);
    const busy = err.message.startsWith("429");
    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy. Try again in a few minutes."
        : "Could not prepare this lesson.",
    });
  }
});

// ---------- Quiz ----------
const PASS_MARK = 0.7;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Questions for one lesson: /lessons/1/quiz (no answers are sent)
app.get("/lessons/:id/quiz", (req, res) => {
  const words = db
    .prepare(
      "SELECT id, word, meaning, pronunciation FROM words WHERE lesson_id = ?",
    )
    .all(Number(req.params.id));

  const meanings = [...new Set(words.map((w) => w.meaning))];
  if (meanings.length < 2) return res.json([]);

  const questions = shuffle(words).map((w) => {
    const wrong = shuffle(meanings.filter((m) => m !== w.meaning)).slice(0, 3);
    return {
      wordId: w.id,
      prompt: w.word,
      pronunciation: w.pronunciation,
      options: shuffle([w.meaning, ...wrong]),
    };
  });

  res.json(questions);
});

// Grade a quiz and record progress if passed
app.post("/lessons/:id/quiz", (req, res) => {
  const { user_id, answers } = req.body;
  const lessonId = Number(req.params.id);

  if (!user_id || !Array.isArray(answers)) {
    return res.status(400).json({ error: "user_id and answers are required" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
  const words = db
    .prepare("SELECT id, word, meaning FROM words WHERE lesson_id = ?")
    .all(lessonId);
  if (!user || words.length === 0) {
    return res
      .status(404)
      .json({ error: "That user or lesson does not exist" });
  }

  const given = new Map();
  for (const a of answers) given.set(a.wordId, a.answer);
  if (!words.every((w) => given.has(w.id))) {
    return res.status(400).json({ error: "Answer every question" });
  }

  const results = words.map((w) => ({
    wordId: w.id,
    word: w.word,
    correct: given.get(w.id) === w.meaning,
    correctAnswer: w.meaning,
  }));

  const score = results.filter((r) => r.correct).length;
  const total = words.length;
  const passed = score / total >= PASS_MARK;

  if (passed) {
    db.prepare(
      "INSERT OR IGNORE INTO progress (user_id, lesson_id) VALUES (?, ?)",
    ).run(user_id, lessonId);
  }

  res.json({ score, total, passed, results });
});

// ---------- AI tutor ----------
app.post("/ai/lesson", async (req, res) => {
  const { text, mode, targetLanguage, nativeLanguage, level } = req.body;

  if (!text || !mode || !targetLanguage || !nativeLanguage) {
    return res.status(400).json({
      error: "text, mode, targetLanguage and nativeLanguage are required",
    });
  }
  if (!MODES[mode]) {
    return res
      .status(400)
      .json({ error: `mode must be one of: ${Object.keys(MODES).join(", ")}` });
  }
  if (text.length > 4000) {
    return res
      .status(400)
      .json({ error: "Text is too long (max 4000 characters)" });
  }

  try {
    const reply = await askTutor({
      text,
      mode,
      targetLanguage,
      nativeLanguage,
      level: level || "Beginner",
    });
    res.json({ reply });
  } catch (err) {
    console.error("AI error:", err.message);
    if (err.message.startsWith("429")) {
      return res.status(429).json({
        error:
          "The AI tutor is very busy right now. Please try again in a few minutes.",
      });
    }
    res.status(500).json({ error: "The AI tutor is unavailable right now" });
  }
});

// ---------- File import ----------
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 60000; // about 20 parts, which protects the AI token budget

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function pdfToText(bytes) {
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    // Version 2 may add page markers like "-- 1 of 2 --"; remove them
    return result.text.replace(/^-- \d+ of \d+ --$/gm, "");
  } finally {
    await parser.destroy();
  }
}

app.post("/import", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      const tooBig = uploadError.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        error: tooBig
          ? "That file is too large (max 10 MB)."
          : "The upload failed. Try again.",
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file was received." });
    }

    const name = file.originalname.toLowerCase();
    const bytes = file.buffer;

    try {
      let text = "";

      if (name.endsWith(".pdf")) {
        if (bytes.slice(0, 4).toString() !== "%PDF") {
          return res
            .status(400)
            .json({ error: "That does not look like a real PDF." });
        }
        text = await pdfToText(bytes);
      } else if (name.endsWith(".docx")) {
        if (bytes.slice(0, 2).toString() !== "PK") {
          return res
            .status(400)
            .json({ error: "That does not look like a real Word file." });
        }
        text = (await mammoth.extractRawText({ buffer: bytes })).value;
      } else if (name.endsWith(".txt")) {
        text = bytes.toString("utf8");
      } else if (name.endsWith(".doc")) {
        return res.status(400).json({
          error:
            "Old .doc files are not supported. Save it as .docx or PDF and try again.",
        });
      } else {
        return res
          .status(400)
          .json({ error: "Please choose a PDF, .docx or .txt file." });
      }

      text = cleanText(text);

      if (text.length < 20) {
        return res.status(422).json({
          error:
            "No readable text found. It may be a scanned document; try the photo option instead.",
        });
      }

      const truncated = text.length > MAX_CHARS;
      res.json({
        fileName: file.originalname,
        text: text.slice(0, MAX_CHARS),
        characters: text.length,
        truncated,
      });
    } catch (err) {
      console.error("Import error:", err);

      if (err && err.name === "PasswordException") {
        return res.status(422).json({
          error:
            "That PDF is password-protected. Remove the password and try again.",
        });
      }
      res.status(422).json({ error: "Could not read that file." });
    }
  });
});

// ---------- Photo to text (OCR) ----------
function looksLikeImage(bytes) {
  const png =
    bytes.length > 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const jpeg =
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  return png || jpeg;
}

// Real pages give many letters in several words. A photo of a face gives a few stray marks.
function looksLikeText(text, language) {
  const asian = ["Mandarin Chinese", "Japanese", "Korean"].includes(language);

  if (asian) {
    const chars = (
      text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []
    ).length;
    return chars >= 4;
  }

  const words = text.match(/[\p{L}\p{M}]{3,}/gu) || [];
  const letters = (text.match(/[\p{L}\p{M}]/gu) || []).length;
  const visible = text.replace(/\s/g, "").length;
  return words.length >= 3 && visible > 0 && letters / visible >= 0.6;
}

app.post("/ocr", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      const tooBig = uploadError.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        error: tooBig
          ? "That photo is too large (max 10 MB)."
          : "The upload failed. Try again.",
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No photo was received." });
    }

    const language = req.body && req.body.language;
    if (!OCR_LANGUAGES[language]) {
      return res.status(400).json({
        error: `Choose one of these languages: ${Object.keys(OCR_LANGUAGES).join(", ")}`,
      });
    }

    if (!looksLikeImage(file.buffer)) {
      return res
        .status(400)
        .json({ error: "Please send a PNG or JPEG photo." });
    }

    try {
      const text = cleanText(await imageToText(file.buffer, language));

      if (text.length < 10 || !looksLikeText(text, language)) {
        return res.status(422).json({
          error:
            "No readable text found. Try a sharper photo of a flat, well-lit, printed page.",
        });
      }

      const truncated = text.length > MAX_CHARS;
      res.json({
        fileName: file.originalname || "photo",
        text: text.slice(0, MAX_CHARS),
        characters: text.length,
        truncated,
      });
    } catch (err) {
      console.error("OCR error:", err);
      const timedOut = err && err.message === "OCR timed out";
      res.status(timedOut ? 504 : 422).json({
        error: timedOut
          ? "Reading the photo took too long. Try a smaller or sharper photo."
          : "Could not read that photo.",
      });
    }
  });
});

// ---------- Books ----------

// Both search routes share the same checks and error handling
function searchRoute(search) {
  return async (req, res) => {
    const title = String(req.query.title || "").trim();
    const language = req.query.language;

    if (title.length < 2 || title.length > 120) {
      return res
        .status(400)
        .json({ error: "Enter a book title (2 to 120 characters)." });
    }
    if (!BOOK_LANGUAGES[language]) {
      return res.status(400).json({
        error: `Choose one of these languages: ${Object.keys(BOOK_LANGUAGES).join(", ")}`,
      });
    }

    try {
      res.json(await search(title, language));
    } catch (err) {
      console.error("Book search error:", err.message);
      const needsSync = err instanceof BookError && err.status === 503;
      res.status(needsSync ? 503 : 502).json({
        error: needsSync
          ? err.message
          : "Book search is unavailable right now. Try again in a moment.",
      });
    }
  };
}

app.get("/books/free", searchRoute(searchFreeBooks));

// Every readable book in a language: /books/browse?language=Mandarin%20Chinese
// Every readable book in a language: /books/browse?language=Mandarin%20Chinese
app.get("/books/browse", (req, res) => {
  const language = req.query.language;
  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({
      error: `Choose one of these languages: ${Object.keys(BOOK_LANGUAGES).join(", ")}`,
    });
  }
  try {
    res.json(browseFreeBooks(language));
  } catch (err) {
    console.error("Browse error:", err.message);
    const needsSync = err instanceof BookError && err.status === 503;
    res.status(needsSync ? 503 : 502).json({
      error: needsSync ? err.message : "Could not list the books right now.",
    });
  }
});

// Details-only results from Open Library: /books/search?title=Candide&language=French
app.get("/books/search", searchRoute(searchDetailBooks));

// Free editions from our local Project Gutenberg catalog: instant

// Wikisource: search /wiki/search?title=Candide&language=French
app.get("/wiki/search", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const language = req.query.language;
  if (title.length < 2 || title.length > 120) {
    return res
      .status(400)
      .json({ error: "Enter a book title (2 to 120 characters)." });
  }
  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({ error: "Choose one of the 20 languages." });
  }
  try {
    res.json(await searchWikisource(title, language));
  } catch (err) {
    console.error("Wikisource search error:", err.message);
    res.status(err instanceof BookError ? err.status : 502).json({
      error: "Wikisource search is unavailable right now.",
    });
  }
});

// Wikisource: one section of a text /wiki/text?language=French&title=...&section=1
app.get("/wiki/text", async (req, res) => {
  const language = req.query.language;
  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({ error: "Choose one of the 20 languages." });
  }
  const section = Number(req.query.section || 1);

  try {
    const book = await loadWikisource(language, req.query.title);
    if (
      !Number.isInteger(section) ||
      section < 1 ||
      section > book.sections.length
    ) {
      return res.status(400).json({ error: "That section does not exist." });
    }
    const text = book.sections[section - 1];
    res.json({
      title: book.title,
      text,
      section,
      sections: book.sections.length,
      characters: text.length,
    });
  } catch (err) {
    console.error("Wikisource text error:", err.message);
    const known =
      err instanceof BookError && [400, 404, 422].includes(err.status);
    res.status(known ? err.status : 502).json({
      error: known
        ? err.message
        : "That text could not be loaded. Try again in a moment.",
    });
  }
});

// A short AI retelling for a book that has no free text
const retellTimes = new Map();
app.post("/books/retell", async (req, res) => {
  const { title, authors, language, level } = req.body || {};
  if (
    typeof title !== "string" ||
    title.trim().length < 2 ||
    title.length > 150
  ) {
    return res.status(400).json({ error: "A book title is required." });
  }
  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({ error: "Choose one of the 20 languages." });
  }
  const chosen = ["Beginner", "Intermediate", "Advanced"].includes(level)
    ? level
    : "Beginner";

  // Each retelling uses AI tokens: 20 per hour for each address
  const now = Date.now();
  const recent = (retellTimes.get(req.ip) || []).filter(
    (t) => now - t < 60 * 60 * 1000,
  );
  if (recent.length >= 20) {
    return res.status(429).json({
      error: "That is a lot of retellings for one hour. Try again later.",
    });
  }
  recent.push(now);
  retellTimes.set(req.ip, recent);

  try {
    const text = await retellBook({
      title: title.replace(/["\r\n]+/g, " ").trim(),
      authors:
        typeof authors === "string"
          ? authors.replace(/["\r\n]+/g, " ").slice(0, 100)
          : "",
      language,
      level: chosen,
    });
    res.json({ title: title.trim(), text });
  } catch (err) {
    console.error("Retell error:", err.message);
    const busy = err.message.startsWith("429");
    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy right now. Try again in a few minutes."
        : "The AI could not write that text.",
    });
  }
});

// One section of a free book: /books/4650/text?section=1
app.get("/books/:id/text", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Bad book number." });
  }
  const section = Number(req.query.section || 1);

  try {
    const book = await loadBook(Number(req.params.id));

    if (
      !Number.isInteger(section) ||
      section < 1 ||
      section > book.sections.length
    ) {
      return res.status(400).json({ error: "That section does not exist." });
    }

    const text = book.sections[section - 1];
    res.json({
      title: book.title,
      text,
      section,
      sections: book.sections.length,
      characters: text.length,
    });
  } catch (err) {
    console.error("Book text error:", err.message);
    const status = err instanceof BookError ? err.status : 502;
    const message =
      status === 404
        ? "That book is not available to read here."
        : "The book could not be loaded. Try again in a moment.";
    res.status(status).json({ error: message });
  }
});

app.use("/sleep", require("./sleep"));
// ---------- Fallbacks (keep these last) ----------

// An unknown address gets a clear JSON answer, not an HTML page
app.use((req, res) => {
  res.status(404).json({ error: `No such route: ${req.method} ${req.path}` });
});

// Any error nobody handled becomes a JSON answer, and the details stay in this terminal
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(err.status || 500)
    .json({ error: "Something went wrong on the server." });
});

const catalogSize = db.prepare("SELECT COUNT(*) AS n FROM catalog").get().n;
if (catalogSize === 0) {
  console.warn(
    "Free-book catalog is empty. Run: node --env-file=.env sync-catalog.js",
  );
}

app.post("/chat/test", async (req, res) => {
  const { language, level, nativeLanguage, history } = req.body || {};
  const { LANGUAGES } = require("./curriculum");

  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({ error: "Choose one of the 20 languages." });
  }
  if (
    !Array.isArray(history) ||
    history.length > 40 ||
    !history.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= 800,
    )
  ) {
    return res.status(400).json({ error: "The conversation is not valid." });
  }
  if (history.filter((m) => m.role === "user").length < 3) {
    return res
      .status(400)
      .json({ error: "Say a few more things first, then take the test." });
  }

  try {
    const questions = await chatTest({
      language,
      level: ["Beginner", "Intermediate", "Advanced"].includes(level)
        ? level
        : "Beginner",
      nativeLanguage:
        typeof nativeLanguage === "string" ? nativeLanguage : "English",
      history,
    });
    res.json({ questions });
  } catch (err) {
    console.error("Chat test error:", String(err.message).slice(0, 300));
    const busy = String(err.message).startsWith("429");
    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy. Try again in a minute."
        : "Could not make the test. Try again.",
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
