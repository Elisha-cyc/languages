const db = require("./database");
const { LANGUAGES } = require("./curriculum");

const rows = db
  .prepare(
    `SELECT languages.name AS language, lessons.status AS status, COUNT(*) AS n
     FROM lessons
     JOIN units ON units.id = lessons.unit_id
     JOIN languages ON languages.id = units.language_id
     GROUP BY languages.name, lessons.status`,
  )
  .all();

const inDatabase = new Set(rows.map((r) => r.language));
for (const name of LANGUAGES) {
  const mine = rows.filter((r) => r.language === name);
  const ready = (mine.find((r) => r.status === "ready") || {}).n || 0;
  const empty = (mine.find((r) => r.status === "empty") || {}).n || 0;
  console.log(
    `${name.padEnd(18)} ready: ${ready}  empty: ${empty}${inDatabase.has(name) ? "" : "  <- NOT IN DATABASE"}`,
  );
}
