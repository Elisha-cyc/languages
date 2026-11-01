"use strict";

const supabase = require("./supabase");

async function main() {
  const { data, error } = await supabase.rpc("catalog_language_counts");
  if (error) throw new Error(error.message);

  console.log("Books in the catalog, by language code:");
  for (const row of data) {
    console.log(`${String(row.language).padEnd(8)} ${row.n}`);
  }
  if (data.length === 0) {
    console.log(
      "The catalog is empty. Run: node --env-file=.env sync-catalog.js",
    );
  }
}

main().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
