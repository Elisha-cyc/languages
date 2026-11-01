"use strict";

const supabase = require("./supabase");
const { LANGUAGES } = require("./curriculum");

async function main() {
  const { data: rows, error } = await supabase.rpc("lesson_status_counts");
  if (error) throw new Error(error.message);

  const inDatabase = new Set(rows.map((r) => r.language));
  for (const name of LANGUAGES) {
    const mine = rows.filter((r) => r.language === name);
    const ready = (mine.find((r) => r.status === "ready") || {}).n || 0;
    const empty = (mine.find((r) => r.status === "empty") || {}).n || 0;
    console.log(
      `${name.padEnd(18)} ready: ${ready}  empty: ${empty}${inDatabase.has(name) ? "" : "  <- NOT IN DATABASE"}`,
    );
  }
}

main().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
