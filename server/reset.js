const db = require("./database");

const lessonId = process.argv[2];
if (!lessonId) {
  console.log("Usage: node reset.js <lessonId>");
  process.exit(1);
}

db.exec("BEGIN");
try {
  db.prepare("DELETE FROM words WHERE lesson_id = ?").run(lessonId);
  db.prepare("UPDATE lessons SET status = 'empty' WHERE id = ?").run(lessonId);
  db.exec("COMMIT");
  console.log(`Lesson ${lessonId} reset. Run generate.js to fill it again.`);
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}
