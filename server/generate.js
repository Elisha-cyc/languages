const db = require("./database");
const { generateLesson } = require("./ai");
const { PRONUNCIATION_GUIDE } = require("./curriculum");

const [language, level] = process.argv.slice(2);
if (!language || !level) {
  console.log("Usage: node --env-file=.env generate.js <Language> <Level>");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pending = db
  .prepare(
    `SELECT lessons.id, lessons.position, units.id AS unit_id,
            units.title AS unit, levels.cefr
     FROM lessons
     JOIN units ON lessons.unit_id = units.id
     JOIN languages ON units.language_id = languages.id
     JOIN levels ON units.level_id = levels.id
     WHERE languages.name = ? AND levels.name = ? AND lessons.status = 'empty'
     ORDER BY units.position, lessons.position`,
  )
  .all(language, level);

function saveLesson(lessonId, title, words) {
  db.exec("BEGIN");
  try {
    db.prepare(
      "UPDATE lessons SET title = ?, status = 'ready' WHERE id = ?",
    ).run(title, lessonId);
    const addWord = db.prepare(
      "INSERT INTO words (lesson_id, word, meaning, pronunciation) VALUES (?, ?, ?, ?)",
    );
    for (const w of words) {
      addWord.run(lessonId, w.word, w.meaning, w.pronunciation || null);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

async function generateWithRetry(args) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await generateLesson(args);
    } catch (err) {
      const dailyLimit = err.message.includes("tokens per day");
      const rateLimited = err.message.startsWith("429") && !dailyLimit;
      const networkError = err.message === "fetch failed";
      const badAnswer =
        err instanceof SyntaxError || err.message.startsWith("The AI");

      if (
        dailyLimit ||
        attempt === MAX_ATTEMPTS ||
        !(rateLimited || networkError || badAnswer)
      ) {
        throw err;
      }

      const waitSeconds = rateLimited ? 30 : networkError ? 10 : 2;
      const reason = rateLimited
        ? "rate limit"
        : networkError
          ? "network"
          : "bad answer";
      console.log(
        `  retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitSeconds}s (${reason})`,
      );
      await sleep(waitSeconds * 1000);
    }
  }
}

async function main() {
  console.log(`${pending.length} ${language} ${level} lessons to generate...`);
  let done = 0;

  for (const lesson of pending) {
    try {
      const previousTitles = db
        .prepare(
          "SELECT title FROM lessons WHERE unit_id = ? AND status = 'ready' ORDER BY position",
        )
        .all(lesson.unit_id)
        .map((row) => row.title);

      const result = await generateWithRetry({
        language,
        nativeLanguage: "English",
        level,
        cefr: lesson.cefr,
        unit: lesson.unit,
        number: lesson.position,
        total: 5,
        previousTitles,
        pronunciationGuide: PRONUNCIATION_GUIDE[language],
      });

      function saveLesson(lessonId, title, words) {
        db.exec("BEGIN");
        try {
          db.prepare(
            "UPDATE lessons SET title = ?, status = 'ready', format = 'sentences' WHERE id = ?",
          ).run(title, lessonId);
          const addWord = db.prepare(
            "INSERT INTO words (lesson_id, word, meaning, pronunciation, focus) VALUES (?, ?, ?, ?, ?)",
          );
          for (const w of words) {
            addWord.run(
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
      done++;
      console.log(`OK  ${lesson.unit} #${lesson.position}: ${result.title}`);
    } catch (err) {
      console.error(
        `FAIL ${lesson.unit} #${lesson.position}: ${err.message.slice(0, 200)}`,
      );
      if (err.message.includes("tokens per day")) {
        console.error("Daily token limit reached. Try again tomorrow.");
        process.exitCode = 2;
        break;
      }
      if (err.message.startsWith("429")) {
        console.error("Still rate limited. Try again in a while.");
        process.exitCode = 2;
        break;
      }
    }

    await sleep(4000);
  }

  console.log(`Finished: ${done} lessons generated.`);
}

main();
