const db = require("./database");

const rows = db
  .prepare(
    "SELECT language, COUNT(*) AS n FROM catalog GROUP BY language ORDER BY n DESC",
  )
  .all();

console.log("Books in the local catalog, by language code:");
for (const row of rows) console.log(`${row.language.padEnd(8)} ${row.n}`);
if (rows.length === 0)
  console.log(
    "The catalog is empty. Run: node --env-file=.env sync-catalog.js",
  );
