"use strict";

const supabase = require("./supabase");

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const [language, level] = args.filter((arg) => arg !== "--yes");

if (!language || !level) {
  console.log(
    "Usage: node --env-file=.env reset-lessons.js <Language> <Level> [--yes]",
  );
  console.log(
    "Example: node --env-file=.env reset-lessons.js French Beginner --yes",
  );
  process.exit(1);
}

async function main() {
  // Only lessons that are still in the old single-word format
  const { data, error } = await supabase
    .from("lessons")
    .select("id, units!inner (languages!inner (name), levels!inner (name))")
    .eq("format", "words")
    .eq("status", "ready")
    .eq("units.languages.name", language)
    .eq("units.levels.name", level)
    .limit(1000);
  if (error) throw new Error(error.message);

  const ids = data.map((row) => row.id);

  if (ids.length === 0) {
    console.log(
      `Nothing to reset: no single-word ${language} ${level} lessons.`,
    );
    return;
  }

  if (!confirmed) {
    console.log(
      `This will empty ${ids.length} ${language} ${level} lessons, deleting their words`,
    );
    console.log(
      "and the progress users made on them. They can then be regenerated as sentences.",
    );
    console.log("To go ahead, run the same command with --yes");
    return;
  }

  const { error: resetError } = await supabase.rpc("reset_lessons", {
    p_ids: ids,
    p_delete_progress: true,
  });
  if (resetError) throw new Error(resetError.message);

  console.log(
    `Reset ${ids.length} lessons. Now run: node --env-file=.env generate.js ${language} ${level}`,
  );
}

main().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
