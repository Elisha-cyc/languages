const db = require("./database");

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const [language, level] = args.filter((arg) => arg !== "--yes");

if (!language || !level) {
  console.log("Usage: node reset-lessons.js <Language> <Level> [--yes]");
  console.log("Example: node reset-lessons.js French Beginner --yes");
  process.exit(1);
}

// Only lessons that are still in the old single-word format
const ids = db
  .prepare(
    `SELECT lessons.id
     FROM lessons
     JOIN units ON units.id = lessons.unit_id
     JOIN languages ON languages.id = units.language_id
     JOIN levels ON levels.id = units.level_id
     WHERE languages.name = ? AND levels.name = ?
       AND lessons.format = 'words' AND lessons.status = 'ready'`,
  )
  .all(language, level)
  .map((row) => row.id);

if (ids.length === 0) {
  console.log(`Nothing to reset: no single-word ${language} ${level} lessons.`);
  process.exit(0);
}

if (!confirmed) {
  console.log(
    `This will empty ${ids.length} ${language} ${level} lessons, deleting their words`,
  );
  console.log(
    "and the progress users made on them. They can then be regenerated as sentences.",
  );
  console.log(
    "Copy lingua.db first if you want a backup. To go ahead, run the same command with --yes",
  );
  process.exit(0);
}

const marks = ids.map(() => "?").join(",");

db.exec("BEGIN");
try {
  db.prepare(
    `DELETE FROM sleep_session_words WHERE word_id IN (SELECT id FROM words WHERE lesson_id IN (${marks}))`,
  ).run(...ids);
  db.prepare(`DELETE FROM progress WHERE lesson_id IN (${marks})`).run(...ids);
  db.prepare(`DELETE FROM words WHERE lesson_id IN (${marks})`).run(...ids);
  db.prepare(`UPDATE lessons SET status = 'empty' WHERE id IN (${marks})`).run(
    ...ids,
  );
  db.exec("COMMIT");
  console.log(
    `Reset ${ids.length} lessons. Now run: node --env-file=.env generate.js ${language} ${level}`,
  );
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}
