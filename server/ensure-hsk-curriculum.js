"use strict";

const { unitSpecs, LESSONS_PER_UNIT } = require("./hsk");

let inFlight;

async function ensureHskCurriculum(supabase) {
  if (inFlight) return inFlight;
  inFlight = seed(supabase).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function seed(supabase) {
  const [{ data: language, error: languageError }, { data: levels, error: levelsError }] = await Promise.all([
    supabase.from("languages").select("id").eq("name", "Mandarin Chinese").maybeSingle(),
    supabase.from("levels").select("id, name").in("name", ["Beginner", "Intermediate", "Advanced"]),
  ]);
  if (languageError) throw languageError;
  if (levelsError) throw levelsError;
  if (!language || levels.length !== 3) throw new Error("Chinese HSK curriculum requires the three standard levels.");

  const levelByName = new Map(levels.map((row) => [row.name, row.id]));
  for (const levelName of ["Beginner", "Intermediate", "Advanced"]) {
    const specs = unitSpecs(levelName);
    const { data: existing, error: existingError } = await supabase
      .from("units")
      .select("id, title, position")
      .eq("language_id", language.id)
      .eq("level_id", levelByName.get(levelName))
      .like("title", "HSK % · Vocabulary %");
    if (existingError) throw existingError;
    const existingByTitle = new Map((existing || []).map((row) => [row.title, row]));
    let nextPosition = Math.max(0, ...(existing || []).map((row) => row.position || 0));
    const missing = specs.filter((spec) => !existingByTitle.has(spec.title));
    if (missing.length) {
      const rows = missing.map((spec) => ({
        language_id: language.id,
        level_id: levelByName.get(levelName),
        title: spec.title,
        position: ++nextPosition,
      }));
      const { data: inserted, error: insertError } = await supabase
        .from("units")
        .insert(rows)
        .select("id, title, position");
      if (insertError) throw insertError;
      for (const row of inserted || []) existingByTitle.set(row.title, row);
    }

    const units = specs.map((spec) => existingByTitle.get(spec.title)).filter(Boolean);
    if (units.length !== specs.length) throw new Error(`Could not create all ${levelName} HSK units.`);
    const unitIds = units.map((row) => row.id);
    const { data: lessons, error: lessonError } = await supabase
      .from("lessons")
      .select("id, unit_id, position")
      .in("unit_id", unitIds);
    if (lessonError) throw lessonError;
    const present = new Set((lessons || []).map((row) => `${row.unit_id}:${row.position}`));
    const unitIndex = new Map(units.map((row, i) => [row.id, i]));
    const lessonRows = [];
    for (const unit of units) {
      const spec = specs[unitIndex.get(unit.id)];
      for (let position = 1; position <= LESSONS_PER_UNIT; position++) {
        const hasVocabulary = spec.words.slice((position - 1) * 10, position * 10).length > 0;
        if (hasVocabulary && !present.has(`${unit.id}:${position}`)) {
          lessonRows.push({ unit_id: unit.id, title: `${spec.title} · ${position}`, position, status: "empty" });
        }
      }
    }
    for (let offset = 0; offset < lessonRows.length; offset += 500) {
      const { error } = await supabase.from("lessons").insert(lessonRows.slice(offset, offset + 500));
      if (error) throw error;
    }
  }
}

module.exports = { ensureHskCurriculum };
