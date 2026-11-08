const express = require("express");
const cors = require("cors");
const multer = require("multer");

const { askTutor, MODES, retellBook, chatTest } = require("./ai");
const supabase = require("./supabase");
const { imageToText, OCR_LANGUAGES } = require("./ocr");
const { ensureLesson } = require("./lessonmaker");
const { isChinese, courseForLevel, lessonPlan } = require("./hsk");
const { ensureHskCurriculum } = require("./ensure-hsk-curriculum");

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

// ---------- Heavy libraries load only when a file is uploaded ----------
// (pdf-parse needs graphics packages that do not exist on Vercel; loading it
// at startup would crash the whole server)

function loadPdfParse() {
  const { PDFParse } = require("pdf-parse");
  if (typeof PDFParse !== "function") {
    throw new Error(
      "pdf-parse is an old version. Run: npm install pdf-parse@latest",
    );
  }
  return PDFParse;
}

// ---------- App setup ----------

const app = express();

// On Vercel every request arrives through a proxy. Without this, the server
// sees the proxy's address as everybody's address, so the sign-up and login
// limits would count ALL users together and lock new people out.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const { router: authRouter, requireAuth } = require("./auth");
const { localize } = require("./translate");

app.use("/auth", authRouter);
app.use("/admin", require("./admin")); // private owner page, has its own password
app.use(requireAuth);

app.get("/", (req, res) => {
  res.send("LinguaApp server is running");
});

app.use("/chat", require("./chat"));
app.use("/hanzi", require("./hanzi"));
app.use("/speech", require("./speech"));
app.use("/course", require("./course"));
app.use("/placement", require("./placement"));

// ---------- Curriculum ----------

// Get all available languages
app.get("/languages", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select("name")
      .order("name");

    if (error) throw error;

    res.json(data.map((row) => ({ name: row.name, ready: true })));
  } catch (err) {
    next(err);
  }
});

// Get all levels
app.get("/levels", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("levels")
      .select("id, name, cefr")
      .order("position");

    if (error) throw error;

    const chinese = isChinese(req.query.language);
    res.json(data.map((level) => ({
      ...level,
      ...(chinese ? {
        curriculum: { Beginner: "HSK 1", Intermediate: "HSK 2–3", Advanced: "HSK 4–6" }[level.name],
      } : {}),
    })));
  } catch (err) {
    next(err);
  }
});

// Full HSK course map for the selected app level.
app.get("/hsk/course", (req, res) => {
  if (!isChinese(req.query.language)) {
    return res.json(null);
  }
  const course = courseForLevel(req.query.level);
  if (!course) return res.status(400).json({ error: "Unknown course level." });
  res.json(course);
});

// Get units for a language and level
// Example: /units?language=Arabic&level=Beginner&user=1
app.get("/units", async (req, res, next) => {
  try {
    const { language, level } = req.query;

    if (!language || !level) {
      return res.status(400).json({
        error: "language and level are required",
      });
    }

    const userId = req.user.id;

    if (isChinese(language)) await ensureHskCurriculum(supabase);

    const { data: matchingUnits, error: unitsError } = await supabase
      .from("units")
      .select("id, title, position, languages!inner(name), levels!inner(name)")
      .eq("languages.name", language)
      .eq("levels.name", level)
      .order("position");

    if (unitsError) throw unitsError;

    const units = isChinese(language)
      ? (matchingUnits || []).filter((unit) => /^HSK [1-6] · Vocabulary \d+$/.test(unit.title))
      : matchingUnits || [];
    const unitIds = units.map((unit) => unit.id);
    let completedLessonIds = new Set();

    if (unitIds.length > 0) {
      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("id, unit_id")
        .in("unit_id", unitIds);

      if (lessonsError) throw lessonsError;

      const lessonIds = (lessons || []).map((lesson) => lesson.id);

      if (lessonIds.length > 0) {
        const { data: progress, error: progressError } = await supabase
          .from("progress")
          .select("lesson_id")
          .eq("user_id", userId)
          .in("lesson_id", lessonIds);

        if (progressError) throw progressError;

        completedLessonIds = new Set(
          (progress || []).map((item) => item.lesson_id),
        );
      }

      const lessonsByUnit = new Map();

      for (const lesson of lessons || []) {
        if (!lessonsByUnit.has(lesson.unit_id)) {
          lessonsByUnit.set(lesson.unit_id, []);
        }
        lessonsByUnit.get(lesson.unit_id).push(lesson.id);
      }

      let previousComplete = true;

      const result = units.map((unit) => {
        const unitLessons = lessonsByUnit.get(unit.id) || [];
        const total = unitLessons.length;
        const done = unitLessons.filter((id) =>
          completedLessonIds.has(id),
        ).length;

        const locked = !previousComplete;
        previousComplete = done >= total;

        return {
          id: unit.id,
          title: unit.title,
          done,
          total,
          locked,
        };
      });

      return res.json(
        await localize("unit_title", result, "title", req.user?.nativeLanguage),
      );
    }

    return res.json([]);
  } catch (err) {
    next(err);
  }
});

// Get lessons for a unit
// Example: /lessons?unit=1&user=1
app.get("/lessons", async (req, res, next) => {
  try {
    const { unit } = req.query;

    if (!unit) {
      return res.status(400).json({ error: "unit is required" });
    }

    const unitId = Number(unit);

    if (!Number.isInteger(unitId) || unitId <= 0) {
      return res.status(400).json({ error: "unit must be a positive integer" });
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, title, position")
      .eq("unit_id", unitId)
      .order("position");

    if (lessonsError) throw lessonsError;

    const lessonIds = (lessons || []).map((lesson) => lesson.id);
    let completedIds = new Set();

    if (lessonIds.length > 0) {
      const { data: progress, error: progressError } = await supabase
        .from("progress")
        .select("lesson_id")
        .eq("user_id", req.user.id)
        .in("lesson_id", lessonIds);

      if (progressError) throw progressError;

      completedIds = new Set((progress || []).map((item) => item.lesson_id));
    }

    const items = (lessons || []).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      completed: completedIds.has(lesson.id),
    }));

    res.json(
      await localize("lesson_title", items, "title", req.user?.nativeLanguage),
    );
  } catch (err) {
    next(err);
  }
});

// Get words for a lesson, generating the lesson if necessary
app.get("/lessons/:id/words", async (req, res) => {
  const lessonId = Number(req.params.id);

  if (!Number.isInteger(lessonId) || lessonId < 1) {
    return res.status(400).json({ error: "Invalid lesson ID." });
  }

  try {
    await ensureLesson(lessonId);

    const { data: words, error: wordsError } = await supabase
      .from("words")
      .select("id, word, meaning, pronunciation, focus")
      .eq("lesson_id", lessonId)
      .order("id");

    if (wordsError) {
      throw new Error(`Could not load lesson words: ${wordsError.message}`);
    }

    const localizedWords = await localize(
      "word_meaning", words, "meaning", req.user?.nativeLanguage,
    );
    const { data: courseLesson, error: courseError } = await supabase
      .from("lessons")
      .select("position, units!inner(title, levels!inner(name), languages!inner(name))")
      .eq("id", lessonId)
      .maybeSingle();
    if (courseError) throw new Error(`Could not load lesson course: ${courseError.message}`);

    const unit = courseLesson?.units;
    if (isChinese(unit?.languages?.name)) {
      const plan = lessonPlan(unit.title, Number(courseLesson.position), unit.levels.name);
      return res.json({
        cards: localizedWords,
        guide: {
          standard: courseForLevel(unit.levels.name)?.standard,
          grade: `HSK ${plan?.grade}`,
          topic: plan?.topic,
          grammar: plan?.grammar,
          outcomes: plan?.outcomes || [],
          writing: plan?.writing,
          exam: plan?.exam,
        },
      });
    }
    res.json(localizedWords);
  } catch (err) {
    console.error("Lesson error:", err.message);

    if (err.message === "Lesson not found") {
      return res.status(404).json({
        error: "That lesson does not exist.",
      });
    }

    const busy = String(err.message).startsWith("429");

    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy right now. Try again in a few minutes."
        : "Could not prepare this lesson. Try again.",
    });
  }
});

// Explicitly generate a lesson
app.post("/lessons/:id/generate", async (req, res) => {
  const lessonId = Number(req.params.id);

  if (!Number.isInteger(lessonId) || lessonId < 1) {
    return res.status(400).json({ error: "Invalid lesson ID." });
  }

  try {
    const status = await ensureLesson(lessonId);
    res.json({ status });
  } catch (err) {
    console.error("Generate error:", err.message);

    const busy = String(err.message).startsWith("429");

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

// Get quiz questions without revealing the answers

// Get quiz questions without revealing the answers
app.get("/lessons/:id/quiz", async (req, res, next) => {
  try {
    const lessonId = Number(req.params.id);

    if (!Number.isInteger(lessonId) || lessonId < 1) {
      return res.status(400).json({ error: "Invalid lesson ID." });
    }

    const { data: rawWords, error } = await supabase
      .from("words")
      .select("id, word, meaning, pronunciation")
      .eq("lesson_id", lessonId)
      .order("id");

    if (error) {
      throw new Error(`Could not load quiz words: ${error.message}`);
    }

    const words = await localize(
      "word_meaning",
      rawWords || [],
      "meaning",
      req.user?.nativeLanguage,
    );

    const meanings = [...new Set(words.map((word) => word.meaning))];

    if (meanings.length < 2) {
      return res.json([]);
    }

    const questions = shuffle(words).map((word) => {
      const wrongAnswers = shuffle(
        meanings.filter((meaning) => meaning !== word.meaning),
      ).slice(0, 3);

      return {
        wordId: word.id,
        prompt: word.word,
        pronunciation: word.pronunciation,
        options: shuffle([word.meaning, ...wrongAnswers]),
      };
    });

    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// Grade a quiz and record progress when passed
app.post("/lessons/:id/quiz", async (req, res, next) => {
  try {
    const lessonId = Number(req.params.id);
    const { answers } = req.body || {};
    const userId = req.user?.id;

    if (!Number.isInteger(lessonId) || lessonId < 1) {
      return res.status(400).json({ error: "Invalid lesson ID." });
    }

    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: "answers must be an array",
      });
    }

    const { data: rawWords, error: wordsError } = await supabase
      .from("words")
      .select("id, word, meaning")
      .eq("lesson_id", lessonId)
      .order("id");

    if (wordsError) {
      throw new Error(`Could not load quiz words: ${wordsError.message}`);
    }

    // The quiz was shown in the user's language; grade in that same language
    const words = await localize(
      "word_meaning",
      rawWords || [],
      "meaning",
      req.user?.nativeLanguage,
    );
    const originalMeaning = new Map(
      (rawWords || []).map((word) => [word.id, word.meaning]),
    );

    if (!words || words.length === 0) {
      return res.status(404).json({
        error: "That lesson does not exist or has no quiz words.",
      });
    }

    const given = new Map();

    for (const answer of answers) {
      if (
        !answer ||
        !Number.isInteger(answer.wordId) ||
        typeof answer.answer !== "string" ||
        given.has(answer.wordId)
      ) {
        return res.status(400).json({
          error: "Invalid or duplicate answer.",
        });
      }

      given.set(answer.wordId, answer.answer);
    }

    if (
      given.size !== words.length ||
      !words.every((word) => given.has(word.id))
    ) {
      return res.status(400).json({
        error: "Answer every question exactly once.",
      });
    }

    const results = words.map((word) => ({
      wordId: word.id,
      word: word.word,
      // Also accept the original text, in case the translation was unavailable
      // when the quiz was shown
      correct:
        given.get(word.id) === word.meaning ||
        given.get(word.id) === originalMeaning.get(word.id),
      correctAnswer: word.meaning,
    }));

    const score = results.filter((result) => result.correct).length;
    const total = words.length;
    const passed = score / total >= PASS_MARK;

    if (passed) {
      const { data: existing, error: readError } = await supabase
        .from("progress")
        .select("user_id")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .limit(1);

      if (readError) {
        throw new Error(`Could not check progress: ${readError.message}`);
      }

      if (!existing || existing.length === 0) {
        const { error: insertError } = await supabase.from("progress").insert({
          user_id: userId,
          lesson_id: lessonId,
          completed_at: new Date().toISOString(),
        });

        if (insertError) {
          throw new Error(`Could not save progress: ${insertError.message}`);
        }
      }
    }

    res.json({ score, total, passed, results });
  } catch (err) {
    next(err);
  }
});

// ---------- AI tutor ----------

app.post("/ai/lesson", async (req, res) => {
  const { text, mode, targetLanguage, nativeLanguage, level } = req.body || {};

  if (!text || !mode || !targetLanguage || !nativeLanguage) {
    return res.status(400).json({
      error: "text, mode, targetLanguage and nativeLanguage are required",
    });
  }

  if (!MODES[mode]) {
    return res.status(400).json({
      error: `mode must be one of: ${Object.keys(MODES).join(", ")}`,
    });
  }

  if (typeof text !== "string") {
    return res.status(400).json({
      error: "text must be a string",
    });
  }

  if (text.length > 4000) {
    return res.status(400).json({
      error: "Text is too long (max 4000 characters)",
    });
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

    if (String(err.message).startsWith("429")) {
      return res.status(429).json({
        error:
          "The AI tutor is very busy right now. Please try again in a few minutes.",
      });
    }

    res.status(500).json({
      error: "The AI tutor is unavailable right now",
    });
  }
});

// ---------- File import ----------

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 60000;

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
  const parser = new (loadPdfParse())({
    data: new Uint8Array(bytes),
  });

  try {
    const result = await parser.getText();

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
      return res.status(400).json({
        error: "No file was received.",
      });
    }

    const name = file.originalname.toLowerCase();
    const bytes = file.buffer;

    try {
      let text = "";

      if (name.endsWith(".pdf")) {
        if (bytes.slice(0, 4).toString() !== "%PDF") {
          return res.status(400).json({
            error: "That does not look like a real PDF.",
          });
        }

        text = await pdfToText(bytes);
      } else if (name.endsWith(".docx")) {
        if (bytes.slice(0, 2).toString() !== "PK") {
          return res.status(400).json({
            error: "That does not look like a real Word file.",
          });
        }

        text = (await require("mammoth").extractRawText({ buffer: bytes }))
          .value;
      } else if (name.endsWith(".txt")) {
        text = bytes.toString("utf8");
      } else if (name.endsWith(".doc")) {
        return res.status(400).json({
          error:
            "Old .doc files are not supported. Save it as .docx or PDF and try again.",
        });
      } else {
        return res.status(400).json({
          error: "Please choose a PDF, .docx or .txt file.",
        });
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

      res.status(422).json({
        error: "Could not read that file.",
      });
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
      return res.status(400).json({
        error: "No photo was received.",
      });
    }

    const language = req.body && req.body.language;

    if (!OCR_LANGUAGES[language]) {
      return res.status(400).json({
        error: `Choose one of these languages: ${Object.keys(OCR_LANGUAGES).join(", ")}`,
      });
    }

    if (!looksLikeImage(file.buffer)) {
      return res.status(400).json({
        error: "Please send a PNG or JPEG photo.",
      });
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

function searchRoute(search) {
  return async (req, res) => {
    const title = String(req.query.title || "").trim();
    const language = req.query.language;

    if (title.length < 2 || title.length > 120) {
      return res.status(400).json({
        error: "Enter a book title (2 to 120 characters).",
      });
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

// Search free books
app.get("/books/free", searchRoute(searchFreeBooks));

// Browse books in a language
app.get("/books/browse", async (req, res, next) => {
  const language = req.query.language;

  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({
      error: `Choose one of these languages: ${Object.keys(BOOK_LANGUAGES).join(", ")}`,
    });
  }

  try {
    res.json(await browseFreeBooks(language));
  } catch (err) {
    console.error("Browse error:", err.message);

    const needsSync = err instanceof BookError && err.status === 503;

    res.status(needsSync ? 503 : 502).json({
      error: needsSync ? err.message : "Could not list the books right now.",
    });
  }
});

// Search book details
app.get("/books/search", searchRoute(searchDetailBooks));

// Search Wikisource
app.get("/wiki/search", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const language = req.query.language;

  if (title.length < 2 || title.length > 120) {
    return res.status(400).json({
      error: "Enter a book title (2 to 120 characters).",
    });
  }

  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({
      error: "Choose one of the 20 languages.",
    });
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

// Load a section of a Wikisource book
app.get("/wiki/text", async (req, res) => {
  const language = req.query.language;

  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({
      error: "Choose one of the 20 languages.",
    });
  }

  const section = Number(req.query.section || 1);

  try {
    const book = await loadWikisource(language, req.query.title);

    if (
      !Number.isInteger(section) ||
      section < 1 ||
      section > book.sections.length
    ) {
      return res.status(400).json({
        error: "That section does not exist.",
      });
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

// Retell a book using AI
const retellTimes = new Map();

app.post("/books/retell", async (req, res) => {
  const { title, authors, language, level } = req.body || {};

  if (
    typeof title !== "string" ||
    title.trim().length < 2 ||
    title.length > 150
  ) {
    return res.status(400).json({
      error: "A book title is required.",
    });
  }

  if (!BOOK_LANGUAGES[language]) {
    return res.status(400).json({
      error: "Choose one of the 20 languages.",
    });
  }

  const chosen = ["Beginner", "Intermediate", "Advanced"].includes(level)
    ? level
    : "Beginner";

  // Limit each IP address to 20 retellings per hour.
  const now = Date.now();

  const recent = (retellTimes.get(req.ip) || []).filter(
    (time) => now - time < 60 * 60 * 1000,
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

    res.json({
      title: title.trim(),
      text,
    });
  } catch (err) {
    console.error("Retell error:", err.message);

    const busy = String(err.message).startsWith("429");

    res.status(busy ? 429 : 502).json({
      error: busy
        ? "The AI is busy right now. Try again in a few minutes."
        : "The AI could not write that text.",
    });
  }
});

// Load a section of a free book
app.get("/books/:id/text", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({
      error: "Bad book number.",
    });
  }

  const section = Number(req.query.section || 1);

  try {
    const book = await loadBook(Number(req.params.id));

    if (
      !Number.isInteger(section) ||
      section < 1 ||
      section > book.sections.length
    ) {
      return res.status(400).json({
        error: "That section does not exist.",
      });
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

// ---------- Sleep mode ----------

app.use("/sleep", require("./sleep"));
app.use("/teacher", require("./teacher"));
app.use("/tts", require("./tts"));
app.use("/pronounce", require("./pronounce"));

// ---------- Chat test ----------

app.post("/chat/test", async (req, res) => {
  const { language, level, nativeLanguage, history } = req.body || {};

  const { LANGUAGES } = require("./curriculum");

  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({
      error: "Choose one of the 20 languages.",
    });
  }

  if (
    !Array.isArray(history) ||
    history.length > 40 ||
    !history.every(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length <= 800,
    )
  ) {
    return res.status(400).json({
      error: "The conversation is not valid.",
    });
  }

  if (history.filter((message) => message.role === "user").length < 3) {
    return res.status(400).json({
      error: "Say a few more things first, then take the test.",
    });
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

// ---------- Startup checks ----------

supabase
  .from("catalog")
  .select("id", { count: "exact", head: true })
  .then(({ count, error }) => {
    if (error) {
      console.error("Could not check the free-book catalog:", error.message);
    } else if (!count) {
      console.warn(
        "Free-book catalog is empty. Run: node --env-file=.env sync-catalog.js",
      );
    }
  });

// ---------- Fallback routes (keep these last) ----------

// Unknown route handler
app.use((req, res) => {
  res.status(404).json({
    error: `No such route: ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: "Something went wrong on the server.",
  });
});

// ---------- Start server ----------

// On Vercel the platform runs the app for each request, so we export it.
// Everywhere else (your PC, a VPS) we start a normal server.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LinguaApp server listening on port ${PORT}`);
  });
}

module.exports = app;
