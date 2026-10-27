const { DatabaseSync } = require("node:sqlite");
const { LEVELS, LANGUAGES, LESSONS_PER_UNIT } = require("./curriculum");

const db = new DatabaseSync("lingua.db");
db.exec("PRAGMA foreign_keys = ON");

// ---------- Tables ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cefr TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER NOT NULL REFERENCES languages(id),
    level_id INTEGER NOT NULL REFERENCES levels(id),
    title TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'empty'
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    word TEXT NOT NULL,
    meaning TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id),
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS catalog (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    language TEXT NOT NULL,
    title_key TEXT NOT NULL,
    search TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS catalog_language ON catalog(language);

  CREATE TABLE IF NOT EXISTS sleep_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    language TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tested_at TEXT,
    cued_score INTEGER,
    cued_total INTEGER,
    uncued_score INTEGER,
    uncued_total INTEGER,
    sleep_quality INTEGER,
    cues_woke_me INTEGER
  );

  CREATE TABLE IF NOT EXISTS sleep_session_words (
    session_id INTEGER NOT NULL REFERENCES sleep_sessions(id),
    word_id INTEGER NOT NULL REFERENCES words(id),
    cued INTEGER NOT NULL,
    PRIMARY KEY (session_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS sleep_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sleep_sessions(id),
    word TEXT NOT NULL,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    cued INTEGER NOT NULL,
    evening_correct INTEGER
  );

  CREATE INDEX IF NOT EXISTS sleep_items_session ON sleep_items(session_id);
`);

// ---------- Migrations: add columns to tables that already exist ----------
function addColumnIfMissing(table, column, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((col) => col.name);

  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("words", "pronunciation", "TEXT");
addColumnIfMissing("sleep_session_words", "evening_correct", "INTEGER");
addColumnIfMissing("sleep_sessions", "cued_evening_score", "INTEGER");
addColumnIfMissing("sleep_sessions", "uncued_evening_score", "INTEGER");
addColumnIfMissing(
  "sleep_sessions",
  "source",
  "TEXT NOT NULL DEFAULT 'lessons'",
);
addColumnIfMissing("sleep_sessions", "label", "TEXT");
addColumnIfMissing("words", "focus", "TEXT");
addColumnIfMissing("lessons", "format", "TEXT NOT NULL DEFAULT 'words'");


// One-time move: older sleep sessions pointed at lesson words.
// New sessions keep their own copy of each word, so words can come from any source.
const legacyRows = db
  .prepare("SELECT COUNT(*) AS n FROM sleep_session_words")
  .get().n;
const itemRows = db.prepare("SELECT COUNT(*) AS n FROM sleep_items").get().n;
if (legacyRows > 0 && itemRows === 0) {
  db.exec(`
    INSERT INTO sleep_items (session_id, word, meaning, pronunciation, cued, evening_correct)
    SELECT sleep_session_words.session_id, words.word, words.meaning, words.pronunciation,
           sleep_session_words.cued, sleep_session_words.evening_correct
    FROM sleep_session_words
    JOIN words ON words.id = sleep_session_words.word_id
  `);
}

// ---------- Starter data ----------
const insertId = (statement, ...values) =>
  Number(statement.run(...values).lastInsertRowid);

function seed() {
  db.exec("BEGIN");
  try {
    if (db.prepare("SELECT COUNT(*) AS n FROM levels").get().n === 0) {
      const addLevel = db.prepare(
        "INSERT INTO levels (name, cefr, position) VALUES (?, ?, ?)",
      );
      LEVELS.forEach((level, i) => addLevel.run(level.name, level.cefr, i + 1));
    }
    const levelRows = db.prepare("SELECT id, name FROM levels").all();

    const addLanguage = db.prepare("INSERT INTO languages (name) VALUES (?)");
    const addUnit = db.prepare(
      "INSERT INTO units (language_id, level_id, title, position) VALUES (?, ?, ?, ?)",
    );
    const addLesson = db.prepare(
      "INSERT INTO lessons (unit_id, title, position) VALUES (?, ?, ?)",
    );

    for (const language of LANGUAGES) {
      if (db.prepare("SELECT id FROM languages WHERE name = ?").get(language)) {
        continue;
      }

      const languageId = insertId(addLanguage, language);
      for (const level of LEVELS) {
        const levelId = levelRows.find((row) => row.name === level.name).id;
        level.units.forEach((theme, unitIndex) => {
          const unitId = insertId(
            addUnit,
            languageId,
            levelId,
            theme,
            unitIndex + 1,
          );
          for (let n = 1; n <= LESSONS_PER_UNIT; n++) {
            addLesson.run(unitId, `${theme} ${n}`, n);
          }
        });
      }
    }

    if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0) {
      db.prepare("INSERT INTO users (name) VALUES (?)").run("Learner");
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

seed();

module.exports = db;
