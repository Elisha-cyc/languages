const db = require("./database");
const { ensureLesson } = require("./lessonmaker");
const { LANGUAGES } = require("./curriculum");

const perLanguage = Number(process.argv[2]) || 3; // ready lessons wanted per language
const level = process.argv[3] || "Beginner";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let made = 0;

  for (const language of LANGUAGES) {
    const has = db
      .prepare(
        `SELECT COUNT(*) AS n FROM lessons
         JOIN units ON units.id = lessons.unit_id
         JOIN languages ON languages.id = units.language_id
         JOIN levels ON levels.id = units.level_id
         WHERE languages.name = ? AND levels.name = ? AND lessons.status = 'ready'`,
      )
      .get(language, level).n;

    const need = perLanguage - has;
    if (need <= 0) continue;

    const todo = db
      .prepare(
        `SELECT lessons.id FROM lessons
         JOIN units ON units.id = lessons.unit_id
         JOIN languages ON languages.id = units.language_id
         JOIN levels ON levels.id = units.level_id
         WHERE languages.name = ? AND levels.name = ? AND lessons.status = 'empty'
         ORDER BY units.position, lessons.position
         LIMIT ?`,
      )
      .all(language, level, need);

    for (const { id } of todo) {
      try {
        await ensureLesson(id);
        made++;
        console.log(`OK    ${language} lesson ${id}`);
      } catch (err) {
        console.log(
          `FAIL  ${language} lesson ${id}: ${String(err.message).slice(0, 100)}`,
        );
        if (String(err.message).startsWith("429")) {
          console.log(
            `The free AI limit is reached. Made ${made} lessons. Run the same command again later.`,
          );
          return;
        }
      }
      await pause(1500); // be gentle with the free limit
    }
  }

  console.log(`Done. Made ${made} lessons.`);
}

main();
