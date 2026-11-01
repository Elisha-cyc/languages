"use strict";

const supabase = require("./supabase");

// Lessons of one language + level with the given status ("empty" or "ready"),
// in curriculum order (unit position, then lesson position).
async function findLessons(language, level, status) {
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `id, position, unit_id,
       units!inner (position, title, languages!inner (name), levels!inner (name, cefr))`,
    )
    .eq("status", status)
    .eq("units.languages.name", language)
    .eq("units.levels.name", level)
    .limit(1000);

  if (error) throw new Error(`Could not load lessons: ${error.message}`);

  return data.sort(
    (a, b) => a.units.position - b.units.position || a.position - b.position,
  );
}

module.exports = { findLessons };
