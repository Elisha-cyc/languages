"use strict";

const { ensureLesson } = require("./lessonmaker");
const { findLessons } = require("./lessonqueries");
const { LANGUAGES } = require("./curriculum");

const perLanguage = Number(process.argv[2]) || 3; // ready lessons wanted per language
const level = process.argv[3] || "Beginner";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let made = 0;

  for (const language of LANGUAGES) {
    const has = (await findLessons(language, level, "ready")).length;
    const need = perLanguage - has;
    if (need <= 0) continue;

    const todo = (await findLessons(language, level, "empty")).slice(0, need);

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

main().catch((err) => {
  console.error("Fill failed:", err.message);
  process.exit(1);
});
